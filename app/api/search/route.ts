import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { generateEmbedding } from "@/app/lib/ollama";
import { getErrorMessage } from "@/app/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query } = body;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Query is required and must be a non-empty string" 
        },
        { status: 400 }
      );
    }

    console.log("Search query:", query);

    // Generate embedding for the search query
    let embedding;
    try {
      embedding = await generateEmbedding(query);
    } catch (embeddingError) {
      console.error("Failed to generate embedding:", embeddingError);
      // Fallback to full-text search if embedding generation fails
      return await performFullTextSearch(query);
    }

    // Convert to pgvector format
    const vector = `[${embedding.join(",")}]`;

    // Search knowledge entries using vector similarity
    const result = await db.query(
      `
      SELECT
        ke.id,
        ke.title,
        ke.slug,
        ke.content,
        ke.summary,
        ke.type,
        ke.category,
        ke.tags,
        ke.created_at,
        ke.updated_at,
        c.name as category_name,
        1 - (ke.embedding <=> $1) as similarity
      FROM knowledge_entries ke
      LEFT JOIN categories c ON ke.category = c.id
      WHERE ke.embedding IS NOT NULL 
        AND 1 - (ke.embedding <=> $1) > 0.3
      ORDER BY ke.embedding <=> $1
      LIMIT 10
      `,
      [vector]
    );

    // Also perform full-text search on title and content as a fallback
    const fullTextResults = await db.query(
      `
      SELECT
        ke.id,
        ke.title,
        ke.slug,
        ke.content,
        ke.summary,
        ke.type,
        ke.category,
        ke.tags,
        ke.created_at,
        ke.updated_at,
        c.name as category_name,
        ts_rank(to_tsvector('english', ke.title || ' ' || ke.content), plainto_tsquery('english', $1)) as rank
      FROM knowledge_entries ke
      LEFT JOIN categories c ON ke.category = c.id
      WHERE to_tsvector('english', ke.title || ' ' || ke.content) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT 5
      `,
      [query]
    );

    // Combine results, removing duplicates by id
    const combinedResults = [...result.rows];
    for (const ftResult of fullTextResults.rows) {
      if (!combinedResults.some(r => r.id === ftResult.id)) {
        combinedResults.push({ ...ftResult, similarity: ftResult.rank * 0.5 }); // Lower weight for text search
      }
    }

    // Sort by similarity/rank
    combinedResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    console.log(`Found ${combinedResults.length} results for query: "${query}"`);

    return NextResponse.json({
      success: true,
      query: query,
      results: combinedResults,
      total: combinedResults.length,
    });

  } catch (error) {
    console.error("Search error:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Search unavailable",
        details: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

// Fallback function for full-text search when embedding fails
async function performFullTextSearch(query: string) {
  try {
    const result = await db.query(
      `
      SELECT
        ke.id,
        ke.title,
        ke.slug,
        ke.content,
        ke.summary,
        ke.type,
        ke.category,
        ke.tags,
        ke.created_at,
        ke.updated_at,
        c.name as category_name,
        ts_rank(to_tsvector('english', ke.title || ' ' || ke.content), plainto_tsquery('english', $1)) as relevance
      FROM knowledge_entries ke
      LEFT JOIN categories c ON ke.category = c.id
      WHERE to_tsvector('english', ke.title || ' ' || ke.content) @@ plainto_tsquery('english', $1)
      ORDER BY relevance DESC
      LIMIT 10
      `,
      [query]
    );

    return NextResponse.json({
      success: true,
      query: query,
      results: result.rows,
      total: result.rows.length,
      fallback: true,
      message: "Using full-text search (embedding generation failed)"
    });
  } catch (fallbackError) {
    console.error("Full-text search also failed:", fallbackError);
    throw fallbackError;
  }
}