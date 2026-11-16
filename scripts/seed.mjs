#!/usr/bin/env node
// Seed Atlas Index with a broad technical corpus.
//
// Usage:
//   npm run seed
//   node scripts/seed.mjs
//   node scripts/seed.mjs --dry-run
//   node scripts/seed.mjs --limit=10
//
// The script connects to PostgreSQL directly, embeds each chunk with the model
// configured in the settings table, and inserts entries plus vectors in one
// transaction. It is idempotent: entries whose slug or title already exists are
// skipped. Re-running it will not duplicate the corpus.

import fs from "node:fs";
import pg from "pg";
import { entries, categories } from "./seed/atlas-corpus.mjs";

const { Pool } = pg;

/** Load the project's .env without requiring a dotenv package. Existing env wins. */
function loadDotEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

loadDotEnv();

const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || "atlas")}:` +
    `${encodeURIComponent(process.env.POSTGRES_PASSWORD || "atlas")}@` +
    `${process.env.POSTGRES_HOST || "localhost"}:` +
    `${process.env.POSTGRES_PORT || "5432"}/` +
    `${process.env.POSTGRES_DB || "atlasdb"}`;

const OLLAMA_HOST = (
  process.env.OLLAMA_HOST || "http://localhost:11434"
).replace(/\/+$/, "");
const BATCH_SIZE = Math.max(1, Number(process.env.SEED_BATCH_SIZE) || 8);
const TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.SEED_TIMEOUT_MS) || 120_000
);
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "24h";

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 200;
const SEED_TAG = "atlas-seed";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 1) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Same chunking logic as app/lib/embeddings.ts. */
function chunkText(text, maxChars = MAX_CHUNK_CHARS, overlap = CHUNK_OVERLAP) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];
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

/** Same slug generation as app/api/entries/create-entry/route.ts. */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function toPgVector(vector) {
  return `[${vector.join(",")}]`;
}

function resolveBaseUrl(settings) {
  if (settings.base_url) return settings.base_url.replace(/\/+$/, "");
  if (settings.provider === "ollama") return OLLAMA_HOST;
  if (settings.provider === "openai") return "https://api.openai.com/v1";
  throw new Error("base_url is required for the custom embedding provider");
}

async function embedWithOllama(texts, settings) {
  const response = await fetch(`${resolveBaseUrl(settings)}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model_id,
      input: texts,
      keep_alive: KEEP_ALIVE,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Ollama embedding failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }

  const payload = await response.json();
  return payload.embeddings ?? [];
}

async function embedWithOpenAI(texts, settings) {
  const headers = { "Content-Type": "application/json" };
  if (settings.api_key) headers.Authorization = `Bearer ${settings.api_key}`;

  const response = await fetch(`${resolveBaseUrl(settings)}/embeddings`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: settings.model_id, input: texts }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Embedding API failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }

  const payload = await response.json();
  return (payload.data ?? []).map((item) => item.embedding ?? []);
}

async function embedBatch(texts, settings, attempt = 0) {
  try {
    const embeddings =
      settings.provider === "ollama"
        ? await embedWithOllama(texts, settings)
        : await embedWithOpenAI(texts, settings);

    if (embeddings.length !== texts.length) {
      throw new Error(
        `Embedding provider returned ${embeddings.length} vectors for ${texts.length} texts`
      );
    }

    for (const vector of embeddings) {
      if (vector.length !== settings.dimensions) {
        throw new Error(
          `Model ${settings.model_id} returned ${vector.length}-dimension vectors, expected ${settings.dimensions}`
        );
      }
    }

    return embeddings;
  } catch (error) {
    if (texts.length > 1) {
      const mid = Math.ceil(texts.length / 2);
      const left = await embedBatch(texts.slice(0, mid), settings);
      const right = await embedBatch(texts.slice(mid), settings);
      return [...left, ...right];
    }

    if (attempt + 1 < 3) {
      await sleep(1000 * (attempt + 1));
      return embedBatch(texts, settings, attempt + 1);
    }

    throw error;
  }
}

async function getSettings(pool) {
  const result = await pool.query(
    `SELECT provider, model_id, dimensions, base_url, api_key
     FROM settings WHERE id = 1`
  );

  if (result.rows.length === 0) {
    return {
      provider: "ollama",
      model_id: process.env.OLLAMA_MODEL || "nomic-embed-text",
      dimensions: 768,
      base_url: null,
      api_key: null,
    };
  }

  const row = result.rows[0];
  return {
    provider:
      row.provider === "openai" || row.provider === "custom"
        ? row.provider
        : "ollama",
    model_id: row.model_id || "nomic-embed-text",
    dimensions: Number(row.dimensions) || 768,
    base_url: row.base_url || null,
    api_key: row.api_key || null,
  };
}

async function main() {
  const selected = limit ? entries.slice(0, limit) : entries;

  // Validate the corpus before touching the network or database.
  const seenSlugs = new Set();
  for (const entry of selected) {
    const slug = slugify(entry.title);
    if (!slug) throw new Error(`Title produces an empty slug: ${entry.title}`);
    if (seenSlugs.has(slug)) {
      throw new Error(`Duplicate seed slug: ${slug}`);
    }
    seenSlugs.add(slug);
  }

  const prepared = selected.map((entry) => {
    const chunks = chunkText(entry.content);
    if (chunks.length === 0) {
      throw new Error(`Entry has no content: ${entry.title}`);
    }
    return {
      ...entry,
      slug: slugify(entry.title),
      chunks,
      tags: Array.from(new Set([...(entry.tags ?? []), SEED_TAG])),
    };
  });

  const totalChunks = prepared.reduce(
    (sum, entry) => sum + entry.chunks.length,
    0
  );

  console.log(
    `Corpus: ${prepared.length} entries, ${totalChunks} chunks, ${categories.length} categories`
  );

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const settings = await getSettings(pool);
    console.log(
      `Embedding: ${settings.provider}/${settings.model_id} (${settings.dimensions} dimensions)`
    );

    const existing = await pool.query(
      `SELECT slug, title FROM entries WHERE slug = ANY($1::text[]) OR title = ANY($2::text[])`,
      [prepared.map((entry) => entry.slug), prepared.map((entry) => entry.title)]
    );

    const existingSlugs = new Set(existing.rows.map((row) => row.slug));
    const existingTitles = new Set(existing.rows.map((row) => row.title));
    const pending = prepared.filter(
      (entry) =>
        !existingSlugs.has(entry.slug) && !existingTitles.has(entry.title)
    );

    if (pending.length === 0) {
      console.log("Nothing to do: all seed entries already exist.");
      return;
    }

    if (dryRun) {
      console.log(`Dry run: would insert ${pending.length} entries.`);
      for (const entry of pending) {
        console.log(`- ${entry.title} (${entry.chunks.length} chunks)`);
      }
      return;
    }

    const jobs = pending.flatMap((entry, entryIndex) =>
      entry.chunks.map((chunk, chunkIndex) => ({
        entryIndex,
        chunkIndex,
        text: `${entry.title}\n\n${chunk}`,
      }))
    );

    console.log(
      `Embedding ${jobs.length} chunks in batches of ${BATCH_SIZE}...`
    );

    const vectors = new Array(jobs.length);
    for (let start = 0; start < jobs.length; start += BATCH_SIZE) {
      const batch = jobs.slice(start, start + BATCH_SIZE);
      const batchNumber = Math.floor(start / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(jobs.length / BATCH_SIZE);
      console.log(`  batch ${batchNumber}/${totalBatches} (${batch.length})`);

      const embedded = await embedBatch(
        batch.map((job) => job.text),
        settings
      );
      embedded.forEach((vector, index) => {
        vectors[start + index] = vector;
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const categoryIds = new Map();
      for (const name of categories) {
        const result = await client.query(
          `INSERT INTO categories (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [name]
        );
        categoryIds.set(name, result.rows[0].id);
      }

      let insertedChunks = 0;
      for (const [index, entry] of pending.entries()) {
        const categoryId = categoryIds.get(entry.category);
        if (!categoryId) {
          throw new Error(`Unknown category in corpus: ${entry.category}`);
        }

        const inserted = await client.query(
          `INSERT INTO entries (
             title, slug, content, summary, type, status,
             category_id, tags, chunks_total, chunks_done, current_model_id
           ) VALUES ($1, $2, $3, $4, 'manual', 'embedded', $5, $6, $7, $7, $8)
           RETURNING id`,
          [
            entry.title,
            entry.slug,
            entry.content,
            entry.summary ?? null,
            categoryId,
            entry.tags,
            entry.chunks.length,
            settings.model_id,
          ]
        );

        const entryId = inserted.rows[0].id;
        const jobOffset = pending
          .slice(0, index)
          .reduce((sum, item) => sum + item.chunks.length, 0);

        for (let chunkIndex = 0; chunkIndex < entry.chunks.length; chunkIndex += 1) {
          const vector = vectors[jobOffset + chunkIndex];
          if (!vector) {
            throw new Error(
              `Missing vector for ${entry.title} chunk ${chunkIndex}`
            );
          }

          await client.query(
            `INSERT INTO entry_chunks (
               entry_id, chunk_index, content, embedding, model_id
             ) VALUES ($1, $2, $3, $4, $5)`,
            [
              entryId,
              chunkIndex,
              entry.chunks[chunkIndex],
              toPgVector(vector),
              settings.model_id,
            ]
          );
          insertedChunks += 1;
        }
      }

      await client.query("COMMIT");
      console.log(
        `Inserted ${pending.length} entries and ${insertedChunks} chunks.`
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const totals = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM entries) AS entries,
         (SELECT count(*)::int FROM entry_chunks) AS chunks`
    );
    console.log(
      `Database now has ${totals.rows[0].entries} entries and ${totals.rows[0].chunks} chunks.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
