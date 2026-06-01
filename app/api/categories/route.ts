import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db';

export async function GET() {
  try {
    // 1. Added 'const' to define res
    const res = await db.query("select * from categories");
    const data = res.rows
    if (data.length < 1) {
      return NextResponse.json({data: null})
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error(error)
    // 2. Fixed status code syntax
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
