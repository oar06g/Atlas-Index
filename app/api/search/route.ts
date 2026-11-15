import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getModelSettings } from "@/app/lib/settings";
import { embedTexts, toPgVector } from "@/app/lib/embeddings";
import { getErrorMessage } from "@/app/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Query is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    let vector: string;
    let modelId: string;
    try {
      const settings = await getModelSettings();
      const [embedding] = await embedTexts([query], settings);
      vector = toPgVector(embedding);
      modelId = settings.model_id;
    } catch (embeddingError) {
      console.error("Failed to generate embedding:", embeddingError);
      return await performFullTextSearch(query);
    }

    // Vector search across the chunks produced by the current model. Results
    // are grouped per entry, keeping the best matching chunk's similarity.
    let result;
    try {
      result = await db.query(
        `
        SELECT
          e.id,
          e.title,
          e.slug,
          e.content,
          e.summary,
          e.type,
          e.category_id,
          e.tags,
          e.created_at,
          e.updated_at,
          c.name AS category_name,
          1 - MIN(ce.embedding <=> $1) AS similarity
        FROM entries e
        JOIN entry_chunks ce ON ce.entry_id = e.id
        LEFT JOIN categories c ON e.category_id = c.id
        WHERE ce.model_id = $2
          AND e.status = 'embedded'
        GROUP BY e.id, c.name
        HAVING 1 - MIN(ce.embedding <=> $1) > 0.3
        ORDER BY MIN(ce.embedding <=> $1) ASC
        LIMIT 10
        `,
        [vector, modelId]
      );
    } catch (vectorError) {
      // Stored vectors may have been produced with different dimensions.
      console.error("Vector search failed, falling back to full-text:", vectorError);
      return await performFullTextSearch(query);
    }

    const fullTextResults = await db.query(
      `
      SELECT
        e.id,
        e.title,
        e.slug,
        e.content,
        e.summary,
        e.type,
        e.category_id,
        e.tags,
        e.created_at,
        e.updated_at,
        c.name AS category_name,
        ts_rank(
          to_tsvector('english', e.title || ' ' || e.content),
          plainto_tsquery('english', $1)
        ) AS rank
      FROM entries e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE to_tsvector('english', e.title || ' ' || e.content)
            @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT 5
      `,
      [query]
    );

    const combinedResults = [...result.rows];
    for (const fullTextResult of fullTextResults.rows) {
      if (!combinedResults.some((row) => row.id === fullTextResult.id)) {
        combinedResults.push({
          ...fullTextResult,
          similarity: fullTextResult.rank * 0.5,
        });
      }
    }

    combinedResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return NextResponse.json({
      success: true,
      query,
      model_id: modelId,
      results: combinedResults,
      total: combinedResults.length,
    });
  } catch (error) {
    console.error("Search error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Search unavailable",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

async function performFullTextSearch(query: string) {
  const result = await db.query(
    `
    SELECT
      e.id,
      e.title,
      e.slug,
      e.content,
      e.summary,
      e.type,
      e.category_id,
      e.tags,
      e.created_at,
      e.updated_at,
      c.name AS category_name,
      ts_rank(
        to_tsvector('english', e.title || ' ' || e.content),
        plainto_tsquery('english', $1)
      ) AS relevance
    FROM entries e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE to_tsvector('english', e.title || ' ' || e.content)
          @@ plainto_tsquery('english', $1)
    ORDER BY relevance DESC
    LIMIT 10
    `,
    [query]
  );

  return NextResponse.json({
    success: true,
    query,
    results: result.rows,
    total: result.rows.length,
    fallback: true,
    message: "Using full-text search (embedding generation failed)",
  });
}
