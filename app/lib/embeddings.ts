import { Ollama } from "ollama";
import {
  getModelSettings,
  resolveBaseUrl,
  type ModelSettings,
} from "@/app/lib/settings";

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 200;

/**
 * Maximum time a single embedding request may take. If a batch takes longer,
 * the request is aborted and the queue retries it with smaller batches.
 */
const EMBED_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.EMBED_TIMEOUT_MS) || 120_000
);

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });
}

/**
 * Split text into overlapping chunks suitable for embedding.
 * Paragraph boundaries are preferred; very long paragraphs are hard-split.
 */
export function chunkText(
  text: string,
  maxChars = MAX_CHUNK_CHARS,
  overlap = CHUNK_OVERLAP
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush();
      const step = Math.max(1, maxChars - overlap);
      for (let start = 0; start < paragraph.length; start += step) {
        chunks.push(paragraph.slice(start, start + maxChars).trim());
        if (start + maxChars >= paragraph.length) break;
      }
      continue;
    }

    if (current && current.length + 2 + paragraph.length > maxChars) {
      flush();
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  flush();
  return chunks.filter(Boolean);
}

/** Convert a JS number array into the textual form pgvector expects. */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function embedWithOllama(
  texts: string[],
  settings: ModelSettings
): Promise<number[][]> {
  const client = new Ollama({
    host: resolveBaseUrl(settings),
    fetch: fetchWithTimeout,
  });
  const response = await client.embed({
    model: settings.model_id,
    input: texts,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || "24h",
  });
  return response.embeddings;
}

async function embedWithOpenAICompatible(
  texts: string[],
  settings: ModelSettings
): Promise<number[][]> {
  const response = await fetch(`${resolveBaseUrl(settings)}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.api_key
        ? { Authorization: `Bearer ${settings.api_key}` }
        : {}),
    },
    body: JSON.stringify({
      model: settings.model_id,
      input: texts,
    }),
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Embedding request failed (${response.status})${
        detail ? `: ${detail.slice(0, 300)}` : ""
      }`
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embeddings = (payload.data ?? []).map((item) => item.embedding ?? []);
  if (embeddings.length !== texts.length) {
    throw new Error(
      "Embedding provider returned an unexpected number of vectors"
    );
  }
  return embeddings;
}

/**
 * Generate embeddings for a batch of texts using the model configured in the
 * database. Throws when the provider returns vectors with the wrong size, so
 * mismatched settings are surfaced instead of silently corrupting the index.
 */
export async function embedTexts(
  texts: string[],
  settings?: ModelSettings
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const config = settings ?? (await getModelSettings());
  const embeddings =
    config.provider === "ollama"
      ? await embedWithOllama(texts, config)
      : await embedWithOpenAICompatible(texts, config);

  for (const vector of embeddings) {
    if (vector.length !== config.dimensions) {
      throw new Error(
        `Model "${config.model_id}" returned ${vector.length}-dimension embeddings, but settings expect ${config.dimensions}. Update the dimensions in Settings.`
      );
    }
  }

  return embeddings;
}

export async function generateEmbedding(
  text: string,
  settings?: ModelSettings
): Promise<number[]> {
  const [embedding] = await embedTexts([text], settings);
  return embedding;
}
