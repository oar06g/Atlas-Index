import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { ollama } from '@/app/lib/ollama'
import { getErrorMessage } from '@/app/lib/errors'

interface ServiceStatus {
  status: string;
  code: number;
  error?: string;
}

interface StatusReport {
  database: ServiceStatus;
  ollama: ServiceStatus;
}

export async function GET() {
  const statusReport: Partial<StatusReport> = {}

  try {
    await db.query("SELECT 1")
    statusReport.database = { status: 'connected', code: 200 }
  } catch (error: unknown) {
    statusReport.database = { status: 'failed', error: getErrorMessage(error), code: 500 }
  }

  try {
    await ollama.list()
    statusReport.ollama = { status: 'connected', code: 200 }
  } catch (error: unknown) {
    statusReport.ollama = { status: 'failed', error: getErrorMessage(error), code: 500 }
  }

  
  const hasFailure = statusReport.database.status === 'failed' || statusReport.ollama.status === 'failed'
  const globalStatus = hasFailure ? 500 : 200

  return NextResponse.json(statusReport, { status: globalStatus })
}
