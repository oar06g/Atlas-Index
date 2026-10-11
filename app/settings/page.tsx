"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Database,
  Server,
  Save,
  FlaskConical,
  KeyRound,
  Globe,
  Hash,
  User,
  SquareTerminal,
} from "lucide-react";

interface DatabaseSettings {
  mode: "internal" | "external";
  url?: string;
}

interface Settings {
  database: DatabaseSettings;
  updatedAt?: string;
}

interface DbFields {
  host: string;
  port: string;
  user: string;
  password: string;
  dbname: string;
}

const DEFAULT_FIELDS: DbFields = {
  host: "localhost",
  port: "5432",
  user: "postgres",
  password: "",
  dbname: "postgres",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [useRawUrl, setUseRawUrl] = useState(false);
  const [rawUrl, setRawUrl] = useState("");
  const [fields, setFields] = useState<DbFields>(DEFAULT_FIELDS);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSettings(data.settings);
          setMode(data.settings.database.mode);
          const url = data.settings.database.url;
          if (url) {
            setRawUrl(url);
            try {
              const u = new URL(url);
              setFields({
                host: u.hostname,
                port: u.port || "5432",
                user: u.username ? decodeURIComponent(u.username) : "postgres",
                password: u.password ? decodeURIComponent(u.password) : "",
                dbname: u.pathname.replace(/^\//, "") || "postgres",
              });
            } catch {
              // keep defaults if the URL cannot be parsed
            }
          }
        } else {
          setSaveResult({ ok: false, message: data.error || "Failed to load settings" });
        }
      })
      .catch(() => {
        setSaveResult({ ok: false, message: "Failed to load settings" });
      })
      .finally(() => setLoading(false));
  }, []);

  const buildConnectionString = useCallback((): string => {
    if (useRawUrl) {
      return rawUrl.trim();
    }
    const enc = encodeURIComponent;
    const user = fields.user.trim() || "postgres";
    const password = fields.password;
    const auth = password
      ? `${enc(user)}:${enc(password)}`
      : enc(user);
    const host = fields.host.trim() || "localhost";
    const port = fields.port.trim() || "5432";
    const dbname = fields.dbname.trim() || "postgres";
    return `postgresql://${auth}@${host}:${port}/${dbname}`;
  }, [useRawUrl, rawUrl, fields]);

  const connectionString =
    mode === "external" ? buildConnectionString() : "";

  const handleTest = async () => {
    if (!connectionString) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: connectionString }),
      });
      const data = await res.json();
      setTestResult({
        ok: data.success === true,
        message: data.success
          ? data.message || "Connected successfully"
          : data.error || "Connection failed",
      });
    } catch {
      setTestResult({ ok: false, message: "Network error while testing connection" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const payload =
        mode === "internal"
          ? { database: { mode: "internal" } }
          : { database: { mode: "external", url: connectionString } };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setSaveResult({
          ok: true,
          message: "Settings saved. The application is using the new database now.",
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

  const fieldClass =
    "w-full px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors font-mono text-sm";

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
            Configure how Atlas Index stores your knowledge base.
          </p>
        </div>

        {/* Database section */}
        <div className="bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              <Database className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Database
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Where your entries, categories and vector embeddings are stored.
              </p>
            </div>
          </div>

          {/* Mode selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("internal");
                setTestResult(null);
                setSaveResult(null);
              }}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                mode === "internal"
                  ? "border-neutral-900 dark:border-neutral-50 bg-neutral-50 dark:bg-neutral-800/50"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Server
                  className={`w-4 h-4 ${
                    mode === "internal"
                      ? "text-neutral-900 dark:text-neutral-50"
                      : "text-neutral-400"
                  }`}
                />
                <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                  Internal (default)
                </span>
                {settings?.database.mode === "internal" && mode === "internal" && (
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                PostgreSQL with pgvector runs inside the Atlas container. No
                external services needed.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("external");
                setTestResult(null);
                setSaveResult(null);
              }}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                mode === "external"
                  ? "border-neutral-900 dark:border-neutral-50 bg-neutral-50 dark:bg-neutral-800/50"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Globe
                  className={`w-4 h-4 ${
                    mode === "external"
                      ? "text-neutral-900 dark:text-neutral-50"
                      : "text-neutral-400"
                  }`}
                />
                <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                  External PostgreSQL
                </span>
                {settings?.database.mode === "external" && mode === "external" && (
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Connect to an existing PostgreSQL server (with the pgvector
                extension) instead of the internal one.
              </p>
            </button>
          </div>

          {/* Internal mode info */}
          {mode === "internal" && (
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <div className="flex gap-3">
                <Database className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  The internal database is managed automatically inside the
                  Atlas container. Your data persists in a Docker volume across
                  restarts. Ollama and the embedding model also run inside the
                  same container, so everything works completely offline.
                </div>
              </div>
            </div>
          )}

          {/* External mode configuration */}
          {mode === "external" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Connection details
                </span>
                <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useRawUrl}
                    onChange={(e) => setUseRawUrl(e.target.checked)}
                    className="rounded border-neutral-300 dark:border-neutral-700"
                  />
                  Use connection string instead
                </label>
              </div>

              {useRawUrl ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    <SquareTerminal className="w-4 h-4" />
                    Connection string
                  </label>
                  <input
                    type="text"
                    value={rawUrl}
                    onChange={(e) => setRawUrl(e.target.value)}
                    placeholder="postgresql://user:password@host:5432/database?sslmode=require"
                    className={fieldClass}
                    spellCheck={false}
                  />
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    Extra options such as SSL can be passed as URL parameters
                    (e.g. ?sslmode=require). The server must have the pgvector
                    extension installed.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <Globe className="w-4 h-4" />
                      Host
                    </label>
                    <input
                      type="text"
                      value={fields.host}
                      onChange={(e) => setFields({ ...fields, host: e.target.value })}
                      placeholder="localhost"
                      className={fieldClass}
                      spellCheck={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <Hash className="w-4 h-4" />
                      Port
                    </label>
                    <input
                      type="text"
                      value={fields.port}
                      onChange={(e) => setFields({ ...fields, port: e.target.value })}
                      placeholder="5432"
                      className={fieldClass}
                      spellCheck={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <User className="w-4 h-4" />
                      Username
                    </label>
                    <input
                      type="text"
                      value={fields.user}
                      onChange={(e) => setFields({ ...fields, user: e.target.value })}
                      placeholder="postgres"
                      className={fieldClass}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <KeyRound className="w-4 h-4" />
                      Password
                    </label>
                    <input
                      type="password"
                      value={fields.password}
                      onChange={(e) => setFields({ ...fields, password: e.target.value })}
                      placeholder="••••••••"
                      className={fieldClass}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <Database className="w-4 h-4" />
                      Database name
                    </label>
                    <input
                      type="text"
                      value={fields.dbname}
                      onChange={(e) => setFields({ ...fields, dbname: e.target.value })}
                      placeholder="atlasdb"
                      className={fieldClass}
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

              {/* Connection string preview */}
              {connectionString && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Connection string
                  </p>
                  <p className="text-xs font-mono break-all text-neutral-700 dark:text-neutral-300">
                    {connectionString}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !connectionString}
                  className="inline-flex items-center gap-2 h-9 px-4 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FlaskConical className="w-4 h-4" />
                  )}
                  Test connection
                </button>

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
          )}

          {/* Save */}
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
          </div>
        </div>

        <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
          Changes take effect immediately — no restart required. Switching the
          database does not move existing data; re-index your entries if you
          switch storage.
        </p>
      </div>
    </div>
  );
}
