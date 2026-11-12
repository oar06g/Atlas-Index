#!/bin/sh
set -eu

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
