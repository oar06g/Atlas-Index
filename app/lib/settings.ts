import { db } from "@/app/lib/db";

export type EmbeddingProvider = "ollama" | "openai" | "custom";

export interface ModelSettings {
  provider: EmbeddingProvider;
  model_id: string;
  dimensions: number;
  base_url: string | null;
  api_key: string | null;
  updated_at?: string;
}

const DEFAULT_DIMENSIONS = 768;

function rowToSettings(row: Record<string, unknown>): ModelSettings {
  const provider = row.provider;
  return {
    provider: provider === "openai" || provider === "custom" ? provider : "ollama",
    model_id:
      typeof row.model_id === "string" && row.model_id.trim()
        ? row.model_id
        : "nomic-embed-text",
    dimensions: Number(row.dimensions) || DEFAULT_DIMENSIONS,
    base_url: typeof row.base_url === "string" ? row.base_url : null,
    api_key: typeof row.api_key === "string" ? row.api_key : null,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/**
 * Resolve the endpoint used for embedding requests.
 *
 * For Ollama we fall back to OLLAMA_HOST so the same database can be used both
 * from `npm run dev` (localhost) and inside Docker (`http://ollama:11434`).
 */
export function resolveBaseUrl(settings: ModelSettings): string {
  const explicit = settings.base_url?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  if (settings.provider === "ollama") {
    return (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/+$/, "");
  }
  if (settings.provider === "openai") {
    return "https://api.openai.com/v1";
  }
  throw new Error("base_url is required for the custom provider");
}

/** Read the single settings row, creating it with defaults when missing. */
export async function getModelSettings(): Promise<ModelSettings> {
  const result = await db.query(
    `SELECT provider, model_id, dimensions, base_url, api_key, updated_at
     FROM settings
     WHERE id = 1`
  );

  if (result.rows.length > 0) {
    return rowToSettings(result.rows[0]);
  }

  const inserted = await db.query(
    `INSERT INTO settings (id, provider, model_id, dimensions)
     VALUES (1, 'ollama', $1, $2)
     ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
     RETURNING provider, model_id, dimensions, base_url, api_key, updated_at`,
    [process.env.OLLAMA_MODEL || "nomic-embed-text", DEFAULT_DIMENSIONS]
  );

  return rowToSettings(inserted.rows[0]);
}

export async function saveModelSettings(
  settings: ModelSettings
): Promise<ModelSettings> {
  const result = await db.query(
    `INSERT INTO settings (id, provider, model_id, dimensions, base_url, api_key, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       provider = EXCLUDED.provider,
       model_id = EXCLUDED.model_id,
       dimensions = EXCLUDED.dimensions,
       base_url = EXCLUDED.base_url,
       api_key = EXCLUDED.api_key,
       updated_at = NOW()
     RETURNING provider, model_id, dimensions, base_url, api_key, updated_at`,
    [
      settings.provider,
      settings.model_id,
      settings.dimensions,
      settings.base_url,
      settings.api_key,
    ]
  );

  return rowToSettings(result.rows[0]);
}

/**
 * Validate and normalise user input. Missing fields fall back to `base`, which
 * lets the settings page test a model before saving it.
 */
export function normalizeModelSettings(
  raw: unknown,
  base: ModelSettings
): ModelSettings {
  const input = (raw ?? {}) as Record<string, unknown>;

  const provider = input.provider === undefined ? base.provider : input.provider;
  if (provider !== "ollama" && provider !== "openai" && provider !== "custom") {
    throw new Error("provider must be one of: ollama, openai, custom");
  }

  const modelId =
    input.model_id === undefined ? base.model_id : String(input.model_id).trim();
  if (!modelId) {
    throw new Error("model_id is required");
  }

  const dimensions =
    input.dimensions === undefined ? base.dimensions : Number(input.dimensions);
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 8192) {
    throw new Error("dimensions must be an integer between 1 and 8192");
  }

  const baseUrlRaw = input.base_url === undefined ? base.base_url : input.base_url;
  const baseUrl =
    typeof baseUrlRaw === "string" && baseUrlRaw.trim()
      ? baseUrlRaw.trim().replace(/\/+$/, "")
      : null;
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error("base_url must be a valid URL");
    }
  }

  const apiKeyRaw = input.api_key === undefined ? base.api_key : input.api_key;
  const apiKey =
    typeof apiKeyRaw === "string" && apiKeyRaw.trim()
      ? apiKeyRaw.trim()
      : null;

  return {
    provider,
    model_id: modelId,
    dimensions,
    base_url: baseUrl,
    api_key: apiKey,
  };
}
