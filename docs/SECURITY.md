# Security

**Project:** Shadow User Agent  
**Version:** 1.0

---

## Overview

The Shadow User Agent handles sensitive items: target application credentials, internal app URLs, session logs with screenshots, and API keys. This document defines all security controls for the system.

---

## 1. Authentication

### API Authentication

- All API endpoints require a valid JWT token
- Tokens are issued on successful login via `POST /auth/login`
- Token TTL: 8 hours (aligned with working day)
- Refresh tokens are not implemented in v1.0 (re-login required)
- Tokens are signed with `RS256` using a private key stored in `JWT_PRIVATE_KEY` env var

### Internal API Key

- A static `INTERNAL_API_KEY` env var allows tool-to-tool calls (e.g., GitHub Actions trigger)
- This key must be rotated every 90 days
- Never log or expose this key in responses

---

## 2. Input Validation

### URL Validation

All submitted URLs are validated before the agent starts:

```typescript
// Allowed protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Blocked hosts (prevent SSRF)
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254',  // AWS metadata endpoint
  '::1'
];

function validateTargetUrl(url: string): void {
  const parsed = new URL(url);
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) throw new Error('INVALID_URL');
  if (BLOCKED_HOSTS.includes(parsed.hostname)) throw new Error('INVALID_URL');
  // Block private IP ranges
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(parsed.hostname)) {
    // Allow only if explicitly whitelisted in ALLOWED_INTERNAL_HOSTS env var
    const allowed = (process.env.ALLOWED_INTERNAL_HOSTS || '').split(',');
    if (!allowed.includes(parsed.hostname)) throw new Error('INVALID_URL');
  }
}
```

### Auth Credentials

- Credentials passed in `options.authCredentials` are never stored in the database
- They are passed directly to the agent process via a short-lived in-memory token
- They are never logged

### Form Fill Data

- The edge-case persona may fill forms with unexpected characters
- Special characters are drawn from a fixture list, not generated dynamically
- The agent never generates SQL injection strings, XSS payloads, or shell commands

---

## 3. Browser Sandbox

The Playwright browser runs in an isolated context with the following restrictions:

```typescript
const browserContext = await browser.newContext({
  // Disable permissions that could expose host system
  permissions: [],
  geolocation: undefined,
  // Block file:// access
  extraHTTPHeaders: {},
  // Disable service workers (prevent cache poisoning)
  serviceWorkers: 'block',
  // Restrict to target domain
  // (implemented via route interception — see agent/observer.ts)
});
```

**Network restriction via route interception:**

```typescript
// Block all requests outside the target origin
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== targetOrigin) {
    route.abort();
    return;
  }
  route.continue();
});
```

**Filesystem restriction:**

- Agent process has write access only to `/tmp/agent-sessions/{runId}/`
- Screenshots are written to this directory then moved to the file store on completion
- Directory is deleted after run completes and files are stored

---

## 4. Secrets Management

| Secret | Storage | Access |
|--------|---------|--------|
| `ANTHROPIC_API_KEY` | Environment variable | API server only |
| `JWT_PRIVATE_KEY` | Environment variable | Auth service only |
| `DATABASE_URL` | Environment variable | API server only |
| `INTERNAL_API_KEY` | Environment variable | API server only |
| `REDIS_URL` | Environment variable | API server + worker |

**Rules:**

- Secrets are never hardcoded in source code
- `.env` files are never committed to the repository
- `.env.example` contains only key names with placeholder values
- In production, secrets are injected via the CI/CD secrets manager (GitHub Actions Secrets or HashiCorp Vault)

---

## 5. Data Handling

### Session Logs

- Session logs (JSON) contain action sequences and element selectors — not sensitive user data
- Logs are stored in PostgreSQL with row-level ownership (each run is owned by the user who created it)
- Users can only access their own runs via API

### Screenshots

- Screenshots may capture content from the target application
- Screenshots are stored with access restricted to the owning user
- Screenshots are automatically deleted after 30 days (`DELETE /runs/:id` also deletes screenshots)

### Auth Credentials

- `authCredentials` passed in run config are used once by the agent and never written to disk or database
- If a run fails mid-auth, credentials are cleared from memory before the process exits

---

## 6. Rate Limiting

Rate limiting is implemented using Redis via the `express-rate-limit` + `rate-limit-redis` packages.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /runs` | 10 requests | per hour per user |
| `POST /auth/login` | 5 requests | per 15 minutes per IP |
| All others | 300 requests | per minute per user |

Failed login attempts increment the counter even on `401` responses to prevent credential stuffing.

---

## 7. Dependency Security

- `npm audit` is run on every CI build; builds fail on high-severity vulnerabilities
- Dependency updates are managed via Dependabot (weekly PR)
- Playwright browser binaries are pinned to a specific version in `package.json`

---

## 8. Known Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Agent navigates to malicious redirect URL | URL protocol and host validation on input |
| SSRF via crafted target URL | Private IP range blocklist; internal host whitelist |
| Screenshot captures sensitive production data | Access restricted to owning user; 30-day auto-deletion |
| Auth credentials leaked in logs | Credentials never written to logs or DB |
| Claude API key exposed | Stored in env var; never returned in API responses |
| Agent crashes and leaves browser process running | Process manager (PM2) with forced kill after 5 min timeout |
