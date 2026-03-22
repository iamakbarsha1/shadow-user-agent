# Testing

**Project:** Shadow User Agent  
**Version:** 1.0

---

## Overview

Testing the Shadow User Agent covers three distinct concerns:

1. **Standard unit + integration tests** — API routes, data models, utility functions
2. **Agent behaviour tests** — does the browser agent navigate correctly and capture the right events?
3. **AI output validation** — is the AI-generated report structured correctly and not hallucinating?

---

## Test Stack

| Type | Tool |
|------|------|
| Unit + integration | Vitest |
| API integration | Supertest |
| Agent behaviour | Playwright Test |
| AI output validation | Custom validator (Zod schemas) |
| Coverage | Vitest Coverage (v8) |
| CI runner | GitHub Actions |

---

## 1. Unit Tests

### Location

```
src/
├── api/
│   └── __tests__/
│       ├── runs.test.ts
│       └── reports.test.ts
├── agent/
│   └── __tests__/
│       ├── personaEngine.test.ts
│       └── observer.test.ts
├── ai/
│   └── __tests__/
│       ├── promptBuilder.test.ts
│       └── responseParser.test.ts
└── utils/
    └── __tests__/
        └── urlValidator.test.ts
```

### Example — URL Validator

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

### Example — Persona Engine

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

---

## 2. API Integration Tests

```typescript
// src/api/__tests__/runs.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('POST /api/v1/runs', () => {
  it('returns 201 with runId for valid input', async () => {
    const res = await request(app)
      .post('/api/v1/runs')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({
        url: 'https://demo.playwright.dev/todomvc',
        personaId: 'new_user'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('runId');
    expect(res.body.status).toBe('pending');
  });

  it('returns 400 for missing personaId', async () => {
    const res = await request(app)
      .post('/api/v1/runs')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ url: 'https://demo.playwright.dev/todomvc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_PERSONA');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/runs')
      .send({ url: 'https://example.com', personaId: 'new_user' });

    expect(res.status).toBe(401);
  });
});
```

---

## 3. Agent Behaviour Tests

These tests run a real Playwright session against a known, controlled test application.

### Test App

A simple React test app is included in the repo at `test-app/`. It contains:
- A login page (with a known broken auth flow)
- A dashboard with a stuck loader
- A form with missing error states
- A page with a broken image

### Test Scenarios

```typescript
// tests/agent/agentBehaviour.test.ts
import { test, expect } from '@playwright/test';
import { runAgentOnTestApp } from '../helpers/agentRunner';

test('new_user persona captures login failure', async () => {
  const result = await runAgentOnTestApp({
    personaId: 'new_user',
    targetPath: '/login'
  });

  const loginFailure = result.observations.find(
    o => o.eventType === 'network_failure' && o.payload.url.includes('/auth')
  );
  expect(loginFailure).toBeDefined();
});

test('observer captures broken image on dashboard', async () => {
  const result = await runAgentOnTestApp({
    personaId: 'power_user',
    targetPath: '/dashboard'
  });

  const brokenImage = result.observations.find(o => o.eventType === 'broken_image');
  expect(brokenImage).toBeDefined();
  expect(brokenImage.payload.src).toContain('/assets/logo.png');
});

test('edge_case persona triggers console errors with special characters', async () => {
  const result = await runAgentOnTestApp({
    personaId: 'edge_case',
    targetPath: '/form'
  });

  const consoleErrors = result.observations.filter(o => o.eventType === 'console_error');
  expect(consoleErrors.length).toBeGreaterThan(0);
});

test('agent completes run within timeout', async () => {
  const start = Date.now();
  await runAgentOnTestApp({ personaId: 'new_user', targetPath: '/' });
  expect(Date.now() - start).toBeLessThan(180000);  // 3 min timeout
});
```

---

## 4. AI Output Validation Tests

These tests validate the structure of Claude's response using Zod schemas. They do not call the live API — they use fixture responses.

```typescript
// tests/ai/reportValidation.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseAnalysisReport } from '../../src/ai/responseParser';
import mockClaudeResponse from '../fixtures/claude_response_valid.json';
import malformedResponse from '../fixtures/claude_response_malformed.json';

describe('parseAnalysisReport', () => {
  it('parses a valid Claude response', () => {
    const report = parseAnalysisReport(mockClaudeResponse);
    expect(report.bugs.length).toBeGreaterThan(0);
    expect(['P1','P2','P3','P4']).toContain(report.bugs[0].severity);
  });

  it('throws on malformed response', () => {
    expect(() => parseAnalysisReport(malformedResponse)).toThrow();
  });

  it('discards bugs with no matching observationId', () => {
    const report = parseAnalysisReport(mockClaudeResponse);
    report.bugs.forEach(bug => {
      expect(bug.observationId).toBeTruthy();
    });
  });
});
```

---

## 5. Running Tests

```bash
# All unit + integration tests
npm run test

# Agent behaviour tests (requires Docker test-app running)
npm run test:agent

# Coverage report
npm run test:coverage

# CI (runs all tests, exits non-zero on failure)
npm run test:ci
```

---

## 6. Coverage Targets

| Module | Target |
|--------|--------|
| URL Validator | 100% |
| Persona Engine | 100% |
| API Routes | 90% |
| Observer | 80% |
| AI Response Parser | 95% |
| Overall | 85% |

---

## 7. Test Data / Fixtures

All test fixtures are in `tests/fixtures/`:

- `claude_response_valid.json` — sample valid AI response
- `claude_response_malformed.json` — response missing required fields
- `session_log_sample.json` — full session log from a real test run
- `persona_configs.json` — all persona definitions for snapshot testing
