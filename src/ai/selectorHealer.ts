import { analyzeWithClaude } from './claudeClient';
import { logger } from '../utils/logger';
import type { FailureDiagnosis } from '../types/testExecution';

/**
 * Selector Healer
 *
 * Uses Claude to rewrite broken CSS/role selectors in a Playwright test.
 * Returns updated test code with more robust selectors.
 */

interface HealResult {
  healedCode: string;
  updatedSelectorMap: Record<string, string>;
}

function buildHealPrompts(
  testCode: string,
  selectorMap: Record<string, string>,
  diagnosis: FailureDiagnosis,
  failureOutput: string
): { system: string; user: string } {
  const system = `You are an expert Playwright test engineer specialising in selector resilience.

Given a failing Playwright test, rewrite the BROKEN selectors using these priorities (highest first):
1. data-testid / data-cy / aria-label attributes
2. role-based locators: getByRole(), getByLabel(), getByPlaceholder(), getByText()
3. Semantic CSS (.btn-primary, [type="submit"]) — never use generated class names

Rules:
- Only change broken selectors. Leave all other code unchanged.
- Return ONLY valid TypeScript — no explanations, no markdown fences.
- The output must be the complete updated test file.`;

  const user = `DIAGNOSIS:
- Failure type: ${diagnosis.failureType}
- Affected selectors: ${diagnosis.affectedSelectors.join(', ') || 'unknown'}
- Diagnosis: ${diagnosis.diagnosis}
- Suggested fix: ${diagnosis.suggestedFix}

CURRENT SELECTOR MAP:
${JSON.stringify(selectorMap, null, 2)}

FAILURE OUTPUT (excerpt):
${failureOutput.slice(0, 1500)}

FAILING TEST CODE:
${testCode}

Rewrite only the broken selectors. Output the complete fixed test code.`;

  return { system, user };
}

/**
 * Attempts to heal a failing Playwright test by rewriting broken selectors.
 * Returns healed code or null if healing fails.
 */
export async function healSelectors(
  testCode: string,
  selectorMap: Record<string, string>,
  diagnosis: FailureDiagnosis,
  failureOutput: string
): Promise<HealResult | null> {
  // Only attempt healing for selector failures
  if (diagnosis.failureType !== 'selector' && diagnosis.failureType !== 'timeout') {
    logger.info({ failureType: diagnosis.failureType }, 'Skipping healing — not a selector/timeout failure');
    return null;
  }

  if (diagnosis.affectedSelectors.length === 0 && diagnosis.failureType !== 'timeout') {
    logger.info('Skipping healing — no affected selectors identified');
    return null;
  }

  try {
    const prompts = buildHealPrompts(testCode, selectorMap, diagnosis, failureOutput);
    const raw = await analyzeWithClaude(prompts.system, prompts.user);

    // Strip markdown fences if AI added them
    const healedCode = raw
      .replace(/^```(?:typescript|ts)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    if (!healedCode || healedCode.length < 50) {
      logger.warn('Healed code too short — rejecting');
      return null;
    }

    // Extract updated selectors from the healed code using a simple heuristic
    const updatedSelectorMap = extractSelectorsFromCode(healedCode, selectorMap);

    return { healedCode, updatedSelectorMap };
  } catch (err) {
    logger.warn({ err }, 'Selector healing AI call failed');
    return null;
  }
}

/**
 * Extracts a selector map by matching known selector variable names from the code.
 * Falls through to the original map for any selectors that aren't found.
 */
function extractSelectorsFromCode(
  code: string,
  originalMap: Record<string, string>
): Record<string, string> {
  const updated: Record<string, string> = { ...originalMap };

  // Match patterns like: page.locator('...'), page.getByRole('...'), page.getByTestId('...')
  const locatorPattern = /page\.(locator|getByRole|getByLabel|getByText|getByPlaceholder|getByTestId)\((['"`])(.*?)\2/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = locatorPattern.exec(code)) !== null) {
    const selector = match[3];
    if (selector) found.push(selector);
  }

  // If the map uses indexed keys (sel_0, sel_1...), update them in order
  const mapKeys = Object.keys(updated);
  found.forEach((sel, i) => {
    if (i < mapKeys.length) {
      const key = mapKeys[i];
      if (key) updated[key] = sel;
    }
  });

  return updated;
}
