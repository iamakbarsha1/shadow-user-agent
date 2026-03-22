# Backend Specification

**Project:** Shadow User Agent  
**Version:** 1.0

---

## Base URL

```
Development: http://localhost:4000/api/v1
Production:  https://shadow-agent.concertIDC.internal/api/v1
```

---

## Authentication

All API endpoints require a bearer token in the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

Tokens are issued via `POST /auth/login`. For internal use, a static API key is also accepted via `X-API-Key` header (configured via `INTERNAL_API_KEY` env var).

---

## Endpoints

---

### POST /runs

Starts a new agent run.

**Request body:**

```json
{
  "url": "https://your-app.concertIDC.internal",
  "personaId": "new_user",
  "options": {
    "maxSteps": 30,
    "authCredentials": {
      "username": "testuser@example.com",
      "password": "testpass123"
    },
    "scopePathPrefix": "/dashboard"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | Target application URL |
| `personaId` | string | yes | One of: `new_user`, `power_user`, `mobile_user`, `edge_case` |
| `options.maxSteps` | number | no | Max browser actions (default: 30) |
| `options.authCredentials` | object | no | Username/password for login flows |
| `options.scopePathPrefix` | string | no | Restrict agent to URL paths starting with this prefix |

**Response `201 Created`:**

```json
{
  "runId": "a3f2c1d0-...",
  "status": "pending",
  "startedAt": "2025-09-01T10:00:00Z"
}
```

**Errors:**

| Code | Reason |
|------|--------|
| `400` | Invalid URL or unknown personaId |
| `401` | Missing or invalid auth token |
| `429` | Too many concurrent runs (max 3 per user) |

---

### GET /runs/:runId

Fetches the current status and metadata of a run.

**Response `200 OK`:**

```json
{
  "runId": "a3f2c1d0-...",
  "url": "https://your-app.concertIDC.internal",
  "personaId": "new_user",
  "status": "complete",
  "startedAt": "2025-09-01T10:00:00Z",
  "completedAt": "2025-09-01T10:03:22Z",
  "observationCount": 14,
  "reportIds": ["r1", "r2", "r3"]
}
```

**Errors:**

| Code | Reason |
|------|--------|
| `404` | Run not found |

---

### GET /runs

Lists all runs for the authenticated user.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `pending`, `running`, `complete`, `failed` |
| `limit` | number | Results per page (default: 20, max: 100) |
| `offset` | number | Pagination offset |

**Response `200 OK`:**

```json
{
  "runs": [
    {
      "runId": "a3f2c1d0-...",
      "url": "https://...",
      "personaId": "new_user",
      "status": "complete",
      "startedAt": "...",
      "completedAt": "..."
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### GET /reports/:reportId

Fetches a specific report by ID.

**Response `200 OK`:**

```json
{
  "reportId": "r1-...",
  "runId": "a3f2c1d0-...",
  "reportType": "bug_report",
  "createdAt": "2025-09-01T10:03:30Z",
  "content": {
    "bugs": [
      {
        "id": "bug-001",
        "title": "Login button unresponsive after failed attempt",
        "severity": "P1",
        "description": "After entering incorrect credentials, the login button becomes non-functional. The user is unable to retry without refreshing the page.",
        "stepsToReproduce": [
          "Navigate to /login",
          "Enter invalid credentials",
          "Click Login",
          "Observe button is now unresponsive"
        ],
        "screenshotUrl": "/screenshots/run-a3f2/obs-007.png",
        "fixSuggestion": "Re-enable the submit button after a failed login attempt. Check the form state reset logic in LoginForm.tsx."
      }
    ]
  }
}
```

---

### GET /reports/:reportId/pdf

Generates and returns a downloadable PDF version of a report.

**Response:** `application/pdf` binary stream

---

### GET /runs/:runId/session-log

Returns the full raw session log for a completed run.

**Response `200 OK`:**

```json
{
  "runId": "a3f2c1d0-...",
  "observations": [
    {
      "id": "obs-001",
      "eventType": "network_failure",
      "payload": {
        "url": "https://app/api/user-profile",
        "statusCode": 500,
        "responseTime": 1203
      },
      "capturedAt": "2025-09-01T10:01:12Z",
      "screenshotUrl": "/screenshots/run-a3f2/obs-001.png"
    }
  ]
}
```

---

### DELETE /runs/:runId

Cancels a running agent session or deletes a completed run's data.

**Response `200 OK`:**

```json
{ "deleted": true }
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is not reachable or is malformed.",
    "details": {}
  }
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_URL` | 400 | URL is malformed or unreachable |
| `UNKNOWN_PERSONA` | 400 | personaId not in allowed list |
| `UNAUTHORIZED` | 401 | Missing or expired token |
| `RUN_NOT_FOUND` | 404 | No run with given ID |
| `REPORT_NOT_FOUND` | 404 | No report with given ID |
| `RUN_LIMIT_EXCEEDED` | 429 | User has too many active runs |
| `AGENT_CRASH` | 500 | Agent process exited unexpectedly |
| `AI_TIMEOUT` | 504 | Claude API did not respond within 60s |

---

## Logging

All API requests are logged using `pino` with the following fields:

```json
{
  "timestamp": "2025-09-01T10:00:01Z",
  "level": "info",
  "method": "POST",
  "path": "/api/v1/runs",
  "runId": "a3f2c1d0-...",
  "userId": "u-001",
  "durationMs": 23,
  "statusCode": 201
}
```

Agent process events are logged separately to `/logs/agent-{runId}.log` for debugging.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /runs` | 10 per hour per user |
| `GET /reports/:id/pdf` | 20 per hour per user |
| All other endpoints | 300 per minute per user |
