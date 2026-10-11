# Atlas Index

A local knowledge assistant. Store knowledge entries (Markdown documents,
notes, articles), index them with vector embeddings, and search them with
semantic similarity — all running in **one self-contained container**.

## Architecture (standalone)

Everything runs inside a single Docker container — there are no external
services to install or manage:

| Component | What it does |
| --- | --- |
| **Next.js app** | Web UI + API (`/app`, port `3000`) |
| **PostgreSQL 16 + pgvector** | Internal database; stores entries, categories and the vector embeddings (port `5432`, internal only) |
| **Ollama** | Local embedding service with the `nomic-embed-text` model pre-installed (port `11434`, internal only) |

```
┌───────────────────────────────────────────────┐
│              atlas-index container            │
│                                               │
│   ┌─────────────┐   ┌─────────────────────┐  │
│   │  Next.js    │   │  PostgreSQL +       │  │
│   │  app :3000  │──▶│  pgvector :5432     │  │
│   └──────┬──────┘   │  (internal DB +     │  │
│          │          │   vector embeddings) │  │
│          │          └─────────────────────┘  │
│          │          ┌─────────────────────┐  │
│          └─────────▶│  Ollama :11434      │  │
│                     │  nomic-embed-text   │  │
│                     └─────────────────────┘  │
└───────────────────────────────────────────────┘
```

### Quick start

```bash
docker compose up --build
```

Then open http://localhost:3000.

The first build takes a while because the `nomic-embed-text` embedding
model (~274 MB) is downloaded and baked into the image.

### Persistence

Data survives restarts via three Docker volumes:

| Volume | Contents |
| --- | --- |
| `postgres_data` | Internal database (entries, categories, embeddings) |
| `ollama_data` | Ollama models |
| `app_data` | Application settings (e.g. external database config) |

## External PostgreSQL (optional)

By default the app uses the database inside the container. To use an
existing PostgreSQL server instead:

1. Open **Settings** (top-right of the home page) — or go to `/settings`.
2. Choose **External PostgreSQL**.
3. Fill in the host, port, username, password and database name (or
   paste a full `postgresql://` connection string — extra options such
   as `?sslmode=require` are supported).
4. Use **Test connection** to verify it, then **Save settings**.

The external server must have the **pgvector** extension installed, since
entries are stored as `vector(768)` embeddings. The schema in `init.sql`
(applied automatically on every startup) is idempotent, but it is only
auto-applied to the **internal** database — apply it manually on an
external server if needed.

Changes take effect immediately; no restart is required.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_USER` | `atlas` | Internal PostgreSQL user |
| `POSTGRES_PASSWORD` | `atlas` | Internal PostgreSQL password |
| `POSTGRES_DB` | `atlasdb` | Internal PostgreSQL database |
| `DATABASE_URL` | derived from the above | Overrides the internal connection string |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API URL used by the app |
| `OLLAMA_KEEP_ALIVE` | `24h` | How long Ollama keeps the model loaded |
| `ATLAS_DATA_DIR` | `/app/data` | Where settings are persisted |

The container publishes only port `3000` for the web app. PostgreSQL
(`5432`) and Ollama (`11434`) are internal and are intentionally **not**
published, so they can never conflict with services already running on
the host (for example, a system-wide Ollama on `11434`).

## Development

```bash
npm install
npm run dev
```

`npm run dev` expects a PostgreSQL server with the pgvector extension at
`localhost:5432` (or set `DATABASE_URL`), and an Ollama instance with
`nomic-embed-text` available at `localhost:11434`.

## Notes

- The embedding model is fixed at build time (`nomic-embed-text`,
  768 dimensions). Changing the model produces incompatible embeddings —
  re-create your entries (and the database) if you swap the model.
- Search combines vector similarity with PostgreSQL full-text search;
  it automatically falls back to full-text search if embedding
  generation fails.
