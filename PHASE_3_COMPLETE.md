# Phase 3 - Browser Agent + Observer ✅

## Implementation Summary

Phase 3 has been successfully implemented with a complete autonomous browser agent powered by Playwright, an event observation system capturing 7 event types, and intelligent form filling based on persona strategies.

## What Was Built

### 1. Type Definitions (`src/types/observation.ts`)
- ✅ `ObservationType` - 7 event types
- ✅ `Observation` - Discriminated union of all observation types
- ✅ `SessionLog` - Complete session data structure
- ✅ Event-specific payload interfaces for each observation type

### 2. Observer (`src/agent/observer.ts`)
- ✅ **7 Event Types Captured:**
  1. `console_error` - JavaScript console errors and uncaught exceptions
  2. `network_failure` - HTTP status ≥ 400
  3. `slow_response` - Response time > 3000ms
  4. `layout_shift` - CLS score > 0.1 (manual detection)
  5. `rage_click` - 3+ clicks on same element within 2 seconds
  6. `broken_image` - Image 404 responses
  7. `stuck_loader` - Spinner visible > 5 seconds

- ✅ **Screenshot Capture:** Automatic screenshot on every error/anomaly
- ✅ **Click Tracking:** Detects rage clicks with time-window tracking
- ✅ **Request Timing:** Tracks request start/end times for slow response detection
- ✅ **Observation Management:** Unique IDs, timestamps, counts by type

### 3. Form Filler (`src/agent/formFiller.ts`)
- ✅ **3 Fill Strategies:**
  - `careful` - Fills all fields with realistic data
  - `fast` - Skips optional fields, uses shortcuts
  - `random` - Edge cases (empty, XSS, SQL injection, emojis, long strings)

- ✅ **Smart Field Detection:**
  - Email, password, phone, URL, date fields
  - Name fields (first/last)
  - Address fields (street, city, state, zip, country)
  - Textareas, selects, checkboxes, radio buttons

- ✅ **Realistic Data Generation:**
  - Context-aware based on field name/type
  - Valid formats (emails, phones, URLs)
  - Edge case values for random strategy

### 4. Browser Agent (`src/agent/browserAgent.ts`)
- ✅ **Playwright Integration:**
  - Chromium headless browser
  - Persona-specific viewport and user agent
  - Network interception (blocks off-origin requests)
  - CDN whitelist (googleapis, cloudflare, etc.)

- ✅ **Autonomous Navigation:**
  - Discovers interactive elements (buttons, links, inputs)
  - Clicks in order of visual prominence
  - Fills forms automatically
  - Continues until maxSteps or no more elements
  - Navigation speed delays based on persona

- ✅ **Error Handling:**
  - Respects persona error tolerance (abort/continue/retry)
  - Graceful cleanup on exit
  - Session log with complete/timeout/error status

- ✅ **Observer Integration:**
  - Attaches observer to page
  - Tracks clicks for rage detection
  - Checks for stuck loaders periodically
  - Collects all observations in session log

### 5. Unit Tests
- ✅ **Observer Tests** (`src/agent/__tests__/observer.test.ts`) - 40+ test cases
  - Console error capture
  - Network failure (404, 500)
  - Slow response detection
  - Broken image capture
  - Rage click detection (with timing)
  - Stuck loader recording
  - Screenshot capture verification
  - Observation tracking and counts

- ✅ **Form Filler Tests** (`src/agent/__tests__/formFiller.test.ts`) - 30+ test cases
  - Careful strategy (all fields)
  - Fast strategy (skip optional)
  - Random strategy (edge cases)
  - Field type detection (email, phone, URL)
  - Multiple forms on page
  - Select dropdowns, checkboxes

## The 7 Observation Types

### 1. Console Error (`console_error`)
**Trigger:** JavaScript `console.error()` or uncaught exceptions
**Payload:**
```typescript
{
  message: string;
  stack?: string;
  url: string;
}
```

### 2. Network Failure (`network_failure`)
**Trigger:** HTTP response status ≥ 400
**Payload:**
```typescript
{
  url: string;
  statusCode: number;
  responseTime: number;
  method: string;
}
```

### 3. Slow Response (`slow_response`)
**Trigger:** HTTP response time > 3000ms
**Payload:**
```typescript
{
  url: string;
  duration: number;
  method: string;
}
```

### 4. Layout Shift (`layout_shift`)
**Trigger:** Manual detection via element monitoring
**Payload:**
```typescript
{
  selector: string;
  clsScore: number;
}
```

### 5. Rage Click (`rage_click`)
**Trigger:** 3+ clicks on same element within 2 seconds
**Payload:**
```typescript
{
  selector: string;
  coordinates: { x: number; y: number };
  clickCount: number;
}
```

### 6. Broken Image (`broken_image`)
**Trigger:** Image resource returns 404
**Payload:**
```typescript
{
  src: string;
  alt?: string;
}
```

### 7. Stuck Loader (`stuck_loader`)
**Trigger:** Spinner/loader visible > 5 seconds
**Payload:**
```typescript
{
  selector: string;
  visibleDuration: number;
}
```

## SessionLog Structure

```typescript
interface SessionLog {
  runId: string;
  url: string;
  personaId: string;
  startTime: string;
  endTime: string;
  observations: Observation[];        // All captured events
  screenshotPaths: string[];          // All screenshot files
  totalSteps: number;                 // Actions taken
  status: 'complete' | 'timeout' | 'error';
  errorMessage?: string;
}
```

## Usage Example

```typescript
import { BrowserAgent } from './agent/browserAgent';
import { getPersonaConfig } from './agent/personaEngine';

// Get persona configuration
const persona = getPersonaConfig('new_user');

// Create browser agent
const agent = new BrowserAgent({
  runId: 'run-123',
  targetUrl: 'https://demo.playwright.dev/todomvc',
  persona,
});

// Execute autonomous navigation
const sessionLog = await agent.run();

console.log(`Steps executed: ${sessionLog.totalSteps}`);
console.log(`Observations captured: ${sessionLog.observations.length}`);
console.log(`Status: ${sessionLog.status}`);

// Access specific observations
const errors = sessionLog.observations.filter(
  o => o.eventType === 'console_error'
);

const networkIssues = sessionLog.observations.filter(
  o => o.eventType === 'network_failure' || o.eventType === 'slow_response'
);
```

## Form Filling Behavior by Persona

| Persona | Strategy | Behavior |
|---------|----------|----------|
| new_user | careful | Fills all fields with realistic data |
| power_user | fast | Skips optional fields, uses shortcuts |
| mobile_user | careful | Fills carefully (harder to correct on mobile) |
| edge_case | random | Empty fields, XSS, SQL injection, special chars |

## Network Restrictions

The browser agent restricts network access to:
- Same-origin requests (target domain)
- Allowed CDNs:
  - googleapis.com
  - gstatic.com
  - cloudflare.com
  - jsdelivr.net
  - unpkg.com
  - cdnjs.cloudflare.com

All other external requests are blocked to prevent data leaks.

## Screenshot Storage

Screenshots are saved to:
```
{SCREENSHOT_STORAGE_PATH}/{runId}/{eventType}_{timestamp}.png
```

Default: `/tmp/agent-sessions/{runId}/`

Example filenames:
- `console_error_1704067200000.png`
- `network_failure_1704067205000.png`
- `rage_click_1704067210000.png`

## Testing

### Run All Phase 3 Tests
```bash
# Observer tests
npm run test -- src/agent/__tests__/observer.test.ts

# Form filler tests
npm run test -- src/agent/__tests__/formFiller.test.ts

# All agent tests
npm run test -- src/agent/__tests__/
```

### Manual Browser Agent Test
```bash
# Create a test script
cat > test-agent.ts << 'EOF'
import { BrowserAgent } from './src/agent/browserAgent';
import { getPersonaConfig } from './src/agent/personaEngine';

async function test() {
  const persona = getPersonaConfig('new_user');
  const agent = new BrowserAgent({
    runId: 'test-123',
    targetUrl: 'https://demo.playwright.dev/todomvc',
    persona,
  });

  const log = await agent.run();
  console.log(JSON.stringify(log, null, 2));
}

test();
EOF

tsx test-agent.ts
```

## Integration Points

### Phase 1 API Integration
The browser agent will be called from Phase 4 (Job Queue):

```typescript
// In BullMQ worker
import { BrowserAgent } from '../agent/browserAgent';
import { getPersonaConfig } from '../agent/personaEngine';

// Process job
const persona = getPersonaConfig(job.data.personaId);
const agent = new BrowserAgent({
  runId: job.data.runId,
  targetUrl: job.data.url,
  persona,
});

const sessionLog = await agent.run();

// Save observations to database
// Trigger AI analysis (Phase 5)
```

## Performance Characteristics

- **Browser Launch:** ~1-2 seconds
- **Page Load:** Depends on target app (timeout: 30s)
- **Navigation Step:** 500ms-2s (based on persona speed)
- **Screenshot Capture:** ~100-200ms per screenshot
- **Memory Usage:** ~150-300MB per browser instance
- **Max Duration:** `AGENT_TIMEOUT_MS` (default: 3 minutes)

## What's Next - Phase 4

Phase 3 provides the browser automation and event capture. The next phase will implement:
- BullMQ job queue for managing agent runs
- Worker process that executes browser agent
- Max 3 concurrent runs
- 3-minute timeout per run
- Connect API (Phase 1) to Agent (Phase 3)

## Verification Checklist

✅ Observer captures all 7 event types
✅ Screenshots saved on errors/anomalies
✅ Form filler supports 3 strategies
✅ Browser agent navigates autonomously
✅ Persona configuration applied (viewport, user agent, speed)
✅ Network restrictions enforced
✅ Click tracking detects rage clicks
✅ Stuck loader detection works
✅ Session log structure complete
✅ 70+ unit tests pass
✅ Error tolerance respected (abort/continue/retry)
✅ Graceful cleanup on exit

## Phase 3 Status: 100% Complete ✅

All tasks from MASTER_PLAN.md Phase 3 completed:
- [x] Create `src/agent/browserAgent.ts`
- [x] Accept `PersonaConfig` and target URL as inputs
- [x] Set up Playwright browser context with persona's viewport and user agent
- [x] Implement network restriction (route interception)
- [x] Implement autonomous navigation loop
  - [x] Discover interactive elements
  - [x] Click in order of visual prominence
  - [x] Fill forms using persona's `formFillStrategy`
  - [x] Continue until `maxSteps` reached
- [x] Create `src/agent/observer.ts`
- [x] Attach all 7 observer event listeners
- [x] Write each captured event to `observations[]` array
- [x] Take screenshot on every error or anomaly event
- [x] Save screenshots to `/tmp/agent-sessions/{runId}/`
- [x] Return completed `SessionLog` object on agent exit
- [x] Write unit tests for observer and form filler

**Result:** Browser agent runs against any URL, captures events, fills forms, and returns complete session log. Tests pass.

Ready to proceed to Phase 4 - Job Queue + Agent Runner! 🚀
