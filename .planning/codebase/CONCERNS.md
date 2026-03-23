# Technical Debt & Concerns

**Analysis Date:** 2026-03-23

## 1. Critical Issues

### 1.1 Report Viewer UI Not Implemented
**Severity:** High  
**Phase:** 6 (Partial)  
**Location:** `frontend/app/reports/[runId]/page.tsx`

**Issue:**
The reports directory and route exist, but the page is not implemented. Users cannot view AI-generated bug reports, UX friction analysis, or code reviews through the UI.

**Impact:**
- Reports are generated and stored in database but not accessible to users
- Cannot download reports as PDF
- Manual database queries required to view results

**Fix Required:**
```typescript
// frontend/app/reports/[runId]/page.tsx
// Needs implementation:
// - Fetch reports from API
// - Display bug report with severity badges
// - Display UX friction points
// - Display code review findings
// - PDF download button
```

**Related:**
- `src/ai/responseParser.ts` - Report schemas exist
- `docs/FRONTEND_SPEC.md` - Report viewer spec exists

---

### 1.2 Test Failures (11 Failing Tests)
**Severity:** High  
**Status:** Known issue  
**Location:** Multiple test files

**Failing Tests:**
| Test File | Issue | Root Cause |
|-----------|-------|------------|
| `src/api/__tests__/auth.test.ts` | Test interaction | Shared state between tests |
| `src/api/__tests__/health.test.ts` | Test interaction | Shared state between tests |
| `src/agent/__tests__/observer.test.ts` | Data: URL test | Test design issue |
| `src/agent/__tests__/formFiller.test.ts` | Flaky timing | Randomness in form filler |
| `src/api/__tests__/runs.test.ts` | DELETE test fails | UUID handling issue |

**Impact:**
- CI/CD pipeline may fail
- Reduced confidence in code changes
- Cannot rely on test suite for regression detection

**Fix Required:**
1. Isolate test state with proper `beforeEach`/`afterEach`
2. Mock database transactions for isolation
3. Fix UUID generation in DELETE test
4. Seed random number generator in form filler tests

---

### 1.3 Screenshot Mapping Incomplete
**Severity:** Medium  
**Phase:** 3/4  
**Location:** `src/agent/observer.ts`, `prisma/schema.prisma`

**Issue:**
Screenshots are captured and saved to filesystem, but the database linkage between screenshots and observations is not properly implemented.

**Current State:**
```typescript
// Screenshot saved but observation not updated with screenshotId
await this.saveScreenshot(imageBuffer);
// Missing: observation.screenshotId = screenshot.id
```

**Impact:**
- Screenshots exist but cannot be traced back to specific events
- Report viewer cannot display contextual screenshots
- Debugging requires manual file system navigation

**Fix Required:**
```typescript
// In observer.ts after capturing screenshot:
const screenshot = await saveScreenshot(imageBuffer, observationId);
await prisma.observation.update({
  where: { id: observation.id },
  data: { screenshotId: screenshot.id },
});
```

---

## 2. Missing Features (Phase 6-7)

### 2.1 PDF Export
**Severity:** Medium  
**Phase:** 6  
**Location:** `frontend/app/reports/[runId]/page.tsx`

**Issue:**
No mechanism to download reports as PDF for sharing or archival.

**Required:**
- Install `react-pdf` or `@react-pdf/renderer`
- Create PDF template for bug reports
- Add download button to report viewer

---

### 2.2 SSRF Protection (Partially Complete)
**Severity:** Medium-High  
**Phase:** 7  
**Location:** `src/utils/urlValidator.ts`

**Current State:**
URL validator exists and blocks:
- ✅ Private IP ranges (10.x, 172.16-31.x, 192.168.x)
- ✅ Loopback addresses (127.0.0.1, ::1)
- ✅ Cloud metadata endpoints (169.254.169.254)
- ✅ Internal ports (22, 3306, 5432, 6379, 27017)
- ✅ `file://` protocol

**Missing:**
- ❌ DNS rebinding protection
- ❌ Redirect validation (follow redirects and re-validate)
- ❌ IPv6 literal blocking (comprehensive)
- ❌ Unicode domain normalization

**Risk:**
Attackers could potentially access internal resources via:
- DNS rebinding attacks
- Redirect chains
- IPv6-mapped IPv4 addresses

**Fix Required:**
```typescript
// Add redirect validation
page.on('request', (request) => {
  const url = request.url();
  validateTargetUrl(url); // Re-validate on redirect
});
```

---

### 2.3 Test Application Missing
**Severity:** Medium  
**Phase:** 3/7  
**Location:** N/A (requires new directory)

**Issue:**
Agent behavior tests (`npm run test:agent`) require a controlled test application with known bugs, but no such application exists.

**Impact:**
- Cannot run E2E agent tests reliably
- Manual testing required for agent behavior validation
- CI/CD cannot validate agent navigation

**Required:**
```
test-app/
├── index.html          # Simple HTML app with intentional bugs
├── bugs.js             # Console errors, network failures
├── slow-api.js         # Slow responses
└── broken-images.html  # 404 images
```

**Alternative:**
Use public test applications:
- `https://demo.playwright.dev/todomvc`
- `https://react-demo-app.glitch.me/`

---

## 3. Code Quality Concerns

### 3.1 Coverage Below Target
**Severity:** Medium  
**Target:** 85%  
**Current:** ~70%

**Gaps:**
| Module | Coverage | Gap |
|--------|----------|-----|
| Lines | 70% | -15% |
| Functions | 75% | -10% |
| Branches | 65% | -15% |
| Statements | 70% | -15% |

**Low Coverage Areas:**
- `src/agent/browserAgent.ts` - Complex navigation logic
- `src/worker/agentJob.ts` - Job orchestration
- `src/ai/promptBuilder.ts` - Prompt construction
- Error handling paths

**Action Required:**
- Add unit tests for uncovered branches
- Test error paths explicitly
- Mock external dependencies for isolated testing

---

### 3.2 Flaky Timing Tests
**Severity:** Low-Medium  
**Location:** `src/agent/__tests__/formFiller.test.ts`, `src/agent/__tests__/observer.test.ts`

**Issue:**
Tests rely on timing assumptions that may fail under load or in CI:
```typescript
// Flaky pattern
await page.waitForTimeout(1000); // Arbitrary wait
expect(observation).toBeDefined();
```

**Fix Required:**
```typescript
// Use deterministic waits
await page.waitForSelector('[data-testid="submit"]');
await expect(observation).toBeDefined();
```

---

### 3.3 Shared State in API Tests
**Severity:** Medium  
**Location:** `src/api/__tests__/*.test.ts`

**Issue:**
Tests share database state, causing intermittent failures:
```typescript
// Test A creates run
const run = await createRun();
// Test B expects empty database
const runs = await listRuns(); // May include run from Test A
```

**Fix Required:**
```typescript
// Use transactions for isolation
beforeEach(async () => {
  tx = await prisma.$transaction();
});

afterEach(async () => {
  await prisma.$rollback(tx);
});
```

---

## 4. Security Concerns

### 4.1 JWT Token Refresh Not Implemented
**Severity:** Low  
**Phase:** 7  
**Location:** `src/api/middleware/auth.ts`

**Issue:**
Tokens expire after 8 hours with no refresh mechanism. Users must re-login.

**Risk:**
- Poor user experience
- Sessions lost unexpectedly

**Fix Required:**
- Implement refresh token endpoint
- Store refresh tokens securely (httpOnly cookie)
- Add token rotation

---

### 4.2 Rate Limiting in Test Environment
**Severity:** Low  
**Location:** `src/api/middleware/rateLimit.ts`

**Issue:**
Rate limiting uses in-memory store in test environment, which may not accurately reflect production behavior.

**Risk:**
- Tests may pass but fail in production under load
- Rate limit logic not validated

**Fix Required:**
- Use Redis in test environment (via Docker Compose)
- Or mock rate limiter explicitly in tests

---

### 4.3 Error Message Leakage
**Severity:** Low  
**Location:** `src/api/middleware/errorHandler.ts`

**Issue:**
Some error responses may include stack traces or internal details in development mode.

**Example:**
```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap...",
    "details": {}
  }
}
```

**Fix Required:**
```typescript
// In errorHandler.ts
if (process.env.NODE_ENV === 'production') {
  response.message = 'An unexpected error occurred';
  delete response.stack;
}
```

---

## 5. Performance Concerns

### 5.1 Agent Timeout (3 Minutes)
**Severity:** Low  
**Configuration:** `AGENT_TIMEOUT_MS=180000`

**Issue:**
Complex applications may require more than 3 minutes for thorough testing.

**Impact:**
- Agent killed mid-session
- Incomplete reports
- False negatives

**Recommendation:**
- Make timeout configurable per run
- Add progress tracking to estimate completion
- Implement graceful degradation (partial reports)

---

### 5.2 Concurrent Run Limit (3)
**Severity:** Low  
**Configuration:** `AGENT_MAX_CONCURRENCY=3`

**Issue:**
High-traffic deployments may require more concurrent runs.

**Impact:**
- Jobs queue up during peak usage
- Increased wait times

**Recommendation:**
- Monitor queue depth in production
- Scale horizontally (multiple workers)
- Implement priority queues for urgent runs

---

### 5.3 Screenshot Storage
**Severity:** Low  
**Location:** `/tmp/agent-sessions/`

**Issue:**
Screenshots stored in `/tmp` which may be cleared on reboot.

**Impact:**
- Lost screenshots after server restart
- Broken links in reports

**Recommendation:**
- Use persistent storage (S3, GCS, Azure Blob)
- Or configure `SCREENSHOT_STORAGE_PATH` to persistent volume

---

## 6. AI-Related Concerns

### 6.1 AI Cost Unpredictability
**Severity:** Low  
**Cost:** ~$0.06-0.08 per run

**Issue:**
AI costs scale linearly with usage, no cost controls implemented.

**Risk:**
- Unexpected charges at scale
- No budget alerts

**Recommendation:**
- Implement run quota per user
- Add cost tracking dashboard
- Set up billing alerts

---

### 6.2 Hallucination Risk
**Severity:** Medium  
**Mitigation:** Hallucination guard in `src/ai/responseParser.ts`

**Current State:**
Response parser validates `observationIds` against actual observations:
```typescript
validated.bugs = validated.bugs.filter((bug) => {
  if (!validObservationIds.has(bug.observationId)) {
    logger.warn({ bugId: bug.id }, 'Discarding bug with invalid observationId');
    return false;
  }
  return true;
});
```

**Remaining Risk:**
- AI may misinterpret observations
- False positives in bug detection
- Severity misclassification

**Recommendation:**
- Add confidence scores to AI output
- Allow user feedback on report accuracy
- Fine-tune prompts based on feedback

---

### 6.3 Provider Failover
**Severity:** Low  
**Location:** `src/ai/claudeClient.ts`

**Current State:**
Provider priority: Gemini > KIE.AI > OpenRouter > Anthropic

**Issue:**
No automatic failover if primary provider fails mid-request.

**Recommendation:**
```typescript
// Implement provider failover
async function analyzeWithRetry(sessionLog) {
  const providers = getProviderOrder();
  for (const provider of providers) {
    try {
      return await callProvider(provider, sessionLog);
    } catch (err) {
      logger.warn({ provider, err }, 'Provider failed, trying next');
    }
  }
  throw new Error('All AI providers failed');
}
```

---

## 7. Deployment Concerns

### 7.1 Docker Image Size
**Severity:** Low  
**Images:**
- `Dockerfile.worker`: ~500MB (Playwright + Chromium)
- `Dockerfile.api`: ~200MB
- `Dockerfile.frontend`: ~200MB

**Recommendation:**
- Use multi-stage builds more aggressively
- Consider Alpine-based Playwright image
- Remove dev dependencies in production

---

### 7.2 Health Check Completeness
**Severity:** Low  
**Location:** `src/api/routes/health.ts`, `Dockerfile.api`

**Current State:**
```typescript
GET /health
// Returns: { status: 'ok', timestamp: '...' }
```

**Missing:**
- Database connectivity check
- Redis connectivity check
- Queue health check
- AI provider availability check

**Recommendation:**
```typescript
GET /health/ready
// Checks: DB, Redis, Queue, AI provider
// Returns: { database: 'ok', redis: 'ok', queue: 'ok', ai: 'ok' }
```

---

## 8. Documentation Gaps

### 8.1 API Documentation
**Severity:** Medium  
**Status:** Partial

**Existing:**
- `docs/BACKEND_SPEC.md` - Endpoint specifications

**Missing:**
- OpenAPI/Swagger schema
- Interactive API documentation
- Example requests/responses for all endpoints

**Recommendation:**
- Add `swagger-ui-express` or `redoc`
- Generate OpenAPI schema from Zod validators
- Host at `/api/docs`

---

### 8.2 User Guide
**Severity:** Low  
**Status:** Not started

**Required:**
- How to trigger runs
- How to interpret reports
- Persona selection guide
- Troubleshooting common issues

---

## 9. Priority Action Items

### Immediate (Before Demo)
1. ✅ Fix 11 failing tests
2. ✅ Implement Report Viewer UI
3. ✅ Add PDF export
4. ✅ Fix screenshot mapping

### Short-Term (Phase 7)
5. Complete SSRF protection (redirects, DNS rebinding)
6. Create test application for agent tests
7. Improve test coverage to 85%
8. Add health check endpoints

### Long-Term (Post-Demo)
9. Implement JWT refresh tokens
10. Add S3 storage for screenshots
11. Implement provider failover
12. Add cost tracking and quotas
13. Create user documentation
14. Add API documentation (OpenAPI)

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test failures in CI | High | Medium | Fix flaky tests, improve isolation |
| AI hallucination | Medium | High | Hallucination guard, user feedback |
| SSRF attack | Low | Critical | Complete URL validator, redirect checks |
| Cost overrun | Medium | Low | Quotas, alerts, monitoring |
| Data loss (screenshots) | Low | Medium | Persistent storage migration |
| Agent timeout | Medium | Low | Configurable timeout, progress tracking |

---

*Technical debt analysis: 2026-03-23*
