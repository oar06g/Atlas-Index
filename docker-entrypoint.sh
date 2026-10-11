#!/bin/bash
set -Eeo pipefail

# ---------------------------------------------------------------------------
# Atlas Index standalone entrypoint
#
# This container is fully self-contained. On startup it brings up:
#   1. PostgreSQL (with pgvector)  -> internal database + vector embeddings
#   2. Ollama (with nomic-embed-text) -> local embedding model
#   3. The Next.js application server
# ---------------------------------------------------------------------------

export POSTGRES_USER="${POSTGRES_USER:-atlas}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-atlas}"
export POSTGRES_DB="${POSTGRES_DB:-atlasdb}"
export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export OLLAMA_HOME="${OLLAMA_HOME:-/root/.ollama}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-$OLLAMA_HOME/models}"
export ATLAS_DATA_DIR="${ATLAS_DATA_DIR:-/app/data}"

echo "Starting Atlas Index (standalone)..."

PIDS=()

cleanup() {
  trap - EXIT TERM INT
  echo "Shutting down Atlas Index..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  wait >/dev/null 2>&1 || true
  echo "Atlas Index stopped."
}
trap cleanup EXIT TERM INT

# --- 1. PostgreSQL (internal database) ---------------------------------------
echo "Starting PostgreSQL..."
docker-entrypoint.sh postgres &
PIDS+=("$!")

# The official entrypoint first runs a socket-only temporary server while
# initializing the cluster, so waiting for TCP on 127.0.0.1:5432 tells us
# the real server is up.
for _ in $(seq 1 60); do
  pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && break
  sleep 1
done

if ! pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL did not become ready in time" >&2
  exit 1
fi
echo "PostgreSQL is ready."

# Apply schema migrations (idempotent) on every start
echo "Applying database migrations..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 \
  -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -f /app/init.sql

# --- 2. Ollama (embedding model) ---------------------------------------------
# Restore the model baked into the image into the persistent volume (first run)
if [ ! -d "$OLLAMA_MODELS/manifests" ] && [ -d /ollama-staging/models ]; then
  echo "Restoring pre-installed Ollama models into the persistent volume..."
  mkdir -p "$OLLAMA_HOME"
  cp -a /ollama-staging/models "$OLLAMA_HOME/models"
fi

echo "Starting Ollama..."
# Bind on all interfaces so the Ollama API can also be reached from the host
# via the published port. The application itself talks to localhost:11434.
OLLAMA_HOST=0.0.0.0:11434 ollama serve &
PIDS+=("$!")

for _ in $(seq 1 60); do
  curl -fsS http://localhost:11434/ >/dev/null 2>&1 && break
  sleep 1
done

if ! curl -fsS http://localhost:11434/ >/dev/null 2>&1; then
  echo "ERROR: Ollama did not become ready in time" >&2
  exit 1
fi

# Make sure the embedding model is available (only pulls when missing)
if ! ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
  echo "Pulling nomic-embed-text model..."
  ollama pull nomic-embed-text
fi
echo "Ollama is ready."

# --- 3. Application ----------------------------------------------------------
mkdir -p "$ATLAS_DATA_DIR"

echo "Starting Atlas Index application..."
# HOSTNAME is forced to 0.0.0.0 because Docker sets it to the container
# ID at runtime, which would otherwise bind the server to a single
# interface and break in-container healthchecks.
HOSTNAME=0.0.0.0 node /app/server.js &
PIDS+=("$!")

# Keep running until any service exits, then shut everything down
set +e
wait -n
status=$?
set -e

echo "A service exited (status $status); shutting down."
exit "$status"
