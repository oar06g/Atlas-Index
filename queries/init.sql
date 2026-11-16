-- Atlas Index database schema.
-- Keep the queries/init.sql and compose.yml (init_sql) copies identical.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    content TEXT NOT NULL,
    summary TEXT,
    type TEXT NOT NULL DEFAULT 'manual'
        CHECK (type IN ('manual', 'file', 'url')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'embedded', 'failed')),
    error_message TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    current_model_id TEXT,
    chunks_total INT NOT NULL DEFAULT 0,
    chunks_done INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- For databases created before the progress columns were introduced.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS chunks_total INT NOT NULL DEFAULT 0;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS chunks_done INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS entry_chunks (
    id BIGSERIAL PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector NOT NULL,
    model_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1,
    provider TEXT NOT NULL DEFAULT 'ollama'
        CHECK (provider IN ('ollama', 'openai', 'custom')),
    model_id TEXT NOT NULL DEFAULT 'nomic-embed-text',
    dimensions INT NOT NULL DEFAULT 768,
    -- NULL means "use OLLAMA_HOST" for Ollama (or the provider default).
    base_url TEXT DEFAULT NULL,
    api_key TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_current_model ON entries(current_model_id);
CREATE INDEX IF NOT EXISTS idx_entries_tags ON entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_entry_chunks_entry ON entry_chunks(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_chunks_model ON entry_chunks(model_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_chunks_unique
ON entry_chunks(entry_id, chunk_index);
