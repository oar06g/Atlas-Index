import {NextRequest, NextResponse} from 'next/server'
import {db} from '@/app/lib/db'

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const res = await db.query(
      `SELECT * FROM categories WHERE id = $1 limit 1`, [id]
    )
    const data = res.rows;

    if (!data || data.length === 0) {
      return NextResponse.json({error: "category not found"}, {status: 404})
    }
    return NextResponse.json(data[0])
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}