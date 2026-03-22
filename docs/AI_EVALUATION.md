# AI Evaluation

**Project:** Shadow User Agent  
**Version:** 1.0

---

## Overview

The Shadow User Agent's value depends entirely on the quality of its AI-generated reports. An AI that produces too many false positives wastes developer time. One that misses real bugs defeats the purpose. This document defines how we measure and track AI performance.

---

## 1. Core Metrics

### 1.1 Bug Detection Accuracy (Precision)

**Definition:** Of all bugs reported by the AI, what percentage are real bugs?

```
Precision = True Positives / (True Positives + False Positives)
```

**Target:** ≥ 80%

**How to measure:**
- After every run, a developer reviews each reported bug
- Each bug is marked `confirmed` (true positive) or `false_positive`
- Precision is computed weekly from the `reports` table

**Acceptable false positive rate:** ≤ 20%  
**Unacceptable false positive rate:** > 35% (triggers prompt review)

---

### 1.2 Bug Discovery Rate (Recall)

**Definition:** Of all real bugs that exist in the app (as confirmed by manual QA), what percentage did the AI find?

```
Recall = True Positives / (True Positives + False Negatives)
```

**Target:** ≥ 60% for P1 and P2 bugs  

**How to measure:**
- After each sprint, compare AI-reported bugs against bugs found by human QA
- Bugs caught by QA but missed by the agent are recorded as false negatives
- Recall is tracked per severity level

**Note:** 100% recall is not the goal — the agent is a first pass, not a replacement for QA.

---

### 1.3 Severity Calibration

**Definition:** Are bugs assigned the right severity level?

**How to measure:**
- Developer reviews each confirmed bug and rates AI severity as `correct`, `too_high`, or `too_low`
- Track percentage of correctly calibrated severities

**Target:** ≥ 75% of severities rated `correct`  
**Threshold for prompt re-tuning:** < 60% correct

---

### 1.4 UX Friction Relevance Score

**Definition:** Subjective quality rating of UX friction observations.

**How to measure:**
- Developer or UX reviewer rates each friction point as `relevant`, `minor`, or `noise`
- Relevance score = `relevant` / total friction points

**Target:** ≥ 65% rated `relevant`

---

### 1.5 Fix Suggestion Usefulness

**Definition:** Of fix suggestions provided in bug reports, how many were actionable and accurate?

**How to measure:**
- Developers rate each fix suggestion: `useful`, `partially_useful`, or `unhelpful`

**Target:** ≥ 60% rated `useful`

---

### 1.6 Hallucination Rate

**Definition:** Percentage of AI-reported bugs that reference an event or element that does not appear in the session log.

**How to measure:**
- Every bug must have a valid `observationId`
- At report-generation time, cross-reference each bug's `observationId` against actual observations
- Any bug with an invalid or missing `observationId` is discarded and counted as a hallucination

**Target:** 0% hallucinations (enforced in code, not just measured)

---

## 2. Evaluation Workflow

### Automated (every run)

```
Agent run completes
       │
       ▼
AI generates report
       │
       ▼
Hallucination check (observationId validation) → discard invalid bugs
       │
       ▼
Report saved to DB with status: "pending_review"
```

### Manual (weekly)

1. Developer opens the weekly review queue in the dashboard
2. For each bug: mark `confirmed` or `false_positive`
3. Rate severity calibration and fix suggestion usefulness
4. System computes metrics automatically

---

## 3. Metrics Dashboard

The `/settings/ai-evaluation` page displays the following:

| Metric | Current Week | Last Week | Target |
|--------|-------------|-----------|--------|
| Precision | 84% | 79% | ≥ 80% |
| Recall (P1/P2) | 63% | 58% | ≥ 60% |
| Severity Calibration | 77% | 71% | ≥ 75% |
| UX Friction Relevance | 68% | 65% | ≥ 65% |
| Fix Suggestion Usefulness | 62% | 60% | ≥ 60% |
| Hallucination Rate | 0% | 0% | 0% |

---

## 4. Prompt Improvement Process

When any metric falls below its threshold for two consecutive weeks:

1. Export the last 50 false positive bug reports as a training set
2. Identify patterns in what the AI is getting wrong (e.g., misclassifying slow network as a P1 bug)
3. Update the system prompt in `docs/AI_SPEC.md` with corrective rules
4. Run a retrospective evaluation on the last 50 runs with the new prompt
5. Deploy if precision improves by ≥ 5 percentage points

---

## 5. Baseline Benchmarks (Sprint 1)

These baselines are set from manual evaluation of 20 test runs during the first sprint:

| Metric | Baseline |
|--------|----------|
| Precision | 72% |
| Recall (P1/P2) | 55% |
| Severity Calibration | 68% |
| UX Friction Relevance | 60% |
| Hallucination Rate | 3% (before code-level fix) |

All targets in Section 1 are set relative to a 10–15% improvement over these baselines.

---

## 6. Edge Case Evaluation Scenarios

The following specific scenarios are evaluated manually on a monthly basis:

| Scenario | Expected AI Behaviour |
|----------|----------------------|
| App returns 200 with empty body | Detected as UX friction, not bug |
| Form validation error message is correct | Not reported (working as intended) |
| Slow API response (2.5s) on mobile persona | Reported as P3 friction |
| 500 error on non-critical endpoint | P2 bug |
| Broken image on landing page | P3 bug |
| Complete auth failure (cannot log in) | P1 bug |
| UI layout overflow on mobile viewport | P2 bug |
