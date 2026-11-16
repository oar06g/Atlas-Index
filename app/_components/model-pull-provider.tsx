"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ModelPullEvent } from "@/app/lib/model-pull";

export type ModelPullOutcome = "idle" | "pulling" | "success" | "error";

export interface ModelPullSnapshot {
  outcome: ModelPullOutcome;
  model: string | null;
  status: string;
  percent: number;
  completed: number;
  total: number;
  error: string | null;
}

interface ModelPullContextValue extends ModelPullSnapshot {
  isPulling: boolean;
  startPull: (model: string) => Promise<void>;
  cancelPull: () => void;
  dismiss: () => void;
}

const IDLE: ModelPullSnapshot = {
  outcome: "idle",
  model: null,
  status: "",
  percent: 0,
  completed: 0,
  total: 0,
  error: null,
};

const ModelPullContext = createContext<ModelPullContextValue | null>(null);

const clampPercent = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

/**
 * Owns the model-pull stream for the whole app. It lives in the root layout so
 * a download keeps streaming (and its progress stays visible) while the user
 * navigates between pages.
 */
export function ModelPullProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ModelPullSnapshot>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const cancelPull = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSnapshot(IDLE);
  }, []);

  const dismiss = useCallback(() => {
    cancelPull();
  }, [cancelPull]);

  const startPull = useCallback(async (model: string) => {
    const target = model.trim();
    if (!target) {
      setSnapshot({
        ...IDLE,
        outcome: "error",
        error: "Enter a model name before starting a download.",
      });
      return;
    }

    if (abortRef.current) {
      // A download is already running; don't start a second one.
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setSnapshot({
      outcome: "pulling",
      model: target,
      status: "starting",
      percent: 0,
      completed: 0,
      total: 0,
      error: null,
    });

    try {
      const response = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: target }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error || `Model download failed (${response.status}).`
        );
      }

      if (!response.body) {
        throw new Error("The server returned an empty download stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastProgressUpdate = 0;

      const applyEvent = (event: ModelPullEvent) => {
        if (event.type === "error") {
          setSnapshot((previous) => ({
            ...previous,
            outcome: "error",
            status: "failed",
            error: event.error || "The model download failed.",
          }));
          return;
        }

        if (event.type === "done") {
          setSnapshot((previous) => ({
            ...previous,
            outcome: "success",
            status: "success",
            percent: 100,
            completed: event.overallCompleted ?? previous.completed,
            total: event.overallTotal ?? previous.total,
            error: null,
          }));
          return;
        }

        // Ollama emits progress per downloaded chunk. Rendering every event is
        // wasteful, so cap progress updates at roughly 12 per second.
        const now = Date.now();
        if (now - lastProgressUpdate < 80) return;
        lastProgressUpdate = now;

        setSnapshot((previous) => ({
          ...previous,
          outcome: "pulling",
          status: event.status || previous.status,
          percent: Math.max(
            previous.percent,
            clampPercent(event.overallPercent ?? previous.percent)
          ),
          completed: event.overallCompleted ?? previous.completed,
          total: event.overallTotal ?? previous.total,
        }));
      };

      const parseLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          applyEvent(JSON.parse(trimmed) as ModelPullEvent);
        } catch {
          // Ignore malformed fragments instead of killing the download.
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          parseLine(buffer.slice(0, newlineIndex));
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf("\n");
        }
      }

      buffer += decoder.decode();
      parseLine(buffer);

      // The stream closed without a terminal event: treat it as finished.
      setSnapshot((previous) =>
        previous.outcome === "pulling"
          ? { ...previous, outcome: "success", status: "success", percent: 100 }
          : previous
      );
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        setSnapshot(IDLE);
      } else {
        setSnapshot((previous) => ({
          ...previous,
          outcome: "error",
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Network error while downloading the model.",
        }));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const value = useMemo<ModelPullContextValue>(
    () => ({
      ...snapshot,
      isPulling: snapshot.outcome === "pulling",
      startPull,
      cancelPull,
      dismiss,
    }),
    [snapshot, startPull, cancelPull, dismiss]
  );

  return (
    <ModelPullContext.Provider value={value}>
      {children}
    </ModelPullContext.Provider>
  );
}

export function useModelPull(): ModelPullContextValue {
  const context = useContext(ModelPullContext);
  if (!context) {
    throw new Error("useModelPull must be used inside a ModelPullProvider");
  }
  return context;
}
