import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  getModelSettings,
  normalizeModelSettings,
  saveModelSettings,
} from "@/app/lib/settings";
import { getErrorMessage } from "@/app/lib/errors";

export async function GET() {
  try {
    const settings = await getModelSettings();

    const stale = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM entries
       WHERE current_model_id IS DISTINCT FROM $1`,
      [settings.model_id]
    );

    return NextResponse.json({
      success: true,
      settings,
      stale_entries: stale.rows[0]?.count ?? 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = await getModelSettings();
    const settings = normalizeModelSettings(body, current);
    const saved = await saveModelSettings(settings);

    return NextResponse.json({ success: true, settings: saved });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
