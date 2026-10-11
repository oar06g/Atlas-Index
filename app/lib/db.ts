import { Pool } from "pg";
import { getSettings } from "@/app/lib/config";

/**
 * Build the connection string for the in-container PostgreSQL instance.
 * Explicit DATABASE_URL wins so the container can still be configured via env.
 */
function buildInternalUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.POSTGRES_USER || "atlas";
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || "atlas");
  const database = process.env.POSTGRES_DB || "atlasdb";
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

const INTERNAL_DATABASE_URL = buildInternalUrl();

let pool: Pool | null = null;
let poolUrl: string | null = null;

async function resolveConnectionString(): Promise<string> {
  const settings = await getSettings();
  if (settings.database.mode === "external" && settings.database.url) {
    return settings.database.url;
  }
  return INTERNAL_DATABASE_URL;
}

async function getPool(): Promise<Pool> {
  const connectionString = await resolveConnectionString();
  if (!pool || poolUrl !== connectionString) {
    const oldPool = pool;
    pool = new Pool({ connectionString });
    poolUrl = connectionString;
    if (oldPool) {
      // Drain in-flight queries, then close the previous pool.
      setTimeout(() => {
        oldPool.end().catch(() => {});
      }, 5000).unref();
    }
  }
  return pool;
}

export const db = {
  query: async (text: string, params?: unknown[]) => {
    const p = await getPool();
    return p.query(text, params);
  },
};

/**
 * Verify that a PostgreSQL connection string is reachable.
 * Used by the settings UI to test external connections before saving.
 */
export async function testDatabaseConnection(
  connectionString: string
): Promise<void> {
  const probe = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  try {
    await probe.query("SELECT 1");
  } finally {
    await probe.end().catch(() => {});
  }
}
