# Shadow User Agent — TestSprite Competitor

## What This Is

Shadow User Agent is an AI-powered QA system that simulates real user behavior to detect UX friction and bugs. Phases 0-8 are complete (107 tests passing). This milestone adds 9 phases (9-17) to match and exceed TestSprite's feature set: test code generation, MCP IDE integration, scheduled monitoring, auto-healing, test groups, credit tracking, API testing, security testing, and cloud sandbox execution.

## Core Value

Generate reusable Playwright test code from autonomous agent sessions so developers can maintain a living test suite without manual effort.

## Requirements

### Validated

- ✓ Autonomous browser agent with 4 personas (new_user, power_user, mobile_user, edge_case)
- ✓ Observer capturing 7 event types (console_error, network_failure, slow_response, layout_shift, rage_click, broken_image, stuck_loader)
- ✓ AI analysis generating bug reports + code reviews (Claude/Gemini/OpenRouter)
- ✓ BullMQ job queue with 3 concurrent runs, 3-min timeout
- ✓ Next.js dashboard (dashboard, new run, live monitor, report viewer)
- ✓ PostgreSQL + Prisma (runs, observations, reports, screenshots)
- ✓ JWT auth, rate limiting, SSRF protection

### Active

- [ ] Test Code Generation — Playwright tests from agent sessions (Phase 9)
- [ ] MCP Server — IDE integration for Cursor/VSCode/Claude Code (Phase 10)
- [ ] Scheduled Monitoring — cron-based recurring test runs (Phase 11)
- [ ] Auto-Healing — diagnose + fix broken selectors (Phase 12)
- [ ] Smart Test Groups + IDE Fix Recommendations (Phase 13)
- [ ] Credit-Based Usage Tracking (Phase 14)
- [ ] API Testing via OpenAPI specs (Phase 15)
- [ ] Security Testing — XSS, headers, cookies (Phase 16)
- [ ] Cloud Sandbox Execution — ephemeral Docker containers (Phase 17)

### Out of Scope

- Multi-tenant / SaaS billing infrastructure — too complex for this milestone
- Visual regression testing — not in TestSprite's core offering
- Mobile app testing — Playwright web only

## Context

- Express API at port 4000, Next.js frontend at port 3000
- PostgreSQL + Redis via Docker Compose
- Existing AI layer uses `claude-sonnet-4-20250514` at temperature 0
- BullMQ worker in `src/worker/`, agents in `src/agent/`
- Tests: 107 passing (Vitest unit+integration + Playwright agent tests)
- SSRF protection: blocks private IPs, AWS metadata, file:// protocol
- Rate limiting: 10 runs/hour per user

## Constraints

- **TypeScript**: Strict mode, no `any`, explicit types on all exports
- **Logging**: pino only (no console.log)
- **Error handling**: Typed custom error classes from `src/utils/errors.ts`
- **Testing**: All new code must maintain or improve 107-test suite
- **Patterns**: Follow existing patterns (queries/runs.ts, claudeClient.ts, promptBuilder.ts)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phase 9 before all others | TestCase model is required by phases 10, 12, 13 | — Pending |
| BullMQ for scheduling (Phase 11) | Already in use, avoids new infrastructure | — Pending |
| MCP SDK (@modelcontextprotocol/sdk) | Official SDK for IDE integration | — Pending |
| dockerode for sandbox (Phase 17) | Mature Docker API wrapper for Node.js | — Pending |

---
*Last updated: 2026-03-24 — project initialized for phases 9-17*
