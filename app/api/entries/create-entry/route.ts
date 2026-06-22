// app/api/create-entry/route.ts
import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { generateEmbedding } from "@/app/lib/ollama";
import { getErrorMessage } from "@/app/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { 
      title, 
      content, 
      summary, 
      type, 
      category, 
      tags 
    } = body;

    console.log("Received payload:", { title, content, summary, type, category, tags });

    // Validate required fields
    if (!title || !content || !type) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Missing required fields: title, content, and type are required" 
        },
        { status: 400 }
      );
    }

    // Generate slug from title
    const slug = generateSlug(title);
    
    // Check if slug already exists
    const existingEntry = await db.query(
      `SELECT id FROM knowledge_entries WHERE slug = $1`,
      [slug]
    );

    let finalSlug = slug;
    if (existingEntry.rows.length > 0) {
      // Add a timestamp to make slug unique
      finalSlug = `${slug}-${Date.now()}`;
    }

    // Prepare embedding text
    const embeddingText = `
      Title: ${title}
      Type: ${type}
      Category ID: ${category || 'None'}
      Tags: ${tags && tags.length > 0 ? tags.join(', ') : 'None'}
      Summary: ${summary || 'None'}
    `;
    
    console.log("Generating embedding...");
    
    // Generate embedding for the entry
    let vector = null;
    try {
      const embedding = await generateEmbedding(embeddingText);
      vector = `[${embedding.join(",")}]`;
    } catch (embeddingError) {
      console.error("Failed to generate embedding:", embeddingError);
      // Continue without embedding if generation fails
      vector = null;
    }

    // Save knowledge entry
    const result = await db.query(
      `
      INSERT INTO knowledge_entries (
        title, 
        slug, 
        content, 
        summary, 
        type, 
        category, 
        tags, 
        embedding,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, slug, created_at
      `,
      [
        title, 
        finalSlug, 
        content, 
        summary || null, 
        type, 
        category || null, 
        tags && tags.length > 0 ? tags : [], 
        vector
      ]
    );

    const newEntry = result.rows[0];

    console.log("Entry created successfully:", newEntry);

    return NextResponse.json({
      success: true,
      id: newEntry.id,
      slug: newEntry.slug,
      created_at: newEntry.created_at,
      message: "Entry created successfully"
    });

  } catch (error: unknown) {
    console.error("Error creating entry:", error);
    
    const message = getErrorMessage(error);
    const pgError = error as { code?: string; message?: string };

    // Handle specific database errors
    if (pgError.code === '23505') { // PostgreSQL unique violation
      return NextResponse.json(
        {
          success: false,
          error: "An entry with this slug already exists",
          details: message
        },
        { status: 409 }
      );
    }

    if (pgError.code === '23503') { // PostgreSQL foreign key violation
      return NextResponse.json(
        {
          success: false,
          error: "Invalid category ID. The specified category does not exist.",
          details: message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: message
      },
      { status: 500 }
    );
  }
}

// Helper function to generate slug
function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}