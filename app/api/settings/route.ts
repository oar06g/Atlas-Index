import { NextResponse } from "next/server";
import { getSettings, saveSettings, type AppSettings } from "@/app/lib/config";
import { getErrorMessage } from "@/app/lib/errors";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      database?: { mode?: unknown; url?: unknown };
    };

    if (!body.database || typeof body.database !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid payload: database settings are required" },
        { status: 400 }
      );
    }

    const mode = body.database.mode;
    if (mode !== "internal" && mode !== "external") {
      return NextResponse.json(
        { success: false, error: "database.mode must be 'internal' or 'external'" },
        { status: 400 }
      );
    }

    const settings: AppSettings = { database: { mode } };

    if (mode === "external") {
      const url =
        typeof body.database.url === "string" ? body.database.url.trim() : "";
      if (!url) {
        return NextResponse.json(
          { success: false, error: "A connection string is required for an external database" },
          { status: 400 }
        );
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid PostgreSQL connection string" },
          { status: 400 }
        );
      }
      if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
        return NextResponse.json(
          { success: false, error: "The connection string must use the postgresql:// protocol" },
          { status: 400 }
        );
      }
      settings.database.url = url;
    }

    const saved = await saveSettings(settings);
    return NextResponse.json({ success: true, settings: saved });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
