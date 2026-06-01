import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import ollama from "ollama"

export async function GET() {
  const statusReport: any = {}

  try {
    await db.query("SELECT 1")
    statusReport.database = { status: 'connected', code: 200 }
  } catch (error: any) {
    statusReport.database = { status: 'failed', error: error.message, code: 500 }
  }

  try {
    await ollama.list()
    statusReport.ollama = { status: 'connected', code: 200 }
  } catch (error: any) {
    statusReport.ollama = { status: 'failed', error: error.message, code: 500 }
  }

  
  const hasFailure = statusReport.database.status === 'failed' || statusReport.ollama.status === 'failed'
  const globalStatus = hasFailure ? 500 : 200

  return NextResponse.json(statusReport, { status: globalStatus })
}
