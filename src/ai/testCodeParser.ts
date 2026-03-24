import { z } from 'zod';
import { logger } from '../utils/logger';
import type { GeneratedTestCase, TestGenerationResponse } from '../types/testCase';

const GeneratedTestCaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  testCode: z.string().min(1),
  selectorMap: z.record(z.string()).default({}),
});

const TestGenerationResponseSchema = z.object({
  testCases: z.array(GeneratedTestCaseSchema).min(1),
});

/**
 * Strips markdown code fences from AI response
 */
function extractJSON(response: string): string {
  const trimmed = response.trim();
  if (trimmed.startsWith('```')) {
    const endIndex = trimmed.lastIndexOf('```');
    if (endIndex > 3) {
      let content = trimmed.slice(3, endIndex).trim();
      const firstNewline = content.indexOf('\n');
      if (firstNewline >= 0) {
        const beforeNewline = content.substring(0, firstNewline).trim();
        if (!beforeNewline.includes('{')) {
          content = content.slice(firstNewline + 1).trim();
        }
      }
      return content;
    }
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

/**
 * Validates that a test code string contains basic Playwright syntax
 */
function isValidPlaywrightCode(code: string): boolean {
  return (
    code.includes('test(') &&
    code.includes('page.') &&
    code.includes('@playwright/test')
  );
}

/**
 * Parses and validates AI-generated test code response
 */
export function parseTestGenerationResponse(response: string): TestGenerationResponse {
  try {
    const jsonString = extractJSON(response);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = JSON.parse(jsonString) as unknown;
    const validated = TestGenerationResponseSchema.parse(json);

    // Filter out test cases with invalid Playwright syntax
    const validTestCases: GeneratedTestCase[] = validated.testCases.filter((tc) => {
      if (!isValidPlaywrightCode(tc.testCode)) {
        logger.warn({ title: tc.title }, 'Discarding test case with invalid Playwright syntax');
        return false;
      }
      return true;
    });

    if (validTestCases.length === 0) {
      logger.warn({ response: response.substring(0, 200) }, 'No valid test cases after filtering');
      return { testCases: [] };
    }

    return { testCases: validTestCases };
  } catch (error) {
    logger.warn(
      { error, response: response.substring(0, 200) },
      'Failed to parse test generation response'
    );
    return { testCases: [] };
  }
}
