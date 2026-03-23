# System Architecture

**Analysis Date:** 2026-03-23

## 1. High-Level Architecture

Shadow User Agent follows a **layered architecture** with clear separation of concerns across four primary layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│              Next.js Dashboard (Port 3000)                   │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────────────┐
│                   Orchestration Layer                        │
│            Express API Server (Port 4000)                    │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │ Auth MW    │  │ Rate Limit │  │ Route Handlers      │   │
│  └────────────┘  └────────────┘  └─────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ BullMQ Jobs
┌────────────────────▼────────────────────────────────────────┐
│                   Processing Layer                           │
│              BullMQ Worker (Background)                      │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │ Job Queue  │  │ Processor  │  │ Cleanup Tasks       │   │
│  └────────────┘  └────────────┘  └─────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ Playwright Sessions
┌────────────────────▼────────────────────────────────────────┐
│                   Execution Layer                            │
│             Browser Agent (Headless Chromium)                │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │ Persona    │  │ Observer   │  │ Form Filler         │   │
│  └────────────┘  └────────────┘  └─────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ Session Logs
┌────────────────────▼────────────────────────────────────────┐
│                   Intelligence Layer                         │
│              AI Analysis (Claude/Gemini/KIE)                 │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │ Prompt     │  │ AI Client  │  │ Response Parser     │   │
│  └────────────┘  └────────────┘  └─────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ Reports
┌────────────────────▼────────────────────────────────────────┐
│                   Storage Layer                              │
│    PostgreSQL (Data) + Redis (Queue) + Filesystem (Media)   │
└─────────────────────────────────────────────────────────────┘
```

## 2. Component Architecture

### 2.1 Presentation Layer (Frontend)

**Technology:** Next.js 14 + React 18 + Zustand + TailwindCSS

**Responsibilities:**
- User input collection (URL, persona selection)
- Live monitoring of agent runs via polling
- Report visualization and navigation
- Run history dashboard

**Key Pages:**
| Route | Purpose |
|-------|---------|
| `/` | Dashboard - run history list |
| `/run/new` | Create new agent run |
| `/run/[runId]/live` | Live monitoring during execution |
| `/reports/[runId]` | Report viewer (pending implementation) |

**State Management:**
- Zustand stores for run state, observations, and reports
- Polling-based updates for live monitoring
- API client with centralized error handling

### 2.2 Orchestration Layer (API)

**Technology:** Express 4 + JWT + express-rate-limit + Helmet

**Responsibilities:**
- RESTful API endpoints
- Authentication and authorization
- Rate limiting per client
- Input validation with Zod
- Agent lifecycle management

**Middleware Stack:**
```
Request → CORS → Helmet → Rate Limit → Auth → Route Handler → Error Handler
```

**Key Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/runs` | Create agent run |
| GET | `/api/v1/runs` | List all runs |
| GET | `/api/v1/runs/:id` | Get run details |
| DELETE | `/api/v1/runs/:id` | Delete a run |
| GET | `/api/v1/runs/:id/observations` | Get observations |
| GET | `/api/v1/runs/:id/reports` | Get AI reports |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/register` | User registration |
| GET | `/health` | Health check |

### 2.3 Processing Layer (Worker)

**Technology:** BullMQ + ioredis

**Responsibilities:**
- Async job processing (max 3 concurrent)
- Job queue management
- Orphaned job cleanup
- Screenshot retention cleanup (30-day)

**Queue Configuration:**
- Queue name: `agent-run`
- Max concurrency: `AGENT_MAX_CONCURRENCY` (default: 3)
- Job timeout: `AGENT_TIMEOUT_MS` (default: 180000ms)
- Rate limit: 100 runs/hour per user

**Job Lifecycle:**
```
1. API creates run record → 2. Job enqueued → 3. Worker picks up job
→ 4. Browser agent executes → 5. AI analyzes → 6. Reports saved → 7. Job completed
```

### 2.4 Execution Layer (Browser Agent)

**Technology:** Playwright + Chromium

**Responsibilities:**
- Headless browser navigation
- Persona-driven interaction
- Event observation and capture
- Screenshot capture
- Form filling

**Agent Lifecycle:**
```
Initialize → Navigate → Observe → Interact → Repeat (until maxSteps) → Cleanup
```

**Sub-components:**
- **Persona Engine:** Defines navigation behavior per user archetype
- **Observer:** Captures 7 event types (console errors, network failures, etc.)
- **FormFiller:** Intelligent form interaction strategies

### 2.5 Intelligence Layer (AI)

**Technology:** Anthropic SDK + Native fetch (Gemini/OpenRouter/KIE)

**Responsibilities:**
- AI provider abstraction
- Prompt construction
- Response parsing and validation
- Retry logic with exponential backoff

**Provider Priority:**
1. Gemini (if `GEMINI_API_KEY` set)
2. KIE.AI (if `KIE_AI_API_KEY` set)
3. OpenRouter (if `OPENROUTER_API_KEY` set)
4. Anthropic (fallback, requires `ANTHROPIC_API_KEY`)

**AI Models:**
| Provider | Model | Default |
|----------|-------|---------|
| Anthropic | claude-sonnet-4-20250514 | claude-sonnet-4-20250514 |
| Gemini | gemini-2.5-flash | gemini-2.5-flash |
| OpenRouter | Any | anthropic/claude-sonnet-4-20250514 |
| KIE.AI | claude-sonnet-4-6 | claude-sonnet-4-6 |

**Reports Generated:**
- Bug Report (severity P1-P4, steps to reproduce, fix suggestions)
- UX Friction Report (usability issues, friction points)
- Code Review (critical issues, improvements, recommendations)

### 2.6 Storage Layer

**PostgreSQL (Primary Data):**
- `runs` - Agent execution records
- `observations` - Raw events with JSONB payload
- `reports` - AI-generated reports (JSONB content)
- `screenshots` - Screenshot metadata

**Redis (Queue + Cache):**
- BullMQ job queue
- Rate limiting store
- Ephemeral state

**Filesystem (Screenshots):**
- Path: `/tmp/agent-sessions/{runId}/`
- Retention: 30 days (auto-cleanup)
- Served via Express static route

## 3. Data Flow

### 3.1 Agent Run Flow

```
1. User submits URL + persona
       ↓
2. API validates input, creates run (status: pending)
       ↓
3. BullMQ job enqueued
       ↓
4. Worker picks up job, updates run (status: running)
       ↓
5. BrowserAgent initializes Playwright
       ↓
6. Persona-driven navigation begins
       ↓
7. Observer captures events + screenshots
       ↓
8. Session log returned to worker
       ↓
9. AI analysis triggered (3 reports)
       ↓
10. Reports saved to database
       ↓
11. Run status updated (complete/failed)
       ↓
12. Frontend polls and displays results
```

### 3.2 Observation Capture Flow

```
Browser Event (e.g., console.error)
       ↓
Observer listens via Playwright page.on()
       ↓
Screenshot captured (if applicable)
       ↓
Observation saved to DB
       ↓
Linked to runId
```

### 3.3 AI Analysis Flow

```
Session Log (JSON)
       ↓
Prompt Builder constructs system + user prompt
       ↓
AI Provider called (with retry logic)
       ↓
Response parsed with Zod schema
       ↓
Reports saved to DB
```

## 4. Security Architecture

### 4.1 Authentication
- **Algorithm:** RS256 (asymmetric JWT)
- **Token TTL:** 8 hours
- **Storage:** Client-side (localStorage/cookies)
- **Development bypass:** Hardcoded dev user when `NODE_ENV=development`

### 4.2 SSRF Protection
URL validator blocks:
- Private IPs (10.x, 172.16-31.x, 192.168.x)
- Loopback (127.0.0.1, ::1)
- Cloud metadata (169.254.169.254)
- Internal ports (22, 3306, 5432, 6379, 27017)
- `file://` protocol

Whitelist via `ALLOWED_INTERNAL_HOSTS` env var.

### 4.3 Browser Sandboxing
- Network restricted to target domain via route interception
- No host filesystem access outside `/tmp/agent-sessions/`
- Service workers blocked
- Permissions disabled (geolocation, notifications, etc.)

### 4.4 Rate Limiting
| Endpoint | Limit |
|----------|-------|
| POST /api/v1/runs | 100/hour |
| Other /api routes | 300/minute |

## 5. Deployment Architecture

### 5.1 Development
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API       │     │  Frontend   │     │   Worker    │
│  (Port 4000)│     │  (Port 3000)│     │ (Background)│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
              ┌────────────▼────────────┐
              │  Docker Compose         │
              │  - PostgreSQL (5432)    │
              │  - Redis (6379)         │
              └─────────────────────────┘
```

### 5.2 Production
```
┌───────────────────────────────────────────────────────┐
│                   Load Balancer                        │
└───────────┬───────────────────┬───────────────────────┘
            │                   │
┌───────────▼──────┐   ┌────────▼────────┐
│  API Container   │   │ Frontend        │
│  (Node 18-alpine)│   │ (Node 18-alpine)│
└────────┬─────────┘   └─────────────────┘
         │
┌────────▼─────────┐
│  Worker Container│
│  (Playwright)    │
└────────┬─────────┘
         │
┌────────▼─────────────────────────┐
│  External Services               │
│  - PostgreSQL (managed)          │
│  - Redis (managed)               │
│  - AI Provider (API)             │
└──────────────────────────────────┘
```

## 6. Design Patterns

### 6.1 Strategy Pattern
Persona Engine uses strategy pattern to define navigation behavior:
```typescript
interface PersonaConfig {
  id: PersonaId;
  navigationSpeed: 'slow' | 'normal' | 'fast';
  formFillStrategy: 'careful' | 'fast' | 'random';
  errorTolerance: 'abort' | 'continue' | 'retry';
}
```

### 6.2 Observer Pattern
Browser events captured via Playwright event listeners:
```typescript
page.on('console', (msg) => this.captureConsole(msg));
page.on('response', (res) => this.captureNetwork(res));
page.on('pageerror', (err) => this.captureError(err));
```

### 6.3 Repository Pattern
Database queries abstracted via Prisma query helpers in `src/db/queries/`.

### 6.4 Factory Pattern
AI client uses factory pattern to select provider:
```typescript
function getProvider(): Provider {
  if (GEMINI_API_KEY) return 'gemini';
  if (KIE_AI_API_KEY) return 'kie';
  if (OPENROUTER_API_KEY) return 'openrouter';
  return 'anthropic';
}
```

### 6.5 Circuit Breaker Pattern
AI calls have retry logic with exponential backoff:
- Max retries: 2
- Timeout: 60 seconds
- Backoff: Exponential

## 7. Error Handling Strategy

### 7.1 Custom Error Classes
All errors extend typed error classes:
```typescript
class InvalidUrlError extends Error { code = 'INVALID_URL' }
class RunNotFoundError extends Error { code = 'RUN_NOT_FOUND' }
class AITimeoutError extends Error { code = 'AI_TIMEOUT' }
class InsufficientCreditsError extends Error { code = 'INSUFFICIENT_CREDITS' }
```

### 7.2 API Error Response Format
```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is not reachable or is malformed.",
    "details": {}
  }
}
```

### 7.3 Error Propagation
```
Browser Agent → Worker → API → Frontend
    ↓             ↓        ↓        ↓
  Capture     Update    Transform  Display
  in Obs      Status   to Error    to User
```

---

*Architecture analysis: 2026-03-23*
