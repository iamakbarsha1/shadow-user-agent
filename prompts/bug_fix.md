You are in PLAN MODE.

Task: Fix OpenRouter API 402 error due to max_tokens exceeding available credits.

Follow CLAUDE.md strictly:

- One task only
- Root cause → fix → validate
- Minimal, elegant change (no hacks)
- Do NOT rewrite entire files
- Output concise, no repetition

---

## Problem

Error:
OpenRouter API error 402:
"You requested up to 4096 tokens, but can only afford 1491"

Impact:

- AI analysis fails
- Run is still marked COMPLETE (incorrect state handling)

---

## Goals

1. Prevent token over-allocation dynamically
2. Ensure graceful fallback when credits are insufficient
3. Fix incorrect run status (should not be COMPLETE on failure)

---

## Plan (Checklist)

- [ ] Inspect `claudeClient.ts` → where `max_tokens` is set
- [ ] Implement dynamic token cap:
      max_tokens = min(configured_limit, available_budget or safe_default)
- [ ] Add fallback strategy:
      if 402 → retry with reduced tokens (e.g., 50%)
- [ ] Add guard:
      if still failing → return structured failure (no throw crash)
- [ ] Fix worker logic in `agentJob.ts`: - If AI fails → mark run as FAILED (not COMPLETE)
- [ ] Ensure error uses typed custom error (per project rules)
- [ ] Add logging via pino (no console.log)
- [ ] Validate with: - simulated low-token scenario - logs confirm retry + fallback - run status correctly set

---

## Constraints

- DO NOT increase API credits (code fix only)
- DO NOT hardcode magic numbers without reasoning
- DO NOT break existing retry logic (529 handling)
- Follow existing architecture patterns

---

## Output Format

1. Root cause (1–2 lines)
2. Minimal code diff only (no full files)
3. Validation proof (logs / expected behavior)

---

If context exceeds ~70%, STOP and provide continuation prompt.
