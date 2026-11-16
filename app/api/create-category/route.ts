import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getErrorMessage } from "@/app/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (name.length === 0) {
      return NextResponse.json(
        { success: false, error: "Category name is required" },
        { status: 400 }
      );
    }

    const existingCategory = await db.query(
      `SELECT id, name FROM categories WHERE name = $1`,
      [name]
    );

    if (existingCategory.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Category already exists",
          id: existingCategory.rows[0].id,
        },
        { status: 409 }
      );
    }

    const result = await db.query(
      `INSERT INTO categories (name)
       VALUES ($1)
       RETURNING id, name, created_at`,
      [name]
    );

    const category = result.rows[0];

    return NextResponse.json(
      {
        success: true,
        id: category.id,
        name: category.name,
        created_at: category.created_at,
        message: "Category created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create category:", error);

    // A concurrent request may have inserted the same name between the check
    // and the insert, so report the unique violation as a normal conflict.
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json(
        { success: false, error: "Category already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create category",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
