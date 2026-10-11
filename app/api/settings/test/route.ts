import { NextResponse } from "next/server";
import { testDatabaseConnection } from "@/app/lib/db";
import { getErrorMessage } from "@/app/lib/errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json(
        { success: false, error: "url is required" },
        { status: 400 }
      );
    }

    await testDatabaseConnection(url);

    return NextResponse.json({
      success: true,
      message: "Connection successful",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
