# Master Plan

**Project:** Shadow User Agent  
**Version:** 1.0  
**Goal:** Build a production-grade, demo-ready system phase by phase, with each phase producing a working, testable output.

---

## Instruction for Claude

> Follow this file top to bottom. Complete each phase fully before starting the next.  
> Use all docs in `docs/` as the source of truth.  
> Do not assume anything not stated in the docs.  
> After each phase, confirm what was built and list any blockers before proceeding.

---

## Phase 0 — Project Setup

**Goal:** Working repository with all infrastructure running locally.

Tasks:
- [ ] Initialise monorepo with `package.json`, `tsconfig.json`, and `nx.json` (or Turborepo)
- [ ] Create folder structure per `docs/CODE_GUIDELINES.md`
- [ ] Set up Docker Compose with PostgreSQL and Redis (per `docs/DEPLOYMENT.md`)
- [ ] Configure Prisma with initial schema (per `docs/SYSTEM_DESIGN.md` — database schema section)
- [ ] Run `npx prisma migrate dev` and confirm DB is accessible
- [ ] Set up environment variable loading (`dotenv`) with `.env.example`
- [ ] Configure ESLint, Prettier, and Vitest
- [ ] Confirm `npm run dev` starts without errors

**Done when:** `docker compose up` starts Postgres and Redis; `npm run dev` starts the API on port 4000 and frontend on port 3000.

---

## Phase 1 — Core API

**Goal:** Working REST API with authentication and run management.

Reference: `docs/BACKEND_SPEC.md`

Tasks:
- [ ] Implement `POST /auth/login` with JWT issuance
- [ ] Implement JWT middleware for all protected routes
- [ ] Implement `POST /api/v1/runs` — validates input, creates run record, returns runId
- [ ] Implement `GET /api/v1/runs/:runId` — returns run status and metadata
- [ ] Implement `GET /api/v1/runs` — paginated run list
- [ ] Implement `DELETE /api/v1/runs/:runId`
- [ ] Add input validation with `zod` for all request bodies
- [ ] Add rate limiting with `express-rate-limit` + Redis store
- [ ] Add `GET /health` endpoint
- [ ] Write unit tests for all routes (Supertest)

**Done when:** All endpoints return correct responses as defined in `docs/BACKEND_SPEC.md`; unit tests pass.

---

## Phase 2 — Persona Engine

**Goal:** Configurable persona system that drives agent behaviour.

Reference: `docs/AI_SPEC.md` — Persona Definitions section

Tasks:
- [ ] Create `src/agent/personaEngine.ts`
- [ ] Implement all 4 personas: `new_user`, `power_user`, `mobile_user`, `edge_case`
- [ ] Each persona returns a `PersonaConfig` object (typed per AI_SPEC.md interface)
- [ ] Validate persona ID at engine entry (throw `UNKNOWN_PERSONA` if invalid)
- [ ] Write unit tests for all personas

**Done when:** `getPersonaConfig('new_user')` returns the correct config object; tests pass.

---

## Phase 3 — Browser Agent + Observer

**Goal:** Playwright agent that navigates a target URL and captures all observations.

Reference: `docs/SYSTEM_DESIGN.md` — Components 3.3 and 3.4

Tasks:
- [ ] Create `src/agent/browserAgent.ts`
- [ ] Accept `PersonaConfig` and target URL as inputs
- [ ] Set up Playwright browser context with persona's viewport and user agent
- [ ] Implement network restriction (route interception — block off-origin requests)
- [ ] Implement autonomous navigation loop:
  - Discover interactive elements (buttons, links, inputs)
  - Click in order of visual prominence
  - Fill forms using persona's `formFillStrategy`
  - Continue until `maxSteps` is reached or page has no more interactive elements
- [ ] Create `src/agent/observer.ts`
- [ ] Attach all 7 observer event listeners (per SYSTEM_DESIGN.md — Observer table)
- [ ] Write each captured event to `observations[]` array with schema from SYSTEM_DESIGN.md
- [ ] Take a screenshot on every error or anomaly event
- [ ] Save screenshots to `/tmp/agent-sessions/{runId}/`
- [ ] Return completed `SessionLog` object on agent exit
- [ ] Write Playwright Test behaviour tests (per `docs/TESTING.md` — Section 3)

**Done when:** Agent runs against `https://demo.playwright.dev/todomvc`, captures at least 5 events, and returns a valid session log JSON.

---

## Phase 4 — Job Queue + Agent Runner

**Goal:** BullMQ queue that manages agent jobs and connects Phase 1 API to Phase 3 agent.

Reference: `docs/SYSTEM_DESIGN.md` — Agent Lifecycle State Machine

Tasks:
- [ ] Create `src/worker/index.ts` — BullMQ worker that processes `agent-run` jobs
- [ ] On job start: update run status to `running` in DB
- [ ] On job start: call `browserAgent.run()` with persona and URL
- [ ] On job complete: save session log to DB (`observations` table)
- [ ] On job complete: update run status to `complete`
- [ ] On job error: update run status to `failed` with error message
- [ ] In API `POST /runs`: add job to BullMQ queue instead of running synchronously
- [ ] Implement max concurrency (3 parallel runs, per `AGENT_MAX_CONCURRENCY` env var)
- [ ] Implement 3-minute job timeout (kill process if exceeded)

**Done when:** `POST /api/v1/runs` returns runId immediately; polling `GET /runs/:id` shows status moving from `pending` → `running` → `complete`.

---

## Phase 5 — AI Analysis Layer

**Goal:** Claude API integration that analyses session logs and produces structured reports.

Reference: `docs/AI_SPEC.md` — Session Analysis Prompt and Code Review Prompt

Tasks:
- [ ] Create `src/ai/promptBuilder.ts` — builds system + user prompt from session log and persona
- [ ] Create `src/ai/claudeClient.ts` — wraps Anthropic SDK with retry logic and timeout
- [ ] Create `src/ai/responseParser.ts` — parses and validates Claude response against Zod schemas
- [ ] Implement hallucination guard (discard bugs with invalid `observationId`)
- [ ] Create `src/ai/codeReviewBuilder.ts` — builds code review prompt from analysis report
- [ ] On agent run complete: trigger AI analysis, save reports to `reports` table
- [ ] Implement `GET /api/v1/reports/:reportId` endpoint
- [ ] Write AI output validation tests (per `docs/TESTING.md` — Section 4)

**Done when:** After a completed agent run, `GET /reports/:id` returns a valid, structured bug report and code review report.

---

## Phase 6 — React Dashboard

**Goal:** Functional frontend for triggering runs and viewing reports.

Reference: `docs/FRONTEND_SPEC.md`

Tasks:
- [ ] Set up Next.js 14 with Tailwind CSS and shadcn/ui
- [ ] Implement Zustand stores: `useRunStore`, `useRunFormStore`, `useReportStore`
- [ ] Build `/` Dashboard page with `RunHistoryTable` and `QuickStartCard`
- [ ] Build `/run/new` New Run page with `UrlInput`, `PersonaSelector`, `AdvancedOptions`
- [ ] Build `/run/[runId]/live` Live Monitor with polling and `LiveObservationFeed`
- [ ] Build `/reports/[runId]` Report Viewer with tabs for Bug Report, UX Friction, Code Review
- [ ] Implement `DownloadReportButton` with PDF generation (`react-pdf`)
- [ ] Add global error handling (Axios interceptor, toast notifications)
- [ ] Ensure all pages are responsive (mobile-first)

**Done when:** A developer can trigger a run from the UI, watch it complete live, and view and download the full report.

---

## Phase 7 — Production Hardening

**Goal:** System is stable, secure, and ready for internal deployment.

Reference: `docs/SECURITY.md`, `docs/DEPLOYMENT.md`

Tasks:
- [ ] Add all SSRF protections (URL validator with private IP blocklist)
- [ ] Confirm auth credentials are never logged or stored
- [ ] Add screenshot 30-day auto-deletion job (BullMQ scheduled job)
- [ ] Write `Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.frontend`
- [ ] Configure GitHub Actions CI/CD pipeline
- [ ] Run `npm audit` and fix all high-severity vulnerabilities
- [ ] Confirm all environment variables are documented in `.env.example`
- [ ] Run full test suite in CI
- [ ] Deploy to internal staging environment
- [ ] Run 10 real agent sessions on internal apps and review output

**Done when:** System is deployed to staging; 10 real runs complete without crashes; test coverage ≥ 85%.

---

## Phase 8 — Demo Preparation

**Goal:** Competition-ready demo.

Tasks:
- [ ] Record a 3-minute screen capture of: triggering a run → watching live → viewing report
- [ ] Prepare the AI-generated code review report as a PDF for the submission
- [ ] Create a presentation covering: Problem, Solution, Architecture, Demo, Results
- [ ] Write a one-page summary of the system for non-technical judges

**Done when:** Demo video is recorded; presentation is complete; all submission materials are ready.
