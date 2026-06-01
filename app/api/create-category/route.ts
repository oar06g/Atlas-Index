// app/api/create-category/route.ts
import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Category name is required and must be a non-empty string" 
        },
        { status: 400 }
      );
    }

    // Check if category already exists
    const existingCategory = await db.query(
      `SELECT id FROM categories WHERE name = $1`,
      [name.trim()]
    );

    if (existingCategory.rows.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Category already exists",
          id: existingCategory.rows[0].id
        },
        { status: 409 }
      );
    }

    // Insert new category
    const result = await db.query(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id, name`,
      [name.trim()]
    );

    const newCategory = result.rows[0];

    return NextResponse.json({
      success: true,
      id: newCategory.id,
      name: newCategory.name,
      created_at: newCategory.created_at,
      message: "Category created successfully"
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating category:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message
      },
      { status: 500 }
    );
  }
}