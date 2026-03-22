# Shadow User Agent - Project Context

**Generated:** 2026-03-22  
**Project Status:** Phase 6 Complete (95% implemented)  
**Type:** AI-Powered Automated QA System

---

## 🎯 Project Overview

Shadow User Agent is an autonomous testing system that simulates real user behavior to detect UX friction and bugs before manual QA begins. It uses Playwright to navigate web applications with different user personas, observes everything that goes wrong, and generates structured bug reports using Claude AI.

### Core Value Proposition
- **Proactive QA:** Catches bugs before human QA testers engage
- **Persona-Driven:** Simulates 4 distinct user archetypes with unique behaviors
- **AI Analysis:** Claude interprets session logs and generates plain-English bug reports
- **Full Automation:** From URL input to report generation with zero manual intervention

### Key Metrics
| Metric | Value |
|--------|-------|
| Max concurrent runs | 3 |
| Agent timeout | 3 minutes |
| Rate limit | 10 runs/hour per user |
| AI cost per run | ~$0.06-0.08 |
| Test coverage | ~70% (target: 85%) |

---

## 🚀 Quick Start Commands

### Initial Setup (One-Time)
```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Install Playwright browsers
npx playwright install chromium

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### Development
```bash
# Start all services (API + Frontend + Worker)
npm run dev

# Start services individually
npm run dev:api      # API server on port 4000
npm run dev:worker   # Background job processor
cd frontend && npm run dev  # Frontend on port 3000
```

### Testing
```bash
# Unit + integration tests
npm run test

# Watch mode
npm run test:watch

# Agent behavior tests (requires Docker test-app)
npm run test:agent

# Coverage report
npm run test:coverage

# All tests for CI
npm run test:ci
```

### Database Operations
```bash
# Create new migration
npx prisma migrate dev --name "migration_name"

# Apply migrations (production)
npm run db:migrate:deploy

# Reset and re-seed (dev only)
npm run db:reset

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Code Quality
```bash
# Lint with fix
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check
```

### Build
```bash
# Build all services
npm run build

# Build individually
npm run build:api
npm run build:worker
npm run build:frontend
```

---

## 🏗️ Architecture Overview

### Data Flow
```
User Input → API creates run → BullMQ job spawned → Agent executes with Persona
→ Observer captures events → Session log saved → Claude analyzes → Reports generated
```

### Agent Lifecycle State Machine
```
PENDING → RUNNING → COMPLETE (or FAILED)
```

### System Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Orchestration** | Express API | Receives user input, manages agent lifecycle via BullMQ |
| **Execution** | Playwright Agent | Runs headless browser with persona-driven navigation |
| **Intelligence** | Claude AI | Analyzes session logs, generates bug/UX reports |
| **Presentation** | Next.js Dashboard | Triggers runs, displays live monitoring, shows reports |
| **Queue** | BullMQ + Redis | Manages concurrent job execution (max 3 parallel) |
| **Storage** | PostgreSQL + Prisma | Persists runs, observations, reports, screenshots |

---

## 📁 Project Structure

```
shadow-user-agent/
├── src/
│   ├── api/                    # Express server
│   │   ├── routes/             # API endpoints (auth, runs, health)
│   │   ├── middleware/         # JWT auth, rate limiting, error handling
│   │   ├── app.ts              # Express app configuration
│   │   ├── server.ts           # Server entry point
│   │   └── validation.ts       # Zod schemas for request validation
│   │
│   ├── agent/                  # Browser automation
│   │   ├── browserAgent.ts     # Autonomous Playwright navigation
│   │   ├── observer.ts         # Event capture (7 types)
│   │   ├── personaEngine.ts    # 4 user archetypes
│   │   └── formFiller.ts       # Form filling strategies
│   │
│   ├── ai/                     # Claude AI integration
│   │   ├── claudeClient.ts     # Anthropic SDK wrapper
│   │   ├── promptBuilder.ts    # Constructs AI prompts
│   │   └── responseParser.ts   # Validates AI output with Zod
│   │
│   ├── worker/                 # Background job processing
│   │   ├── index.ts            # BullMQ worker
│   │   ├── queue.ts            # Queue configuration
│   │   ├── agentJob.ts         # Job processor
│   │   └── screenshotCleanup.ts # 30-day retention cleanup
│   │
│   ├── db/                     # Database layer
│   │   └── queries/            # Prisma query helpers
│   │
│   ├── types/                  # Shared TypeScript interfaces
│   │
│   └── utils/                  # Utilities
│       ├── logger.ts           # Pino logger
│       ├── errors.ts           # Custom error classes
│       ├── envValidator.ts     # Environment variable validation
│       └── urlValidator.ts     # SSRF protection
│
├── frontend/                   # Next.js 14 application
│   ├── app/
│   │   ├── page.tsx            # Dashboard (run history)
│   │   ├── run/new/            # New run form
│   │   ├── run/[runId]/live/   # Live monitor
│   │   └── reports/[runId]/    # Report viewer (directory exists)
│   ├── components/             # React components
│   ├── stores/                 # Zustand state management
│   └── lib/api.ts              # API client
│
├── tests/
│   ├── fixtures/               # Test data (session logs, Claude responses)
│   ├── agent/                  # Playwright behavior tests
│   └── ai/                     # AI output validation tests
│
├── docs/                       # Comprehensive specifications
│   ├── PRD.md                  # Product requirements
│   ├── SYSTEM_DESIGN.md        # Architecture
│   ├── BACKEND_SPEC.md         # API endpoints
│   ├── AI_SPEC.md              # Persona definitions, prompts
│   ├── FRONTEND_SPEC.md        # UI specifications
│   ├── SECURITY.md             # Security practices
│   ├── TESTING.md              # Test strategy
│   └── MASTER_PLAN.md          # Phased roadmap
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Seed data
│
├── .github/workflows/
│   └── ci.yml                  # CI/CD pipeline
│
└── Dockerfiles
    ├── Dockerfile.api
    ├── Dockerfile.worker
    └── Dockerfile.frontend
```

---

## 🔧 Core Components Detail

### Persona Engine (`src/agent/personaEngine.ts`)
Four user archetypes that drive navigation and AI analysis:

| Persona | Viewport | Max Steps | Behavior |
|---------|----------|-----------|----------|
| `new_user` | 1280x800 | 25 | Slow, careful, aborts on errors |
| `power_user` | 1920x1080 | 50 | Fast, expects instant responses |
| `mobile_user` | 390x844 | 30 | iPhone 14, sensitive to layout breaks |
| `edge_case` | 1280x800 | 40 | Submits empty forms, stress-tests |

### Observer (`src/agent/observer.ts`)
Captures 7 event types during agent sessions:

1. `console_error` - JavaScript errors
2. `network_failure` - HTTP status ≥ 400
3. `slow_response` - Response time > 3s
4. `layout_shift` - CLS > 0.1
5. `rage_click` - 3+ clicks in 2s
6. `broken_image` - Failed image loads
7. `stuck_loader` - Spinner visible > 5s

### AI Analysis (`src/ai/`)
- **Model:** claude-sonnet-4-20250514
- **Temperature:** 0 (deterministic output)
- **Reports Generated:**
  - Bug Report: severity (P1-P4), steps to reproduce, fix suggestions
  - UX Friction: usability issues, friction points
  - Code Review: critical issues, improvements, recommendations
- **Safety:** Hallucination guard validates observationIds, retry logic (2 retries)

### Database Schema (`prisma/schema.prisma`)
| Table | Purpose |
|-------|---------|
| `runs` | Agent execution records (status, timestamps) |
| `observations` | Raw events with JSONB payload |
| `reports` | AI-generated reports (JSONB content) |
| `screenshots` | Linked to observations |

---

## 🧪 Testing Strategy

### Three Test Layers

| Layer | Framework | Coverage Target |
|-------|-----------|-----------------|
| Unit + Integration | Vitest + Supertest | 85% overall |
| Agent Behavior | Playwright Test | Critical paths |
| AI Output Validation | Zod schemas + fixtures | 100% validation |

### Current Test Status
```
Test Files: 5 failed | 2 passed (7)
Tests: 11 failed | 90 passed (101)
```

**Known Failing Tests:**
- Auth/health tests (test interaction issues with shared state)
- Observer tests (data: URL test design issue)
- FormFiller tests (timing/randomness flakiness)
- DELETE run test (UUID handling issue)

---

## 🔐 Security Features

### SSRF Protection (`src/utils/urlValidator.ts`)
- Blocks private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Blocks loopback addresses (127.0.0.1, ::1)
- Blocks cloud metadata endpoints (169.254.169.254)
- Blocks internal ports (22, 3306, 5432, 6379, 27017)
- Whitelist via `ALLOWED_INTERNAL_HOSTS` env var

### Authentication
- JWT with RS256 signing
- 8-hour token TTL
- Rate limiting: 10 runs/hour, 300 req/min for other endpoints

### Browser Sandboxing
- Network restricted to target domain via route interception
- No host filesystem access outside `/tmp/agent-sessions/`
- Service workers blocked
- Permissions disabled

---

## 📋 Environment Variables

### Required
```bash
DATABASE_URL=postgresql://shadow:shadow@localhost:5432/shadow_agent
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
INTERNAL_API_KEY=<64-char-hex>
```

### Optional
```bash
AGENT_MAX_CONCURRENCY=3
AGENT_TIMEOUT_MS=180000
SCREENSHOT_STORAGE_PATH=/tmp/agent-sessions
ALLOWED_INTERNAL_HOSTS=internal-app.company.com
```

---

## 🎯 Development Conventions

### Code Style
- **TypeScript:** Strict mode enabled, no `any` types (use `unknown` with type guards)
- **JSDoc:** Required on all exported functions
- **Error Handling:** Custom error classes in `src/utils/errors.ts`
- **Logging:** Use `pino` exclusively (never `console.log`)
- **Naming:** Interfaces for object shapes, explicit function signatures

### Git Conventions
- **Commits:** Conventional Commits format (`feat:`, `fix:`, `chore:`, `test:`, `docs:`)
- **Branches:** `feature/`, `fix/`, `chore/` prefixes
- **PRs:** Max 400 lines, tests must pass

### API Response Format
```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is not reachable or is malformed.",
    "details": {}
  }
}
```

---

## 📊 Current Implementation Status

### Completed Phases (0-6)
| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ 100% | Project setup, Docker, Prisma |
| Phase 1 | ✅ 100% | Core API with authentication |
| Phase 2 | ✅ 100% | Persona Engine (4 personas) |
| Phase 3 | ✅ 100% | Browser Agent + Observer |
| Phase 4 | ✅ 100% | Job Queue + Agent Runner |
| Phase 5 | ✅ 100% | AI Analysis Layer |
| Phase 6 | ✅ 100% | React Dashboard |

### Remaining Work (Phases 7-8)
| Phase | Status | Tasks |
|-------|--------|-------|
| Phase 7 | ⏳ Partial | Production hardening (security audit, deploy to staging) |
| Phase 8 | ❌ Not Started | Demo preparation (video, presentation, materials) |

### Missing Features
1. **Report Viewer UI** - `/reports/[runId]` page needs implementation
2. **PDF Export** - Download reports as PDF
3. **Screenshot Linking** - Properly map screenshots to observations in DB
4. **Test-App** - Controlled test application for agent behavior tests

---

## 🔗 Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/MASTER_PLAN.md` | Phased implementation roadmap |
| `docs/SYSTEM_DESIGN.md` | Architecture and data flow |
| `docs/BACKEND_SPEC.md` | API endpoints and schemas |
| `docs/AI_SPEC.md` | Persona definitions and prompts |
| `docs/SECURITY.md` | Security practices |
| `docs/TESTING.md` | Test strategy |
| `HANDOFF.md` | Development handoff document |
| `CLAUDE.md` | AI assistant usage guidelines |

---

## 🐛 Known Issues

1. **Test Failures (11 failing)** - Test interaction issues, flaky timing tests
2. **Report Viewer Not Built** - Reports generated but no UI to view them
3. **No PDF Export** - Cannot download reports
4. **Screenshot Mapping** - Screenshots saved but not properly linked to observations

---

## 💡 Tips for AI Assistants

1. **Session Discipline:** One objective per session. Stop at ~70% context usage.
2. **Phase-Based:** Follow Plan → Design → Implement → Test → Refactor order.
3. **Code Handling:** Reference existing code; don't rewrite unless modifying.
4. **Error Classes:** Always use custom error types from `src/utils/errors.ts`.
5. **Logging:** Use `pino` logger, never `console.log`.
6. **TypeScript:** Strict mode, no `any`, explicit types required.
7. **Documentation:** Check `docs/` folder for detailed specifications before implementing.

---

## 🚀 Next Priority Actions

1. **Fix Test Failures** - Address 11 failing tests
2. **Build Report Viewer** - Implement `/reports/[runId]` page with PDF download
3. **Production Testing** - Run 10 real agent sessions
4. **Demo Preparation** - Record demo video, create presentation

---

**System is production-ready for internal deployment after Phase 7 security hardening.**
