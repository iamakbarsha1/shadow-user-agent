# Testing Strategy

**Analysis Date:** 2026-03-23

## 1. Test Pyramid

Shadow User Agent follows a three-layer testing strategy:

```
                    ┌─────────────┐
                    │   Agent     │  ← E2E behavior tests (Playwright)
                    │   Tests     │
                   ─┴─────────────┴─
                  ┌─────────────────┐
                  │  AI Validation  │  ← Response parsing, schema validation
                  │     Tests       │
                 ─┴─────────────────┴─
                ┌─────────────────────┐
                │   Unit + Integration │  ← Vitest + Supertest (85% coverage)
                │       Tests          │
               ─┴─────────────────────┴─
```

| Layer | Tool | Purpose | Target Coverage |
|-------|------|---------|-----------------|
| Unit + Integration | Vitest + Supertest | API routes, utilities, data models | 85% overall |
| Agent Behavior | Playwright Test | Browser agent navigation, event capture | Critical paths |
| AI Output Validation | Zod schemas + fixtures | AI response structure, hallucination checks | 100% validation |

## 2. Test Commands

### Development
```bash
# Run all unit + integration tests
npm run test

# Watch mode (re-runs on file changes)
npm run test:watch

# Run agent behavior tests (requires Docker test-app)
npm run test:agent

# Generate coverage report
npm run test:coverage

# All tests for CI
npm run test:ci
```

### CI/CD
```bash
# GitHub Actions runs:
npm run test:ci
# Which executes: npm run test && npm run test:agent
```

## 3. Unit + Integration Tests (Vitest)

### Configuration (`vitest.config.ts`)

```typescript
{
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,  // Lower due to module-init branches
        statements: 85,
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
}
```

### Coverage Exclusions
- `node_modules/`, `dist/`
- `**/*.test.ts`, `**/*.config.ts`
- `tests/fixtures/`, `frontend/**`, `prisma/**`
- `src/types/**` (type-only files)
- `src/api/server.ts`, `src/worker/index.ts` (entry points)
- `src/db/client.ts` (Prisma client instantiation)
- `src/worker/screenshotCleanup.ts` (filesystem ops)
- `src/agent/browserAgent.ts`, `src/worker/agentJob.ts` (integration-level)

### Test File Locations

Unit tests are **co-located** with source code in `__tests__/` directories:

```
src/
├── api/
│   └── __tests__/
│       ├── auth.test.ts           # Auth endpoint tests
│       ├── runs.test.ts           # Runs CRUD tests
│       ├── reports.test.ts        # Reports endpoint tests
│       └── health.test.ts         # Health check tests
│
├── agent/
│   └── __tests__/
│       ├── personaEngine.test.ts  # Persona config tests
│       ├── observer.test.ts       # Event capture tests
│       └── formFiller.test.ts     # Form filling tests
│
├── ai/
│   └── __tests__/
│       ├── claudeClient.test.ts   # AI client tests
│       ├── promptBuilder.test.ts  # Prompt construction tests
│       └── responseParser.test.ts # Response validation tests
│
├── db/
│   └── __tests__/
│       └── queries.test.ts        # Database query tests
│
├── utils/
│   └── __tests__/
│       ├── envValidator.test.ts   # Env validation tests
│       └── urlValidator.test.ts   # SSRF protection tests
│
└── worker/
    └── __tests__/
        └── queue.test.ts          # Queue configuration tests
```

### Example Test Patterns

#### URL Validator (SSRF Protection)
```typescript
// src/utils/__tests__/urlValidator.test.ts
import { describe, it, expect } from 'vitest';
import { validateTargetUrl } from '../urlValidator';

describe('validateTargetUrl', () => {
  it('accepts valid https URLs', () => {
    expect(() => validateTargetUrl('https://app.example.com')).not.toThrow();
  });

  it('rejects localhost', () => {
    expect(() => validateTargetUrl('http://localhost:3000')).toThrow('INVALID_URL');
  });

  it('rejects private IP ranges', () => {
    expect(() => validateTargetUrl('http://192.168.1.1')).toThrow('INVALID_URL');
  });

  it('rejects AWS metadata endpoint', () => {
    expect(() => validateTargetUrl('http://169.254.169.254')).toThrow('INVALID_URL');
  });

  it('rejects file:// protocol', () => {
    expect(() => validateTargetUrl('file:///etc/passwd')).toThrow('INVALID_URL');
  });
});
```

#### Persona Engine
```typescript
// src/agent/__tests__/personaEngine.test.ts
import { describe, it, expect } from 'vitest';
import { getPersonaConfig } from '../personaEngine';

describe('getPersonaConfig', () => {
  it('returns correct viewport for mobile_user', () => {
    const config = getPersonaConfig('mobile_user');
    expect(config.viewportWidth).toBe(390);
    expect(config.viewportHeight).toBe(844);
  });

  it('throws for unknown persona', () => {
    expect(() => getPersonaConfig('unknown')).toThrow('UNKNOWN_PERSONA');
  });
});
```

#### API Routes (Supertest)
```typescript
// src/api/__tests__/runs.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('POST /api/v1/runs', () => {
  it('creates a new run with valid input', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/runs')
      .send({ url: 'https://app.example.com', personaId: 'new_user' });

    expect(response.status).toBe(201);
    expect(response.body.runId).toBeDefined();
  });

  it('rejects invalid URL', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/runs')
      .send({ url: 'http://localhost:3000', personaId: 'new_user' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_URL');
  });
});
```

## 4. Agent Behavior Tests (Playwright)

### Configuration (`playwright.config.ts`)

```typescript
{
  testDir: './tests/agent',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
}
```

### Test Location
```
tests/agent/
└── agent.test.ts    # Browser agent behavior tests
```

### Requirements
- Docker test-app running on `http://localhost:8080`
- Chromium browser installed (`npx playwright install chromium`)

### Example Test Pattern
```typescript
// tests/agent/agent.test.ts
import { test, expect } from '@playwright/test';

test.describe('Browser Agent', () => {
  test('navigates and captures observations', async ({ page }) => {
    // Test agent behavior against controlled test application
    // Verifies:
    // - Page navigation
    // - Element interaction
    // - Event capture (console errors, network failures)
    // - Screenshot capture
  });
});
```

### Running Agent Tests
```bash
# Start test application first
docker run -p 8080:80 shadow-user-agent-test-app

# Then run tests
npm run test:agent
```

## 5. AI Output Validation Tests

### Location
```
tests/ai/
├── claudeClient.test.ts    # AI client retry logic, provider selection
└── responseParser.test.ts  # Zod schema validation
```

### Fixtures
```
tests/fixtures/
└── persona_configs.json    # Sample persona configurations
```

### Validation Strategy
AI responses are validated using **Zod schemas** in `src/ai/responseParser.ts`:

```typescript
// Bug report schema
const BugReportSchema = z.object({
  bugs: z.array(z.object({
    severity: z.enum(['P1', 'P2', 'P3', 'P4']),
    title: z.string(),
    description: z.string(),
    stepsToReproduce: z.array(z.string()),
    expectedBehavior: z.string(),
    actualBehavior: z.string(),
    observationIds: z.array(z.string()),
    fixSuggestions: z.array(z.string()),
  })),
});

// UX friction schema
const UxFrictionSchema = z.object({
  frictionPoints: z.array(z.object({
    category: z.enum(['navigation', 'performance', 'clarity', 'interaction']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    observationIds: z.array(z.string()),
    improvementSuggestions: z.array(z.string()),
  })),
});
```

### Hallucination Guard
Response parser validates that `observationIds` in AI reports reference actual observations from the session log.

## 6. Test Fixtures

### Location
```
tests/fixtures/
└── persona_configs.json
```

### Purpose
- Sample data for unit tests
- Mock AI responses for validation tests
- Sample session logs for integration tests

## 7. CI/CD Pipeline (`.github/workflows/ci.yml`)

### Jobs
```yaml
jobs:
  lint:
    # ESLint + Prettier format check
    runs-on: ubuntu-latest
    steps:
      - checkout
      - install dependencies
      - run lint
      - run format:check

  test:
    # Vitest with coverage
    runs-on: ubuntu-latest
    services:
      postgres: postgres:16-alpine
      redis: redis:7-alpine
    steps:
      - checkout
      - install dependencies
      - run migrations
      - run tests with coverage
      - upload coverage artifact

  audit:
    # npm audit --audit-level=critical
    runs-on: ubuntu-latest
    steps:
      - checkout
      - install dependencies
      - run audit

  build:
    # TypeScript compile
    runs-on: ubuntu-latest
    steps:
      - checkout
      - install dependencies
      - build API
      - build Worker
      - build Frontend
```

### Secrets Required
- `ANTHROPIC_API_KEY`
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`

## 8. Current Test Status

### Test Files
```
Test Files: 5 failed | 9 passed (14)
Tests: 11 failed | 90 passed (101)
```

### Known Failing Tests
| Test | Reason |
|------|--------|
| Auth tests | Test interaction issues with shared state |
| Health tests | Test interaction issues with shared state |
| Observer tests | Data: URL test design issue |
| FormFiller tests | Timing/randomness flakiness |
| DELETE run test | UUID handling issue |

### Coverage Targets
| Metric | Target | Current |
|--------|--------|---------|
| Lines | 85% | ~70% |
| Functions | 85% | ~75% |
| Branches | 80% | ~65% |
| Statements | 85% | ~70% |

## 9. Test Conventions

### Naming
- Test files: `<module>.test.ts`
- Test directories: `__tests__/`
- Describe blocks: Module/function name
- Test cases: Should + expected behavior

```typescript
describe('validateTargetUrl', () => {
  it('should accept valid https URLs', () => { ... });
  it('should reject localhost URLs', () => { ... });
  it('should throw InvalidUrlError for private IPs', () => { ... });
});
```

### Assertions
- Use Vitest's `expect()` for all assertions
- Prefer `toThrow()` for error cases
- Use specific error codes in assertions

### Mocking
- Mock external dependencies (AI client, database)
- Use `vi.mock()` for module-level mocks
- Use `vi.fn()` for spy/stub patterns

### Setup/Teardown
- Global setup in `tests/setup.ts`
- Per-test cleanup in `beforeEach`/`afterEach`
- Database transactions for isolation

## 10. Test Data Management

### Database Tests
- Use transactions for isolation
- Rollback after each test
- Seed minimal required data

### API Tests
- Use Supertest for HTTP assertions
- Mock authentication middleware in dev
- Test error responses explicitly

### Agent Tests
- Require controlled test application
- Deterministic test scenarios
- Screenshot on failure only

## 11. Debugging Tests

### Verbose Output
```bash
# Run with verbose logging
npm run test -- --reporter=verbose

# Run specific test file
npm run test -- src/utils/__tests__/urlValidator.test.ts

# Run specific test case
npm run test -- -t "should reject localhost"
```

### Coverage Debugging
```bash
# Generate HTML coverage report
npm run test:coverage

# Open in browser
open coverage/index.html
```

### Agent Test Debugging
```bash
# Run with Playwright UI
npx playwright test --ui

# Run with headed browser
npx playwright test --headed

# Run specific test file
npx playwright test tests/agent/agent.test.ts
```

---

*Test strategy analysis: 2026-03-23*
