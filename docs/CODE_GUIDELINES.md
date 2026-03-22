# Code Guidelines

**Project:** Shadow User Agent  
**Version:** 1.0

---

## 1. Folder Structure

```
shadow-user-agent/
├── README.md
├── docs/                          # All documentation
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── api/                       # Express API server
│   │   ├── app.ts                 # Express app setup
│   │   ├── server.ts              # Server entry point
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── errorHandler.ts
│   │   └── routes/
│   │       ├── runs.ts
│   │       ├── reports.ts
│   │       └── health.ts
│   ├── agent/                     # Browser agent + persona + observer
│   │   ├── browserAgent.ts
│   │   ├── observer.ts
│   │   ├── personaEngine.ts
│   │   └── formFiller.ts
│   ├── ai/                        # Claude API integration
│   │   ├── claudeClient.ts
│   │   ├── promptBuilder.ts
│   │   ├── responseParser.ts
│   │   └── codeReviewBuilder.ts
│   ├── worker/                    # BullMQ job worker
│   │   ├── index.ts
│   │   └── agentJob.ts
│   ├── db/                        # Prisma client + query helpers
│   │   ├── client.ts
│   │   └── queries/
│   │       ├── runs.ts
│   │       └── reports.ts
│   ├── types/                     # Shared TypeScript interfaces
│   │   ├── persona.ts
│   │   ├── observation.ts
│   │   ├── report.ts
│   │   └── run.ts
│   └── utils/
│       ├── urlValidator.ts
│       ├── logger.ts
│       └── retry.ts
├── frontend/                      # Next.js application
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard
│   │   ├── run/
│   │   │   ├── new/page.tsx
│   │   │   └── [runId]/live/page.tsx
│   │   └── reports/
│   │       └── [runId]/page.tsx
│   ├── components/
│   │   ├── dashboard/
│   │   ├── run/
│   │   └── reports/
│   └── stores/
│       ├── useRunStore.ts
│       ├── useRunFormStore.ts
│       └── useReportStore.ts
└── tests/
    ├── fixtures/
    ├── agent/
    └── ai/
```

---

## 2. Naming Conventions

### Files

| Type | Convention | Example |
|------|-----------|---------|
| TypeScript source | camelCase | `browserAgent.ts` |
| React component file | PascalCase | `BugCard.tsx` |
| Test file | `*.test.ts` | `urlValidator.test.ts` |
| Type definition file | camelCase | `observation.ts` |
| Config file | kebab-case or standard | `docker-compose.yml` |

### Variables and Functions

| Type | Convention | Example |
|------|-----------|---------|
| Variables | camelCase | `sessionLog`, `runId` |
| Functions | camelCase | `validateTargetUrl()`, `buildPrompt()` |
| Constants | UPPER_SNAKE_CASE | `MAX_STEPS`, `DEFAULT_TIMEOUT_MS` |
| Classes | PascalCase | `BrowserAgent`, `ObserverService` |
| Interfaces | PascalCase | `PersonaConfig`, `AnalysisReport` |
| Enums | PascalCase values | `RunStatus.Complete` |

### Database

| Type | Convention | Example |
|------|-----------|---------|
| Table names | snake_case | `runs`, `observations` |
| Column names | snake_case | `run_id`, `started_at` |
| Indexes | `idx_{table}_{column}` | `idx_runs_status` |

### API

| Type | Convention | Example |
|------|-----------|---------|
| Routes | kebab-case | `/api/v1/run-agent` |
| Request body keys | camelCase | `personaId`, `maxSteps` |
| Response keys | camelCase | `runId`, `startedAt` |

---

## 3. TypeScript Rules

- Strict mode is enabled (`"strict": true` in tsconfig.json)
- No `any` types — use `unknown` and narrow with type guards
- All function parameters and return types must be explicitly typed
- Prefer interfaces over type aliases for object shapes
- Prefer `readonly` arrays and properties where mutation is not intended

```typescript
// ✅ Good
function getPersonaConfig(personaId: string): PersonaConfig {
  ...
}

// ❌ Bad
function getPersonaConfig(personaId: any): any {
  ...
}
```

---

## 4. Error Handling

- All errors must be instances of a typed error class, not plain `Error`
- Define custom errors in `src/utils/errors.ts`

```typescript
// ✅ Good
export class InvalidUrlError extends Error {
  code = 'INVALID_URL';
  constructor(url: string) {
    super(`URL is invalid or not reachable: ${url}`);
  }
}

// Throw it:
throw new InvalidUrlError(url);

// ❌ Bad
throw new Error('invalid url');
throw 'something went wrong';
```

- API error responses always use the standard error format defined in `docs/BACKEND_SPEC.md`
- Never return a raw stack trace to the client — log it server-side only

---

## 5. Logging

Use `pino` for all server-side logging. Never use `console.log` in production code.

```typescript
import { logger } from '../utils/logger';

// ✅ Good
logger.info({ runId, personaId }, 'Agent run started');
logger.error({ err, runId }, 'Agent process crashed');

// ❌ Bad
console.log('run started:', runId);
```

Log levels:
- `info` — normal operational events (run started, run complete)
- `warn` — recoverable issues (AI retry, slow response)
- `error` — failures (agent crash, DB write failure)
- `debug` — development only (never committed with debug logs left on)

---

## 6. Comments

- Write comments for **why**, not **what**
- Do not leave commented-out code in commits
- JSDoc is required on all exported functions

```typescript
/**
 * Validates a target URL against the SSRF blocklist.
 * Throws InvalidUrlError if the URL is malformed, uses a blocked protocol,
 * or resolves to a private IP range not in the whitelist.
 */
export function validateTargetUrl(url: string): void {
  ...
}
```

---

## 7. Git Conventions

### Commit Messages

Follow the Conventional Commits format:

```
feat: add mobile_user persona
fix: prevent agent crash on empty page
chore: update playwright to 1.44.0
test: add observer event capture tests
docs: update DEPLOYMENT.md with S3 config
```

### Branch Naming

```
feature/persona-engine
fix/observer-race-condition
chore/update-dependencies
```

### PR Rules

- Every PR must have at least one reviewer
- Tests must pass before merge
- No PR larger than 400 lines of diff — split if needed

---

## 8. Environment Safety

- Never hardcode values that differ between environments
- All environment-specific config is loaded from `.env` via `process.env`
- All required env vars are documented in `.env.example`
- At startup, validate that all required env vars are present:

```typescript
// src/utils/envValidator.ts
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'ANTHROPIC_API_KEY',
  'JWT_PRIVATE_KEY'
];

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```
