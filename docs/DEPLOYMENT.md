# Deployment

**Project:** Shadow User Agent  
**Version:** 1.0

---

## 1. Local Development Setup

### Prerequisites

- Node.js 18 LTS
- Docker + Docker Compose
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/concertIDC/shadow-user-agent.git
cd shadow-user-agent

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — see Environment Variables section below

# 3. Start infrastructure (PostgreSQL + Redis)
docker compose up -d postgres redis

# 4. Install dependencies
npm install

# 5. Install Playwright browser
npx playwright install chromium

# 6. Run database migrations
npm run db:migrate

# 7. Seed database with default personas
npm run db:seed

# 8. Start the development server
npm run dev
```

App is available at:
- Frontend: `http://localhost:3000`
- API: `http://localhost:4000`

### Default Login (Development Only)

```
Email:    admin@concertIDC.internal
Password: shadow_dev_2025
```

---

## 2. Environment Variables

```bash
# ── Application ──────────────────────────────────────────────
NODE_ENV=development                        # development | production
APP_PORT=4000                               # API server port
FRONTEND_URL=http://localhost:3000          # Used for CORS and redirects

# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql://shadow:shadow@localhost:5432/shadow_agent

# ── Redis ────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Authentication ────────────────────────────────────────────
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
INTERNAL_API_KEY=replace_with_random_64_char_string

# ── AI ───────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── File Storage ─────────────────────────────────────────────
SCREENSHOT_STORAGE_PATH=/tmp/agent-sessions   # local dev
# For production, use S3-compatible:
# S3_BUCKET=shadow-agent-screenshots
# S3_REGION=ap-south-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...

# ── Security ─────────────────────────────────────────────────
ALLOWED_INTERNAL_HOSTS=staging.concertIDC.internal,dev.concertIDC.internal

# ── Agent ────────────────────────────────────────────────────
AGENT_MAX_CONCURRENCY=3                     # max parallel agent runs
AGENT_TIMEOUT_MS=180000                     # 3 minutes
```

---

## 3. Docker Compose (Development)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shadow
      POSTGRES_PASSWORD: shadow
      POSTGRES_DB: shadow_agent
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## 4. Production Deployment

### Infrastructure

| Component | Service |
|-----------|---------|
| API Server | AWS EC2 (t3.medium) or ECS Fargate |
| Frontend | Vercel or AWS Amplify |
| Database | AWS RDS PostgreSQL 16 |
| Redis | AWS ElastiCache |
| Screenshots | AWS S3 |
| Agent Worker | EC2 or ECS (separate from API) |

### Docker Production Build

```bash
# Build production images
docker build -t shadow-agent-api -f Dockerfile.api .
docker build -t shadow-agent-worker -f Dockerfile.worker .
docker build -t shadow-agent-frontend -f Dockerfile.frontend .
```

**`Dockerfile.api`:**

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build:api

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/api/server.js"]
```

**`Dockerfile.worker`:**

```dockerfile
FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build:worker
CMD ["node", "dist/worker/index.js"]
```

---

## 5. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run test:agent

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster shadow-agent-prod \
            --service shadow-agent-api \
            --force-new-deployment
```

---

## 6. Database Migrations

```bash
# Generate a new migration after schema change
npx prisma migrate dev --name "add_run_tags"

# Apply all pending migrations (production)
npx prisma migrate deploy

# Reset and re-seed (development only — DESTRUCTIVE)
npx prisma migrate reset
```

---

## 7. Health Check

```
GET /health

Response 200:
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "anthropic": "reachable",
  "version": "1.0.0"
}
```

Load balancer should check `/health` every 30 seconds with a 5-second timeout.

---

## 8. Rollback

```bash
# Rollback the ECS service to the previous task definition
aws ecs update-service \
  --cluster shadow-agent-prod \
  --service shadow-agent-api \
  --task-definition shadow-agent-api:PREVIOUS_REVISION
```

Database rollbacks use Prisma's migration history. Identify and roll back the last migration:

```bash
npx prisma migrate resolve --rolled-back "migration_name"
```
