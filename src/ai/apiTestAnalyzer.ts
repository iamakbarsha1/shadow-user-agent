import { z } from 'zod';
import { analyzeWithClaude } from './claudeClient';
import { logger } from '../utils/logger';
import type { ApiTestResult } from '../agent/apiAgent';

/**
 * Structured report from analyzing API test results.
 */
export interface ApiAnalysisReport {
  summary: string;
  totalEndpoints: number;
  passedEndpoints: number;
  failedEndpoints: number;
  issues: Array<{
    endpoint: string;
    severity: 'P1' | 'P2' | 'P3' | 'P4';
    description: string;
    recommendation: string;
  }>;
}

const apiIssueSchema = z.object({
  endpoint: z.string(),
  severity: z.enum(['P1', 'P2', 'P3', 'P4']),
  description: z.string(),
  recommendation: z.string(),
});

const apiAnalysisReportSchema = z.object({
  summary: z.string(),
  totalEndpoints: z.number().int().nonnegative(),
  passedEndpoints: z.number().int().nonnegative(),
  failedEndpoints: z.number().int().nonnegative(),
  issues: z.array(apiIssueSchema),
});

/**
 * Build the system prompt for API test analysis.
 */
function buildSystemPrompt(): string {
  return `You are a QA engineer analyzing HTTP API test results.
Your job is to identify failures, unexpected status codes, and potential issues.
Respond ONLY with a valid JSON object matching this exact schema — no prose, no markdown, no code fences:
{
  "summary": "string — brief overall assessment",
  "totalEndpoints": number,
  "passedEndpoints": number,
  "failedEndpoints": number,
  "issues": [
    {
      "endpoint": "METHOD /path",
      "severity": "P1" | "P2" | "P3" | "P4",
      "description": "what went wrong",
      "recommendation": "how to fix it"
    }
  ]
}

Severity guide:
- P1: 5xx errors, auth failures (401/403), or complete endpoint unavailability
- P2: Unexpected 4xx on endpoints that should succeed, slow responses (>2s)
- P3: Minor deviations from expected status codes, missing response fields
- P4: Informational observations, style issues`;
}

/**
 * Build the user prompt with serialized test results.
 */
function buildUserPrompt(results: ApiTestResult[], baseUrl: string): string {
  const summary = {
    baseUrl,
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
  };

  // Limit payload size: include full results but truncate responseBody strings
  const truncated = results.map((r) => ({
    endpoint: r.endpoint,
    operationId: r.operationId,
    status: r.status,
    responseTime: r.responseTime,
    passed: r.passed,
    failureReason: r.failureReason,
    expectedStatuses: r.expectedStatuses,
    responseBody:
      typeof r.responseBody === 'string'
        ? r.responseBody.slice(0, 200)
        : r.responseBody,
  }));

  return `API Test Results for ${baseUrl}:
Summary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed.

Full results:
${JSON.stringify(truncated, null, 2)}`;
}

/**
 * Analyze API test results using Claude AI and return a structured report.
 *
 * @param results - Array of ApiTestResult from the API agent run
 * @param baseUrl - The base URL that was tested
 * @returns Validated ApiAnalysisReport
 */
export async function analyzeApiTestResults(
  results: ApiTestResult[],
  baseUrl: string
): Promise<ApiAnalysisReport> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(results, baseUrl);

  logger.info({ baseUrl, resultCount: results.length }, 'Starting API test analysis');

  const raw = await analyzeWithClaude(systemPrompt, userPrompt);

  // Strip markdown code fences if present
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, raw: raw.slice(0, 500) }, 'Failed to parse API analysis response as JSON');
    throw new Error(
      `Failed to parse API analysis response: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const validated = apiAnalysisReportSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ errors: validated.error.errors, parsed }, 'API analysis response failed schema validation');
    throw new Error(
      `API analysis response validation failed: ${validated.error.errors.map((e) => e.message).join(', ')}`
    );
  }

  logger.info(
    {
      baseUrl,
      summary: validated.data.summary.slice(0, 100),
      issues: validated.data.issues.length,
    },
    'API test analysis complete'
  );

  return validated.data;
}
