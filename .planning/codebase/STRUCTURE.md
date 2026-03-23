# Project Structure

**Analysis Date:** 2026-03-23

## 1. Root Directory

```
shadow-user-agent/
├── .env.example              # Environment variable template
├── .eslintrc.json            # ESLint configuration
├── .gitignore                # Git ignore patterns
├── .prettierrc.json          # Prettier formatting rules
├── .prettierignore           # Prettier ignore patterns
├── docker-compose.yml        # Infrastructure services (PostgreSQL + Redis)
├── Dockerfile.api            # API container build instructions
├── Dockerfile.frontend       # Frontend container build instructions
├── Dockerfile.worker         # Worker container build instructions
├── package.json              # Root package.json (workspaces enabled)
├── package-lock.json         # npm lockfile
├── playwright.config.ts      # Playwright test configuration
├── vitest.config.ts          # Vitest test configuration
├── tsconfig.json             # Root TypeScript configuration
├── tsconfig.api.json         # API-specific TypeScript config
├── tsconfig.worker.json      # Worker-specific TypeScript config
├── CLAUDE.md                 # AI assistant usage guidelines
├── HANDOFF.md                # Development handoff document
├── PHASE_*.md                # Phase completion documents (0-6)
│
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI/CD pipeline
│
├── .planning/
│   └── codebase/             # GSD-generated documentation
│       ├── STACK.md          # Technology stack analysis
│       ├── INTEGRATIONS.md   # External integrations audit
│       ├── ARCHITECTURE.md   # System architecture
│       ├── STRUCTURE.md      # This file
│       ├── CONVENTIONS.md    # Coding conventions
│       ├── TESTING.md        # Test strategy
│       └── CONCERNS.md       # Technical debt and concerns
│
├── docs/                     # Comprehensive documentation
│   ├── PRD.md                # Product requirements document
│   ├── SYSTEM_DESIGN.md      # Architecture specification
│   ├── BACKEND_SPEC.md       # API endpoints specification
│   ├── AI_SPEC.md            # AI/Persona specifications
│   ├── FRONTEND_SPEC.md      # UI specifications
│   ├── SECURITY.md           # Security practices
│   ├── TESTING.md            # Test strategy
│   ├── MASTER_PLAN.md        # Phased implementation roadmap
│   └── ...
│
├── prisma/                   # Database layer
│   ├── schema.prisma         # Prisma schema definition
│   ├── seed.ts               # Database seed script
│   └── migrations/           # Auto-generated migrations
│
├── src/                      # Source code (backend + worker)
│   ├── api/                  # Express API server
│   ├── agent/                # Browser automation
│   ├── ai/                   # Claude AI integration
│   ├── worker/               # Background job processing
│   ├── db/                   # Database layer
│   ├── types/                # Shared TypeScript types
│   └── utils/                # Utility functions
│
├── frontend/                 # Next.js 14 application
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   ├── stores/               # Zustand state management
│   ├── lib/                  # Frontend utilities
│   ├── public/               # Static assets
│   ├── next.config.js        # Next.js configuration
│   ├── tailwind.config.ts    # TailwindCSS configuration
│   └── package.json          # Frontend dependencies
│
├── tests/                    # Test files
│   ├── fixtures/             # Test data (session logs, Claude responses)
│   ├── agent/                # Playwright behavior tests
│   ├── ai/                   # AI output validation tests
│   └── setup.ts              # Test setup
│
└── dist/                     # Compiled JavaScript (generated)
    ├── api/                  # API build output
    └── worker/               # Worker build output
```

## 2. Source Code Structure (`src/`)

### 2.1 API Layer (`src/api/`)

```
src/api/
├── server.ts                 # Server entry point (starts Express)
├── app.ts                    # Express app configuration
├── validation.ts             # Zod schemas for request validation
│
├── routes/                   # Route handlers
│   ├── auth.ts               # Authentication endpoints
│   ├── runs.ts               # Agent run CRUD endpoints
│   └── health.ts             # Health check endpoint
│
├── middleware/               # Express middleware
│   ├── auth.ts               # JWT authentication
│   ├── rateLimit.ts          # Rate limiting (Redis-backed)
│   └── errorHandler.ts       # Global error handler
│
└── __tests__/                # API tests
    ├── app.test.ts           # App configuration tests
    └── routes/               # Route-specific tests
        ├── auth.test.ts      # Auth endpoint tests
        ├── runs.test.ts      # Runs endpoint tests
        └── health.test.ts    # Health check tests
```

**Key Files:**
- `server.ts` - Entry point, starts HTTP server on `APP_PORT` (default: 4000)
- `app.ts` - Creates Express app with middleware stack
- `validation.ts` - Request body validation schemas using Zod

### 2.2 Agent Layer (`src/agent/`)

```
src/agent/
├── browserAgent.ts           # Main Playwright browser automation
├── observer.ts               # Event capture (7 event types)
├── personaEngine.ts          # 4 user archetypes configuration
├── formFiller.ts             # Form filling strategies
│
└── __tests__/                # Agent tests
    ├── browserAgent.test.ts  # Browser agent behavior tests
    ├── observer.test.ts      # Observer event capture tests
    ├── personaEngine.test.ts # Persona configuration tests
    └── formFiller.test.ts    # Form filler strategy tests
```

**Key Files:**
- `browserAgent.ts` - Autonomous navigation with persona-driven behavior
- `observer.ts` - Captures console errors, network failures, layout shifts, etc.
- `personaEngine.ts` - Defines 4 personas: new_user, power_user, mobile_user, edge_case
- `formFiller.ts` - Intelligent form interaction strategies

### 2.3 AI Layer (`src/ai/`)

```
src/ai/
├── claudeClient.ts           # AI provider abstraction (Anthropic/Gemini/KIE/OpenRouter)
├── promptBuilder.ts          # Constructs AI prompts for analysis
├── responseParser.ts         # Validates AI output with Zod schemas
│
└── __tests__/                # AI tests
    ├── claudeClient.test.ts  # AI client tests
    └── responseParser.test.ts # Response validation tests
```

**Key Files:**
- `claudeClient.ts` - Multi-provider AI client with retry logic
- `promptBuilder.ts` - Builds prompts for bug reports, UX friction, code review
- `responseParser.ts` - Zod schemas for validating AI responses

### 2.4 Worker Layer (`src/worker/`)

```
src/worker/
├── index.ts                  # BullMQ worker entry point
├── queue.ts                  # Queue configuration and types
├── agentJob.ts               # Job processor (orchestrates agent + AI)
└── screenshotCleanup.ts      # 30-day screenshot retention cleanup
```

**Key Files:**
- `index.ts` - Starts BullMQ worker, handles graceful shutdown
- `queue.ts` - Exports queue connection config and job types
- `agentJob.ts` - Processes agent run jobs end-to-end
- `screenshotCleanup.ts` - Periodic cleanup of old screenshots

### 2.5 Database Layer (`src/db/`)

```
src/db/
├── client.ts                 # Prisma client singleton
└── queries/                  # Query helpers
    ├── runQueries.ts         # Run CRUD operations
    ├── observationQueries.ts # Observation queries
    └── reportQueries.ts      # Report queries
```

**Key Files:**
- `client.ts` - Singleton Prisma client instance
- `queries/*.ts` - Reusable database query functions

### 2.6 Types Layer (`src/types/`)

```
src/types/
├── persona.ts                # Persona-related types
├── observation.ts            # Observation and session log types
├── report.ts                 # Report types
├── api.ts                    # API request/response types
└── errors.ts                 # Error type definitions
```

### 2.7 Utils Layer (`src/utils/`)

```
src/utils/
├── logger.ts                 # Pino logger configuration
├── errors.ts                 # Custom error classes
├── envValidator.ts           # Environment variable validation
├── urlValidator.ts           # SSRF protection for URLs
└── __tests__/
    ├── logger.test.ts
    ├── errors.test.ts
    ├── envValidator.test.ts
    └── urlValidator.test.ts
```

**Key Files:**
- `logger.ts` - Shared Pino logger (pretty in dev, JSON in prod)
- `errors.ts` - Custom error classes (InvalidUrlError, RunNotFoundError, etc.)
- `envValidator.ts` - Validates required environment variables at startup
- `urlValidator.ts` - SSRF protection, blocks private IPs and internal endpoints

## 3. Frontend Structure (`frontend/`)

```
frontend/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Dashboard (run history)
│   ├── run/
│   │   ├── new/
│   │   │   └── page.tsx      # New run form
│   │   └── [runId]/
│   │       └── live/
│   │           └── page.tsx  # Live monitoring page
│   └── reports/
│       └── [runId]/
│           └── page.tsx      # Report viewer (pending implementation)
│
├── components/               # React components
│   ├── ui/                   # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   ├── RunList.tsx           # Run history list
│   ├── RunCard.tsx           # Individual run card
│   ├── LiveMonitor.tsx       # Live monitoring component
│   └── ...
│
├── stores/                   # Zustand state management
│   ├── runStore.ts           # Run state management
│   ├── observationStore.ts   # Observation state
│   └── reportStore.ts        # Report state
│
├── lib/                      # Frontend utilities
│   ├── api.ts                # API client
│   └── utils.ts              # Helper functions
│
├── public/                   # Static assets
│
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # TailwindCSS configuration
├── postcss.config.js         # PostCSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Frontend dependencies
```

## 4. Test Structure (`tests/`)

```
tests/
├── setup.ts                  # Global test setup
│
├── fixtures/                 # Test data
│   ├── sessionLogs/          # Sample session logs
│   └── claudeResponses/      # Sample AI responses
│
├── agent/                    # Playwright behavior tests
│   └── agent.test.ts         # Agent navigation tests (requires test-app)
│
└── ai/                       # AI output validation tests
    ├── claudeClient.test.ts  # AI client tests
    └── responseParser.test.ts # Response parsing tests
```

**Test Co-location:**
Unit tests for individual modules are co-located in `__tests__/` directories within each source folder.

## 5. Configuration Files

### 5.1 TypeScript Configurations

| File | Purpose |
|------|---------|
| `tsconfig.json` | Root config, strict mode, ES2022 target |
| `tsconfig.api.json` | API build, outputs to `dist/api/` |
| `tsconfig.worker.json` | Worker build, outputs to `dist/worker/` |
| `frontend/tsconfig.json` | Frontend TypeScript (Next.js managed) |

### 5.2 Test Configurations

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest unit/integration test config |
| `playwright.config.ts` | Playwright E2E/agent test config |

### 5.3 Build Configurations

| File | Purpose |
|------|---------|
| `Dockerfile.api` | Multi-stage build for API (node:18-alpine) |
| `Dockerfile.worker` | Multi-stage build for worker (Playwright image) |
| `Dockerfile.frontend` | Multi-stage build for frontend (Next.js standalone) |
| `docker-compose.yml` | Infrastructure services (PostgreSQL + Redis) |

## 6. File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Source modules | `camelCase.ts` | `personaEngine.ts` |
| Test files | `<module>.test.ts` | `personaEngine.test.ts` |
| Test directories | `__tests__/` | `src/api/routes/__tests__/` |
| Classes | `PascalCase.ts` (matches class name) | `observer.ts` exports `Observer` |
| Config files | `*.config.ts` or `*.config.js` | `vite.config.ts` |
| Type definitions | `camelCase.ts` in `types/` | `src/types/persona.ts` |

## 7. Import Path Patterns

**Relative imports only** - no path aliases configured.

**Order:**
1. Third-party packages (`import Anthropic from '@anthropic-ai/sdk'`)
2. Internal modules (`import { logger } from '../utils/logger'`)
3. Types (`import type { PersonaConfig } from '../types/persona'`)

**Type-only imports:**
```typescript
import type { Express } from 'express';
import type { Run } from '@prisma/client';
```

## 8. Build Output Structure

```
dist/
├── api/                    # API build
│   ├── api/
│   │   ├── server.js
│   │   ├── app.js
│   │   ├── routes/
│   │   └── middleware/
│   ├── agent/              # Shared agent code
│   ├── ai/                 # Shared AI code
│   ├── db/
│   ├── types/
│   └── utils/
│
└── worker/                 # Worker build
    ├── worker/
    │   ├── index.js
    │   ├── queue.js
    │   └── agentJob.js
    ├── agent/
    ├── ai/
    ├── db/
    ├── types/
    └── utils/
```

**Frontend:**
```
frontend/.next/
├── static/                 # Static assets
├── server/                 # Server-side code
├── build/                  # Build artifacts
└── standalone/             # Standalone deployment (Docker)
```

---

*Structure analysis: 2026-03-23*
