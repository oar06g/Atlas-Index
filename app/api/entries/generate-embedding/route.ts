import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { enqueueEntry } from "@/app/lib/embedding-queue";
import { getErrorMessage } from "@/app/lib/errors";

/**
 * Queue an entry for (re-)indexing with the currently configured model.
 *
 * The heavy work runs in the background queue so large entries never hit an
 * HTTP timeout. Poll `GET /api/entries` (or `/api/entries/:slug`) for progress.
 */
export async function POST(req: NextRequest) {
  try {
    const { entryId } = await req.json();

    if (!entryId) {
      return NextResponse.json(
        { success: false, error: "entryId is required" },
        { status: 400 }
      );
    }

    const result = await db.query(`SELECT id FROM entries WHERE id = $1`, [
      entryId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Entry not found" },
        { status: 404 }
      );
    }

    await db.query(
      `UPDATE entries
       SET status = 'pending',
           error_message = NULL,
           chunks_done = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [entryId]
    );

    enqueueEntry(entryId);

    return NextResponse.json({
      success: true,
      queued: true,
      entryId,
      message: "Entry queued for indexing",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
