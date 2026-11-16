import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getErrorMessage } from "@/app/lib/errors";

export async function GET() {
  try {
    const result = await db.query(
      `SELECT id, name, created_at
       FROM categories
       ORDER BY name ASC`
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error("Failed to list categories:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load categories",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
