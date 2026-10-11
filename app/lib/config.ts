import { promises as fs } from "fs";
import path from "path";

export interface DatabaseSettings {
  /**
   * "internal"  -> use the PostgreSQL instance running inside the container
   * "external"  -> use the user-supplied PostgreSQL connection string
   */
  mode: "internal" | "external";
  /** PostgreSQL connection string, required when mode is "external" */
  url?: string;
}

export interface AppSettings {
  database: DatabaseSettings;
  updatedAt?: string;
}

const DATA_DIR = process.env.ATLAS_DATA_DIR || path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// Short TTL cache so we don't hit the filesystem on every query, while still
// picking up changes made through the settings API within a couple of seconds.
const CACHE_TTL_MS = 2000;
let cache: { value: AppSettings; expires: number } | null = null;

function normalize(raw: unknown): AppSettings {
  const parsed = (raw ?? {}) as Partial<AppSettings>;
  const database = (parsed.database ?? {}) as Partial<DatabaseSettings>;
  return {
    database: {
      mode: database.mode === "external" ? "external" : "internal",
      url: typeof database.url === "string" && database.url.trim()
        ? database.url.trim()
        : undefined,
    },
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
  };
}

async function readSettingsFile(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return normalize(JSON.parse(raw));
  } catch {
    return { database: { mode: "internal" } };
  }
}

export async function getSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return cache.value;
  }
  const value = await readSettingsFile();
  cache = { value, expires: now + CACHE_TTL_MS };
  return value;
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const toSave: AppSettings = {
    database: settings.database,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${SETTINGS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(toSave, null, 2), "utf-8");
  await fs.rename(tmp, SETTINGS_FILE);
  cache = { value: toSave, expires: Date.now() + CACHE_TTL_MS };
  return toSave;
}
