import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { resumePendingEntries } from "@/app/lib/embedding-queue";
import { getErrorMessage } from "@/app/lib/errors";

const ALLOWED_STATUSES = new Set([
  "pending",
  "processing",
  "embedded",
  "failed",
]);

export async function GET(request: NextRequest) {
  try {
    // Re-queue anything left over from a previous process (server restart).
    void resumePendingEntries();

    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get("status");
    const statuses = statusParam
      ? statusParam
          .split(",")
          .map((status) => status.trim())
          .filter((status) => ALLOWED_STATUSES.has(status))
      : [];

    const limitParam = Number(searchParams.get("limit"));
    const limit = Math.min(
      Math.max(
        Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20,
        1
      ),
      100
    );

    const params: unknown[] = [];
    let where = "";

    if (statuses.length > 0) {
      params.push(statuses);
      where = `WHERE status = ANY($${params.length}::text[])`;
    }

    params.push(limit);

    const result = await db.query(
      `SELECT id, title, slug, type, status, error_message,
              chunks_total, chunks_done, current_model_id,
              created_at, updated_at
       FROM entries
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return NextResponse.json({ success: true, entries: result.rows });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
