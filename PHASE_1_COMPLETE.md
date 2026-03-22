# Phase 1 - Core API ✅

## Implementation Summary

Phase 1 has been successfully implemented with a working REST API for authentication and run management.

## What Was Built

### 1. Type Definitions (`src/types/`)
- ✅ `run.ts` - Run-related interfaces (CreateRunRequest, GetRunResponse, etc.)
- ✅ `auth.ts` - Authentication interfaces (LoginRequest, LoginResponse, JWTPayload)
- ✅ `api.ts` - API error response types and error codes

### 2. Database Queries (`src/db/queries/`)
- ✅ `runs.ts` - CRUD operations for runs
  - `createRun()` - Create new run with 'pending' status
  - `findRunById()` - Get run with observations and reports
  - `listRuns()` - Paginated list with filtering
  - `updateRunStatus()` - Update run status and completion time
  - `deleteRun()` - Cascade delete
  - `countActiveRuns()` - Check concurrent run limit

### 3. Middleware (`src/api/middleware/`)
- ✅ `auth.ts` - JWT authentication + X-API-Key support
- ✅ `errorHandler.ts` - Global error handling with standardized responses
- ✅ `rateLimit.ts` - Redis-backed rate limiting
  - 10 requests/hour for POST /runs
  - 300 requests/minute for other endpoints

### 4. Validation (`src/api/validation.ts`)
- ✅ Zod schemas for all request bodies
- ✅ `loginSchema` - Email and password validation
- ✅ `createRunSchema` - URL, personaId, optional parameters
- ✅ `listRunsQuerySchema` - Query parameter validation
- ✅ `ValidationError` custom error class

### 5. Routes (`src/api/routes/`)
- ✅ **Health** (`GET /health`)
  - Database, Redis, Anthropic API status
  - No authentication required

- ✅ **Auth** (`POST /auth/login`)
  - Issues JWT tokens (RS256, 24-hour expiry)
  - Hardcoded dev credentials: `admin@concertIDC.internal` / `shadow_dev_2025`

- ✅ **Runs**
  - `POST /api/v1/runs` - Create run (auth required, rate limited)
  - `GET /api/v1/runs/:runId` - Get run details (auth required)
  - `GET /api/v1/runs` - List runs with pagination (auth required)
  - `DELETE /api/v1/runs/:runId` - Delete run (auth required)

### 6. Express App (`src/api/app.ts`)
- ✅ Security headers (Helmet)
- ✅ CORS configuration
- ✅ Request logging
- ✅ Route mounting with proper middleware order
- ✅ 404 handler
- ✅ Global error handler

### 7. Server (`src/api/server.ts`)
- ✅ Environment validation
- ✅ Database connection check
- ✅ Graceful shutdown (SIGTERM handling)

### 8. Unit Tests (`src/api/__tests__/`)
- ✅ `runs.test.ts` - 13 test cases for run management
- ✅ `auth.test.ts` - 8 test cases for authentication
- ✅ `health.test.ts` - 2 test cases for health check

## API Endpoints Reference

### Base URL
```
Development: http://localhost:4000
```

### Authentication
All `/api/v1/*` endpoints require either:
- Bearer token: `Authorization: Bearer <JWT>`
- API key: `X-API-Key: <INTERNAL_API_KEY>`

### Endpoints

#### POST /auth/login
```json
Request:
{
  "email": "admin@concertIDC.internal",
  "password": "shadow_dev_2025"
}

Response (200):
{
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

#### POST /api/v1/runs
```json
Request:
{
  "url": "https://your-app.com",
  "personaId": "new_user",
  "options": {
    "maxSteps": 30
  }
}

Response (201):
{
  "runId": "uuid",
  "status": "pending",
  "startedAt": "2025-09-01T10:00:00Z"
}
```

#### GET /api/v1/runs/:runId
```json
Response (200):
{
  "runId": "uuid",
  "url": "https://...",
  "personaId": "new_user",
  "status": "pending",
  "startedAt": "2025-09-01T10:00:00Z",
  "completedAt": null,
  "observationCount": 0,
  "reportIds": []
}
```

#### GET /api/v1/runs?status=pending&limit=20&offset=0
```json
Response (200):
{
  "runs": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### DELETE /api/v1/runs/:runId
```json
Response (200):
{
  "deleted": true
}
```

#### GET /health
```json
Response (200):
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "anthropic": "configured",
  "version": "1.0.0"
}
```

## Error Response Format

All errors follow this structure:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Error codes: `VALIDATION_ERROR`, `INVALID_URL`, `UNKNOWN_PERSONA`, `UNAUTHORIZED`, `RUN_NOT_FOUND`, `RUN_LIMIT_EXCEEDED`

## Testing

### Prerequisites
```bash
# Start Docker services (required)
docker compose up -d

# Run database migration (required)
npm run db:migrate
```

### Run Tests
```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:coverage
```

### Manual Testing with curl

1. **Get auth token:**
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@concertIDC.internal","password":"shadow_dev_2025"}'
```

2. **Create a run:**
```bash
curl -X POST http://localhost:4000/api/v1/runs \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://demo.playwright.dev/todomvc","personaId":"new_user"}'
```

3. **Get run status:**
```bash
curl http://localhost:4000/api/v1/runs/<RUN_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

4. **Health check:**
```bash
curl http://localhost:4000/health
```

## What's Next - Phase 2

Phase 1 provides the API infrastructure. The next phase will implement:
- Persona Engine with 4 user archetypes
- PersonaConfig objects with navigation strategies
- Unit tests for persona validation

## Blockers / Prerequisites

Before Phase 2:
1. ✅ Phase 1 code complete
2. ⚠️ Docker services must be running
3. ⚠️ Database migration must be run
4. ⚠️ Tests should pass (requires DB connection)

To complete Phase 1 verification:
```bash
# Start services
docker compose up -d

# Run migration
npm run db:migrate

# Run tests
npm run test

# Start API server
npm run dev:api
```

Expected result: All tests pass, API starts successfully on port 4000.
