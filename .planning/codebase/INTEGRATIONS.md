# External Integrations

**Analysis Date:** 2026-03-23

## APIs & External Services

**AI Providers (pluggable — exactly one must be configured):**

- **Anthropic Claude** - Primary AI analysis via official SDK
  - SDK/Client: `@anthropic-ai/sdk` ^0.30.1
  - Auth: `ANTHROPIC_API_KEY`
  - Model: `claude-sonnet-4-20250514` (hardcoded in `src/ai/claudeClient.ts`)
  - Endpoint: Anthropic SDK default

- **Google Gemini** - Alternative AI provider (highest priority in provider selection)
  - SDK/Client: Native `fetch`
  - Auth: `GEMINI_API_KEY`
  - Model: `GEMINI_MODEL` env var, default `gemini-2.5-flash`
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

- **OpenRouter** - Proxy provider supporting multiple models (OpenAI-compatible API)
  - SDK/Client: Native `fetch`
  - Auth: `OPENROUTER_API_KEY`
  - Model: `MODEL` env var, default `anthropic/claude-sonnet-4-20250514`
  - Endpoint: `https://openrouter.ai/api/v1/chat/completions`

- **KIE.AI** - Claude proxy provider
  - SDK/Client: Native `fetch`
  - Auth: `KIE_AI_API_KEY`
  - Model: `KIE_MODEL` env var, default `claude-sonnet-4-6`
  - Endpoint: `https://api.kie.ai/claude/v1/messages`

**Provider Priority (set in `src/ai/claudeClient.ts` `getProvider()`):**
Gemini > KIE.AI > OpenRouter > Anthropic (first matching env var wins)

**All AI calls share:**
- 60-second timeout (`TIMEOUT_MS = 60000`)
- Up to 2 retries with exponential backoff on transient network errors
- Temperature 0 for deterministic output
- Token reduction fallback on `InsufficientCreditsError` (OpenRouter/KIE)

## Data Storage

**Databases:**
- PostgreSQL 16-alpine
  - Connection: `DATABASE_URL` (format: `postgresql://user:pass@host:port/db`)
  - Client: Prisma ORM v5.22.x (`src/db/client.ts`)
  - Schema: `prisma/schema.prisma`
  - Models: `runs`, `observations`, `reports`, `screenshots`
  - JSONB columns for `observations.payload` and `reports.content`
  - Cascade deletes: observations/reports/screenshots cascade on run delete
  - Docker: `postgres:16-alpine` on port 5432

**Job Queue / Cache:**
- Redis 7-alpine
  - Connection: `REDIS_URL` (format: `redis://host:port`)
  - Client: `ioredis` ^5.4.1
  - Used by: BullMQ queue (`agent-run` queue) and rate-limit Redis store
  - Docker: `redis:7-alpine` on port 6379
  - BullMQ queue name: `agent-run` (`src/worker/index.ts`, `src/worker/queue.ts`)
  - Max concurrency: `AGENT_MAX_CONCURRENCY` env var, default 3
  - Rate limit prefixes: `rl:create-run:` and `rl:general:` in Redis

**File Storage:**
- Local filesystem only for screenshots: `/tmp/agent-sessions/{runId}/`
  - Path configurable via `SCREENSHOT_STORAGE_PATH` env var
  - Served via Express static at `/api/v1/screenshots` with path-traversal protection
  - 24-hour periodic cleanup via `src/worker/screenshotCleanup.ts`
  - Optional S3 configuration noted in `.env.example` (not implemented in current code)

**Caching:**
- None beyond Redis for BullMQ and rate limiting

## Authentication & Identity

**Auth Provider:** Custom (no third-party identity provider)

**JWT (RS256):**
- Private key: `JWT_PRIVATE_KEY` env var (RSA PEM format)
- Public key: `JWT_PUBLIC_KEY` env var (RSA PEM format)
- Algorithm: RS256 (asymmetric)
- Verification: `src/api/middleware/auth.ts` via `jsonwebtoken`

**Internal API Key:**
- Header: `X-API-Key`
- Value: `INTERNAL_API_KEY` env var (64-char random string)
- Used for worker-to-API internal communication

**Development bypass:**
- When `NODE_ENV=development`, JWT middleware injects a hardcoded dev user without token validation (`src/api/middleware/auth.ts`)

**Password Hashing:**
- `bcrypt` ^6.0.0 is a dependency (types present); used in auth routes (`src/api/routes/auth.ts`)

## Rate Limiting

- **POST /api/v1/runs** (create run): 100 requests/hour per client (Redis-backed in prod)
- **All /api routes**: 300 requests/minute per client (Redis-backed in prod)
- In test environment: in-memory rate limit store (no Redis dependency)
- Implementation: `src/api/middleware/rateLimit.ts` using `express-rate-limit` + `rate-limit-redis`

## Security Middleware

- `helmet` - Sets security HTTP headers (all defaults enabled, `src/api/app.ts`)
- `cors` - Origin restricted to `FRONTEND_URL` env var (default `http://localhost:3000`)
- SSRF protection in URL validator (`src/utils/urlValidator.ts`) - blocks private IPs, localhost, AWS metadata, `file://`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or similar external service detected)

**Logs:**
- `pino` ^9.5.0 structured JSON logging
- Development: `pino-pretty` with colorized, timestamped output
- Production: raw JSON to stdout
- Log level: `LOG_LEVEL` env var, default `info`
- All services (`src/utils/logger.ts`) share the same logger instance

**Health Check:**
- Endpoint: `GET /health` (`src/api/routes/health.ts`)
- Docker HEALTHCHECK configured in `Dockerfile.api` (30s interval, 5s timeout)

## CI/CD & Deployment

**Hosting:**
- Not prescribed; Docker images produced for all three services (API, worker, frontend)

**CI Pipeline:**
- GitHub Actions: `.github/workflows/ci.yml`
- Triggers: push to `main`/`develop`, PRs targeting `main`
- Jobs:
  1. **lint** - ESLint + Prettier format check (ubuntu-latest, Node 18)
  2. **test** - Vitest with coverage (spins up postgres:16-alpine and redis:7-alpine as services)
  3. **audit** - `npm audit --audit-level=critical`
  4. **build** - TypeScript compile for API, worker, and Next.js frontend
- Coverage artifact uploaded on every test run (pass or fail)
- Secrets used in CI: `ANTHROPIC_API_KEY`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`

## Docker Setup

Three separate Dockerfiles, all multi-stage:
- `Dockerfile.api` - `node:18-alpine` builder + runtime, exposes port 4000
- `Dockerfile.worker` - `mcr.microsoft.com/playwright:v1.44.0-jammy` (Chromium included), no port exposure
- `Dockerfile.frontend` - `node:18-alpine`, Next.js standalone mode, exposes port 3000

`docker-compose.yml` starts only infrastructure services (PostgreSQL + Redis). Application services are run separately (dev: via `npm run dev`; prod: via individual Docker containers).

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected (agent navigates target URLs but does not post webhooks)

## Environment Configuration

**Required env vars (enforced at startup in `src/utils/envValidator.ts`):**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_PRIVATE_KEY` - RSA private key PEM for JWT signing
- `JWT_PUBLIC_KEY` - RSA public key PEM for JWT verification
- `INTERNAL_API_KEY` - 64-char secret for internal service-to-service auth
- At least one of: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `KIE_AI_API_KEY`
- If `OPENROUTER_API_KEY` is set, `MODEL` must also be set

**Optional env vars:**
- `NODE_ENV` - `development` | `production` | `test` (default: `development`)
- `APP_PORT` - API server port (default: `4000`)
- `FRONTEND_URL` - CORS allowed origin (default: `http://localhost:3000`)
- `LOG_LEVEL` - pino log level (default: `info`)
- `SCREENSHOT_STORAGE_PATH` - base directory for screenshots (default: `/tmp/agent-sessions`)
- `AGENT_MAX_CONCURRENCY` - max parallel agent runs (default: `3`)
- `AGENT_TIMEOUT_MS` - per-run timeout in ms (default: `180000`)
- `GEMINI_MODEL` - Gemini model name (default: `gemini-2.5-flash`)
- `KIE_MODEL` - KIE.AI model name (default: `claude-sonnet-4-6`)
- `ALLOWED_INTERNAL_HOSTS` - comma-separated list of allowed internal hostnames for SSRF bypass

**Secrets location:**
- Development: `.env` file at project root (not committed; `.env.example` is committed)
- CI: GitHub Actions secrets (`ANTHROPIC_API_KEY`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`)

---

*Integration audit: 2026-03-23*
