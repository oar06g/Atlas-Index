import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { generateEmbedding } from "@/app/lib/ollama";

export async function POST(req: NextRequest) {
  try {
    const { entryId } = await req.json();

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId is required" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      SELECT
        id,
        title,
        summary,
        tags
      FROM knowledge_entries
      WHERE id = $1
      `,
      [entryId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    const entry = result.rows[0];

    const embeddingText = `
      ${entry.title ?? ""}
      
      ${entry.summary ?? ""}
      
      ${(entry.tags ?? []).join(" ")}
    `;

    const embedding = await generateEmbedding(
      embeddingText
    );

    const vector = `[${embedding.join(",")}]`;

    await db.query(
      `
      UPDATE knowledge_entries
      SET embedding = $1
      WHERE id = $2
      `,
      [vector, entryId]
    );

    return NextResponse.json({
      success: true,
      entryId,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate embedding",
      },
      { status: 500 }
    );
  }
}