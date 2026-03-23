# Technology Stack

**Analysis Date:** 2026-03-23

## Languages

**Primary:**
- TypeScript 5.7.x - Backend API, worker, and frontend (all source under `src/` and `frontend/`)

**Secondary:**
- SQL - PostgreSQL schema managed via Prisma migrations under `prisma/`

## Runtime

**Environment:**
- Node.js >=18.0.0 (enforced in `package.json` engines field)
- npm >=9.0.0 (enforced in `package.json` engines field)

**Package Manager:**
- npm (workspace-enabled monorepo)
- Lockfile: `package-lock.json` present at root
- Frontend workspace declared in root `package.json` under `"workspaces": ["frontend"]`

## Frameworks

**Backend API:**
- Express 4.21.x - REST API server (`src/api/server.ts`, `src/api/app.ts`)

**Frontend:**
- Next.js 14.2.x - React SSR/SSG framework (`frontend/app/`)
- React 18.3.x - UI library

**Testing:**
- Vitest 2.1.x - Unit and integration test runner (`vitest.config.ts`)
- @playwright/test 1.44.x - E2E/agent behavior test runner (`playwright.config.ts`)

**Build/Dev:**
- tsx 4.19.x - TypeScript execution for development (`dev:api`, `dev:worker` scripts)
- concurrently 9.1.x - Parallel process runner for `npm run dev`
- tsc - TypeScript compiler for production builds (three tsconfig variants)

## Key Dependencies

**Critical:**
- `@anthropic-ai/sdk` ^0.30.1 - Anthropic Claude API client (`src/ai/claudeClient.ts`)
- `@prisma/client` ^5.22.0 - PostgreSQL ORM client (`src/db/client.ts`)
- `prisma` ^5.22.0 - CLI for migrations and schema management
- `bullmq` ^5.22.4 - Job queue for async agent runs (`src/worker/index.ts`, `src/worker/queue.ts`)
- `playwright` ^1.44.1 - Headless browser for agent execution (`src/agent/browserAgent.ts`)

**Infrastructure:**
- `ioredis` ^5.4.1 - Redis client used by BullMQ and rate limiting (`src/worker/index.ts`, `src/api/middleware/rateLimit.ts`)
- `express-rate-limit` ^7.4.1 - Rate limiting middleware (`src/api/middleware/rateLimit.ts`)
- `rate-limit-redis` ^4.2.0 - Redis-backed store for rate limiter
- `helmet` ^8.0.0 - HTTP security headers (`src/api/app.ts`)
- `cors` ^2.8.5 - CORS middleware (`src/api/app.ts`)

**Authentication:**
- `jsonwebtoken` ^9.0.2 - RS256 JWT signing and verification (`src/api/middleware/auth.ts`)
- `bcrypt` ^6.0.0 - Password hashing (referenced in `@types/bcrypt`)

**Validation:**
- `zod` ^3.24.1 - Schema validation for AI output and API input

**Logging:**
- `pino` ^9.5.0 - Structured JSON logger (`src/utils/logger.ts`)
- `pino-pretty` ^13.0.0 - Human-readable log formatting in development

**Configuration:**
- `dotenv` ^16.4.5 - Environment variable loading

**Frontend State:**
- `zustand` ^4.5.5 - Client-side state management (`frontend/stores/`)

**Frontend Styling:**
- `tailwindcss` ^3.4.17 - Utility CSS framework
- `autoprefixer` ^10.4.20 - PostCSS plugin
- `postcss` ^8.4.49 - CSS transformation

## Dev Dependencies Worth Noting

- `@typescript-eslint/eslint-plugin` ^8.17.0 + `@typescript-eslint/parser` ^8.17.0 - TypeScript-aware linting
- `eslint` ^8.57.0 + `eslint-config-prettier` ^9.1.0 - Linting with Prettier compatibility
- `prettier` ^3.4.2 - Code formatting
- `supertest` ^7.0.0 - HTTP assertion library for API integration tests
- `@vitest/coverage-v8` ^2.1.8 - V8-based code coverage provider
- `@types/node` ^20.17.9, `@types/express` ^5.0.0, `@types/bcrypt` ^5.0.2, `@types/cors` ^2.8.17`, `@types/jsonwebtoken` ^9.0.7` - TypeScript type definitions

## Configuration

**TypeScript:**
- Root `tsconfig.json` - Strict mode, ES2022 target, CommonJS modules, covers `src/**`
- `tsconfig.api.json` - Extends root, outputs to `dist/api/`, includes API/DB/utils/types
- `tsconfig.worker.json` - Extends root, outputs to `dist/worker/`
- Frontend has its own `tsconfig.json` managed by Next.js

**Environment:**
- `.env.example` present at root - documents all required and optional vars
- Validated at startup via `src/utils/envValidator.ts`
- Key required vars: `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `INTERNAL_API_KEY`
- AI provider: one of `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `KIE_AI_API_KEY` (at least one required)

**Build:**
- API: `tsc -p tsconfig.api.json` → `dist/api/`
- Worker: `tsc -p tsconfig.worker.json` → `dist/worker/`
- Frontend: `next build` → `.next/standalone/`

## Platform Requirements

**Development:**
- Docker + Docker Compose for PostgreSQL 16-alpine and Redis 7-alpine
- Chromium browser (installed via `npx playwright install chromium`)

**Production Docker Images:**
- API: `node:18-alpine` (multi-stage, `Dockerfile.api`)
- Worker: `mcr.microsoft.com/playwright:v1.44.0-jammy` (includes Chromium pre-installed, `Dockerfile.worker`)
- Frontend: `node:18-alpine` (Next.js standalone output, `Dockerfile.frontend`)
- API exposes port 4000; Frontend exposes port 3000

---

*Stack analysis: 2026-03-23*
