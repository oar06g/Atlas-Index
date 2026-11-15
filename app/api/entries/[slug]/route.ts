import { db } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/app/lib/errors";
import { resumePendingEntries } from "@/app/lib/embedding-queue";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;

    // Resume any jobs left behind by a server restart.
    void resumePendingEntries();

    const res = await db.query(
      `SELECT e.id, e.title, e.slug, e.content, e.summary, e.type, e.status,
              e.error_message, e.tags, e.category_id, e.current_model_id,
              e.chunks_total, e.chunks_done,
              e.created_at, e.updated_at,
              c.name AS category_name
       FROM entries e
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.slug = $1
       LIMIT 1`,
      [slug]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
