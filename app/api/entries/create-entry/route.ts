// app/api/entries/create-entry/route.ts
import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { chunkText } from "@/app/lib/embeddings";
import { enqueueEntry } from "@/app/lib/embedding-queue";
import { getErrorMessage } from "@/app/lib/errors";

const ENTRY_TYPES = ["manual", "file", "url"] as const;
type EntryType = (typeof ENTRY_TYPES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { title, content, summary, tags } = body;
    const type: EntryType = body.type ?? "manual";
    // `category` is accepted for backwards compatibility with older clients.
    const categoryId: string | null = body.category_id ?? body.category ?? null;

    if (!title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: title and content are required",
        },
        { status: 400 }
      );
    }

    if (!ENTRY_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid type. Allowed values: ${ENTRY_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Chunking is cheap and lets us store the total up front so the UI can
    // display accurate progress while the queue works.
    const chunks = chunkText(content);
    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: "Content is empty" },
        { status: 400 }
      );
    }

    const baseSlug = generateSlug(title) || `entry-${Date.now()}`;

    const existingEntry = await db.query(
      `SELECT id FROM entries WHERE slug = $1`,
      [baseSlug]
    );
    const finalSlug =
      existingEntry.rows.length > 0
        ? `${baseSlug}-${Date.now()}`
        : baseSlug;

    const entryTags: string[] = Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === "string")
      : [];

    // Insert immediately as `pending` and let the background queue handle the
    // embedding. This keeps the HTTP request fast for very large entries.
    const result = await db.query(
      `INSERT INTO entries (
         title,
         slug,
         content,
         summary,
         type,
         status,
         category_id,
         tags,
         chunks_total,
         chunks_done
       ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, 0)
       RETURNING id, slug, status, created_at`,
      [
        title,
        finalSlug,
        content,
        summary || null,
        type,
        categoryId,
        entryTags,
        chunks.length,
      ]
    );

    const newEntry = result.rows[0];
    enqueueEntry(newEntry.id);

    return NextResponse.json({
      success: true,
      id: newEntry.id,
      slug: newEntry.slug,
      status: newEntry.status,
      created_at: newEntry.created_at,
      chunks: chunks.length,
      message: "Entry created and queued for indexing",
    });
  } catch (error: unknown) {
    console.error("Error creating entry:", error);

    const message = getErrorMessage(error);
    const pgError = error as { code?: string; message?: string };

    if (pgError.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          error: "An entry with this slug already exists",
          details: message,
        },
        { status: 409 }
      );
    }

    if (pgError.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid category ID. The specified category does not exist.",
          details: message,
        },
        { status: 400 }
      );
    }

    if (pgError.code === "22P02") {
      return NextResponse.json(
        { success: false, error: "Invalid input format", details: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: message,
      },
      { status: 500 }
    );
  }
}

function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}
