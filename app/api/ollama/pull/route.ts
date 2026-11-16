import { NextResponse } from "next/server";
import type { AbortableAsyncIterator, ProgressResponse } from "ollama";
import { getOllamaClient } from "@/app/lib/embeddings";
import { getErrorMessage } from "@/app/lib/errors";
import { getModelSettings } from "@/app/lib/settings";
import type { ModelPullEvent } from "@/app/lib/model-pull";

/**
 * Ollama model names are registry references such as "bge-m3" or
 * "library/nomic-embed-text:latest". Reject anything that does not look like
 * one instead of forwarding arbitrary strings to the Ollama API.
 */
const MODEL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._\-/:]*$/;

/**
 * Stream `ollama.pull` progress to the browser as newline-delimited JSON.
 *
 * The client reads this with `fetch(...).body.getReader()`, so the response
 * stays open until the download finishes (or the client disconnects). When the
 * connection drops, both the Ollama request and the iterator are aborted.
 */
export async function POST(req: Request) {
  let requestedModel: unknown;
  try {
    const raw = await req.text();
    if (raw.trim()) {
      const body = JSON.parse(raw) as { model?: unknown };
      requestedModel = body?.model;
    }
    // An empty body means "pull the model currently saved in settings".
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  let settings;
  try {
    settings = await getModelSettings();
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }

  if (settings.provider !== "ollama") {
    return NextResponse.json(
      {
        success: false,
        error:
          "Model downloads are only available when the saved embedding provider is Ollama.",
      },
      { status: 409 }
    );
  }

  const model = String(requestedModel ?? settings.model_id ?? "").trim();
  if (!model || model.length > 200 || !MODEL_NAME_PATTERN.test(model)) {
    return NextResponse.json(
      { success: false, error: "A valid Ollama model name is required." },
      { status: 400 }
    );
  }

  const client = getOllamaClient(settings);
  const encoder = new TextEncoder();

  // Aggregate per-digest layer progress into a single overall percentage.
  const layers = new Map<string, { total: number; completed: number }>();

  let iterator: AbortableAsyncIterator<ProgressResponse> | null = null;
  let cancelled = false;

  const abortIterator = () => {
    try {
      iterator?.abort();
    } catch {
      // The iterator may already be closed.
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: ModelPullEvent): boolean => {
        if (cancelled) return false;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          return true;
        } catch {
          // The consumer went away between the abort signal and this write.
          cancelled = true;
          abortIterator();
          return false;
        }
      };

      const onClientAbort = () => {
        cancelled = true;
        abortIterator();
      };
      req.signal.addEventListener("abort", onClientAbort, { once: true });

      try {
        if (
          !write({
            type: "progress",
            model,
            status: "starting",
            overallPercent: 0,
            overallCompleted: 0,
            overallTotal: 0,
          })
        ) {
          return;
        }

        iterator = await client.pull({ model, stream: true });

        if (cancelled) {
          abortIterator();
          return;
        }

        let sawSuccess = false;
        let overallTotal = 0;
        let overallCompleted = 0;

        for await (const part of iterator) {
          if (cancelled) break;

          const digest = typeof part.digest === "string" ? part.digest : "";
          const completed = Number(part.completed) || 0;
          const total = Number(part.total) || 0;

          if (digest && total > 0) {
            layers.set(digest, { total, completed });
          }

          overallTotal = 0;
          overallCompleted = 0;
          for (const layer of layers.values()) {
            overallTotal += layer.total;
            overallCompleted += Math.min(layer.completed, layer.total);
          }

          const overallPercent =
            overallTotal > 0
              ? Math.min(100, (overallCompleted / overallTotal) * 100)
              : 0;

          if (part.status === "success") {
            sawSuccess = true;
            write({
              type: "done",
              model,
              status: part.status,
              overallPercent: 100,
              overallCompleted: overallTotal,
              overallTotal,
            });
            break;
          }

          const event: ModelPullEvent = {
            type: "progress",
            model,
            status: part.status,
            overallPercent,
            overallCompleted,
            overallTotal,
          };

          if (digest) event.digest = digest;
          if (total > 0) {
            event.total = total;
            event.completed = completed;
            event.percent = Math.min(100, (completed / total) * 100);
          }

          if (!write(event)) break;
        }

        if (!cancelled && !sawSuccess) {
          write({
            type: "done",
            model,
            status: "success",
            overallPercent: 100,
            overallCompleted,
            overallTotal,
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          write({ type: "error", model, error: getErrorMessage(error) });
        }
      } finally {
        req.signal.removeEventListener("abort", onClientAbort);
        try {
          controller.close();
        } catch {
          // Already closed by the consumer.
        }
      }
    },

    cancel() {
      cancelled = true;
      abortIterator();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
