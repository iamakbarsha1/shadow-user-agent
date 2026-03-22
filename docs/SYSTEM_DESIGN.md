# System Design

**Project:** Shadow User Agent  
**Version:** 1.0

---

## 1. Architecture Overview

Shadow User Agent is a multi-layer system composed of four primary concerns:

1. **Orchestration** — receives user input, manages agent lifecycle
2. **Execution** — runs the browser agent using a selected persona
3. **Intelligence** — analyses observations using Claude AI
4. **Presentation** — serves reports and run history via the dashboard

The system is designed as a monorepo with a clear frontend/backend separation and a dedicated agent process that runs in an isolated environment.

---

## 2. High-Level Data Flow

```
User Input (URL + Persona)
        │
        ▼
┌─────────────────────┐
│   Orchestrator API   │  POST /run-agent
│   (Node.js/Express) │
└────────┬────────────┘
         │ spawns
         ▼
┌─────────────────────┐
│   Agent Process     │
│   ┌───────────────┐ │
│   │ Persona Engine│ │  → defines navigation strategy
│   └──────┬────────┘ │
│          │          │
│   ┌──────▼────────┐ │
│   │ Browser Agent │ │  → Playwright headless Chromium
│   └──────┬────────┘ │
│          │          │
│   ┌──────▼────────┐ │
│   │   Observer    │ │  → captures events, errors, screenshots
│   └──────┬────────┘ │
└──────────┼──────────┘
           │ session log (JSON)
           ▼
┌─────────────────────┐
│   AI Analysis Layer │  → Claude API (claude-sonnet-4-20250514)
└────────┬────────────┘
         │ structured report
         ▼
┌─────────────────────┐
│   Report Store      │  → PostgreSQL
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   React Dashboard   │  → report viewer, run history
└─────────────────────┘
```

---

## 3. Components

### 3.1 Orchestrator API

- **Role:** Entry point for all agent runs. Validates input, spawns agent process, polls for completion.
- **Technology:** Node.js, Express
- **Key responsibilities:**
  - Validate target URL and persona selection
  - Create a `run` record in the database with status `pending`
  - Spawn the agent as a child process or background job
  - Update run status (`running`, `complete`, `failed`)
  - Return run ID to the frontend for polling

### 3.2 Persona Engine

- **Role:** Defines the navigation behaviour, speed, and decision-making style for each user archetype.
- **Technology:** TypeScript module, loaded at agent startup
- **Output:** A persona config object consumed by the Browser Agent

```typescript
interface PersonaConfig {
  id: string;                         // "new_user" | "power_user" | "mobile_user" | "edge_case"
  navigationSpeed: 'slow' | 'normal' | 'fast';
  maxSteps: number;
  formFillStrategy: 'careful' | 'fast' | 'random';
  errorTolerance: 'abort' | 'continue' | 'retry';
  viewportWidth: number;
  viewportHeight: number;
  userAgentOverride?: string;
}
```

### 3.3 Browser Agent

- **Role:** Headless browser that navigates the target app autonomously.
- **Technology:** Playwright (Chromium)
- **Key behaviours:**
  - Loads target URL in an isolated browser context
  - Applies persona viewport and user agent
  - Discovers and clicks interactive elements in order of visual prominence
  - Fills forms using realistic data from a fixture library
  - Records every action as a timestamped event
  - Captures a screenshot on every error, layout shift, or anomaly

### 3.4 Observer

- **Role:** Passive monitoring layer attached to the browser context.
- **Technology:** Playwright event listeners
- **Captures:**

| Event Type | Trigger | Data Recorded |
|---|---|---|
| `console_error` | JS `console.error` | message, stack trace, timestamp |
| `network_failure` | Request status >= 400 | URL, status code, response time |
| `slow_response` | Response time > 3000ms | URL, duration |
| `layout_shift` | CLS score > 0.1 | affected element selector |
| `rage_click` | 3+ clicks on same element in 2s | selector, coordinates |
| `broken_image` | Image 404 | src URL |
| `stuck_loader` | Spinner visible > 5s | selector, screenshot |

### 3.5 AI Analysis Layer

- **Role:** Sends session logs to Claude API and interprets the structured response.
- **Technology:** Anthropic Node.js SDK
- **Input:** full session log JSON + base64 screenshots
- **Output:** structured `AnalysisReport` object (see `docs/AI_SPEC.md`)

### 3.6 Report Store

- **Role:** Persists all run metadata, session logs, and generated reports.
- **Technology:** PostgreSQL
- **Tables:** `runs`, `observations`, `reports`, `screenshots`

### 3.7 React Dashboard

- **Role:** UI for triggering runs, viewing reports, and managing history.
- **Technology:** React, Next.js, Zustand
- **Pages:** Dashboard, Run Agent, Report Viewer

---

## 4. Database Schema

```sql
-- Tracks every agent execution
CREATE TABLE runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  persona_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | running | complete | failed
  started_at  TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Raw events captured during a run
CREATE TABLE observations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID REFERENCES runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload    JSONB NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT now()
);

-- AI-generated reports
CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID REFERENCES runs(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,  -- 'bug_report' | 'ux_friction' | 'code_review'
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Screenshots linked to observations
CREATE TABLE screenshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID REFERENCES observations(id) ON DELETE CASCADE,
  file_path      TEXT NOT NULL,
  captured_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Agent Lifecycle State Machine

```
PENDING
  │
  │ (API call received, process spawned)
  ▼
RUNNING
  │                   │
  │ (complete)        │ (unhandled exception)
  ▼                   ▼
COMPLETE           FAILED
```

---

## 6. Security Boundary

The Browser Agent runs in a sandboxed process with:
- No access to the host filesystem outside `/tmp/agent-sessions/`
- Network access restricted to the target URL domain
- Browser context cleared after every run
- Secrets never passed into the agent process (only run ID is passed; secrets are fetched from env at API layer)

See `docs/SECURITY.md` for full details.
