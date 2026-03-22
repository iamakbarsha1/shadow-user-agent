# AI Specification

**Project:** Shadow User Agent  
**Version:** 1.0

---

## Overview

The AI layer is the intelligence core of the Shadow User Agent. It has two responsibilities:

1. **Session Analysis** — receives raw browser observations and generates structured bug and UX friction reports
2. **Code Review** — receives relevant source snippets and generates a code review report

Both use Claude API (`claude-sonnet-4-20250514`) with structured JSON output.

---

## 1. Persona Definitions

Personas are injected into the AI's system prompt and also drive Playwright's navigation strategy. Each persona represents a realistic user archetype.

---

### New User (`new_user`)

```json
{
  "id": "new_user",
  "label": "New User",
  "description": "First-time visitor with no product knowledge. Explores slowly, reads labels, gets confused by jargon, gives up if blocked.",
  "navigationSpeed": "slow",
  "maxSteps": 25,
  "formFillStrategy": "careful",
  "errorTolerance": "abort",
  "viewportWidth": 1280,
  "viewportHeight": 800,
  "promptContext": "You are a first-time user visiting this app. You have no prior knowledge of its features. You read every label carefully before clicking. If anything is confusing or broken, you stop and note it. You do not know to try workarounds."
}
```

---

### Power User (`power_user`)

```json
{
  "id": "power_user",
  "label": "Power User",
  "description": "Experienced user who navigates fast, uses keyboard shortcuts, skips instructions, and expects everything to work instantly.",
  "navigationSpeed": "fast",
  "maxSteps": 50,
  "formFillStrategy": "fast",
  "errorTolerance": "continue",
  "viewportWidth": 1920,
  "viewportHeight": 1080,
  "promptContext": "You are a power user who knows web apps well. You navigate fast, click through flows confidently, and notice immediately when things are slower than expected, have visual glitches, or behave inconsistently. You note performance and responsiveness issues."
}
```

---

### Mobile User (`mobile_user`)

```json
{
  "id": "mobile_user",
  "label": "Mobile User",
  "description": "User on a small screen with touch interactions. Sensitive to layout breaks, oversized elements, and horizontal scroll.",
  "navigationSpeed": "normal",
  "maxSteps": 30,
  "formFillStrategy": "careful",
  "errorTolerance": "continue",
  "viewportWidth": 390,
  "viewportHeight": 844,
  "userAgentOverride": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  "promptContext": "You are a user on an iPhone 14 with a 390px viewport. You are sensitive to elements that overflow the screen, text that is too small to tap, buttons that are too close together, and pages that require horizontal scrolling."
}
```

---

### Edge-Case User (`edge_case`)

```json
{
  "id": "edge_case",
  "label": "Edge-Case User",
  "description": "Intentionally tries to break the app. Submits empty forms, uses special characters, navigates back mid-flow, opens multiple tabs.",
  "navigationSpeed": "normal",
  "maxSteps": 40,
  "formFillStrategy": "random",
  "errorTolerance": "retry",
  "viewportWidth": 1280,
  "viewportHeight": 800,
  "promptContext": "You are a user who accidentally stresses the application. You submit forms with empty fields, paste special characters into text inputs, press the browser back button mid-transaction, and refresh at unexpected moments. Note every error, blank screen, or unexpected behaviour that results."
}
```

---

## 2. Session Analysis Prompt

### System Prompt

```
You are an expert QA analyst and UX reviewer. You have been given a structured log of browser events captured while an AI agent navigated a web application.

Your job is to:
1. Identify real bugs and technical errors — things that are broken
2. Identify UX friction points — things that work but are confusing, slow, or frustrating

The user persona for this session was: {{PERSONA_PROMPT_CONTEXT}}

Rules:
- Only report issues that are clearly evidenced in the session log
- Do not invent issues not supported by the data
- Write in plain English — avoid jargon — your reports are read by developers AND non-technical stakeholders
- Assign severity accurately:
  - P1: Blocks the user entirely (cannot proceed)
  - P2: Causes significant confusion or data loss risk
  - P3: Minor bug, cosmetic issue, or minor friction
  - P4: Suggestion or enhancement

Return ONLY a valid JSON object matching the schema below. No preamble, no markdown, no explanation outside the JSON.
```

### User Prompt

```
Session log:
{{SESSION_LOG_JSON}}

Screenshots are attached as images. Each screenshot is labelled with its observation ID.

Generate the analysis report.
```

### Output Schema

```typescript
interface AnalysisReport {
  sessionSummary: string;           // 2-3 sentence plain English overview
  bugs: Bug[];
  uxFrictionPoints: UXFriction[];
}

interface Bug {
  id: string;                       // "bug-001", "bug-002" etc.
  title: string;                    // Short, specific title
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  description: string;              // Plain English explanation
  stepsToReproduce: string[];       // Numbered steps
  observationId: string;            // Links to the raw observation that triggered this
  screenshotRef?: string;           // observation ID whose screenshot is relevant
  fixSuggestion: string;            // Actionable, developer-facing suggestion
}

interface UXFriction {
  id: string;
  title: string;
  description: string;
  impactedPersona: string;
  observationId: string;
  screenshotRef?: string;
}
```

---

## 3. Code Review Prompt

This prompt is triggered separately after the session completes. It receives the session log summary and, optionally, relevant source code snippets.

### System Prompt

```
You are a senior software engineer conducting a code review. You have been given a QA session log showing bugs and issues discovered in a web application.

Your job is to:
1. Review the reported issues through a code quality lens
2. Identify likely root causes at the code level
3. Suggest code-level improvements

Write your review as a professional code review document. Use clear sections. Be specific. Be constructive.

Return ONLY a valid JSON object matching the schema below.
```

### User Prompt

```
Session analysis report:
{{ANALYSIS_REPORT_JSON}}

Source code snippets (if provided):
{{SOURCE_CODE}}

Generate the code review report.
```

### Output Schema

```typescript
interface CodeReviewReport {
  overallAssessment: string;        // 1 paragraph
  criticalIssues: CodeIssue[];      // Must-fix items
  improvements: CodeIssue[];        // Should-fix items
  positives: string[];              // What is working well
  recommendations: string[];        // General advice
}

interface CodeIssue {
  title: string;
  description: string;
  linkedBugId?: string;
  codeLocation?: string;            // File path or component name if known
  suggestedFix: string;
}
```

---

## 4. AI Behaviour Rules

These rules are enforced in code, not just in prompts:

- **Temperature:** set to `0` for all analysis calls — deterministic, not creative
- **Max tokens:** `4096` for session analysis, `2048` for code review
- **Timeout:** 60 seconds; if exceeded, return a partial report and flag `AI_TIMEOUT`
- **Retry:** 2 retries with exponential backoff on `529` (overloaded) responses
- **JSON validation:** parse and validate against the TypeScript interfaces using `zod`; if validation fails, retry once with a corrective prompt
- **No hallucination guard:** if Claude returns a bug with no matching `observationId`, discard it

---

## 5. Cost Estimate

| Run Type | Approx Input Tokens | Approx Output Tokens | Approx Cost (Sonnet) |
|----------|---------------------|---------------------|----------------------|
| Short session (15 steps, no screenshots) | ~3,000 | ~800 | ~$0.02 |
| Full session (30 steps + 5 screenshots) | ~8,000 | ~1,500 | ~$0.06 |
| Code review add-on | ~2,000 | ~1,000 | ~$0.02 |

All costs are approximate based on Anthropic's published token pricing. A daily batch of 20 full runs costs approximately $1.60.
