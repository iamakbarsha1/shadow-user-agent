# Roadmap: Shadow User Agent — TestSprite Feature Parity

## Overview

Nine phases transform Shadow User Agent from a bug-detection tool into a full TestSprite competitor. Phase 9 is the foundation (TestCase DB model required by 10, 12, 13). Phases 14-17 are independent and can run in parallel with 10-13.

## Phases

- [x] **Phase 9: Test Code Generation** — Generate executable Playwright tests from agent sessions
- [x] **Phase 10: MCP Server** — Publishable npm package for Cursor/VSCode/Claude Code integration
- [ ] **Phase 11: Scheduled Monitoring** — Cron-based recurring test runs via BullMQ repeatable jobs
- [ ] **Phase 12: Auto-Healing** — Diagnose test failures and auto-fix broken selectors
- [ ] **Phase 13: Smart Test Groups + IDE Fix Recommendations** — Organize tests, push fixes to IDE
- [ ] **Phase 14: Credit-Based Usage Tracking** — Metering and quota enforcement
- [x] **Phase 15: API Testing** — OpenAPI/Swagger spec-based backend testing (completed 2026-03-24)
- [ ] **Phase 16: Security Testing** — XSS, CSRF, headers, cookies, redirects
- [ ] **Phase 17: Cloud Sandbox Execution** — Ephemeral Docker containers per run

## Phase Details

### Phase 9: Test Code Generation
**Goal**: Accept URL + optional PRD, explore app, generate executable Playwright test code saved to DB
**Depends on**: Nothing (foundational)
**Success Criteria**:
  1. POST /api/v1/runs with generateTests:true triggers test generation after agent run
  2. GET /api/v1/runs/:runId/test-cases returns list of generated TestCase records
  3. Generated code is valid Playwright TypeScript syntax
  4. Frontend shows "Generated Tests" tab in report viewer with code viewer + download
  5. All 107 existing tests still pass
**Plans**: 3 plans

Plans:
- [ ] 09-01: DB schema + AI layer (TestCase model, testCodeGenerator, promptBuilder, parser)
- [ ] 09-02: API endpoints + worker integration (REST routes, agentJob integration)
- [ ] 09-03: Frontend (test cases page, TestCodeViewer, TestCaseList, report tab)

### Phase 10: MCP Server Package
**Goal**: Publishable `@shadow-agent/mcp-server` npm package exposing 6 tools for IDE integration
**Depends on**: Phase 9 (TestCase model)
**Success Criteria**:
  1. `npx @shadow-agent/mcp-server` starts MCP server
  2. All 6 tools callable and returning correct data
  3. API key auth works via x-api-key header
  4. Unit tests cover each tool handler
**Plans**: 2 plans

Plans:
- [ ] 10-01: MCP package structure + API key auth backend
- [ ] 10-02: 6 MCP tool implementations + tests

### Phase 11: Scheduled Monitoring
**Goal**: Cron-based recurring runs using BullMQ repeatable jobs with CRUD management
**Depends on**: Phase 9 (generateTests in schedule options)
**Success Criteria**:
  1. POST /api/v1/schedules creates schedule and registers BullMQ repeatable job
  2. Worker executes scheduled runs at correct cron intervals
  3. Schedule lastRunAt/nextRunAt updated after each run
  4. Frontend shows schedule list with enable/disable toggle
**Plans**: 2 plans

Plans:
- [ ] 11-01: DB schema + backend (Schedule model, scheduledRunner, CRUD API)
- [ ] 11-02: Frontend (schedules page, CronInput, ScheduleList)

### Phase 12: Auto-Healing
**Goal**: When test cases fail, diagnose failure type and auto-update broken selectors
**Depends on**: Phase 9 (TestCase model)
**Success Criteria**:
  1. POST /api/v1/test-cases/:id/execute runs test, diagnoses failure, attempts heal
  2. TestExecution record created with status passed/failed/healed/error
  3. Healed test code saved back to TestCase
  4. Frontend shows execution history and diagnosis cards
**Plans**: 2 plans

Plans:
- [ ] 12-01: DB schema + AI healing layer (TestExecution, failureDiagnoser, selectorHealer, testExecutor)
- [ ] 12-02: API endpoints + frontend (execute endpoint, DiagnosisCard, HealingHistory)

### Phase 13: Smart Test Groups + IDE Fix Recommendations
**Goal**: Organize tests into suites; push fix recommendations via MCP
**Depends on**: Phase 9, Phase 10
**Success Criteria**:
  1. TestGroup CRUD works, test cases assignable to groups
  2. Group execution runs all member tests sequentially
  3. MCP tools shadow_get_fix_suggestions and shadow_apply_fix return correct data
  4. Frontend shows drag-and-drop group manager
**Plans**: 2 plans

Plans:
- [ ] 13-01: DB schema + backend (TestGroup model, group API, MCP additions)
- [ ] 13-02: Frontend (test-groups page, TestGroupManager, GroupExecutionStatus)

### Phase 14: Credit-Based Usage Tracking
**Goal**: Meter actions against quotas; reject when credits exhausted
**Depends on**: Nothing (independent)
**Success Criteria**:
  1. Every run/test-generation/execution records UsageRecord
  2. creditGuard middleware rejects requests when credits exhausted
  3. GET /api/v1/usage returns current period summary
  4. Frontend shows CreditBadge in navbar and usage dashboard page
**Plans**: 2 plans

Plans:
- [ ] 14-01: DB schema + backend (UsageRecord, CreditAllocation, creditTracker, creditGuard, usage API)
- [ ] 14-02: Frontend (CreditBadge, usage/page.tsx)

### Phase 15: API Testing
**Goal**: Test backend APIs by accepting OpenAPI/Swagger specs; HTTP-based agent (no Playwright)
**Depends on**: Nothing (independent)
**Success Criteria**:
  1. POST /api/v1/runs with runType:'api' and spec file triggers API agent
  2. API agent makes requests per spec, validates responses
  3. Results shown in report viewer with API-specific test results
  4. Frontend allows spec upload on new run page
**Plans**: 2 plans

Plans:
- [x] 15-01: Backend (apiAgent, specParser, apiTestGenerator, Run.runType field)
- [ ] 15-02: Frontend (runType toggle, ApiSpecUpload, ApiTestResults)

### Phase 16: Security Testing
**Goal**: Specialized vulnerability scanning for XSS, CSRF, headers, cookies
**Depends on**: Nothing (independent)
**Success Criteria**:
  1. security_scanner persona triggers securityAgent
  2. 7 security checks implemented and reporting findings
  3. Security report tab in report viewer
  4. New observation types logged for security findings
**Plans**: 2 plans

Plans:
- [ ] 16-01: Backend (securityAgent, securityChecks, securityReportBuilder, new persona + observation types)
- [ ] 16-02: Frontend (Security Report tab, security findings display)

### Phase 17: Cloud Sandbox Execution
**Goal**: Ephemeral Docker containers per run for isolation
**Depends on**: Nothing (independent, last)
**Success Criteria**:
  1. Runs with sandbox:true spin up Docker container, execute agent inside, destroy after
  2. Results streamed back to API
  3. Container lifecycle managed (create/execute/destroy) without leaks
  4. Dockerfile.sandbox builds successfully with Playwright pre-installed
**Plans**: 2 plans

Plans:
- [ ] 17-01: sandboxManager + sandboxExecutor + Dockerfile.sandbox
- [ ] 17-02: Integration with agentJob + frontend sandbox toggle

## Progress

**Execution Order:** 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Test Code Generation | 3/3 | Complete | 2026-03-24 |
| 10. MCP Server | 0/2 | Not started | - |
| 11. Scheduled Monitoring | 0/2 | Not started | - |
| 12. Auto-Healing | 0/2 | Not started | - |
| 13. Smart Test Groups | 0/2 | Not started | - |
| 14. Credit Tracking | 0/2 | Not started | - |
| 15. API Testing | 1/2 | Complete    | 2026-03-24 |
| 16. Security Testing | 0/2 | Not started | - |
| 17. Cloud Sandbox | 0/2 | Not started | - |
