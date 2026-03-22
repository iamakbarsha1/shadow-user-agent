# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚡ Claude Usage Protocol (CRITICAL)

To prevent context exhaustion and ensure high-quality outputs, follow these strict rules:

### 1. Session Discipline

- One objective per session (e.g., "fix bug", "design API", "write tests")
- DO NOT combine multiple phases in one conversation
- Monitor context usage continuously
- At ~70% usage:
  - STOP further work
  - Inform the user with a clear warning
  - Provide summary + next steps + continuation prompt

### 2. Phase-Based Execution

All work MUST follow this order:

1. Plan
2. Design
3. Implement
4. Test
5. Refactor

Each phase should ideally be a **separate session**

### 3. Output Style (Token Optimization)

- Be concise unless explicitly asked for explanation
- Avoid repetition of previously stated context
- Do not restate large code blocks unless modified
- Prefer diffs / minimal changes over full rewrites

### 4. Continuation Handling

At the end of each session, ALWAYS provide:

- Summary of work done
- Next-step instructions
- A ready-to-use continuation prompt

### 5. Code Handling Rules

- Only include relevant code snippets (not entire files unless necessary)
- If referencing existing code, say:
  > "Use existing implementation from previous context"

### 6. Failure Recovery

If conversation becomes inefficient or unclear:

- STOP early
- Summarize current state
- Restart in a new session

---

## Project Overview

Shadow User Agent is an AI-powered QA system that simulates real user behavior to detect UX friction and bugs before manual QA begins. It uses Playwright to autonomously navigate web applications with different user personas, observes everything that goes wrong, and generates structured bug reports using Claude AI.

## Development Commands

```bash
# Initial setup
npm install
npx playwright install chromium
npm run db:migrate
npm run db:seed

# Development
npm run dev                # Starts API (port 4000) and frontend (port 3000)
docker compose up -d       # Start PostgreSQL and Redis

# Testing
npm run test              # Unit + integration tests
npm run test:agent        # Agent behavior tests (requires Docker test-app)
npm run test:coverage     # Coverage report
npm run test:ci           # All tests for CI

# Database
npx prisma migrate dev --name "migration_name"  # Create migration
npx prisma migrate deploy                        # Apply migrations (production)
npx prisma migrate reset                         # Reset and re-seed (dev only)
```

## Architecture Overview

The system is composed of four primary layers:

1. **Orchestration** (Express API) — receives user input, manages agent lifecycle via BullMQ job queue
2. **Execution** (Playwright Agent) — runs headless browser with persona-driven navigation strategy
3. **Intelligence** (Claude AI) — analyzes session logs and generates structured bug/UX reports
4. **Presentation** (Next.js Dashboard) — triggers runs, displays live monitoring, shows reports

### Key Data Flow

```
User Input → API creates run → BullMQ job spawned → Agent executes with Persona
→ Observer captures events → Session log saved → Claude analyzes → Reports generated
```

### Agent Lifecycle State Machine

```
PENDING → RUNNING → COMPLETE (or FAILED)
```

Jobs are managed by BullMQ with:

- Max 3 concurrent runs (configurable via `AGENT_MAX_CONCURRENCY`)
- 3-minute timeout per run
- Retry logic for failed processes

## Core Components

### Persona Engine (`src/agent/personaEngine.ts`)

Defines 4 user archetypes that drive both Playwright navigation and AI analysis:

- `new_user` — slow, careful, aborts on errors
- `power_user` — fast, expects instant responses, notices performance issues
- `mobile_user` — 390px viewport, sensitive to layout breaks
- `edge_case` — submits empty forms, special characters, intentionally stress-tests

Each persona returns a `PersonaConfig` object with viewport, speed, form fill strategy, and prompt context.

### Browser Agent (`src/agent/browserAgent.ts`)

Autonomous Playwright session that:

- Discovers interactive elements (buttons, links, inputs) by visual prominence
- Fills forms using realistic data based on persona's `formFillStrategy`
- Continues until `maxSteps` reached or no more interactive elements
- Runs in sandboxed context with network restricted to target domain

### Observer (`src/agent/observer.ts`)

Passive monitoring layer that captures 7 event types:

- `console_error`, `network_failure` (status ≥ 400), `slow_response` (>3s)
- `layout_shift` (CLS > 0.1), `rage_click` (3+ clicks in 2s)
- `broken_image`, `stuck_loader` (spinner visible >5s)

Each event records timestamp, payload, and captures screenshot on errors/anomalies.

### AI Analysis Layer (`src/ai/`)

Uses Claude API (`claude-sonnet-4-20250514`) with structured JSON output:

- **Temperature 0** for deterministic analysis
- **Hallucination guard**: discards bugs with invalid `observationId`
- **Retry logic**: 2 retries with exponential backoff on 529 responses
- **Validation**: Zod schemas validate all AI output

Generates two report types:

1. **Bug Report** — P1-P4 severity, steps to reproduce, fix suggestions
2. **Code Review** — critical issues, improvements, recommendations

## Database Schema

PostgreSQL with Prisma ORM:

- `runs` — tracks every agent execution (status: pending/running/complete/failed)
- `observations` — raw events with JSONB payload (flexible schema)
- `reports` — AI-generated reports (bug_report, ux_friction, code_review)
- `screenshots` — linked to observations, stored in `/tmp/agent-sessions/{runId}/`

JSONB columns handle variable-shape observation payloads without schema migrations.

## Critical Code Patterns

### Error Handling

All errors must be typed custom error classes (not plain `Error`):

```typescript
// Define in src/utils/errors.ts
export class InvalidUrlError extends Error {
  code = 'INVALID_URL';
  constructor(url: string) {
    super(`URL is invalid or not reachable: ${url}`);
  }
}
```

API responses follow standard format from `docs/BACKEND_SPEC.md`:

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is not reachable or is malformed.",
    "details": {}
  }
}
```

### Logging

Use `pino` exclusively (never `console.log`):

```typescript
import { logger } from '../utils/logger';

logger.info({ runId, personaId }, 'Agent run started');
logger.error({ err, runId }, 'Agent process crashed');
```

### TypeScript Rules

- Strict mode enabled — no `any` types (use `unknown` with type guards)
- All function parameters and return types explicitly typed
- JSDoc required on all exported functions
- Prefer interfaces over type aliases for object shapes

### Environment Variables

All required env vars validated at startup in `src/utils/envValidator.ts`:

```typescript
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'REDIS_URL', 'ANTHROPIC_API_KEY', 'JWT_PRIVATE_KEY'];
```

## Security Considerations

- **SSRF Protection**: URL validator blocks private IPs, localhost, AWS metadata endpoint, file:// protocol
- **Agent Sandboxing**: No host filesystem access outside `/tmp/agent-sessions/`, network restricted to target domain
- **Credential Handling**: Auth credentials never logged or stored (passed only to agent process)
- **Rate Limiting**: 10 runs/hour per user, 300 requests/minute for other endpoints

## Testing Strategy

Three test layers:

1. **Unit + Integration** (Vitest) — API routes, persona engine, utilities
2. **Agent Behavior** (Playwright Test) — runs against controlled test-app with known bugs
3. **AI Output Validation** — Zod schema validation against fixture responses

Target coverage: 85% overall (100% for URL validator and persona engine).

## File Organization

```
src/
├── api/          # Express server, routes, middleware
├── agent/        # browserAgent, observer, personaEngine, formFiller
├── ai/           # claudeClient, promptBuilder, responseParser, codeReviewBuilder
├── worker/       # BullMQ job worker
├── db/           # Prisma client + query helpers
├── types/        # Shared TypeScript interfaces
└── utils/        # logger, urlValidator, retry, errors

frontend/         # Next.js app with Zustand state management
  ├── app/        # Pages (Dashboard, New Run, Live Monitor, Report Viewer)
  ├── components/ # React components
  └── stores/     # Zustand stores

tests/
  ├── fixtures/   # Test data (session logs, Claude responses)
  ├── agent/      # Playwright behavior tests
  └── ai/         # AI output validation tests
```

## Git Conventions

- **Commits**: Conventional Commits format (`feat:`, `fix:`, `chore:`, `test:`, `docs:`)
- **Branches**: `feature/`, `fix/`, `chore/` prefixes
- **PRs**: Max 400 lines, at least one reviewer, tests must pass

## Implementation Phases

Project follows phased implementation in `docs/MASTER_PLAN.md`:

- Phase 0: Project setup (Docker, Prisma, folder structure)
- Phase 1: Core API (auth, run management)
- Phase 2: Persona Engine
- Phase 3: Browser Agent + Observer
- Phase 4: Job Queue + Agent Runner
- Phase 5: AI Analysis Layer
- Phase 6: React Dashboard
- Phase 7: Production Hardening
- Phase 8: Demo Preparation

Complete each phase fully before starting the next.

## Reference Documentation

All detailed specifications in `docs/`:

- `SYSTEM_DESIGN.md` — Architecture and data flow
- `BACKEND_SPEC.md` — API endpoints and schemas
- `AI_SPEC.md` — Persona definitions and prompt design
- `CODE_GUIDELINES.md` — Naming conventions and standards
- `TESTING.md` — Test strategy and examples
- `DEPLOYMENT.md` — Local and production setup
- `SECURITY.md` — Security practices
