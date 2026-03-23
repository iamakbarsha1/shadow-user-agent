▗ ▗ ▖ ▖ Claude Code v2.1.75
Opus 4.6 · Claude Pro
▘▘ ▝▝ ~/Documents/code/shadow-user-agent

❯ /usage  
 ⎿ Status dialog dismissed

❯ /model  
 ⎿ Set model to opus (claude-opus-4-6)

❯ so now im planning to make this shadow-user-agent to make a replica of the TestSprite software, where i can have it's functionality in this project! @/Users/akbarsha/Documents/code/shadow-user-agent/TESTSPRITE_RESEARCH.md so go through  
the entire codebase and bring out a plan to implement this in thsi repository, bring out a proper and clean implementation plan to proceed woth feature by feature! need more info check this link: https://www.testsprite.com  
 ⎿  Read TESTSPRITE_RESEARCH.md (340 lines)

⏺ I'll explore the current codebase thoroughly to understand what's already built and what gaps exist compared to TestSprite's feature set. Let me launch parallel exploration agents.

⏺ Let me explore the codebase in parallel to understand what's already built and identify the gaps.

⏺ 3 Explore agents finished (ctrl+o to expand)
├─ Explore core agent & API layer · 33 tool uses · 88.2k tokens
│ ⎿  Done
├─ Explore frontend & testing · 33 tool uses · 77.2k tokens
│ ⎿  Done
└─ Explore project structure & gaps · 31 tool uses · 60.7k tokens
⎿  Done

⏺ Excellent. I now have a comprehensive understanding of the codebase. Let me launch a Plan agent to design the implementation strategy.

⏺ Plan(Design TestSprite implementation plan)
⎿  Done (26 tool uses · 63.6k tokens · 3m 1s)
(ctrl+o to expand)

⏺ Now let me read the key integration files to verify the plan's accuracy before finalizing.

⏺ Read 4 files (ctrl+o to expand)

⏺ I've verified all integration points. Now let me write the final plan.

⏺ Updated plan
⎿  /plan to preview

⏺ Here's a summary of the plan:

9 new phases (Phase 9-17) to transform Shadow User Agent into a TestSprite competitor, ordered by dependency and impact:

┌───────┬──────────────────────────────────────────────────────────────────────┬─────────────┐
│ Phase │ Feature │ Depends On │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 9 │ Test Code Generation — Generate Playwright tests from agent sessions │ - │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 10 │ MCP Server — IDE integration (Cursor, VSCode, Claude Code) │ Phase 9 │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 11 │ Scheduled Monitoring — Cron-based recurring test runs │ Phase 9 │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 12 │ Auto-Healing — Diagnose failures, auto-fix broken selectors │ Phase 9 │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 13 │ Smart Test Groups + IDE Fix Recommendations │ Phase 9, 10 │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 14 │ Credit-Based Usage Tracking — Metering & quotas │ Independent │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 15 │ API Testing — OpenAPI/Swagger spec-based testing │ Independent │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 16 │ Security Testing — XSS, headers, cookies, redirects │ Independent │
├───────┼──────────────────────────────────────────────────────────────────────┼─────────────┤
│ 17 │ Cloud Sandbox Execution — Ephemeral Docker containers │ Independent │
└───────┴──────────────────────────────────────────────────────────────────────┴─────────────┘

Each phase includes: database schema changes, new files/modules, API endpoints, frontend pages, integration points with existing code, and testing strategy.

# Plan: Transform Shadow User Agent into TestSprite Competitor

## Context

Shadow User Agent is a **95% complete autonomous QA system** (Phases 0-6 done, 107 tests passing) that simulates user behavior to detect bugs. It currently **observes and reports** but doesn't **generate reusable test code**, integrate with IDEs, or auto-heal broken tests — which are TestSprite's core differentiators.

This plan adds 9 phases (Phase 9-17) to bridge that gap, prioritized by impact and dependency order. Each phase delivers a standalone, testable feature.

---

## Current State (What Exists)

- Express API with JWT auth, rate limiting, CRUD for runs/reports
- BullMQ + Redis job queue (max 3 concurrent, 3-min timeout)
- Playwright BrowserAgent with 4 personas + Observer (7 event types) + FormFiller (3 strategies)
- Multi-provider AI analysis (Anthropic/Gemini/OpenRouter/KIE) generating bug reports + code reviews
- Next.js dashboard (4 pages: dashboard, new run, live monitor, report viewer)
- PostgreSQL + Prisma (4 tables: runs, observations, reports, screenshots)

## Gap Analysis

| Feature                      | Shadow User Agent | TestSprite | Priority |
| ---------------------------- | :---------------: | :--------: | :------: |
| Test Code Generation         |         -         |    Yes     |  **P0**  |
| MCP Server (IDE Integration) |         -         |    Yes     |  **P0**  |
| Scheduled Monitoring         |         -         |    Yes     |  **P1**  |
| Auto-Healing Tests           |         -         |    Yes     |  **P1**  |
| Smart Test Groups            |         -         |    Yes     |  **P2**  |
| Fix Recommendations to IDE   |         -         |    Yes     |  **P2**  |
| Credit-Based Usage Tracking  |         -         |    Yes     |  **P2**  |
| API Testing                  |         -         |    Yes     |  **P3**  |
| Security Testing             |         -         |    Yes     |  **P3**  |
| Cloud Sandbox Execution      |         -         |    Yes     |  **P4**  |

---

## Dependency Graph

```
Phase 9 (Test Generation) ─────────────────────┐
     |                                          |
     ├── Phase 10 (MCP Server)                  |
     |        |                                 |
     |        └── Phase 13 (Groups + IDE Fix)   |
     |                                          |
     ├── Phase 11 (Scheduled Monitoring)        |
     |                                          |
     └── Phase 12 (Auto-Healing) ───────────────┘

Phase 14 (Credits)          ── independent, any time after Phase 9
Phase 15 (API Testing)      ── independent
Phase 16 (Security Testing) ── independent
Phase 17 (Cloud Sandbox)    ── independent, last
```

---

## Phase 9 — Autonomous Test Generation

**Goal:** Accept URL + optional PRD/description, explore the app, and generate executable Playwright test code from the session.

**This is the foundational phase** — everything else (auto-healing, MCP, groups) depends on having stored test cases.

### Database Changes (`prisma/schema.prisma`)

```prisma
model TestCase {
  id          String    @id @default(uuid()) @db.Uuid
  runId       String    @map("run_id") @db.Uuid
  title       String
  description String?
  testCode    String    @map("test_code") @db.Text
  framework   String    @default("playwright")  // 'playwright' | 'cypress'
  status      String    @default("generated")   // 'generated' | 'passing' | 'failing' | 'stale'
  lastRunAt   DateTime? @map("last_run_at") @db.Timestamptz(3)
  lastResult  Json?     @map("last_result") @db.JsonB
  selectorMap Json?     @map("selector_map") @db.JsonB
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  run   Run    @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId])
  @@index([status])
  @@map("test_cases")
}
```

Add `testCases TestCase[]` to existing `Run` model.

### New Files

| File                              | Purpose                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/ai/testCodeGenerator.ts`     | Orchestrates test generation: calls AI, parses response, saves test cases                |
| `src/ai/testCodePromptBuilder.ts` | Builds system/user prompts for test code generation (follows `promptBuilder.ts` pattern) |
| `src/ai/testCodeParser.ts`        | Parses AI response, extracts Playwright code + selector map, validates with Zod          |
| `src/types/testCase.ts`           | `TestCase`, `TestGenerationRequest`, `TestGenerationResponse` interfaces                 |
| `src/db/queries/testCases.ts`     | CRUD for test_cases table (follows `queries/runs.ts` pattern)                            |
| `src/api/routes/testCases.ts`     | REST endpoints for test case management                                                  |

### API Endpoints

| Method   | Path                              | Description                                                 |
| -------- | --------------------------------- | ----------------------------------------------------------- |
| `POST`   | `/api/v1/runs`                    | Extend to accept `generateTests: boolean` and `prd: string` |
| `GET`    | `/api/v1/runs/:runId/test-cases`  | List generated test cases for a run                         |
| `GET`    | `/api/v1/test-cases/:id`          | Get single test case with code                              |
| `PUT`    | `/api/v1/test-cases/:id`          | Update test case (user edits)                               |
| `DELETE` | `/api/v1/test-cases/:id`          | Delete test case                                            |
| `POST`   | `/api/v1/test-cases/:id/execute`  | Execute test case, return results                           |
| `GET`    | `/api/v1/test-cases/:id/download` | Download test file (.spec.ts)                               |

### Integration Points

- **`agentJob.ts:148`** — After code review is saved, add test generation step when `generateTests` is true
- **`claudeClient.ts`** — Reuse `analyzeWithClaude()` for generation prompts
- **`app.ts`** — Mount: `app.use('/api/v1/test-cases', authenticateJWT, testCasesRouter)`
- **`queue.ts`** — Add `generateTests` and `prd` to `AgentJobData` interface

### Frontend Changes

- New page: `frontend/app/test-cases/[runId]/page.tsx` — View/manage generated tests
- Component: `TestCodeViewer.tsx` — Syntax-highlighted code with copy/download
- Component: `TestCaseList.tsx` — List with status badges
- Store: `useTestCaseStore.ts`
- Update `lib/api.ts` with test case methods
- Add "Generated Tests" tab to report viewer

### Tests

- Unit: `testCodePromptBuilder.test.ts`, `testCodeParser.test.ts` with fixture data
- Integration: test case API endpoints (mock DB, follow `runs.test.ts` pattern)
- Validation: ensure generated Playwright code passes syntax check

---

## Phase 10 — MCP Server Package

**Goal:** Publishable npm package that exposes Shadow Agent capabilities via MCP for Cursor, VSCode, Claude Code.

### New Package Structure

```
packages/
  mcp-server/
    package.json            # "@shadow-agent/mcp-server"
    tsconfig.json
    src/
      index.ts              # Entry point
      server.ts             # MCP server (uses @modelcontextprotocol/sdk)
      tools/
        runTest.ts          # Trigger full agent run
        generateTests.ts    # Generate test cases from URL
        getResults.ts       # Get run results/reports
        listTestCases.ts    # List test cases
        executeTestCase.ts  # Run specific test
        getReport.ts        # Get bug/code review report
      config.ts             # API key + server URL config
      apiClient.ts          # HTTP client wrapping Shadow API
    bin/
      shadow-mcp.ts         # CLI: npx @shadow-agent/mcp-server
```

### MCP Tools

| Tool                     | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `shadow_run_test`        | Accept URL + persona, trigger agent run, return results |
| `shadow_generate_tests`  | URL + optional PRD → generate Playwright test code      |
| `shadow_get_results`     | Get results/report for a run ID                         |
| `shadow_list_test_cases` | List test cases filtered by run                         |
| `shadow_execute_test`    | Execute specific test case by ID                        |
| `shadow_get_report`      | Get bug report or code review                           |

### Backend Changes

- New model `ApiKey` in Prisma (id, key, label, timestamps)
- `POST /api/v1/auth/api-key` — Generate API keys for programmatic access
- API key auth middleware (alternative to JWT, checked via `x-api-key` header)

### Root Package Changes

- Update `package.json` workspaces: `["frontend", "packages/*"]`
- Add `@modelcontextprotocol/sdk` dependency to MCP package

### Tests

- Unit: each tool handler with mocked API responses
- Integration: start MCP server, send tool calls, verify responses

---

## Phase 11 — Scheduled Monitoring

**Goal:** Cron-based recurring test runs using BullMQ repeatable jobs.

### Database Changes

```prisma
model Schedule {
  id          String    @id @default(uuid()) @db.Uuid
  url         String
  personaId   String    @map("persona_id")
  cronPattern String    @map("cron_pattern")     // "0 */6 * * *"
  enabled     Boolean   @default(true)
  options     Json?     @db.JsonB                // maxSteps, auth, generateTests
  lastRunId   String?   @map("last_run_id") @db.Uuid
  lastRunAt   DateTime? @map("last_run_at") @db.Timestamptz(3)
  nextRunAt   DateTime? @map("next_run_at") @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  @@map("schedules")
}
```

### New Files

| File                            | Purpose                                |
| ------------------------------- | -------------------------------------- |
| `src/api/routes/schedules.ts`   | CRUD endpoints                         |
| `src/db/queries/schedules.ts`   | DB queries                             |
| `src/types/schedule.ts`         | Interfaces                             |
| `src/worker/scheduledRunner.ts` | Register/remove BullMQ repeatable jobs |

### API Endpoints

CRUD: `POST/GET/PUT/DELETE /api/v1/schedules[/:id]`

### Integration Points

- **`queue.ts`** — Add `enqueueScheduledRun()` using BullMQ `repeat: { pattern }` option
- **`worker/index.ts`** — On startup, sync schedules from DB to BullMQ repeatable jobs
- **`agentJob.ts`** — Add `scheduleId` to `AgentJobData`, update schedule after run completes

### Frontend Changes

- Pages: `schedules/page.tsx`, `schedules/new/page.tsx`
- Components: `CronInput.tsx` (human-readable builder), `ScheduleList.tsx` (table + toggle)
- Store: `useScheduleStore.ts`

---

## Phase 12 — Auto-Healing

**Goal:** When test cases fail on re-run, diagnose failure type and auto-update broken selectors.

### Database Changes

```prisma
model TestExecution {
  id          String   @id @default(uuid()) @db.Uuid
  testCaseId  String   @map("test_case_id") @db.Uuid
  status      String   // 'passed' | 'failed' | 'healed' | 'error'
  duration    Int      // ms
  errorOutput String?  @map("error_output") @db.Text
  diagnosis   Json?    @db.JsonB
  healResult  Json?    @map("heal_result") @db.JsonB
  executedAt  DateTime @default(now()) @map("executed_at") @db.Timestamptz(3)
  testCase    TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  @@index([testCaseId])
  @@map("test_executions")
}
```

Add `healHistory Json?` and `executions TestExecution[]` to `TestCase` model.

### New Files

| File                         | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- | -------------- | --------- | ------------------ |
| `src/agent/testExecutor.ts`  | Execute stored Playwright test code in sandboxed context    |
| `src/ai/failureDiagnoser.ts` | Classify failure: `real_bug                                 | flaky_selector | slow_load | broken_dependency` |
| `src/ai/selectorHealer.ts`   | Re-analyze DOM, generate updated selectors, patch test code |
| `src/types/diagnosis.ts`     | `FailureDiagnosis`, `HealingResult` interfaces              |

### API Endpoints

| Method | Path                                  | Description                        |
| ------ | ------------------------------------- | ---------------------------------- |
| `POST` | `/api/v1/test-cases/:id/execute`      | Execute → diagnose → heal pipeline |
| `GET`  | `/api/v1/test-cases/:id/executions`   | Execution history                  |
| `GET`  | `/api/v1/test-cases/:id/heal-history` | Healing changelog                  |

### Frontend Changes

- Components: `DiagnosisCard.tsx`, `HealingHistory.tsx`
- Update test case viewer with execution history and diagnosis results

---

## Phase 13 — Smart Test Groups + Fix Recommendations to IDE

**Goal:** Organize tests into groups/suites. Push fix recommendations via MCP to IDE.

### Database Changes

```prisma
model TestGroup {
  id          String     @id @default(uuid()) @db.Uuid
  name        String
  description String?
  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime   @updatedAt @map("updated_at") @db.Timestamptz(3)
  testCases   TestCase[]
  @@map("test_groups")
}
```

Add `groupId` + `group` relation to `TestCase`.

### API Endpoints

CRUD: `POST/GET/PUT/DELETE /api/v1/test-groups[/:id]`

- `POST /api/v1/test-groups/:id/execute` — Run all tests in group
- `POST /api/v1/test-cases/:id/move` — Move to different group

### MCP Server Additions

- `shadow_get_fix_suggestions` — Returns code fix suggestions formatted for IDE
- `shadow_apply_fix` — Returns diff/patch for IDE agent to apply
- `shadow_execute_test_group` — Run all tests in a group

### Frontend

- Page: `test-groups/page.tsx` — Manage groups with drag-and-drop
- Components: `TestGroupManager.tsx`, `GroupExecutionStatus.tsx`

---

## Phase 14 — Credit-Based Usage Tracking

**Goal:** Metering system tracking actions against user quotas.

### Database Changes

```prisma
model UsageRecord {
  id        String   @id @default(uuid()) @db.Uuid
  action    String   // 'run' | 'test_generation' | 'test_execution' | 'ai_analysis'
  credits   Int
  metadata  Json?    @db.JsonB
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  @@index([action])
  @@index([createdAt])
  @@map("usage_records")
}

model CreditAllocation {
  id             String   @id @default(uuid()) @db.Uuid
  plan           String   @default("free")
  monthlyCredits Int      @map("monthly_credits")
  usedCredits    Int      @default(0) @map("used_credits")
  periodStart    DateTime @map("period_start") @db.Timestamptz(3)
  periodEnd      DateTime @map("period_end") @db.Timestamptz(3)
  @@map("credit_allocations")
}
```

### Credit Costs

| Action                    | Credits |
| ------------------------- | ------- |
| Agent run                 | 10      |
| Test generation           | 5       |
| Test execution            | 2       |
| AI analysis (bug report)  | 5       |
| AI analysis (code review) | 3       |

### New Files

- `src/utils/creditTracker.ts` — Check availability, record usage
- `src/api/middleware/creditGuard.ts` — Reject when credits exhausted
- `src/api/routes/usage.ts` — Usage dashboard endpoints

### Frontend

- Component: `CreditBadge.tsx` in nav bar
- Page: `usage/page.tsx` — Usage dashboard

---

## Phase 15 — API Testing

**Goal:** Test backend APIs by accepting OpenAPI/Swagger specs.

### New Files

- `src/agent/apiAgent.ts` — HTTP-based agent (no Playwright), makes requests, validates responses
- `src/agent/specParser.ts` — Parse OpenAPI/Swagger specs
- `src/ai/apiTestGenerator.ts` — AI-driven API test scenario generation

### Changes

- Add `runType` field to `Run` model: `'ui' | 'api'` (default `'ui'`)
- Add `testType` to `TestCase`: `'ui' | 'api'`
- `agentJob.ts` — Route to `apiAgent` when `runType === 'api'`

### Frontend

- Toggle on new run page: "UI Testing" vs "API Testing"
- Components: `ApiSpecUpload.tsx`, `ApiTestResults.tsx`

---

## Phase 16 — Security Testing

**Goal:** Specialized vulnerability scanning (XSS, CSRF, headers, cookies).

### New Files

- `src/agent/securityAgent.ts` — Security-focused browser agent
- `src/agent/securityChecks.ts` — Individual check implementations
- `src/ai/securityReportBuilder.ts` — Security analysis prompts

### Security Checks

1. Missing security headers (CSP, X-Frame-Options, HSTS)
2. Cookie security flags (HttpOnly, Secure, SameSite)
3. XSS reflection tests
4. Open redirect detection
5. Mixed content (HTTP on HTTPS)
6. Exposed source maps
7. Information disclosure in error pages

### Integration

- Add `security_scanner` persona to `personaEngine.ts`
- New observation types: `security_header_missing`, `xss_vulnerability`, `cookie_insecure`
- New report tab: "Security Report"

---

## Phase 17 — Cloud Sandbox Execution

**Goal:** Ephemeral containerized environments for isolated test runs.

### New Files

- `src/worker/sandboxManager.ts` — Docker container lifecycle (create/execute/destroy)
- `src/worker/sandboxExecutor.ts` — Run Playwright inside containers
- `Dockerfile.sandbox` — Lightweight image with Playwright pre-installed

### Approach

- Use `dockerode` npm package for Docker API
- Each run gets its own container with network access only to target URL
- Results streamed back via stdout/volume mounts
- Container destroyed after execution

---

## Verification Strategy

After each phase:

1. Run `npm run test` — all existing 107+ tests still pass
2. Run new phase-specific tests
3. Manual smoke test via dashboard or MCP client
4. `npm run build` — all build targets succeed
5. `npm run lint` — no new lint errors

## Critical Files to Modify (Across All Phases)

| File                         | Phases              | Changes                                   |
| ---------------------------- | ------------------- | ----------------------------------------- |
| `prisma/schema.prisma`       | 9,10,11,12,13,14,15 | New models                                |
| `src/worker/agentJob.ts`     | 9,11,12,14          | Test gen step, schedule tracking, credits |
| `src/worker/queue.ts`        | 9,11                | New job data fields, repeatable jobs      |
| `src/api/app.ts`             | 9,10,11,13,14,15    | Mount new routes                          |
| `src/ai/claudeClient.ts`     | 9,12,15,16          | Reuse for all AI features                 |
| `package.json`               | 10                  | Add `packages/*` to workspaces            |
| `src/agent/personaEngine.ts` | 16                  | Add security_scanner persona              |

## Recommended Execution Order

1. **Phase 9** (Test Generation) — foundation for everything
2. **Phase 10** (MCP Server) — TestSprite's killer feature
3. **Phase 11** (Scheduled Monitoring) — quick win, high impact
4. **Phase 12** (Auto-Healing) — major differentiator
5. **Phase 13** (Groups + IDE Fix) — organizational + MCP enhancement
6. **Phase 14** (Credits) — monetization enabler
7. **Phase 15** (API Testing) — coverage expansion
8. **Phase 16** (Security Testing) — coverage expansion
9. **Phase 17** (Cloud Sandbox) — infrastructure, last
