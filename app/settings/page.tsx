"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Cpu,
  Download,
  FlaskConical,
  Globe,
  Hash,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  XCircle,
} from "lucide-react";
import { useModelPull } from "@/app/_components/model-pull-provider";

type EmbeddingProvider = "ollama" | "openai" | "custom";

interface ModelSettings {
  provider: EmbeddingProvider;
  model_id: string;
  dimensions: number;
  base_url: string | null;
  api_key: string | null;
  updated_at?: string;
}

interface TestResult {
  ok: boolean;
  message: string;
}

const PROVIDERS: Array<{
  value: EmbeddingProvider;
  label: string;
  description: string;
}> = [
  {
    value: "ollama",
    label: "Ollama",
    description: "Local embedding model served by the ollama container.",
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "Official OpenAI embeddings API.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Any OpenAI-compatible /embeddings endpoint.",
  },
];

const DEFAULT_BASE_URLS: Record<EmbeddingProvider, string> = {
  ollama: "",
  openai: "https://api.openai.com/v1",
  custom: "",
};

export default function SettingsPage() {
  const { startPull, isPulling } = useModelPull();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [provider, setProvider] = useState<EmbeddingProvider>("ollama");
  const [savedProvider, setSavedProvider] = useState<EmbeddingProvider | null>(
    null
  );
  const [modelId, setModelId] = useState("");
  const [dimensions, setDimensions] = useState("768");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [staleEntries, setStaleEntries] = useState(0);
  const [pullModel, setPullModel] = useState("");

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveResult, setSaveResult] = useState<TestResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applySettings = (settings: ModelSettings) => {
    setProvider(settings.provider);
    setModelId(settings.model_id);
    setDimensions(String(settings.dimensions));
    setBaseUrl(settings.base_url ?? "");
    setApiKey(settings.api_key ?? "");
    setPullModel((current) => current || settings.model_id);
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          applySettings(data.settings);
          setSavedProvider(data.settings.provider);
          setStaleEntries(data.stale_entries ?? 0);
        } else {
          setLoadError(data.error || "Failed to load settings");
        }
      })
      .catch(() => setLoadError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const buildPayload = () => ({
    provider,
    model_id: modelId.trim(),
    dimensions: Number(dimensions),
    base_url: baseUrl.trim() || null,
    api_key: apiKey.trim() || null,
  });

  const validate = (): string | null => {
    if (!modelId.trim()) return "Model ID is required";
    const parsed = Number(dimensions);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8192) {
      return "Dimensions must be an integer between 1 and 8192";
    }
    if (provider === "custom" && !baseUrl.trim()) {
      return "Base URL is required for a custom provider";
    }
    return null;
  };

  const handleTest = async () => {
    const validationError = validate();
    if (validationError) {
      setTestResult({ ok: false, message: validationError });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (data.success && typeof data.dimensions === "number") {
        setDimensions(String(data.dimensions));
      }
      setTestResult({
        ok: data.success === true,
        message: data.success
          ? `${data.message} — detected ${data.dimensions} dimensions. Save settings to apply.`
          : data.error || "Connection failed",
      });
    } catch {
      setTestResult({ ok: false, message: "Network error while testing the model" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setSaveResult({ ok: false, message: validationError });
      return;
    }

    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (data.success) {
        applySettings(data.settings);
        setSavedProvider(data.settings.provider);
        setSaveResult({
          ok: true,
          message: "Model settings saved.",
        });
        setTestResult(null);
      } else {
        setSaveResult({ ok: false, message: data.error || "Failed to save settings" });
      }
    } catch {
      setSaveResult({ ok: false, message: "Network error while saving settings" });
    } finally {
      setSaving(false);
    }
  };

  const handlePull = () => {
    const target = pullModel.trim();
    if (!target) return;
    void startPull(target);
  };

  const fieldClass =
    "w-full px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors text-sm";
  const monoFieldClass = `${fieldClass} font-mono`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-neutral-600 dark:text-neutral-400 animate-spin" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212]">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
            Settings
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Choose the embedding model used to index and search your knowledge base.
          </p>
        </div>

        {loadError && (
          <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        <div className="bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              <Cpu className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Embedding model
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Stored in the <code className="font-mono">settings</code> table and
                shared by every entry.
              </p>
            </div>
          </div>

          {/* Provider selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {PROVIDERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setProvider(option.value);
                  setTestResult(null);
                  setSaveResult(null);
                  if (!baseUrl.trim()) {
                    setBaseUrl(DEFAULT_BASE_URLS[option.value]);
                  }
                }}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  provider === option.value
                    ? "border-neutral-900 dark:border-neutral-50 bg-neutral-50 dark:bg-neutral-800/50"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                    {option.label}
                  </span>
                  {provider === option.value && (
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {option.description}
                </p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <Cpu className="w-4 h-4" />
                Model ID
              </label>
              <input
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="nomic-embed-text"
                className={monoFieldClass}
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <Hash className="w-4 h-4" />
                Dimensions
              </label>
              <input
                type="number"
                min={1}
                max={8192}
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder="768"
                className={monoFieldClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <Globe className="w-4 h-4" />
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  provider === "ollama"
                    ? "Uses OLLAMA_HOST (e.g. http://ollama:11434)"
                    : DEFAULT_BASE_URLS[provider] || "https://example.com/v1"
                }
                className={monoFieldClass}
                spellCheck={false}
              />
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Leave empty for Ollama to use the <code className="font-mono">OLLAMA_HOST</code>{" "}
                environment variable.
              </p>
            </div>

            {provider !== "ollama" && (
              <div className="space-y-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  <KeyRound className="w-4 h-4" />
                  API key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className={monoFieldClass}
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          {staleEntries > 0 && (
            <div className="mt-6 flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                {staleEntries} {staleEntries === 1 ? "entry was" : "entries were"}{" "}
                embedded with a different model. Re-index them from the entry API
                (<code className="font-mono">/api/entries/generate-embedding</code>)
                after saving the new model.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 h-9 px-5 bg-neutral-900 dark:bg-neutral-50 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-neutral-50 dark:text-neutral-900 text-sm font-medium rounded-full shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save settings
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-2 h-9 px-4 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
              Test model
            </button>

            {saveResult && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  saveResult.ok
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {saveResult.ok ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{saveResult.message}</span>
              </div>
            )}

            {testResult && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  testResult.ok
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span className="break-all">{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              <Download className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Download a model
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Pull a model into Ollama. Progress stays visible on every page
                while the download runs.
              </p>
            </div>
          </div>

          {savedProvider !== "ollama" ? (
            <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                Downloads use the saved Ollama host. Save Ollama as the
                embedding provider before pulling a model.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={pullModel}
                  onChange={(e) => setPullModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handlePull();
                    }
                  }}
                  placeholder="bge-m3"
                  className={monoFieldClass}
                  spellCheck={false}
                  disabled={isPulling}
                />

                <button
                  type="button"
                  onClick={handlePull}
                  disabled={!pullModel.trim() || isPulling}
                  className="inline-flex items-center justify-center gap-2 h-[42px] px-5 bg-neutral-900 dark:bg-neutral-50 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-neutral-50 dark:text-neutral-900 text-sm font-medium rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isPulling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isPulling ? "Downloading..." : "Download model"}
                </button>
              </div>

              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-3 leading-relaxed">
                Recommended for stronger multilingual search:{" "}
                <code className="font-mono">bge-m3</code> (1024 dimensions).
                After the download, run <strong>Test model</strong> to detect the
                dimensions, then save the settings.
              </p>
            </>
          )}
        </div>

        <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
          Embeddings are stored per chunk together with the model that produced
          them. Changing the model does not delete existing vectors; re-index an
          entry to make it searchable with the new model.
        </p>
      </div>
    </div>
  );
}
