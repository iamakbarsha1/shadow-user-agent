# Frontend Specification

**Project:** Shadow User Agent  
**Version:** 1.0

---

## Technology

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14 (App Router) |
| UI Library | React 18 |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Component Library | shadcn/ui |
| Charts | Recharts |
| HTTP Client | Axios |
| PDF Generation | react-pdf |

---

## Pages

---

### `/` — Dashboard

**Purpose:** Entry point. Shows run history and quick-start button.

**Components:**
- `RunHistoryTable` — paginated list of past runs with status badges
- `QuickStartCard` — URL input + persona picker for fast launch
- `SummaryStats` — total runs, bugs found this week, open issues

**State:**
- `useRunStore` → `runs[]`, `loadRuns()`, `deleteRun(id)`

**Behaviour:**
- Runs auto-refresh every 10 seconds while any run is `running`
- Clicking a completed run row navigates to `/reports/[runId]`
- Failed runs show error tooltip on hover

---

### `/run/new` — New Run

**Purpose:** Full-page form for configuring and starting an agent run.

**Components:**
- `UrlInput` — URL field with live reachability check (debounced ping)
- `PersonaSelector` — card grid with description for each persona
- `AdvancedOptions` — collapsible panel for `maxSteps`, auth credentials, scope prefix
- `RunButton` — submits form and navigates to `/run/[runId]/live`

**State:**
- `useRunFormStore` → `url`, `personaId`, `options`, `setField()`, `submit()`

**Validation:**
- URL must start with `http://` or `https://`
- URL must pass reachability check (GET ping, 2s timeout)
- `personaId` must be selected before submission

---

### `/run/[runId]/live` — Live Run Monitor

**Purpose:** Shows the agent working in real-time.

**Components:**
- `StatusBanner` — current status with animated spinner for `running`
- `LiveObservationFeed` — scrolling list of captured events (auto-updates via polling)
- `ScreenshotPreview` — latest screenshot from the agent session
- `AgentProgressBar` — estimated completion based on steps taken vs maxSteps

**State:**
- `useRunStore` → `currentRun`, `pollRun(id)`, `observations[]`

**Behaviour:**
- Polls `GET /runs/:id` every 3 seconds
- On status change to `complete`, redirects to `/reports/[runId]` after 2 seconds
- On status change to `failed`, shows error panel with raw error message

---

### `/reports/[runId]` — Report Viewer

**Purpose:** Full report for a completed run. Primary output of the system.

**Tabs:**
1. **Bug Report** — list of bugs, filterable by severity
2. **UX Friction** — narrative list of friction points with screenshots
3. **Code Review** — AI-generated code review report
4. **Session Log** — raw JSON viewer (collapsible, syntax-highlighted)

**Components:**
- `ReportHeader` — run metadata (URL, persona, duration, timestamp)
- `BugCard` — displays one bug: title, severity badge, description, steps, screenshot, fix suggestion
- `SeverityFilter` — P1/P2/P3/P4 toggle buttons
- `UXFrictionItem` — numbered friction point with description and screenshot
- `CodeReviewPanel` — formatted markdown output from AI code review
- `SessionLogViewer` — JSON tree viewer (react-json-view)
- `DownloadReportButton` — triggers PDF generation

**State:**
- `useReportStore` → `bugReport`, `uxReport`, `codeReview`, `sessionLog`, `activeSeverities[]`

---

### `/settings` — Settings

**Purpose:** Manage API keys, notification preferences, and default persona.

**Components:**
- `ApiKeyForm` — masked input to set/rotate internal API key
- `DefaultPersonaSelector` — sets default persona for quick runs
- `NotificationSettings` — toggle Slack/email notifications

---

## Component Inventory

| Component | Used On | Description |
|-----------|---------|-------------|
| `RunHistoryTable` | Dashboard | Paginated run list |
| `QuickStartCard` | Dashboard | Fast run trigger |
| `PersonaSelector` | New Run | Persona card grid |
| `UrlInput` | New Run | URL with reachability check |
| `AdvancedOptions` | New Run | Collapsible config panel |
| `StatusBanner` | Live Monitor | Animated status display |
| `LiveObservationFeed` | Live Monitor | Real-time event list |
| `BugCard` | Report Viewer | Single bug display |
| `SeverityFilter` | Report Viewer | P1-P4 filter toggles |
| `CodeReviewPanel` | Report Viewer | Markdown report display |
| `DownloadReportButton` | Report Viewer | PDF download trigger |

---

## State Management (Zustand)

### `useRunStore`

```typescript
interface RunStore {
  runs: Run[];
  currentRun: Run | null;
  observations: Observation[];
  loadRuns: () => Promise<void>;
  pollRun: (id: string) => void;
  stopPolling: () => void;
  deleteRun: (id: string) => Promise<void>;
}
```

### `useRunFormStore`

```typescript
interface RunFormStore {
  url: string;
  personaId: string;
  options: RunOptions;
  isSubmitting: boolean;
  validationErrors: Record<string, string>;
  setField: (key: string, value: unknown) => void;
  submit: () => Promise<string>;  // returns runId
  reset: () => void;
}
```

### `useReportStore`

```typescript
interface ReportStore {
  bugReport: BugReport | null;
  uxReport: UXFrictionReport | null;
  codeReview: CodeReviewReport | null;
  sessionLog: SessionLog | null;
  activeSeverities: Severity[];
  loadReports: (runId: string) => Promise<void>;
  toggleSeverity: (s: Severity) => void;
}
```

---

## Routing

| Path | Page | Auth Required |
|------|------|---------------|
| `/` | Dashboard | Yes |
| `/run/new` | New Run | Yes |
| `/run/[runId]/live` | Live Monitor | Yes |
| `/reports/[runId]` | Report Viewer | Yes |
| `/settings` | Settings | Yes |
| `/login` | Login | No |

---

## Error Handling

- API errors are caught globally by an Axios response interceptor
- Network errors show a dismissable toast: "Connection lost. Retrying..."
- 401 responses redirect to `/login`
- 500 responses show an error banner with a "Report this issue" link
