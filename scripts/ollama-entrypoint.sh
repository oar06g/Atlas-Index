#!/bin/sh
# Ollama startup script. Keep the compose.yml and scripts/ollama-entrypoint.sh
# copies identical.
set -eu

# Pull the embedding model on startup (only downloads when missing) and keep
# the Ollama server in the foreground so Docker can supervise it.
OLLAMA_MODEL="${OLLAMA_MODEL:-nomic-embed-text}"

ollama serve &
ollama_pid=$!

cleanup() {
  kill "$ollama_pid" 2>/dev/null || true
  wait "$ollama_pid" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

until ollama list >/dev/null 2>&1; do
  if ! kill -0 "$ollama_pid" 2>/dev/null; then
    wait "$ollama_pid"
    exit 1
  fi
  echo "Waiting for Ollama..."
  sleep 2
done

ollama pull "$OLLAMA_MODEL"
wait "$ollama_pid"
