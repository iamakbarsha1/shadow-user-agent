import type { SessionLog } from '../types/observation';

/**
 * Builds prompts for Playwright test code generation from agent session logs
 */

export function buildTestCodeGenerationPrompt(
  sessionLog: SessionLog,
  url: string,
  prd?: string
): { system: string; user: string } {
  const system = `You are a senior QA engineer. Generate executable Playwright TypeScript test cases from a recorded browser session.

Rules:
- Respond with ONLY a JSON object — no markdown, no code fences, no explanations
- Generate 3-6 focused test cases covering distinct user flows observed in the session
- Each test must be self-contained and runnable with Playwright test runner
- Use data-testid selectors when available; fall back to role/text selectors
- Include realistic assertions (expect statements) for each test step
- Record every selector used in selectorMap for future healing
- Test code must import from @playwright/test
- Response must be valid JSON starting with { and ending with }
- NO CODE FENCES, NO MARKDOWN, NO EXPLANATIONS

Required JSON schema:
{
  "testCases": [
    {
      "title": "string — descriptive test name (e.g., 'User can submit login form')",
      "description": "string — one sentence describing what this test validates",
      "testCode": "string — complete Playwright test code as a single string with \\n for newlines",
      "selectorMap": { "elementName": "selector" }
    }
  ]
}`;

  const prdSection = prd
    ? `\n\nProduct Requirements Document (use for context):\n${prd}`
    : '';

  const user = `Target URL: ${url}${prdSection}

Session Log:
${JSON.stringify(sessionLog, null, 2)}

Generate Playwright tests for the key user flows observed. Respond with JSON only.`;

  return { system, user };
}
