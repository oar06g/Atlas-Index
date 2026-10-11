# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: build the Next.js application
# ---------------------------------------------------------------------------
FROM node:20-bookworm AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: one self-contained image with everything inside
#   - PostgreSQL 16 + pgvector   (internal database, stores vector embeddings)
#   - Node.js                    (Next.js standalone server)
#   - Ollama + nomic-embed-text  (local embedding model)
# ---------------------------------------------------------------------------
FROM pgvector/pgvector:pg16

# curl: downloads + container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl zstd \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (same major version as the build stage)
ARG NODE_VERSION=20.20.2
RUN set -eux; \
    dpkgArch="$(dpkg --print-architecture)"; \
    case "$dpkgArch" in \
      amd64) nodeArch="x64" ;; \
      arm64) nodeArch="arm64" ;; \
      *) echo "Unsupported architecture: $dpkgArch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${nodeArch}.tar.xz" -o /tmp/node.tar.xz; \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1; \
    rm -f /tmp/node.tar.xz; \
    node --version; npm --version

# Install Ollama, CPU-only.
#
# The published tarball is ~1.4 GB compressed / ~2.3 GB unpacked and bundles
# GPU runtimes for CUDA, ROCm, Vulkan and MLX (installed under
# lib/ollama/<variant>/). This service only performs CPU embeddings, so we
# extract into /usr/local and then delete the GPU payload. That keeps both the
# final image and the build's peak disk usage small (the earlier build filled
# the host disk and the engine died with SIGBUS during image export).
RUN set -eux; \
    dpkgArch="$(dpkg --print-architecture)"; \
    case "$dpkgArch" in \
      amd64) ollamaArch="amd64" ;; \
      arm64) ollamaArch="arm64" ;; \
      *) echo "Unsupported architecture: $dpkgArch" >&2; exit 1 ;; \
    esac; \
    curl -fSL --retry 5 --retry-delay 5 --retry-all-errors \
      "https://ollama.com/download/ollama-linux-${ollamaArch}.tar.zst" \
      -o /tmp/ollama.tar.zst; \
    zstd -dc /tmp/ollama.tar.zst | tar -x -C /usr/local; \
    rm -f /tmp/ollama.tar.zst; \
    if [ ! -x /usr/local/bin/ollama ] && [ -x /usr/local/ollama ]; then \
      ln -sf /usr/local/ollama /usr/local/bin/ollama; \
    fi; \
    odir=/usr/local/lib/ollama; \
    if [ -d "$odir" ]; then \
      rm -rf "$odir"/cuda_* "$odir"/rocm_* "$odir"/vulkan* "$odir"/mlx_*; \
      find "$odir" -maxdepth 1 -type f \
        \( -name 'libggml-cuda*' -o -name 'libggml-rocm*' -o -name 'libggml-vulkan*' \) \
        -delete; \
    fi; \
    echo 'Ollama runtime libraries kept:'; \
    ls -la "$odir" || true; \
    ollama --version

WORKDIR /app

# Install the standalone Next.js server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Database schema + startup script
COPY init.sql /app/init.sql
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint-atlas.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-atlas.sh \
 && mkdir -p /app/data

# Pre-install the embedding model into the image.
# Models are staged at /ollama-staging so they can be copied into the
# persistent volume on first run.
ENV OLLAMA_MODELS=/root/.ollama/models
RUN set -eux; \
    ollama serve >/dev/null 2>&1 & \
    ollamaPid=$!; \
    for i in $(seq 1 60); do \
      curl -fsS http://localhost:11434/ >/dev/null 2>&1 && break; \
      sleep 2; \
    done; \
    ollama pull nomic-embed-text; \
    echo 'Verifying CPU inference (loads the CPU backend and runs an embedding)...'; \
    curl -fsS http://localhost:11434/api/embed \
      -d '{"model":"nomic-embed-text","input":"atlas-index self test"}' \
      > /tmp/embed.json; \
    grep -q '"embeddings"' /tmp/embed.json; \
    rm -f /tmp/embed.json; \
    kill "$ollamaPid" 2>/dev/null || true; \
    sleep 2; \
    mkdir -p /ollama-staging; \
    mv /root/.ollama/models /ollama-staging/models

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    ATLAS_DATA_DIR=/app/data \
    OLLAMA_HOST=http://localhost:11434 \
    OLLAMA_KEEP_ALIVE=24h \
    POSTGRES_USER=atlas \
    POSTGRES_PASSWORD=atlas \
    POSTGRES_DB=atlasdb

EXPOSE 3000 11434

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-atlas.sh"]
