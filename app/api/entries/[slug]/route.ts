import { db } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;

    const res = await db.query(
      `SELECT e.id, e.title, e.slug, e.content, e.summary, e.type, e.tags,
              e.created_at, e.updated_at, e.category,
              c.name AS category_name
       FROM knowledge_entries e
       LEFT JOIN categories c ON e.category = c.id
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
