import { analyzeWithClaude } from './claudeClient';
import { logger } from '../utils/logger';
import type { FailureDiagnosis } from '../types/testExecution';

/**
 * Failure Diagnoser
 *
 * Uses Claude to analyse Playwright test failure output and classify the root cause.
 * Returns structured diagnosis including failure type and selector recommendations.
 */

function buildDiagnosisPrompts(
  testCode: string,
  failureOutput: string
): { system: string; user: string } {
  const system = `You are an expert Playwright test engineer. Analyse the failing test and output a JSON diagnosis.

Your response MUST be a single JSON object (no markdown, no explanation):
{
  "failureType": "selector" | "timeout" | "assertion" | "network" | "unknown",
  "affectedSelectors": ["array of broken CSS/XPath selector strings found in the error"],
  "diagnosis": "One clear sentence explaining the root cause",
  "suggestedFix": "One actionable sentence describing how to fix it"
}

failureType rules:
- "selector": Error mentions 'locator', 'element not found', 'waiting for', 'strict mode violation'
- "timeout": Error mentions 'timeout', 'Timeout', 'exceeded'
- "assertion": Error mentions 'Expected', 'toBe', 'toHaveText', 'toBeVisible'
- "network": Error mentions 'net::', 'ERR_', 'ECONNREFUSED', '404', '500'
- "unknown": anything else`;

  const user = `TEST CODE:
\`\`\`typescript
${testCode}
\`\`\`

FAILURE OUTPUT:
\`\`\`
${failureOutput.slice(0, 3000)}
\`\`\`

Diagnose this failure.`;

  return { system, user };
}

function parseDiagnosisResponse(raw: string): FailureDiagnosis {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const validTypes = ['selector', 'timeout', 'assertion', 'network', 'unknown'] as const;
  const failureType = validTypes.includes(parsed['failureType'] as (typeof validTypes)[number])
    ? (parsed['failureType'] as FailureDiagnosis['failureType'])
    : 'unknown';

  return {
    failureType,
    affectedSelectors: Array.isArray(parsed['affectedSelectors'])
      ? (parsed['affectedSelectors'] as string[]).filter((s) => typeof s === 'string')
      : [],
    diagnosis: typeof parsed['diagnosis'] === 'string' ? parsed['diagnosis'] : 'Unknown failure',
    suggestedFix:
      typeof parsed['suggestedFix'] === 'string'
        ? parsed['suggestedFix']
        : 'Inspect the test output for details',
  };
}

/**
 * Diagnoses a Playwright test failure using AI.
 * Returns a structured FailureDiagnosis or null if diagnosis fails.
 */
export async function diagnoseFailure(
  testCode: string,
  failureOutput: string
): Promise<FailureDiagnosis | null> {
  try {
    const prompts = buildDiagnosisPrompts(testCode, failureOutput);
    const raw = await analyzeWithClaude(prompts.system, prompts.user);
    return parseDiagnosisResponse(raw);
  } catch (err) {
    logger.warn({ err }, 'Failure diagnosis AI call failed — skipping diagnosis');
    return null;
  }
}
