# Product Requirements Document (PRD)

**Project:** Shadow User Agent  
**Version:** 1.0  
**Status:** Active  
**Owner:** ConcertIDC AI Idea-thon Submission

---

## 1. Problem Statement

QA testing in most software teams is:

- **Late** — testing happens after development, when fixing is expensive
- **Human-biased** — testers think like developers, not end users
- **Narrow** — manual testing misses edge cases, slow responses, and subtle UX friction
- **Repetitive** — re-running flows after every change is time-consuming

There is no existing internal tool at ConcertIDC that simulates the way a real, non-technical user navigates a web application and automatically surfaces issues in plain English.

---

## 2. Proposed Solution

An AI agent that:

1. Accepts a target web application URL
2. Autonomously navigates the app using a configurable user persona
3. Observes all interactions, errors, and anomalies via a browser observer layer
4. Sends all observations to Claude AI for analysis
5. Outputs a structured bug report + UX friction report in plain English

The agent is not a test script. It does not follow a pre-written test plan. It *discovers* issues the way a real user would.

---

## 3. Goals

| Goal | Metric |
|------|--------|
| Reduce bugs reaching QA | 30% fewer QA-reported bugs after 4 sprints |
| Reduce QA cycle time | First-pass QA time reduced by 40% |
| Improve UX quality | UX friction issues logged per sprint increases in early phases, then drops |
| Enable non-QA devs to run checks | Any developer can run a scan in under 2 minutes |

---

## 4. Features

### 4.1 Persona Engine

- Defines 4 user archetypes: New User, Power User, Mobile User, Edge-Case User
- Each persona has a unique navigation strategy, speed, and error tolerance
- Personas are configurable via JSON

### 4.2 Browser Agent

- Playwright headless Chromium browser
- Simulates real interactions: clicks, scrolls, form fills, keyboard navigation
- Handles auth flows, modals, and dynamic content
- Configurable session timeout and max steps

### 4.3 Observer

- Captures: JS console errors, network failures (4xx/5xx), layout shifts, long response times, broken images, stuck loaders, rage-click patterns
- Screenshots at every significant event
- Full session replay log (JSON)

### 4.4 AI Analysis Layer

- Powered by Claude API (claude-sonnet-4-20250514)
- Receives: session logs + screenshots + persona context
- Outputs: severity-ranked bug list, UX friction points, fix suggestions
- Outputs: AI-generated code review report (auto-attached)

### 4.5 Reporting Dashboard

- Run history with timestamps, persona used, URL scanned
- Bug report viewer with severity filters
- UX friction heatmap (click path visualisation)
- Downloadable PDF reports

### 4.6 Integrations (Phase 2)

- Jira ticket auto-creation from bug reports
- Slack notification on run completion
- GitHub Actions trigger (run agent on every PR)

---

## 5. User Stories

### Developer

```
As a developer,
I want to run the Shadow User Agent against my feature branch URL,
So that I can detect UX issues and bugs before submitting a PR.
```

```
As a developer,
I want to receive a plain-English bug report with severity and fix suggestions,
So that I can fix issues without needing a QA engineer to explain them.
```

### QA Engineer

```
As a QA engineer,
I want the agent to run automatically on every deployment,
So that I can focus my manual testing on complex scenarios the agent cannot cover.
```

### Project Manager

```
As a project manager,
I want to see a weekly report of issues found by the agent,
So that I can track quality trends over time without reading code.
```

### Non-Technical Stakeholder

```
As a stakeholder,
I want bug reports written in plain English with screenshots,
So that I can understand the severity of issues without technical knowledge.
```

---

## 6. Acceptance Criteria

### Agent Execution

- [ ] Agent accepts a valid URL and begins a session within 5 seconds
- [ ] Agent completes a full navigation flow within 3 minutes for a standard app
- [ ] Agent handles auth-required pages with configurable credentials
- [ ] Agent does not crash on 404 pages, empty states, or broken APIs

### Observation

- [ ] Observer captures all console errors during the session
- [ ] Observer records response times for every network call
- [ ] Observer takes a screenshot at every error or anomaly event
- [ ] Session log is saved as structured JSON on completion

### AI Reporting

- [ ] Bug report is generated within 30 seconds of session completion
- [ ] Each bug includes: title, description, steps to reproduce, severity (P1–P4), screenshot
- [ ] UX friction report includes at least 3 observations per run on a non-trivial app
- [ ] AI code review report is generated and attached to every run

### Dashboard

- [ ] Run history is visible and filterable
- [ ] Reports are downloadable as PDF
- [ ] Dashboard is mobile-responsive

---

## 7. Out of Scope (v1.0)

- Native mobile app testing (iOS/Android)
- Authenticated multi-user flows
- Load/performance testing
- Accessibility compliance checking (planned for v2.0)

---

## 8. Assumptions

- Target applications are web-based and publicly accessible or accessible within the internal network
- Claude API credentials are available and rate limits are sufficient for batch sessions
- Playwright can run in the deployment environment (Linux container)
