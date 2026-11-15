import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getModelSettings, type ModelSettings } from "@/app/lib/settings";
import { embedTexts } from "@/app/lib/embeddings";
import { getErrorMessage } from "@/app/lib/errors";

interface ServiceStatus {
  status: string;
  code: number;
  error?: string;
}

interface EmbeddingStatus extends ServiceStatus {
  provider?: string;
  model_id?: string;
  dimensions?: number;
}

interface StatusReport {
  database: ServiceStatus;
  embedding: EmbeddingStatus;
}

export async function GET() {
  const statusReport: Partial<StatusReport> = {};

  try {
    await db.query("SELECT 1");
    statusReport.database = { status: "connected", code: 200 };
  } catch (error: unknown) {
    statusReport.database = {
      status: "failed",
      error: getErrorMessage(error),
      code: 500,
    };
  }

  let settings: ModelSettings | null = null;
  try {
    settings = await getModelSettings();
  } catch {
    // The database status above already reports the underlying problem.
  }

  try {
    if (!settings) {
      throw new Error("Embedding settings are unavailable");
    }
    await embedTexts(["ping"], settings);
    statusReport.embedding = {
      status: "connected",
      code: 200,
      provider: settings.provider,
      model_id: settings.model_id,
      dimensions: settings.dimensions,
    };
  } catch (error: unknown) {
    statusReport.embedding = {
      status: "failed",
      code: 500,
      error: getErrorMessage(error),
      provider: settings?.provider,
      model_id: settings?.model_id,
      dimensions: settings?.dimensions,
    };
  }

  const hasFailure =
    statusReport.database.status === "failed" ||
    statusReport.embedding.status === "failed";

  return NextResponse.json(statusReport, { status: hasFailure ? 500 : 200 });
}
