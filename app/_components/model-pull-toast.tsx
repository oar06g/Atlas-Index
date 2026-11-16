"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle, Download, X } from "lucide-react";
import { useModelPull } from "./model-pull-provider";

const STATUS_LABELS: Record<string, string> = {
  starting: "Connecting to Ollama",
  "pulling manifest": "Fetching model manifest",
  downloading: "Downloading model layers",
  "verifying sha256 digest": "Verifying downloaded layers",
  "writing manifest": "Writing manifest",
  "removing any unused layers": "Cleaning up old layers",
  success: "Download complete",
  failed: "Download failed",
};

function describeStatus(status: string): string {
  const known = STATUS_LABELS[status];
  if (known) return known;
  // Ollama labels layer events as "pulling <digest>".
  if (status.startsWith("pulling ")) return "Downloading model layers";
  return status;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${
    units[exponent]
  }`;
}

/**
 * Fixed progress card rendered on every page. It reads the shared pull state,
 * so a download started in Settings stays visible after navigating away.
 */
export function ModelPullToast() {
  const { outcome, model, status, percent, completed, total, error, dismiss } =
    useModelPull();

  // Let a successful download linger for a moment, then clear it.
  useEffect(() => {
    if (outcome !== "success") return;
    const timer = setTimeout(dismiss, 12_000);
    return () => clearTimeout(timer);
  }, [outcome, dismiss]);

  if (outcome === "idle") return null;

  const isPulling = outcome === "pulling";
  const isError = outcome === "error";

  const title = isError
    ? "Model download failed"
    : outcome === "success"
      ? `${model ?? "Model"} is ready`
      : (model ?? "Downloading model");

  const statusLabel = isError
    ? error ?? "The model download failed."
    : outcome === "success"
      ? "Installed in Ollama. Test it in Settings to detect its dimensions."
      : describeStatus(status);

  const iconWrapClass = isError
    ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
    : outcome === "success"
      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
      : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] w-[min(24rem,calc(100vw-2.5rem))] print:hidden"
    >
      <div className="rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-neutral-800 dark:bg-[#1e1e1e]/95">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconWrapClass}`}
          >
            {isError ? (
              <AlertCircle className="h-4 w-4" />
            ) : outcome === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4 animate-pulse" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {title}
            </p>
            <p
              className={`mt-0.5 text-xs leading-relaxed ${
                isError
                  ? "text-red-600 dark:text-red-400"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {statusLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label={isPulling ? "Cancel model download" : "Dismiss"}
            title={isPulling ? "Cancel download" : "Dismiss"}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isError && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  outcome === "success"
                    ? "bg-green-500"
                    : "bg-neutral-900 dark:bg-neutral-100"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="tabular-nums">
                {outcome === "success" ? "Complete" : `${Math.round(percent)}%`}
              </span>
              {total > 0 && (
                <span className="truncate font-mono">
                  {formatBytes(completed)} / {formatBytes(total)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
