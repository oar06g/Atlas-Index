// Seed corpus for Atlas Index.
//
// The goal is a broad, realistic set of notes so semantic search has enough
// variety to rank. Everything here is original, generic technical material.
// Keep each entry focused on one subject; the seed script chunks long content.

export const categories = [
  "docker",
  "postgresql",
  "nextjs",
  "typescript",
  "linux",
  "networking",
  "security",
  "git",
  "ai",
  "atlas-index",
  "productivity",
];

export const entries = [
  {
    title: "Docker Compose healthchecks and startup ordering",
    category: "docker",
    tags: ["docker", "compose", "healthcheck", "startup-order"],
    summary:
      "How to make an app wait for PostgreSQL or Ollama to be ready instead of only waiting for the container to start.",
    content: `# Docker Compose healthchecks and startup ordering

A plain depends_on only waits for the container process to start. It does not guarantee that PostgreSQL is accepting connections or that Ollama has loaded a model.

Use a healthcheck and the long-form dependency condition:

    services:
      db:
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U atlas -d atlasdb"]
          interval: 10s
          timeout: 5s
          retries: 5
      app:
        depends_on:
          db:
            condition: service_healthy

Useful healthcheck fields:

- interval: how often to run the check.
- timeout: maximum duration of one check.
- retries: failures allowed before the container becomes unhealthy.
- start_period: grace time for a slow first boot.

A healthcheck does not restart an unhealthy container by itself. The application should also retry database and model-server connections with backoff. Treat healthchecks as traffic control, not as a replacement for resilient startup code.`,
  },
  {
    title: "Debugging a Docker container that exits immediately",
    category: "docker",
    tags: ["docker", "logs", "debugging", "exit-code"],
    summary:
      "A practical checklist for containers that start and stop before you can inspect them.",
    content: `# Debugging a container that exits immediately

Start with the container state and logs:

    docker ps -a
    docker logs --tail 100 container-name
    docker inspect container-name

Common exit codes:

- 0: the main process finished successfully. A one-shot command is not necessarily a crash.
- 1: application error, missing file, failed validation, or a bad command.
- 126: command found but not executable.
- 127: command not found, often a broken entrypoint or PATH.
- 137: killed by SIGKILL, commonly out-of-memory or an external stop.
- 143: graceful SIGTERM shutdown.

Override the entrypoint to get a shell:

    docker run --rm -it --entrypoint sh image-name

Then inspect environment variables, file permissions, mounted paths, and the actual command. Also check whether the process expects to run in the foreground. A daemonized process can make the container exit immediately because the main process returns.`,
  },
  {
    title: "Docker volumes vs bind mounts",
    category: "docker",
    tags: ["docker", "volumes", "bind-mounts", "persistence"],
    summary:
      "When to use a named volume and when a host bind mount is the better tool.",
    content: `# Docker volumes vs bind mounts

A named volume is managed by Docker and stored outside the container lifecycle. It is the usual choice for database data, model caches, and anything that must survive container re-creation.

    volumes:
      postgres_data:

    services:
      db:
        volumes:
          - postgres_data:/var/lib/postgresql/data

A bind mount maps a host path directly into the container:

    volumes:
      - ./queries/init.sql:/docker-entrypoint-initdb.d/10-init.sql:ro

Bind mounts are useful for configuration files and local development because edits are visible immediately. They also depend on host paths, permissions, and line endings, so they make a Compose file less portable.

Practical rules:

- Use a named volume for mutable application data.
- Use a read-only bind mount for local config you are actively editing.
- Back up volumes with a temporary container or a database dump.
- On Windows, be careful with CRLF scripts and file permissions.
- Avoid bind-mounting node_modules across operating systems.`,
  },
  {
    title: "Multi-stage Docker builds for Node.js applications",
    category: "docker",
    tags: ["docker", "nodejs", "multi-stage", "build"],
    summary:
      "A repeatable pattern for building a small production image from a Node.js or Next.js app.",
    content: `# Multi-stage Docker builds for Node.js applications

A multi-stage build separates dependency installation and compilation from the runtime image.

    FROM node:20-alpine AS deps
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci

    FROM node:20-alpine AS builder
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    RUN npm run build

    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    USER node
    CMD ["node", "server.js"]

Copy package files before source files so Docker can reuse the dependency layer when only application code changes. Use a .dockerignore that excludes node_modules, .next, .git, logs, and local environment files. Run the final container as a non-root user when possible.`,
  },
  {
    title: "Docker service discovery and container networking",
    category: "docker",
    tags: ["docker", "networking", "dns", "compose"],
    summary:
      "Why localhost inside a container is not the host, and how Compose service names resolve.",
    content: `# Docker service discovery and container networking

Containers on the same user-defined Docker network can reach each other by service name. Compose creates a network for the project, so an app container can connect to a database at the hostname db and to Ollama at ollama.

Inside a container, localhost refers to that container, not to your laptop. A database running on the host is not available at localhost:5432 from inside the app container.

Options for host access:

- On Docker Desktop, host.docker.internal usually points to the host.
- On Linux, use the bridge gateway address or add an explicit host mapping.
- Prefer putting the service in the same Compose network.

ports publishes a container port to the host. expose only documents internal access and does not publish anything. For a database used only by the app, publishing the port is optional and reduces exposure. For local development, publishing it can be convenient.`,
  },
  {
    title: "Docker build cache and layer ordering",
    category: "docker",
    tags: ["docker", "cache", "buildkit", "performance"],
    summary:
      "Why Docker rebuilds dependencies on every change and how to order layers to avoid it.",
    content: `# Docker build cache and layer ordering

Docker caches each layer. A layer is invalidated when its instruction or input files change, and every later layer is rebuilt.

The common Node.js mistake is copying the whole project before npm ci:

    COPY . .
    RUN npm ci

Any source edit invalidates the dependency layer. Copy only the manifests first:

    COPY package.json package-lock.json ./
    RUN npm ci
    COPY . .

Other useful practices:

- Use a .dockerignore to keep .git, node_modules, .next, logs, and secrets out of the build context.
- Use BuildKit cache mounts for package managers when appropriate.
- Keep frequently changing files near the end of the Dockerfile.
- Pin base image versions for reproducible builds.
- Avoid running apt-get update in one layer and install in another; combine them.

Inspect the build output to see which steps hit the cache and which steps rerun.`,
  },
  {
    title: "Running Ollama in Docker",
    category: "docker",
    tags: ["ollama", "docker", "embeddings", "model"],
    summary:
      "The important settings for a local Ollama service used by an embedding pipeline.",
    content: `# Running Ollama in Docker

Ollama stores downloaded models under /root/.ollama inside the container. Mount a named volume there or every restart will re-download the model.

    services:
      ollama:
        image: ollama/ollama:latest
        volumes:
          - ollama_data:/root/.ollama

Set OLLAMA_HOST to 0.0.0.0:11434 so the server listens on the container network rather than only on loopback. Other containers reach it by service name, for example http://ollama:11434. The host reaches it through a published port.

A useful startup bootstrap starts the server, waits until it responds, then pulls the configured model:

    ollama serve &
    until ollama list; do sleep 2; done
    ollama pull nomic-embed-text

Healthchecks should verify that the model is present, not only that the API is up. Keep the server in the foreground so Docker can supervise it. GPU access requires the appropriate container runtime configuration; CPU-only deployments work but are slower.`,
  },

  {
    title: "Finding slow PostgreSQL queries with pg_stat_statements",
    category: "postgresql",
    tags: ["postgresql", "performance", "pg-stat-statements", "queries"],
    summary:
      "Use pg_stat_statements to find the queries that consume the most database time.",
    content: `# Finding slow PostgreSQL queries with pg_stat_statements

Enable the extension in postgresql.conf with shared_preload_libraries, restart PostgreSQL, then run:

    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

Find statements by total execution time:

    SELECT calls,
           round(total_exec_time::numeric, 2) AS total_ms,
           round(mean_exec_time::numeric, 2) AS mean_ms,
           rows,
           query
    FROM pg_stat_statements
    ORDER BY total_exec_time DESC
    LIMIT 20;

Also sort by mean_exec_time to catch individually slow queries, and by calls to catch frequent small queries with high cumulative cost. Reset statistics after a deployment or benchmark:

    SELECT pg_stat_statements_reset();

The view normalizes literals, so one row can represent many query variants. Use the query text and the queryid to identify patterns. Missing indexes, N+1 access patterns, and large sorts usually show up here first.`,
  },
  {
    title: "Reading PostgreSQL EXPLAIN ANALYZE output",
    category: "postgresql",
    tags: ["postgresql", "explain", "query-plan", "performance"],
    summary:
      "What to look at in a query plan before adding another index.",
    content: `# Reading PostgreSQL EXPLAIN ANALYZE output

EXPLAIN shows the planner estimate. EXPLAIN ANALYZE actually runs the query and reports measured time and rows.

    EXPLAIN (ANALYZE, BUFFERS)
    SELECT * FROM entries WHERE status = 'embedded' ORDER BY created_at DESC LIMIT 20;

Read the plan from the innermost node outward. Important fields:

- actual time: time per loop, followed by total time.
- rows: estimated rows versus actual rows.
- loops: how many times the node ran.
- Buffers: shared hits and reads.

A large gap between estimated and actual rows often points to stale statistics, correlated columns, or a poor selectivity estimate. A sequential scan is not automatically bad; it can be correct for a small table or a query returning a large fraction of rows. Look for repeated expensive nodes, large sorts, and nested loops that run far more times than expected. Run ANALYZE after large data changes.`,
  },
  {
    title: "PostgreSQL index types and when to use them",
    category: "postgresql",
    tags: ["postgresql", "indexes", "btree", "gin", "brin"],
    summary:
      "A quick map from query shape to the PostgreSQL index type that fits it.",
    content: `# PostgreSQL index types and when to use them

B-tree is the default and handles equality, ranges, sorting, and prefix matching. Use it for foreign keys, timestamps, and columns used in ORDER BY.

GIN is designed for composite values such as arrays, JSONB, and full-text search. It is a good fit for tag arrays and document search, but writes can be more expensive.

GiST supports geometric data, ranges, and some full-text use cases. BRIN is compact and useful for very large, naturally ordered tables such as append-only logs or time-series data.

Hash indexes support equality only and are rarely the first choice. Partial indexes index only rows that match a predicate, which is useful for status queues:

    CREATE INDEX idx_entries_pending
    ON entries (created_at)
    WHERE status = 'pending';

Covering indexes with INCLUDE can answer a query without visiting the table, at the cost of more index storage. Measure with EXPLAIN ANALYZE; do not add indexes speculatively.`,
  },
  {
    title: "pgvector cosine distance and HNSW indexes",
    category: "postgresql",
    tags: ["pgvector", "postgresql", "embeddings", "hnsw", "similarity"],
    summary:
      "How vector similarity search works in PostgreSQL and where an HNSW index helps.",
    content: `# pgvector cosine distance and HNSW indexes

pgvector adds a vector column type and distance operators. For normalized embeddings, cosine distance is a common choice:

    SELECT id, 1 - (embedding <=> query_vector) AS similarity
    FROM entry_chunks
    ORDER BY embedding <=> query_vector
    LIMIT 10;

The <=> operator returns cosine distance, so 1 minus distance is similarity. Other operators include <-> for Euclidean distance and <#> for negative inner product.

An HNSW index speeds up approximate nearest-neighbor searches:

    CREATE INDEX idx_chunks_embedding
    ON entry_chunks
    USING hnsw (embedding vector_cosine_ops);

Build the index after loading a large batch, because index maintenance adds cost during inserts. Approximate indexes trade a small amount of recall for speed. Always filter by the embedding model id when a table can contain vectors from multiple models, and verify that vector dimensions match the configured model.`,
  },
  {
    title: "PostgreSQL backup and restore with pg_dump",
    category: "postgresql",
    tags: ["postgresql", "backup", "restore", "pg-dump"],
    summary:
      "A simple, testable backup routine for a self-hosted PostgreSQL database.",
    content: `# PostgreSQL backup and restore with pg_dump

Use the custom format for portable, compressed dumps:

    pg_dump -U atlas -d atlasdb -Fc -f atlasdb.dump

Inside Docker:

    docker compose exec -T db pg_dump -U atlas -d atlasdb -Fc > atlasdb.dump

Restore into a fresh database:

    createdb -U atlas atlasdb_restore
    pg_restore -U atlas -d atlasdb_restore atlasdb.dump

The most important part is testing the restore. A backup that has never been restored is only a hypothesis. Restore into a temporary database, run a few queries, and compare row counts.

For recurring backups, write to a timestamped file and delete old copies according to a retention policy. Store backups outside the Docker volume. If the database contains large vector tables, consider whether you need all chunks or only the source entries and can rebuild embeddings later.`,
  },
  {
    title: "Idempotent schema changes for small applications",
    category: "postgresql",
    tags: ["postgresql", "schema", "migrations", "init-sql"],
    summary:
      "Patterns that let an initialization script run repeatedly without failing.",
    content: `# Idempotent schema changes for small applications

A schema script should be safe to run more than once. PostgreSQL supports several idempotent forms:

    CREATE TABLE IF NOT EXISTS entries (...);
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS summary TEXT;
    CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
    INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

Use a transaction when the script contains related changes. Keep destructive operations, such as dropping columns, out of an automatic init script; they need an explicit migration and a backup.

For a small self-hosted app, an idempotent SQL file can run on database initialization and also be applied manually to an existing database. That works well until changes become conditional or data migrations are needed. At that point, use numbered migration files and a migration history table.

Always know whether a script is intended for a fresh database, an existing database, or both. The difference matters.`,
  },
  {
    title: "Debugging too many PostgreSQL connections",
    category: "postgresql",
    tags: ["postgresql", "connections", "pooling", "debugging"],
    summary:
      "Why the connection limit is reached and how to find the clients that hold sessions open.",
    content: `# Debugging too many PostgreSQL connections

When PostgreSQL reports too many clients already, inspect pg_stat_activity:

    SELECT pid, usename, application_name, client_addr,
           state, wait_event_type, query_start, query
    FROM pg_stat_activity
    ORDER BY query_start;

Look for sessions that are idle in transaction, which hold locks and resources. Check max_connections and how many connections each application process creates.

Common causes:

- Every request creates a new pool or client and never closes it.
- A serverless function opens a connection per invocation.
- A development server hot-reloads and leaves old pools behind.
- A script forgets to call client.end() or pool.end().
- A pool size is set much larger than the database can handle.

Use one pool per application process, set a small max size, configure idle timeouts, and close the pool during graceful shutdown. For many small processes, put PgBouncer in front of PostgreSQL.`,
  },
  {
    title: "Full-text search vs vector search",
    category: "postgresql",
    tags: ["postgresql", "search", "full-text", "vectors", "hybrid-search"],
    summary:
      "The strengths and failure modes of keyword search and embedding search, and why hybrid ranking often wins.",
    content: `# Full-text search vs vector search

PostgreSQL full-text search uses tsvector and tsquery. It is strong for exact terms, names, identifiers, error messages, and language stemming:

    SELECT title
    FROM entries
    WHERE to_tsvector('english', title || ' ' || content)
          @@ plainto_tsquery('english', 'postgres connection pool');

Vector search embeds text and compares semantic similarity. It handles paraphrases and conceptual queries, but can miss exact identifiers and can return plausible but irrelevant neighbors.

A practical hybrid approach:

1. Retrieve candidates with vector similarity.
2. Retrieve candidates with full-text ranking.
3. Merge and deduplicate by entry id.
4. Optionally rerank with a cross-encoder or a small language model.

Keep the two result sets visible during development. If vector search fails, full-text search is a useful fallback. If full-text search returns nothing, embeddings can still find related concepts. Neither method replaces a good evaluation set.`,
  },
  {
    title: "Connection pooling for small PostgreSQL applications",
    category: "postgresql",
    tags: ["postgresql", "pool", "nodejs", "performance"],
    summary:
      "Keep one bounded pool per process and avoid creating connections per request.",
    content: `# Connection pooling for small PostgreSQL applications

Creating a PostgreSQL connection for every HTTP request is expensive and easy to get wrong. In Node.js, create one pool when the process starts and reuse it:

    import pg from "pg";
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

Set max based on the database capacity and the number of application replicas. Ten processes with a pool of twenty each can still overwhelm a database with a low max_connections.

Always parameterize queries; never interpolate user input into SQL. Use transactions for related writes, and release clients in a finally block when checking one out manually. On shutdown, stop accepting requests, drain in-flight work, and call pool.end().

For serverless platforms, a traditional pool may not fit. Use a serverless-friendly driver or an external pooler such as PgBouncer.`,
  },

  {
    title: "Server Components vs Client Components in the App Router",
    category: "nextjs",
    tags: ["nextjs", "react", "server-components", "app-router"],
    summary:
      "A simple rule for deciding where the client boundary belongs.",
    content: `# Server Components vs Client Components in the App Router

In the Next.js App Router, components are Server Components by default. They can read data, access server-only resources, and avoid shipping their implementation to the browser.

Add the use client directive only when a component needs:

- State or event handlers.
- Effects or browser APIs.
- A client-only library.
- Context that must run in the browser.

Props crossing from a Server Component to a Client Component must be serializable. Functions and arbitrary class instances cannot cross the boundary.

Keep the client boundary as deep as possible. A page can remain a Server Component while a small interactive widget is a Client Component. Do not mark an entire route as client-side just because one button needs state. This preserves streaming and reduces the JavaScript bundle.`,
  },
  {
    title: "Next.js App Router caching and revalidation",
    category: "nextjs",
    tags: ["nextjs", "caching", "revalidation", "app-router"],
    summary:
      "Why a page shows stale data and how to invalidate the right cache.",
    content: `# Next.js App Router caching and revalidation

Next.js can cache rendered output and data fetches. Stale content usually means a cache was not invalidated at the right layer.

Useful tools:

- revalidatePath invalidates a route path.
- revalidateTag invalidates tagged data.
- Dynamic APIs such as cookies, headers, and searchParams opt a route into dynamic rendering.
- Route segment config can force dynamic or static behavior.

After a database write, invalidate the pages that display the changed data. If a mutation happens in an API route, call the revalidation helper after the write succeeds, not before.

Be careful with cacheComponents and partial prerendering: a static shell can be cached while a dynamic hole streams later. Test the behavior with a production build, not only the development server, because development often disables caching.

When debugging, identify whether the stale value is in the browser, the CDN, the server cache, or the database.`,
  },
  {
    title: "Suspense and useParams in Next.js 16",
    category: "nextjs",
    tags: ["nextjs", "react", "suspense", "use-params"],
    summary:
      "How to avoid prerender errors when a client component reads route parameters.",
    content: `# Suspense and useParams in Next.js 16

useParams is a client hook. During prerendering, Next.js may need a Suspense boundary around a component that calls it. The symptom is a build error or a warning about missing suspense.

A safe structure is:

    page.tsx        Server Component
      Suspense      fallback skeleton
        EntryClient Client Component
          useParams()

Keep the fallback close to the shape of the final content to avoid layout shift. Do not read params in a context provider above the Suspense boundary unless the provider can handle the missing value.

For a dynamic route such as entry/[slug], the page can pass params to a child. If the child is a Client Component and uses hooks, wrap it in Suspense explicitly. Test both the development server and the production build, because prerendering behavior can differ.`,
  },
  {
    title: "API route error handling in Next.js",
    category: "nextjs",
    tags: ["nextjs", "api", "errors", "http"],
    summary:
      "Return consistent JSON errors and map database failures to useful status codes.",
    content: `# API route error handling in Next.js

Every route handler should have a clear failure contract. A useful shape is:

    { "success": false, "error": "Human-readable message", "details": "optional" }

Use appropriate status codes:

- 400 for invalid input.
- 401 or 403 for authentication and authorization.
- 404 for a missing resource.
- 409 for a uniqueness conflict.
- 422 for semantically invalid data.
- 500 for an unexpected server failure.

Wrap database calls and parse errors explicitly. PostgreSQL error codes are useful: 23505 is a unique violation, 23503 is a foreign-key violation, and 22P02 is an invalid input representation.

Log the full error on the server, but do not return stack traces, SQL, connection strings, or secrets to the client. In production, include a request id so logs and user reports can be correlated without exposing internals.`,
  },
  {
    title: "Next.js standalone output for Docker",
    category: "nextjs",
    tags: ["nextjs", "docker", "standalone", "deployment"],
    summary:
      "The production files a standalone Next.js container actually needs.",
    content: `# Next.js standalone output for Docker

Set output to standalone in next.config.ts. The build then produces a minimal server bundle under .next/standalone.

A typical runtime image copies:

    .next/standalone   application server and dependencies
    .next/static       client assets
    public             public files

Then start with node server.js. Set PORT and HOSTNAME so the server listens on all interfaces inside the container. HOSTNAME=0.0.0.0 is a common choice.

Do not copy the entire project or the full node_modules directory into the final image. That defeats the purpose of standalone output.

If the build needs a public directory but the repository does not have one, create it in the Dockerfile before copying. Also confirm that the server can read any runtime files it expects. Build-time environment variables are baked into the output; runtime secrets must be provided by the environment, not by NEXT_PUBLIC variables.`,
  },
  {
    title: "Environment variables in Next.js",
    category: "nextjs",
    tags: ["nextjs", "environment", "secrets", "docker"],
    summary:
      "What is public, what is server-only, and why a variable might be undefined in the browser.",
    content: `# Environment variables in Next.js

Variables prefixed with NEXT_PUBLIC_ are inlined into client bundles at build time. They are public forever. Never put an API key, database password, or signing secret in a NEXT_PUBLIC_ variable.

Server-only variables are read in Server Components, route handlers, or server utilities. They can be provided at runtime in Docker.

Practical rules:

- Keep .env files out of Git.
- Provide a .env.example with safe defaults.
- Use runtime environment variables for secrets.
- Rebuild when a NEXT_PUBLIC_ value changes, because the old value was compiled into the bundle.
- Validate required variables at startup and fail with a clear message.
- Do not log entire environment objects; they often contain credentials.

If a value is undefined in the browser, first check whether it needs the public prefix. If it is undefined on the server, check the container environment and the order in which .env files are loaded.`,
  },
  {
    title: "Debugging hydration mismatches in React",
    category: "nextjs",
    tags: ["react", "nextjs", "hydration", "debugging"],
    summary:
      "Why server HTML and client HTML disagree, and how to find the real source.",
    content: `# Debugging hydration mismatches in React

Hydration errors happen when the HTML produced on the server differs from what React renders in the browser. Typical causes:

- Rendering the current date or time during initial render.
- Using Math.random or generated ids.
- Reading window, localStorage, or browser-only APIs during render.
- Invalid HTML nesting that the browser repairs differently.
- Browser extensions injecting markup.
- Locale or timezone differences.

The best fix is to make the first client render match the server. Move browser-only values into an effect or render them only after mount. Do not reach for suppressHydrationWarning unless the mismatch is genuinely intentional and unavoidable.

To isolate the problem, reproduce in a private window with extensions disabled, simplify the component tree, and compare the server HTML with the client output. Fix the source rather than hiding the warning.`,
  },
  {
    title: "Streaming and partial prerendering in Next.js",
    category: "nextjs",
    tags: ["nextjs", "streaming", "partial-prerendering", "suspense"],
    summary:
      "Use Suspense boundaries to ship a useful static shell while slower data loads.",
    content: `# Streaming and partial prerendering in Next.js

Streaming lets the server send a static shell immediately and fill slower sections as data becomes available. In the App Router, Suspense boundaries define the holes.

Keep the shell useful: navigation, headings, and layout should render without waiting for the slowest query. Place the boundary around the data-dependent component, not around the whole page.

Partial prerendering combines a static shell with dynamic content that streams later. It is a good fit for pages with mostly stable layout and a few personalized or real-time sections.

Avoid making everything dynamic just to remove a loading state. Also avoid creating a Suspense boundary for every tiny component; too many boundaries can fragment the layout and make loading states noisy.

Measure with a production build. Development behavior is not a reliable proxy for caching, prefetching, or streaming.`,
  },

  {
    title: "Discriminated unions for API results",
    category: "typescript",
    tags: ["typescript", "api", "union-types", "errors"],
    summary:
      "Model success and failure explicitly so callers cannot forget error handling.",
    content: `# Discriminated unions for API results

A boolean flag plus optional fields makes invalid states possible. A discriminated union is safer:

    type Result =
      | { ok: true; data: Entry }
      | { ok: false; error: string };

    function handle(result: Result) {
      if (result.ok) {
        return result.data.title;
      }
      return result.error;
    }

TypeScript narrows the union inside each branch. With exhaustive checks, adding a new variant makes the compiler point to every place that needs an update:

    default: {
      const neverValue: never = result;
      throw new Error("Unhandled result: " + String(neverValue));
    }

Use literal properties such as ok, status, or kind as discriminants. This pattern works well for API responses, job states, and parsed input. It is more explicit than throwing everywhere and easier to test.`,
  },
  {
    title: "unknown vs any in TypeScript",
    category: "typescript",
    tags: ["typescript", "unknown", "any", "type-safety"],
    summary:
      "Use unknown for values you have not validated yet, and keep any out of application code.",
    content: `# unknown vs any in TypeScript

any disables type checking for a value and lets mistakes spread silently. unknown also accepts any value, but requires narrowing before use:

    function parse(input: unknown) {
      if (typeof input !== "object" || input === null) {
        throw new Error("Expected an object");
      }
      if (!("title" in input) || typeof input.title !== "string") {
        throw new Error("Expected a title");
      }
      return input.title;
    }

Good places for unknown:

- JSON.parse results.
- Catch clause values.
- Values from environment variables.
- Data received from a network or database boundary.

Use type guards or a schema validator to turn unknown into a trusted domain type. Keep any for rare interoperability escape hatches, and isolate it behind a small typed wrapper. Do not let any leak into shared application code.`,
  },
  {
    title: "Runtime validation at application boundaries",
    category: "typescript",
    tags: ["typescript", "validation", "json", "api"],
    summary:
      "Static types disappear at runtime, so validate data where it enters the application.",
    content: `# Runtime validation at application boundaries

A TypeScript type is not a runtime guarantee. JSON from an API, a request body, a database row, or an environment variable can have any shape.

Validate at boundaries:

- Parse the request body and check required fields.
- Validate environment variables at startup.
- Treat database rows as unknown until mapped.
- Validate third-party API responses before using them.

A small manual guard is often enough:

    function isCreateEntry(value: unknown): value is CreateEntry {
      if (typeof value !== "object" || value === null) return false;
      const candidate = value as Record<string, unknown>;
      return typeof candidate.title === "string" &&
             typeof candidate.content === "string";
    }

For larger schemas, use a validation library and derive types from the schema so validation and types cannot drift. Return a clear 400 response with field-level details instead of letting an invalid value fail deep inside the database layer.`,
  },
  {
    title: "TypeScript generics and constraints",
    category: "typescript",
    tags: ["typescript", "generics", "constraints", "inference"],
    summary:
      "Use generics to preserve relationships between types, not to make simple functions look complex.",
    content: `# TypeScript generics and constraints

A generic function should express a relationship between inputs and outputs.

    function first<T>(items: T[]): T | undefined {
      return items[0];
    }

Constraints restrict the accepted types:

    function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
      return items.map((item) => item[key]);
    }

Here K is constrained to keys of T, so the return type is precise. Defaults can reduce noise:

    type ApiResponse<T, E = string> =
      | { ok: true; data: T }
      | { ok: false; error: E };

Avoid generics when a concrete type is clearer. A function that only accepts strings should take string, not T extends string. Prefer inference over explicit type arguments at call sites. If callers constantly need to write the generic arguments, the API is probably too complicated.`,
  },
  {
    title: "TypeScript strict mode benefits",
    category: "typescript",
    tags: ["typescript", "strict", "configuration", "safety"],
    summary:
      "What strict mode catches and how to adopt it without rewriting everything at once.",
    content: `# TypeScript strict mode benefits

Strict mode enables a group of checks that catch common bugs:

- strictNullChecks: null and undefined are distinct types.
- noImplicitAny: values cannot silently become any.
- strictFunctionTypes: function parameter checking is safer.
- useUnknownInCatchVariables: caught errors start as unknown.
- exactOptionalPropertyTypes: optional properties cannot be assigned undefined accidentally.

Adopting strict mode in an existing codebase can be incremental. Start with noImplicitAny and strictNullChecks, fix the highest-risk modules, and add the remaining flags as the codebase improves.

Do not silence errors with non-null assertions everywhere. A non-null assertion is a claim to the compiler; if the value can actually be missing, handle it. Prefer explicit guards, default values, and narrow types at boundaries.`,
  },
  {
    title: "ESM vs CommonJS in Node.js",
    category: "typescript",
    tags: ["nodejs", "esm", "commonjs", "modules"],
    summary:
      "The practical differences between import and require, and why a file extension can matter.",
    content: `# ESM vs CommonJS in Node.js

CommonJS uses require and module.exports. ESM uses import and export. Modern Node.js supports both, but the rules differ.

To use ESM, set "type": "module" in package.json or use the .mjs extension. ESM requires explicit file extensions in relative imports, and __dirname is not defined by default.

    import { readFile } from "node:fs/promises";
    import { fileURLToPath } from "node:url";

    const filename = fileURLToPath(import.meta.url);

CommonJS can often import ESM only through dynamic import, while ESM can import many CommonJS packages through interop. Some tooling and older packages still assume CommonJS.

Choose one module system for a new project and be consistent. When mixing, isolate the boundary and test the production build, not only the development runner.`,
  },

  {
    title: "Troubleshooting a full Linux disk",
    category: "linux",
    tags: ["linux", "disk", "debugging", "logs"],
    summary:
      "Find what is consuming disk space, including deleted files that are still open.",
    content: `# Troubleshooting a full Linux disk

Start with filesystem usage:

    df -h
    df -i

The second command checks inode exhaustion, which can happen with millions of tiny files even when free bytes remain.

Find large directories without crossing other filesystems:

    du -xhd1 / | sort -h

Find large files:

    find /var -type f -size +500M -print

If df reports a full disk but du does not find a matching directory, a deleted file may still be held open by a process:

    lsof +L1

Restart or truncate the process holding the file. Check logs, package caches, Docker images and volumes, and old backups. For Docker specifically:

    docker system df
    docker image prune

Avoid deleting files you do not understand. Free a little space first so the system can operate, then investigate.`,
  },
  {
    title: "Debugging a systemd service",
    category: "linux",
    tags: ["linux", "systemd", "services", "logs"],
    summary:
      "A repeatable sequence for a service that fails to start or keeps restarting.",
    content: `# Debugging a systemd service

Start with the unit state and the recent logs:

    systemctl status my-service
    journalctl -u my-service --since "30 minutes ago"

Check the unit file:

    systemctl cat my-service

Common problems:

- ExecStart points to the wrong path.
- The service runs as a user without permission to read files or bind a port.
- Environment variables are missing.
- The working directory is not set.
- A dependency failed to start.
- The process daemonizes and systemd thinks it exited.

After editing a unit file, run systemctl daemon-reload. Start the service in the foreground for debugging, or temporarily override the unit with systemctl edit. Remember that a service which exits successfully may still be restarted by Restart=always. Inspect the exit code and the last log lines before guessing.`,
  },
  {
    title: "Finding large files and directories on Linux",
    category: "linux",
    tags: ["linux", "files", "disk-usage", "du"],
    summary:
      "Use du, find, and ncdu to locate the directories that are actually large.",
    content: `# Finding large files and directories on Linux

Sort the top-level directories by size:

    du -xhd1 /srv | sort -h

Drill into the largest one:

    du -xhd1 /srv/data | sort -h

Find files above a threshold:

    find /srv -type f -size +100M -printf "%s %p\n" | sort -n

The -x flag keeps du on one filesystem, which avoids misleading totals from mounted volumes. Use apparent size when sparse files or compression are involved.

Interactive tools such as ncdu are convenient on a server:

    ncdu -x /srv

Once you find a large candidate, check whether it is a log, a cache, a backup, a database file, or a deleted-but-open file. Deleting the obvious file is not always safe. Prefer log rotation, cache cleanup, and retention policies over one-off deletions.`,
  },
  {
    title: "SSH key permissions and agent setup",
    category: "linux",
    tags: ["linux", "ssh", "keys", "permissions"],
    summary:
      "Fix permission denied errors and use an agent without weakening key security.",
    content: `# SSH key permissions and agent setup

OpenSSH is strict about permissions. The .ssh directory should be 700 and private keys should be 600:

    chmod 700 ~/.ssh
    chmod 600 ~/.ssh/id_ed25519
    chmod 644 ~/.ssh/id_ed25519.pub
    chmod 600 ~/.ssh/config

Copy a public key to a server:

    ssh-copy-id user@host

Start an agent and add the key:

    eval "$(ssh-agent -s)"
    ssh-add ~/.ssh/id_ed25519

Use a config file to avoid repeating host settings:

    Host myserver
      HostName 203.0.113.10
      User deploy
      IdentityFile ~/.ssh/id_ed25519

For connection problems, run ssh -vvv user@host and read the key exchange and authentication stages. Do not fix permission errors by making keys world-readable. That defeats the purpose of the key.`,
  },
  {
    title: "Graceful shutdown and signals in Node.js",
    category: "linux",
    tags: ["nodejs", "signals", "shutdown", "docker"],
    summary:
      "Stop accepting work, finish in-flight requests, close resources, and exit cleanly.",
    content: `# Graceful shutdown and signals in Node.js

A container or service manager sends SIGTERM before stopping a process. The application should stop accepting new work, finish in-flight requests, close database and model clients, and then exit.

    let shuttingDown = false;

    async function shutdown(signal) {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log("Received " + signal + ", shutting down");
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

Use an init process or exec-form command in Docker so signals reach Node instead of being swallowed by a shell. Set a termination grace period longer than your shutdown timeout. If the process is in the middle of an embedding job, decide whether to finish the batch, mark it resumable, or leave it pending for the next startup.`,
  },
  {
    title: "Filtering logs with journalctl",
    category: "linux",
    tags: ["linux", "journalctl", "logs", "systemd"],
    summary:
      "Useful journalctl flags for finding the lines that matter during an incident.",
    content: `# Filtering logs with journalctl

Follow a service in real time:

    journalctl -u my-service -f

Limit by time:

    journalctl -u my-service --since "2026-11-16 10:00" --until "2026-11-16 11:00"

Show only warnings and errors:

    journalctl -p warning -u my-service

Search for a request id or error string:

    journalctl -u my-service --grep "request_id=abc123"

Output JSON for structured processing:

    journalctl -u my-service -o json --since today

Practical tips:

- Use a stable request id in application logs.
- Log the start and end of background jobs.
- Avoid logging secrets or full request bodies.
- Check the system journal as well as the unit journal; the failure may be outside the service.
- If logs are missing, confirm the unit uses the journal or a configured output file.`,
  },

  {
    title: "DNS troubleshooting checklist",
    category: "networking",
    tags: ["networking", "dns", "dig", "troubleshooting"],
    summary:
      "Work from the resolver outward to find why a name does not resolve.",
    content: `# DNS troubleshooting checklist

Query the name directly:

    dig example.com
    dig example.com A
    dig example.com AAAA
    dig @1.1.1.1 example.com

Check the resolver configuration:

    cat /etc/resolv.conf

Look at the status, answer section, authority section, and TTL. NXDOMAIN means the name does not exist from that resolver's point of view. SERVFAIL usually points to an upstream or DNSSEC problem.

Common causes:

- The record was changed but the old TTL is still active.
- The client uses a different resolver than the one you tested.
- Split-horizon DNS returns an internal address only inside the network.
- A search domain is being appended unexpectedly.
- IPv6 is preferred and the AAAA record is wrong.
- A local hosts file overrides DNS.

Test from the same network and container as the failing client. A result from your laptop is not proof that the container sees the same answer.`,
  },
  {
    title: "Debugging HTTP requests with curl",
    category: "networking",
    tags: ["curl", "http", "debugging", "api"],
    summary:
      "Use curl verbosity, headers, and timing output to isolate an API problem.",
    content: `# Debugging HTTP requests with curl

Show the request and response headers:

    curl -v https://api.example.com/health

Include response headers in the output:

    curl -i https://api.example.com/health

Send JSON:

    curl -X POST https://api.example.com/entries \
      -H "Content-Type: application/json" \
      -d '{"title":"Test","content":"Hello"}'

Follow redirects and show the final URL:

    curl -L -v https://example.com

Measure timing:

    curl -o /dev/null -s -w "dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} total=%{time_total}\n" https://example.com

If DNS works but the connection hangs, check the port, firewall, and proxy. If TLS fails, inspect the certificate chain and SNI. If a request works from the host but not from a container, compare DNS, routes, and proxy environment variables.`,
  },
  {
    title: "Checking listening ports on Linux",
    category: "networking",
    tags: ["linux", "networking", "ports", "ss"],
    summary:
      "Find which process is listening, and why a service is reachable locally but not remotely.",
    content: `# Checking listening ports on Linux

List listening TCP sockets with process information:

    ss -ltnp

Show all sockets:

    ss -lunp

Legacy alternative:

    netstat -ltnp

If a service listens on 127.0.0.1:3000, it is reachable only through the loopback interface. A container or remote client cannot connect to it. Listening on 0.0.0.0 accepts connections on all IPv4 interfaces; use a firewall or reverse proxy to control access.

Check whether a port is occupied:

    lsof -i :3000

If the process listens but the connection is refused from outside, check:

- The bind address.
- Host firewall rules.
- Cloud security groups.
- Docker port publishing.
- A reverse proxy or load balancer in front of the service.

Use curl or nc from the same network path as the client, not only from the server itself.`,
  },
  {
    title: "Reverse proxy headers and client IP",
    category: "networking",
    tags: ["networking", "reverse-proxy", "headers", "client-ip"],
    summary:
      "How X-Forwarded-For and X-Forwarded-Proto work, and why trust matters.",
    content: `# Reverse proxy headers and client IP

When a reverse proxy forwards a request, the application sees the proxy as the direct client. Proxies add headers such as X-Forwarded-For and X-Forwarded-Proto to preserve the original request context.

X-Forwarded-For is a comma-separated chain. The leftmost value is usually the original client, but clients can spoof the header if the proxy appends rather than replaces it. Only trust forwarded headers from proxies you control.

Configure the framework's trust proxy setting to match the actual network topology. If the app trusts every proxy, rate limiting and audit logs can be bypassed with a forged header.

Use X-Forwarded-Proto to generate correct redirect URLs when TLS terminates at the proxy. Test redirect loops and cookie behavior behind both HTTP and HTTPS. Keep proxy and application timeouts aligned so a slow upstream does not look like a client disconnect.`,
  },
  {
    title: "HTTPS certificate renewal checklist",
    category: "networking",
    tags: ["https", "tls", "certificates", "lets-encrypt"],
    summary:
      "Avoid expired certificates by monitoring renewal and reloading the right service.",
    content: `# HTTPS certificate renewal checklist

For Let's Encrypt certificates, certbot usually installs a renewal timer. Verify it exists and that it can renew without interactive prompts:

    certbot renew --dry-run

Check the certificate dates:

    openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null | openssl x509 -noout -dates

After renewal, the web server must reload or restart to use the new certificate. A common failure is successful renewal followed by an old certificate still being served.

Other checks:

- Port 80 is reachable for HTTP-01 challenges, or DNS-01 is configured.
- The certificate covers every requested hostname.
- The renewal timer is enabled.
- Monitoring alerts before expiry, not after.
- Staging endpoints are used while testing automation.

Document the reload command. A certificate that renews correctly but is never loaded is still an outage waiting to happen.`,
  },
  {
    title: "localhost, 127.0.0.1, and 0.0.0.0",
    category: "networking",
    tags: ["networking", "localhost", "bind-address", "docker"],
    summary:
      "Why binding to the wrong address makes a service unreachable from a container or another machine.",
    content: `# localhost, 127.0.0.1, and 0.0.0.0

localhost is a name that usually resolves to 127.0.0.1 for IPv4 and ::1 for IPv6. A server bound to 127.0.0.1 accepts connections only from the same machine's loopback interface.

0.0.0.0 means all IPv4 interfaces. A server bound there can accept connections from other machines and from Docker networks, subject to firewall rules. It does not mean a public address by itself.

Inside a container, localhost is the container. A service running on the host is not reachable at localhost from inside the container. Use the Compose service name for another container, or host.docker.internal where supported.

Binding to 0.0.0.0 is common in containers, but it increases exposure. Pair it with a private network, a reverse proxy, authentication, and firewall rules. Do not bind a database to all interfaces on a public host without protection.`,
  },

  {
    title: "Password hashing with Argon2 or bcrypt",
    category: "security",
    tags: ["security", "passwords", "argon2", "bcrypt"],
    summary:
      "Store passwords with a slow, salted hash and plan for cost upgrades.",
    content: `# Password hashing with Argon2 or bcrypt

Never store plaintext passwords or a fast hash such as SHA-256. Use a password-hashing function designed to be slow and memory-hard.

Argon2id is a strong default. Tune memory, iterations, and parallelism for your hardware. bcrypt is also widely supported; use a cost factor that takes roughly 100-300 ms on your server.

Each password must have a unique salt. The hashing library normally handles the salt and stores it alongside the hash. Compare hashes with a constant-time function provided by the library.

Plan for cost upgrades:

- Store the algorithm and parameters with the hash.
- On successful login, check whether the stored parameters are below current policy.
- Rehash the password and update the record.
- Never log the password or the full hash.

Rate-limit login attempts and consider breached-password checks. Hashing protects stored passwords; it does not stop online guessing by itself.`,
  },
  {
    title: "JWT access and refresh token design",
    category: "security",
    tags: ["security", "jwt", "authentication", "tokens"],
    summary:
      "Keep access tokens short-lived and make refresh tokens revocable.",
    content: `# JWT access and refresh token design

A common design uses a short-lived access token and a longer-lived refresh token.

The access token is sent with API requests and should expire quickly, often in minutes. It can be a signed JWT so the server can verify it without a database lookup. Keep the payload small and never put secrets in it; JWTs are signed, not encrypted.

The refresh token is exchanged for a new access token. Store refresh tokens server-side or in a database so they can be revoked. Rotate the refresh token on use and detect reuse of an old token.

Browser storage choices matter. localStorage is accessible to JavaScript and therefore to XSS. HttpOnly cookies reduce that risk but introduce CSRF considerations. Use Secure, SameSite, and a sensible path.

Always validate the signature, issuer, audience, and expiry. Handle clock skew explicitly. A JWT library's verify function is not optional.`,
  },
  {
    title: "Secure cookie flags",
    category: "security",
    tags: ["security", "cookies", "csrf", "session"],
    summary:
      "Use HttpOnly, Secure, SameSite, and scoped paths to reduce session risk.",
    content: `# Secure cookie flags

Session cookies should use:

- HttpOnly so JavaScript cannot read them.
- Secure so they are sent only over HTTPS.
- SameSite=Lax or Strict to reduce cross-site request forgery.
- A narrow Path and Domain.
- A short lifetime with explicit expiration.

The __Host- prefix adds constraints: the cookie must be Secure, have Path=/, and must not specify a Domain. Browsers enforce those rules.

SameSite is not a complete CSRF defense. For state-changing requests, use a CSRF token or an equivalent origin check. If the frontend and API are on different sites, SameSite=None requires Secure and careful CORS configuration.

Clear cookies with the same attributes used to set them. A logout that deletes a cookie with a different path can leave the session active. Test login, logout, and session expiry in a real browser, not only with an HTTP client.`,
  },
  {
    title: "SSRF risks in URL import features",
    category: "security",
    tags: ["security", "ssrf", "url-import", "networking"],
    summary:
      "A URL importer can be tricked into reaching internal services or cloud metadata endpoints.",
    content: `# SSRF risks in URL import features

If an application fetches a user-supplied URL, the server may be able to reach internal services that the user cannot. This is server-side request forgery.

Risks include:

- Cloud metadata endpoints that expose credentials.
- Internal admin panels and databases.
- Localhost services on the application host.
- Private network ranges.
- Redirects that switch from a public URL to an internal one.

Mitigations:

- Allow only http and https schemes.
- Resolve the hostname and reject private, loopback, link-local, and metadata addresses.
- Re-check the resolved address after every redirect.
- Limit redirects and response size.
- Set connect and read timeouts.
- Use an isolated egress network if possible.
- Do not return raw internal error details to the user.

A blocklist of hostnames is not enough. Validate the actual destination at connection time and consider DNS rebinding attacks.`,
  },
  {
    title: "Managing secrets in Docker Compose",
    category: "security",
    tags: ["security", "docker", "secrets", "environment"],
    summary:
      "Keep secrets out of images, Git, and build arguments, and rotate them deliberately.",
    content: `# Managing secrets in Docker Compose

Do not commit a real .env file. Provide .env.example with placeholders, add .env to .gitignore, and inject real values at deployment time.

Avoid passing secrets as Docker build arguments. Build arguments can end up in image history and metadata. Runtime environment variables are better for many small deployments, but they are still visible to processes in the container and through docker inspect.

For stronger separation, use Docker secrets or a dedicated secret manager. Mount secrets as read-only files and read them at startup. Do not bake them into the image.

Practical habits:

- Use different secrets per environment.
- Rotate credentials after accidental exposure.
- Limit database users to the permissions they need.
- Do not log environment objects.
- Restrict access to the Docker daemon; it is effectively root.
- Back up secrets separately from application data.`,
  },
  {
    title: "CORS explained for API developers",
    category: "security",
    tags: ["security", "cors", "browser", "api"],
    summary:
      "CORS is a browser policy, not authentication, and preflight behavior explains most surprises.",
    content: `# CORS explained for API developers

CORS controls which origins a browser allows to read responses from another origin. It is enforced by the browser, not by curl, server-to-server calls, or mobile clients.

For a simple cross-origin request, the server must return an Access-Control-Allow-Origin value matching the page origin, or a wildcard when credentials are not used. With credentials, the wildcard is not allowed; return the specific origin and Access-Control-Allow-Credentials: true.

A preflight OPTIONS request is sent for many non-simple methods and headers. The server must answer with allowed methods, allowed headers, and a max age. A 404 on OPTIONS is a common cause of a failed preflight.

Do not use permissive CORS as an authentication mechanism. If an endpoint is sensitive, require a token or cookie and validate it. Restrict origins to the ones you control, and test with the browser's network panel rather than guessing from server logs.`,
  },

  {
    title: "Undo Git commits with reset vs revert",
    category: "git",
    tags: ["git", "reset", "revert", "history"],
    summary:
      "Choose reset for local cleanup and revert for history that other people already have.",
    content: `# Undo Git commits with reset vs revert

git reset moves the current branch pointer. It rewrites local history and should be used carefully.

- reset --soft keeps changes staged.
- reset --mixed keeps changes in the working tree but unstages them.
- reset --hard discards changes and is destructive.

git revert creates a new commit that undoes an earlier commit. It is the safe choice for a shared branch because it does not rewrite history.

    git revert <commit>
    git reset --soft HEAD~1

If you reset by mistake, git reflog can often recover the previous commit. Do not assume a hard reset is irreversible until the reflog and object database have been cleaned.

Never force-push a shared main branch to hide a mistake. Revert it, explain what happened, and preserve an auditable history.`,
  },
  {
    title: "Interactive rebase for clean history",
    category: "git",
    tags: ["git", "rebase", "history", "pull-request"],
    summary:
      "Squash, reword, reorder, and drop local commits before opening a pull request.",
    content: `# Interactive rebase for clean history

Start an interactive rebase over the last few commits:

    git rebase -i HEAD~5

The editor lists commits from oldest to newest. Useful actions:

- pick: keep the commit.
- reword: change the message.
- squash: combine into the previous commit and edit the message.
- fixup: combine while discarding this message.
- drop: remove the commit.
- edit: stop to amend the commit.

A clean history should tell a coherent story. Squash work-in-progress commits, but do not rewrite commits that other people have already based work on.

After rebasing a branch you own, push with force-with-lease rather than a plain force:

    git push --force-with-lease

Resolve conflicts one commit at a time, run tests after the rebase, and check the final diff. If the rebase goes wrong, abort it and recover from the reflog instead of improvising.`,
  },
  {
    title: "Finding a regression with git bisect",
    category: "git",
    tags: ["git", "bisect", "debugging", "regression"],
    summary:
      "Use binary search over commits to find the change that introduced a bug.",
    content: `# Finding a regression with git bisect

git bisect narrows down the commit that introduced a regression. Start with a known good and a known bad revision:

    git bisect start
    git bisect bad
    git bisect good v1.2.0

Git checks out a midpoint. Test it, then mark it:

    git bisect good
    git bisect bad

If a commit cannot be tested, use git bisect skip. When the search finishes, Git reports the first bad commit. Inspect the diff and the surrounding history.

Automate the test when possible:

    git bisect run npm test -- --runInBand

The test command must exit with 0 for good and non-zero for bad. Make sure it is deterministic and does not depend on external services that change between runs.

Finish with:

    git bisect reset

Bisect is most useful when you have a reproducible test and a reliable good revision.`,
  },
  {
    title: "Resolving merge conflicts without panic",
    category: "git",
    tags: ["git", "merge-conflicts", "workflow", "pull-request"],
    summary:
      "Understand the conflict markers, resolve intent, then verify with tests.",
    content: `# Resolving merge conflicts without panic

A conflict means Git could not combine two changes automatically. It does not mean work was lost.

    git status

Open each conflicted file and find the markers:

    <<<<<<< HEAD
    current branch content
    =======
    incoming branch content
    >>>>>>> other-branch

Decide what the combined result should be, remove the markers, and keep the correct code from both sides when appropriate. Then stage the file:

    git add path/to/file

Continue the merge or rebase:

    git merge --continue
    git rebase --continue

If you are unsure, abort and inspect the branches separately:

    git merge --abort
    git rebase --abort

Run tests after resolving. A conflict-free merge can still be logically wrong. For recurring conflicts, consider smaller pull requests, a clearer file ownership boundary, or enabling rerere to reuse recorded resolutions.`,
  },

  {
    title: "Chunking strategies for retrieval augmented generation",
    category: "ai",
    tags: ["ai", "rag", "chunking", "embeddings", "retrieval"],
    summary:
      "Chunk size, overlap, and metadata have a large effect on retrieval quality.",
    content: `# Chunking strategies for retrieval augmented generation

A retrieval system can only return what its chunks contain. Chunking is therefore a core design decision, not a preprocessing detail.

Common approaches:

- Fixed-size chunks with overlap. Simple and predictable. A 1,200-character chunk with 200 characters of overlap is a reasonable starting point for prose.
- Paragraph or heading-based chunks. Preserves semantic boundaries and works well for structured notes.
- Recursive splitting. Try large sections first, then split further only when needed.
- Parent-child retrieval. Index small chunks for matching, then return the larger parent section to the model.

Add metadata to each chunk: entry id, title, heading, category, tags, model id, and chunk index. Prefixing the title to the embedded text often improves retrieval because the title supplies context that a middle paragraph lacks.

Evaluate with real queries. Inspect the chunks that were retrieved, not only the final answer. If the right document is found but the wrong chunk is returned, adjust chunking before changing the model.`,
  },
  {
    title: "Choosing an embedding model",
    category: "ai",
    tags: ["ai", "embeddings", "models", "evaluation"],
    summary:
      "Compare models on your own queries, not only on public benchmarks.",
    content: `# Choosing an embedding model

Embedding models differ in dimensions, context length, language coverage, speed, memory use, and cost. A larger model is not automatically better for a specific corpus.

Evaluate on your own data:

1. Collect 20-50 representative queries.
2. Mark the entries that should be retrieved.
3. Measure recall at 5 and 10, mean reciprocal rank, and manual relevance.
4. Inspect failures: wrong topic, wrong chunk, missing keyword, or ambiguous query.

Consider operational constraints:

- Local model size and CPU/GPU requirements.
- Embedding latency for the expected corpus size.
- Vector dimensions and storage cost.
- Maximum input length.
- Multilingual support if needed.
- Whether the provider supports batch requests.

Store the model id with every vector. Changing models usually requires re-embedding the corpus, because vectors from different models are not comparable. Plan for that migration before the corpus becomes large.`,
  },
  {
    title: "Cosine similarity vs dot product",
    category: "ai",
    tags: ["ai", "vectors", "cosine", "similarity"],
    summary:
      "Understand what each distance means and why normalization changes the comparison.",
    content: `# Cosine similarity vs dot product

Cosine similarity measures the angle between two vectors. It ignores magnitude, so a long document and a short query can still be compared by direction.

Dot product multiplies corresponding components and sums them. If the vectors are normalized to unit length, dot product and cosine similarity rank results identically. Many embedding models return normalized vectors, but it is safer to check than to assume.

Euclidean distance measures straight-line distance. It is sensitive to magnitude unless the vectors are normalized.

In pgvector:

- <=> is cosine distance.
- <#> is negative inner product.
- <-> is Euclidean distance.

Use the operator that matches the model's training objective and your normalization strategy. Do not mix metrics between the index and the query. If you change the metric, rebuild the index and re-evaluate retrieval quality on a fixed query set.`,
  },
  {
    title: "Re-indexing after changing embedding models",
    category: "ai",
    tags: ["ai", "embeddings", "reindexing", "migration"],
    summary:
      "Vectors from different models are not interchangeable; design a safe re-indexing flow.",
    content: `# Re-indexing after changing embedding models

Every stored vector should record the model that produced it. Searching across vectors from different models is meaningless, even when the dimensions happen to match.

A safe re-indexing flow:

1. Save the new model settings.
2. Mark entries as needing indexing.
3. Queue entries for background processing.
4. Write new chunks with the new model id.
5. Keep progress visible and retry failures.
6. Switch search to the new model only when enough entries are ready.
7. Remove old chunks after verification.

Avoid deleting the old chunks before the new ones are complete unless you can tolerate an outage in search quality. For a small corpus, a background queue with progress is enough. For a large corpus, consider a shadow table or a versioned index.

Test a few known queries before and after. Re-indexing can improve some results and degrade others; the evaluation set tells you whether the migration helped.`,
  },
  {
    title: "Evaluating retrieval quality",
    category: "ai",
    tags: ["ai", "retrieval", "evaluation", "search"],
    summary:
      "A small golden query set is more useful than guessing from a few searches.",
    content: `# Evaluating retrieval quality

Retrieval quality is easy to overestimate by trying a few queries that you already know the answer to. Build a small evaluation set instead.

For each query, record the entry ids that should be relevant. Then measure:

- Recall at k: did the relevant entries appear in the top k?
- Mean reciprocal rank: how high did the first relevant result appear?
- Precision at k: how many of the top results were actually relevant?
- Manual relevance: a human review of the top five results.

Include different query types:

- Exact identifiers and error messages.
- Conceptual paraphrases.
- Multi-word topics with synonyms.
- Queries with no good answer, to test empty-state behavior.

Inspect the retrieved chunks, not only the entry titles. A relevant document with the wrong chunk may still produce a poor answer. Keep the query set in the repository and rerun it after changing chunking, embedding models, ranking, or filters.`,
  },

  {
    title: "A simple Markdown knowledge base workflow",
    category: "productivity",
    tags: ["productivity", "markdown", "notes", "knowledge-base"],
    summary:
      "A lightweight structure for notes that stay searchable and easy to maintain.",
    content: `# A simple Markdown knowledge base workflow

A knowledge base works best when capture is cheap and organization is light.

A practical structure:

- Inbox: quick notes that have not been processed yet.
- Projects: material tied to active outcomes.
- Areas: ongoing responsibilities and reference material.
- Archive: finished or inactive material.

Use a consistent title and a short summary. Write one idea per entry instead of one giant document, because retrieval and linking work better with focused notes. Add tags for cross-cutting topics, but do not create a tag for every word.

At the end of the week:

1. Process the inbox.
2. Merge duplicates.
3. Add missing summaries.
4. Link related notes.
5. Archive what is no longer active.

The goal is not a perfect taxonomy. The goal is to find the note again when you need it. Search-first habits beat elaborate folder hierarchies.`,
  },
  {
    title: "Weekly review for technical notes",
    category: "productivity",
    tags: ["productivity", "review", "notes", "habits"],
    summary:
      "A 20-minute routine that keeps a personal knowledge base from becoming a graveyard.",
    content: `# Weekly review for technical notes

A weekly review keeps a note collection useful. Set aside 20-30 minutes and work through a short checklist.

Inbox:

- Read quick captures.
- Turn useful fragments into proper entries.
- Delete duplicates and noise.

Active work:

- Check project notes for decisions that were made.
- Record open questions and next actions.
- Move completed project notes to an archive.

Quality:

- Add summaries to entries that are hard to scan.
- Fix broken links.
- Merge overlapping notes.
- Add missing tags only where they help retrieval.

Search:

- Try three queries you would realistically use.
- If a known note does not appear, improve its title, summary, or content.
- Note missing topics and create stubs.

The review is not about perfect organization. It is about keeping the retrieval path short and trustworthy.`,
  },
  {
    title: "Search-first note taking",
    category: "productivity",
    tags: ["productivity", "search", "notes", "workflow"],
    summary:
      "Write notes so future-you can find them with a question, not a folder path.",
    content: `# Search-first note taking

If you expect to retrieve notes by search, write for retrieval.

Use descriptive titles that include the problem or topic. A title like PostgreSQL connection timeout is easier to find than Database stuff. Start with a one-sentence summary that states what the note answers.

Include the words you would use in a future query:

- The error message, exactly as it appeared.
- The tool and version.
- The environment, such as Docker, Linux, or production.
- Synonyms for the concept.

Structure long notes with headings and short paragraphs. Keep code snippets close to the explanation. One focused note is usually better than a giant document containing several unrelated topics.

When a search fails, treat it as a writing bug. Add the missing term, improve the title, or split the note. Over time, the collection becomes easier to search because the gaps are visible.`,
  },

  {
    title: "Atlas Index architecture overview",
    category: "atlas-index",
    tags: ["atlas-index", "architecture", "nextjs", "pgvector", "ollama"],
    summary:
      "How the web app, PostgreSQL, pgvector, Ollama, and the indexing queue fit together.",
    content: `# Atlas Index architecture overview

Atlas Index is a self-hosted knowledge base with semantic search. The web application is built with Next.js and talks to PostgreSQL with the pgvector extension. Embeddings are generated locally by Ollama by default.

Main pieces:

- The Next.js app serves the UI and API routes.
- PostgreSQL stores entries, categories, settings, chunks, and vectors.
- pgvector performs cosine-distance search over chunk embeddings.
- Ollama provides an embedding model such as nomic-embed-text.
- An in-process queue chunks entries, embeds them in batches, records progress, and retries failures.
- Docker Compose runs the app, database, and model server with healthchecks.

When an entry is created, it is saved immediately with status pending. The queue splits the content into overlapping chunks, embeds each chunk with the title as context, and stores the vectors with the model id. Search embeds the query, retrieves matching chunks, groups them by entry, and merges PostgreSQL full-text results as a complementary path.

The default deployment is entirely local. Optional OpenAI-compatible providers can be configured in Settings.`,
  },
  {
    title: "Atlas Index API endpoints",
    category: "atlas-index",
    tags: ["atlas-index", "api", "rest", "endpoints"],
    summary:
      "A map of the current HTTP API for entries, search, categories, and settings.",
    content: `# Atlas Index API endpoints

The Atlas Index app exposes route handlers under /api.

Status and entries:

- GET /api/status: database and embedding health.
- GET /api/entries: list entries, optionally filtered by status and limit.
- GET /api/entries/[slug]: fetch one entry and its indexing progress.
- POST /api/entries/create-entry: create an entry and queue it for indexing.
- POST /api/entries/generate-embedding: re-index an entry by id.

Search:

- POST /api/search: semantic search with a JSON body containing query.

Categories:

- GET /api/categories: list categories.
- POST /api/create-category: create a category by name.

Settings:

- GET /api/settings: read the active embedding configuration.
- POST /api/settings: update provider, model, dimensions, base URL, and API key.
- POST /api/settings/test: test an embedding configuration before saving.

Most write endpoints accept JSON and return a success flag. Database errors are mapped to useful HTTP status codes where possible. The API has no built-in authentication, so deploy it on a trusted network or behind an authenticated reverse proxy.`,
  },
  {
    title: "Atlas Index self-hosting and troubleshooting",
    category: "atlas-index",
    tags: ["atlas-index", "docker", "self-hosting", "troubleshooting"],
    summary:
      "Common first-run issues and where to look when the stack is not healthy.",
    content: `# Atlas Index self-hosting and troubleshooting

The quickest start is the published Compose file:

    mkdir atlas-index
    cd atlas-index
    curl -fsSLO https://raw.githubusercontent.com/oar06g/Atlas-Index/main/compose.yml
    docker compose up -d

The first start pulls the embedding model, which can take several minutes. Check service health and logs:

    docker compose ps
    docker compose logs -f app
    docker compose logs -f ollama

Common issues:

- The app starts before the database is ready. Check the Postgres healthcheck and app logs.
- The embedding model is still downloading. The Ollama healthcheck should wait for the model, not only the server.
- The database volume was created with an old schema. Apply the idempotent schema file manually.
- A search route returns 404 because the app image is older than the source. Pull a newer image.
- The app is reachable locally but not remotely. Check the port binding and reverse proxy.
- There is no authentication. Do not expose the app directly to the public internet.

Use docker compose config to validate the file before starting. Keep backups of the database volume.`,
  },
];
