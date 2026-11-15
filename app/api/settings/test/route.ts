import { NextResponse } from "next/server";
import {
  getModelSettings,
  normalizeModelSettings,
} from "@/app/lib/settings";
import { embedTexts } from "@/app/lib/embeddings";
import { getErrorMessage } from "@/app/lib/errors";

/**
 * Test an embedding configuration without saving it. When the request body is
 * empty the currently saved settings are used.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const current = await getModelSettings();
    const settings = normalizeModelSettings(body, current);

    const [embedding] = await embedTexts(
      ["Atlas Index embedding connection test"],
      settings
    );

    return NextResponse.json({
      success: true,
      message: `Connected to ${settings.provider} (${settings.model_id})`,
      model_id: settings.model_id,
      dimensions: embedding.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
