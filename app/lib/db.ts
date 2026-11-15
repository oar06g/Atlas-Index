import { Pool, type PoolClient } from "pg";

/**
 * Build the PostgreSQL connection string.
 *
 * The database is a dedicated service (see compose.yml), so the connection is
 * configured purely through environment variables (or an explicit DATABASE_URL).
 */
function buildConnectionString(): string {
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

const CONNECTION_STRING = buildConnectionString();

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: CONNECTION_STRING });
  }
  return pool;
}

export const db = {
  query: (text: string, params?: unknown[]) => getPool().query(text, params),

  /**
   * Run a set of statements inside a single transaction. The callback receives
   * a dedicated client, so every query inside it uses the same connection.
   */
  transaction: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },
};
