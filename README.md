# Shadow User Agent

> An AI-powered QA system that simulates real user behaviour, detects UX friction, and generates intelligent bug reports — before QA even starts.

---

## What It Does

Shadow User Agent autonomously navigates your web application using AI-driven personas (new user, power user, edge-case user), observes everything that goes wrong, and produces structured, plain-English bug and UX friction reports powered by Claude AI.

---

## Key Features

- **Persona Engine** — simulates distinct user archetypes with unique navigation patterns
- **Browser Agent** — Playwright-powered headless browser that interacts like a real human
- **Observer** — captures console errors, layout breaks, rage clicks, slow responses, and broken states
- **AI Analysis** — Claude interprets observations and generates severity-ranked bug reports with fix suggestions
- **AI Code Review** — auto-generated code review report attached to every run
- **Dashboard** — React-based UI to trigger runs, view reports, and track issues over time

---

## Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Claude API key (Anthropic)

### Installation

```bash
git clone https://github.com/concertIDC/shadow-user-agent.git
cd shadow-user-agent
cp .env.example .env        # fill in your API keys
npm install
npx playwright install chromium
npm run db:migrate
npm run dev
```

App runs at `http://localhost:3000`

---

## Running Your First Scan

1. Open the dashboard at `http://localhost:3000`
2. Click **New Run**
3. Enter your target app URL
4. Select a persona (start with **New User**)
5. Click **Start Agent**
6. Watch the live session, then view the generated report

---

## Demo Steps (Competition Presentation)

1. Show dashboard → paste internal app URL → select persona
2. Watch Playwright navigate the app live (screen recording)
3. Open generated bug report — severity, steps to reproduce, screenshot
4. Open AI code review report — attached automatically

---

## Documentation Index

| File | Purpose |
|------|---------|
| `docs/PRD.md` | Product requirements and user stories |
| `docs/SYSTEM_DESIGN.md` | Architecture and data flow |
| `docs/TECH_STACK.md` | Technology choices with justification |
| `docs/BACKEND_SPEC.md` | API endpoints and schemas |
| `docs/FRONTEND_SPEC.md` | UI pages and components |
| `docs/AI_SPEC.md` | Persona definitions and prompt design |
| `docs/SECURITY.md` | Security practices |
| `docs/DEPLOYMENT.md` | Local and production setup |
| `docs/TESTING.md` | Testing strategy |
| `docs/AI_EVALUATION.md` | AI performance metrics |
| `docs/MASTER_PLAN.md` | Phased implementation roadmap |
| `docs/CODE_GUIDELINES.md` | Coding standards and folder structure |

---

## License

MIT — ConcertIDC Internal Project
