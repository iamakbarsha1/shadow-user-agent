---
phase: "15"
plan: "01"
subsystem: "api-testing"
tags: [api-testing, openapi, swagger, http-agent, prisma, validation]
dependency_graph:
  requires: [worker/agentJob, ai/claudeClient, db/queries/reports, utils/errors]
  provides: [src/agent/specParser, src/agent/apiAgent, src/ai/apiTestAnalyzer]
  affects: [src/worker/agentJob, src/api/routes/runs, src/worker/queue, src/types/run, src/types/report]
tech_stack:
  added: []
  patterns: [native-fetch-with-abort, zod-schema-validation, prisma-jsonb-observations, bullmq-job-branching]
key_files:
  created:
    - src/agent/specParser.ts
    - src/agent/apiAgent.ts
    - src/ai/apiTestAnalyzer.ts
    - src/agent/__tests__/specParser.test.ts
    - src/agent/__tests__/apiAgent.test.ts
    - prisma/migrations/20260324060230_add_run_type/migration.sql
  modified:
    - prisma/schema.prisma
    - src/types/run.ts
    - src/types/report.ts
    - src/api/validation.ts
    - src/api/routes/runs.ts
    - src/api/middleware/errorHandler.ts
    - src/worker/queue.ts
    - src/worker/agentJob.ts
    - src/utils/errors.ts
decisions:
  - "Use native fetch with AbortController for 10s timeout — no new HTTP library dependency"
  - "JSON-only spec parsing in MVP to avoid YAML library dependency"
  - "Save each ApiTestResult as individual observation (eventType: api_test_result) for consistency with browser agent observations"
  - "processApiJob extracts from agentJob as a separate function, branching on runType in processAgentJob"
metrics:
  duration: "8 minutes"
  completed_date: "2026-03-24"
  tasks_completed: 11
  files_modified: 15
---

# Phase 15 Plan 01: API Testing Backend Summary

## One-liner

OpenAPI/Swagger spec parser, HTTP-based apiAgent, AI analyzer, and BullMQ job branching for API testing runs alongside the existing browser agent.

## What Was Built

### New Files

- **`src/agent/specParser.ts`** — Parses OpenAPI 3.x and Swagger 2.x JSON specs into `ParsedEndpoint[]`. Handles path/query/header/body parameters, requestBody schemas, and expected status codes. Throws `InvalidSpecError` on malformed input.

- **`src/agent/apiAgent.ts`** — `ApiAgent` class that loops through `ParsedEndpoint[]`, expands path parameters with placeholder values, builds minimal request bodies from JSON schemas, executes `fetch` with 10s timeout, and records `ApiTestResult` (status, responseTime, passed/failed, responseBody snippet).

- **`src/ai/apiTestAnalyzer.ts`** — Sends API test results to Claude, Zod-validates the structured JSON response into `ApiAnalysisReport` with P1-P4 severity issues.

- **`src/agent/__tests__/specParser.test.ts`** — 11 unit tests covering OA3, Swagger2, error handling, and edge cases.

- **`src/agent/__tests__/apiAgent.test.ts`** — 19 unit tests covering pass/fail logic, network errors, timeout, request construction, and result fields.

### Modified Files

- **`prisma/schema.prisma`** — Added `runType String @default("browser") @map("run_type")` to `Run` model.

- **`src/types/run.ts`** — Added `RunType = 'browser' | 'api'`, `runType?` and `apiSpec?` to `CreateRunRequest`, `runType: RunType` to `GetRunResponse`.

- **`src/types/report.ts`** — Added `'api_test_report'` to `ReportType` union.

- **`src/api/validation.ts`** — Extended `createRunSchema` with `runType` (default `'browser'`) and `apiSpec`, plus a refine rule requiring `apiSpec` when `runType === 'api'`.

- **`src/api/routes/runs.ts`** — Pass `runType` and `apiSpec` to `prisma.run.create` and `enqueueAgentRun`, include `runType` in `GetRunResponse`.

- **`src/worker/queue.ts`** — Added `runType?` and `apiSpec?` to `AgentJobData`.

- **`src/worker/agentJob.ts`** — Added `processApiJob` function and branch on `runType === 'api'` in `processAgentJob`. Returns union type including `{ status: 'api_complete'; endpointCount: number }`.

- **`src/utils/errors.ts`** — Added `InvalidSpecError` with `code = 'INVALID_SPEC'`.

- **`src/api/middleware/errorHandler.ts`** — Registered `InvalidSpecError` → HTTP 400.

## Test Results

- Total: **228 tests passed** (16 test files)
- New tests: 30 (11 specParser + 19 apiAgent)
- TypeScript: `npx tsc --noEmit` — no errors
- Migration: `prisma migrate status` — up to date

## Decisions Made

1. **Native fetch + AbortController for timeouts** — avoids adding `node-fetch` or `axios` dependency; Node 18+ has native `fetch`.
2. **JSON-only spec parsing** — no YAML library required in MVP; spec can be converted before submission.
3. **Each ApiTestResult saved as individual Observation** — consistent with existing browser agent pattern; enables per-endpoint queries.
4. **processApiJob as separate function** — clean separation; `processAgentJob` branches at the top, keeping browser agent path unchanged.
5. **'api_test_report' added to ReportType** — extends existing enum rather than creating a new table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added 'api_test_report' to ReportType**
- **Found during:** Task 8 (wiring agentJob)
- **Issue:** `saveReport` parameter typed as `ReportType` which didn't include `'api_test_report'`
- **Fix:** Added `'api_test_report'` to the `ReportType` union in `src/types/report.ts`
- **Files modified:** `src/types/report.ts`
- **Commit:** ba1105f

**2. [Rule 1 - Bug] Fixed Prisma payload typing in agentJob**
- **Found during:** Task 8 (`npx tsc --noEmit`)
- **Issue:** `Record<string, unknown>` not assignable to `Prisma.InputJsonValue` for observation payload
- **Fix:** Cast result as `Prisma.InputJsonValue`; imported `Prisma` type from `@prisma/client`
- **Files modified:** `src/worker/agentJob.ts`
- **Commit:** ba1105f

**3. [Rule 1 - Bug] Fixed GetRunResponse missing runType in runs.ts**
- **Found during:** Task 9 (TypeScript check after Task 4)
- **Issue:** `runs.ts` GET handler didn't include `runType` in response object
- **Fix:** Added `runType: (run.runType ?? 'browser') as 'browser' | 'api'` to response
- **Files modified:** `src/api/routes/runs.ts`
- **Commit:** e894797

**4. [Reorder] Task 10 executed before Task 4**
- **Reason:** `specParser.ts` imports `InvalidSpecError` — doing Task 10 first avoided import errors during development
- **Impact:** No plan deviation in final output; same files delivered

## Known Stubs

None — all new code has real implementations wired end-to-end. `processApiJob` is fully functional (spec parsing, HTTP agent, observations save, AI analysis, status update).

## Self-Check: PASSED

See verification below.
