# Technology Stack

**Project:** Shadow User Agent  
**Version:** 1.0

---

## Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Next.js | 14.x |
| State Management | Zustand | 4.x |
| Backend API | Node.js + Express | 20.x / 4.x |
| Browser Automation | Playwright | 1.44.x |
| AI Analysis | Anthropic Claude API | claude-sonnet-4-20250514 |
| Database | PostgreSQL | 16.x |
| ORM | Prisma | 5.x |
| Job Queue | BullMQ + Redis | 5.x / 7.x |
| File Storage | Local filesystem (S3-compatible in prod) | — |
| Testing | Vitest + Playwright Test | 1.x |
| Containerisation | Docker + Docker Compose | 24.x |
| CI/CD | GitHub Actions | — |

---

## Justification

### React + Next.js

Next.js provides server-side rendering for the report viewer (important for PDF generation and SEO-ready public reports), built-in API routes for lightweight BFF patterns, and a mature ecosystem for the dashboard UI. React's component model maps cleanly to the report card, run history list, and persona selector components.

### Zustand

Redux is overkill for this application. Zustand provides simple, boilerplate-free global state for: current run status, active report, and user preferences. It integrates cleanly with React hooks and requires no provider setup.

### Node.js + Express

The Orchestrator API is I/O-bound (spawning processes, polling DB, calling Claude API). Node.js is the natural fit. Express is chosen over Fastify for simplicity and familiarity in a competition context.

### Playwright

Playwright is the industry standard for reliable headless browser automation. Advantages over Puppeteer:

- Native support for multiple browsers (Chromium used here)
- Built-in network interception and event listeners required by the Observer
- Auto-wait behaviour reduces flakiness
- First-class TypeScript support

### Claude API (claude-sonnet-4-20250514)

Claude Sonnet is chosen over GPT-4 for:

- Superior instruction-following on structured output tasks
- Excellent performance on long-context session log analysis
- Vision capability (screenshot interpretation) without a separate model
- Native JSON output mode reduces post-processing errors

### PostgreSQL + Prisma

Relational structure is appropriate — runs have many observations, observations have screenshots, reports belong to runs. PostgreSQL's JSONB column type handles variable-shape observation payloads without schema migrations. Prisma provides type-safe queries and migration management.

### BullMQ + Redis

Agent runs are long-running processes (up to 3 minutes). BullMQ provides:

- Job queuing so concurrent runs don't overload the server
- Retry logic for failed agent processes
- Progress events streamed back to the API layer
- Dead letter queue for failed jobs

### Docker + Docker Compose

Ensures consistent environment for Playwright (requires specific system dependencies). Docker Compose orchestrates: API server, Next.js frontend, PostgreSQL, Redis, and the agent worker in a single `docker-compose up`.

---

## What Was Deliberately Excluded

| Technology | Reason Excluded |
|---|---|
| GraphQL | REST is sufficient; adds complexity without benefit at this scale |
| MongoDB | Relational data model is a better fit; JSONB in PostgreSQL covers flexible payloads |
| Puppeteer | Playwright is a strict superset with better reliability |
| LangChain | Direct Claude API calls are simpler, more predictable, and easier to debug |
| Kubernetes | Out of scope for v1.0; Docker Compose is sufficient for internal deployment |

---

## Environment Requirements

| Requirement | Minimum |
|---|---|
| Node.js | 18 LTS |
| RAM | 4 GB (8 GB recommended for parallel runs) |
| Disk | 10 GB (screenshots accumulate) |
| OS | Linux (Ubuntu 22.04+ recommended), macOS 13+ |
| Network | Target app must be reachable from the agent host |
