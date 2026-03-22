# Phase 4 - Job Queue + Agent Runner ✅

## Implementation Summary

Phase 4 successfully connects the API (Phase 1) to the Browser Agent (Phase 3) through a BullMQ job queue with Redis backend.

## What Was Built

### 1. Queue Configuration (`src/worker/queue.ts`)
- ✅ BullMQ queue setup with Redis connection
- ✅ `AgentJobData` interface for job payloads
- ✅ `enqueueAgentRun()` - Adds jobs to queue
- ✅ `getJobStatus()` - Checks job state
- ✅ Job timeout: 3 minutes (configurable via `AGENT_TIMEOUT_MS`)
- ✅ Job retention: 24h for completed, 7 days for failed

### 2. Database Helpers (`src/db/queries/observations.ts`)
- ✅ `saveObservations()` - Saves all observations to DB
- ✅ `getObservationsByRunId()` - Retrieves observations
- ✅ `countObservationsByType()` - Groups by event type

### 3. Job Processor (`src/worker/agentJob.ts`)
- ✅ `processAgentJob()` - Main job handler
- ✅ Updates run status: pending → running → complete/failed
- ✅ Executes browser agent with persona config
- ✅ Saves observations to database
- ✅ Progress tracking (0% → 100%)
- ✅ Error handling with proper status updates

### 4. Worker Process (`src/worker/index.ts`)
- ✅ BullMQ Worker with configurable concurrency
- ✅ Max 3 concurrent runs (via `AGENT_MAX_CONCURRENCY`)
- ✅ Event handlers: ready, active, completed, failed
- ✅ Graceful shutdown on SIGTERM/SIGINT
- ✅ Redis and database connection management

### 5. API Integration (`src/api/routes/runs.ts`)
- ✅ `POST /runs` now enqueues jobs instead of running synchronously
- ✅ Returns immediately with runId
- ✅ Client polls `GET /runs/:runId` to track status

## Architecture Flow

```
User Request
    │
    ▼
POST /api/v1/runs
    │
    ├─ Create run record (status: pending)
    ├─ Enqueue job to BullMQ
    └─ Return runId immediately

    ┌──────────────────────────────────┐
    │     BullMQ Queue (Redis)         │
    │  Max 3 concurrent jobs           │
    └──────────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────────┐
    │      Worker Process              │
    │  1. Update status → running       │
    │  2. Execute Browser Agent         │
    │  3. Save observations to DB       │
    │  4. Update status → complete      │
    └──────────────────────────────────┘
              │
              ▼
    Client polls GET /runs/:runId
    (status changes: pending → running → complete)
```

## Agent Lifecycle State Machine

```
PENDING (run created, job enqueued)
   │
   ▼
RUNNING (worker processing job)
   │
   ├─ success ──→ COMPLETE
   └─ error ────→ FAILED
```

## Usage

### Start the Worker
```bash
npm run dev:worker

# Or in production
npm run build:worker
node dist/worker/index.js
```

### API Usage
```bash
# 1. Create run (returns immediately)
curl -X POST http://localhost:4000/api/v1/runs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://example.com","personaId":"new_user"}'

# Response: {"runId":"...", "status":"pending", "startedAt":"..."}

# 2. Poll for status
curl http://localhost:4000/api/v1/runs/$RUN_ID \
  -H "Authorization: Bearer $TOKEN"

# Status progression:
# - pending (queued)
# - running (agent executing)
# - complete (observations saved)
# - failed (error occurred)
```

## Configuration

### Environment Variables
```bash
AGENT_MAX_CONCURRENCY=3     # Max parallel runs
AGENT_TIMEOUT_MS=180000     # 3 minutes
REDIS_URL=redis://localhost:6379
```

### Job Options
```typescript
{
  attempts: 1,              // No retries
  timeout: 180000,          // 3 minutes
  removeOnComplete: {
    age: 86400,            // 24 hours
    count: 100
  }
}
```

## Testing

**Prerequisites:**
- Docker with PostgreSQL and Redis running
- Database migrated

**Manual Test:**
```bash
# Terminal 1: Start API
npm run dev:api

# Terminal 2: Start Worker
npm run dev:worker

# Terminal 3: Create run
TOKEN=$(curl -X POST http://localhost:4000/auth/login \
  -d '{"email":"admin@concertIDC.internal","password":"shadow_dev_2025"}' \
  | jq -r .token)

RUN_ID=$(curl -X POST http://localhost:4000/api/v1/runs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://demo.playwright.dev/todomvc","personaId":"new_user"}' \
  | jq -r .runId)

# Watch status change
watch -n 2 "curl -s http://localhost:4000/api/v1/runs/$RUN_ID \
  -H 'Authorization: Bearer $TOKEN' | jq .status"
```

## What's Next - Phase 5

Phase 4 connects API → Queue → Agent. Next phase:
- Claude API integration
- Bug report generation from observations
- Code review generation
- AI prompt building with persona context

## Phase 4 Status: 100% Complete ✅

All tasks completed:
- [x] Create BullMQ worker
- [x] Update run status: pending → running → complete
- [x] Execute browser agent
- [x] Save observations to database
- [x] Update API to enqueue jobs
- [x] Max 3 concurrent runs
- [x] 3-minute timeout

**Ready for Phase 5 - AI Analysis Layer!** 🚀
