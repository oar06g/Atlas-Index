import { db } from "@/app/lib/db";
import { getModelSettings, type ModelSettings } from "@/app/lib/settings";
import { chunkText, embedTexts, toPgVector } from "@/app/lib/embeddings";
import { getErrorMessage } from "@/app/lib/errors";

/** Number of chunks sent to the embedding provider per request. */
const BATCH_SIZE = Math.max(1, Number(process.env.EMBED_BATCH_SIZE) || 4);

/** How many times a single (unsplittable) text is retried before giving up. */
const SINGLE_TEXT_ATTEMPTS = 3;

interface QueueState {
  queue: string[];
  active: Set<string>;
  running: boolean;
  resumed: boolean;
}

const globalForQueue = globalThis as unknown as {
  __atlasEmbeddingQueue?: QueueState;
};

// Stored on globalThis so the queue survives dev-server hot reloads and is
// shared between route handlers in the same process.
const state: QueueState =
  globalForQueue.__atlasEmbeddingQueue ??
  (globalForQueue.__atlasEmbeddingQueue = {
    queue: [],
    active: new Set<string>(),
    running: false,
    resumed: false,
  });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Embed a batch, retrying and splitting it in half when the provider times out
 * or fails. Small requests keep Ollama responsive even for very large entries.
 */
async function embedBatch(
  texts: string[],
  settings: ModelSettings,
  attempt = 0
): Promise<number[][]> {
  try {
    return await embedTexts(texts, settings);
  } catch (error) {
    if (texts.length > 1) {
      const mid = Math.ceil(texts.length / 2);
      const left = await embedBatch(texts.slice(0, mid), settings);
      const right = await embedBatch(texts.slice(mid), settings);
      return [...left, ...right];
    }

    if (attempt + 1 < SINGLE_TEXT_ATTEMPTS) {
      await sleep(1000 * (attempt + 1));
      return embedBatch(texts, settings, attempt + 1);
    }

    throw error;
  }
}

async function markFailed(entryId: string, error: unknown): Promise<void> {
  const message = getErrorMessage(error);
  try {
    await db.transaction(async (client) => {
      await client.query(`DELETE FROM entry_chunks WHERE entry_id = $1`, [
        entryId,
      ]);
      await client.query(
        `UPDATE entries
         SET status = 'failed',
             error_message = $1,
             chunks_done = 0,
             updated_at = NOW()
         WHERE id = $2`,
        [message, entryId]
      );
    });
  } catch (updateError) {
    console.error("Failed to mark entry as failed:", updateError);
  }
}

async function processEntry(entryId: string): Promise<void> {
  const result = await db.query(
    `SELECT id, title, content FROM entries WHERE id = $1`,
    [entryId]
  );

  if (result.rows.length === 0) {
    return; // The entry was deleted before it was processed.
  }

  const entry = result.rows[0];
  const settings = await getModelSettings();
  const chunks = chunkText(entry.content ?? "");

  if (chunks.length === 0) {
    await markFailed(entryId, new Error("Entry has no content to embed"));
    return;
  }

  // Try to resume a partially indexed entry (e.g. after a server restart).
  // We only resume when the stored chunks belong to the current model and
  // still match the current content; otherwise the entry is rebuilt.
  const existing = await db.query(
    `SELECT chunk_index, content, model_id
     FROM entry_chunks
     WHERE entry_id = $1
     ORDER BY chunk_index ASC`,
    [entryId]
  );

  let done = 0;
  let canResume =
    existing.rows.length > 0 && existing.rows.length <= chunks.length;

  if (canResume) {
    canResume = existing.rows.every(
      (row, index) =>
        row.chunk_index === index &&
        row.model_id === settings.model_id &&
        row.content === chunks[index]
    );
  }

  if (canResume) {
    done = existing.rows.length;
  } else {
    await db.query(`DELETE FROM entry_chunks WHERE entry_id = $1`, [entryId]);
  }

  await db.query(
    `UPDATE entries
     SET status = 'processing',
         error_message = NULL,
         chunks_total = $1,
         chunks_done = $2,
         current_model_id = NULL,
         updated_at = NOW()
     WHERE id = $3`,
    [chunks.length, done, entryId]
  );

  for (let start = done; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const texts = batch.map((chunk) => `${entry.title}\n\n${chunk}`);
    const embeddings = await embedBatch(texts, settings);

    await db.transaction(async (client) => {
      for (let index = 0; index < batch.length; index += 1) {
        await client.query(
          `INSERT INTO entry_chunks (entry_id, chunk_index, content, embedding, model_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            entryId,
            start + index,
            batch[index],
            toPgVector(embeddings[index]),
            settings.model_id,
          ]
        );
      }

      await client.query(
        `UPDATE entries
         SET chunks_done = $1, updated_at = NOW()
         WHERE id = $2`,
        [done + batch.length, entryId]
      );
    });

    done += batch.length;
  }

  await db.query(
    `UPDATE entries
     SET status = 'embedded',
         error_message = NULL,
         chunks_done = $1,
         current_model_id = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [done, settings.model_id, entryId]
  );
}

async function runWorker(): Promise<void> {
  if (state.running) return;
  state.running = true;

  try {
    while (state.queue.length > 0) {
      const entryId = state.queue.shift();
      if (!entryId) continue;

      state.active.add(entryId);
      try {
        await processEntry(entryId);
      } catch (error) {
        console.error(`Embedding failed for entry ${entryId}:`, error);
        await markFailed(entryId, error);
      } finally {
        state.active.delete(entryId);
      }
    }
  } finally {
    state.running = false;
  }
}

/** Add an entry to the indexing queue (no-op when it is already queued). */
export function enqueueEntry(entryId: string): void {
  if (state.active.has(entryId) || state.queue.includes(entryId)) {
    return;
  }
  state.queue.push(entryId);
  void runWorker();
}

/**
 * Re-queue entries left pending/processing (for example after a server
 * restart). Safe to call frequently; it only runs once per process.
 */
export async function resumePendingEntries(): Promise<void> {
  if (state.resumed) return;
  state.resumed = true;

  try {
    const result = await db.query(
      `SELECT id FROM entries
       WHERE status IN ('pending', 'processing')
       ORDER BY created_at ASC
       LIMIT 100`
    );

    for (const row of result.rows) {
      enqueueEntry(row.id);
    }
  } catch (error) {
    console.error("Failed to resume embedding queue:", error);
    state.resumed = false;
  }
}
