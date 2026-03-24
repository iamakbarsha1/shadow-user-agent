import { analyzeWithClaude } from './claudeClient';
import { buildTestCodeGenerationPrompt } from './testCodePromptBuilder';
import { parseTestGenerationResponse } from './testCodeParser';
import { createTestCase } from '../db/queries/testCases';
import { logger } from '../utils/logger';
import type { SessionLog } from '../types/observation';
import type { GeneratedTestCase } from '../types/testCase';

/**
 * Orchestrates Playwright test code generation from an agent session.
 * Calls AI, parses response, saves test cases to the database.
 */
export async function generateTestCases(
  runId: string,
  url: string,
  sessionLog: SessionLog,
  prd?: string
): Promise<GeneratedTestCase[]> {
  logger.info({ runId, url }, 'Starting test code generation');

  const prompts = buildTestCodeGenerationPrompt(sessionLog, url, prd);
  const response = await analyzeWithClaude(prompts.system, prompts.user);
  const { testCases } = parseTestGenerationResponse(response);

  if (testCases.length === 0) {
    logger.warn({ runId }, 'No test cases generated');
    return [];
  }

  // Persist each test case to the database
  await Promise.all(
    testCases.map((tc) =>
      createTestCase({
        runId,
        title: tc.title,
        description: tc.description,
        testCode: tc.testCode,
        selectorMap: tc.selectorMap,
      })
    )
  );

  logger.info({ runId, count: testCases.length }, 'Test cases generated and saved');
  return testCases;
}
