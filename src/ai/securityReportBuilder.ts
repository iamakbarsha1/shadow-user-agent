import { z } from 'zod';
import { analyzeWithClaude } from './claudeClient';
import { logger } from '../utils/logger';
import type { SecurityCheckResult } from '../agent/securityChecks';

/**
 * Structured security report produced by Claude AI analysis.
 */
export interface SecurityReport {
  summary: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: Array<{
    checkName: string;
    severity: string;
    title: string;
    description: string;
    evidence?: string;
    recommendation: string;
  }>;
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
}

const findingSchema = z.object({
  checkName: z.string(),
  severity: z.string(),
  title: z.string(),
  description: z.string(),
  evidence: z.string().optional(),
  recommendation: z.string(),
});

const securityReportSchema = z.object({
  summary: z.string(),
  totalChecks: z.number().int().nonnegative(),
  passedChecks: z.number().int().nonnegative(),
  failedChecks: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  mediumCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  findings: z.array(findingSchema),
  overallRisk: z.enum(['critical', 'high', 'medium', 'low', 'safe']),
});

/**
 * Build the system prompt for security analysis.
 */
function buildSystemPrompt(): string {
  return `You are a security expert analyzing web application security scan results.
Your job is to assess the findings, provide actionable recommendations, and determine overall risk.
Respond ONLY with a valid JSON object matching this exact schema — no prose, no markdown, no code fences:
{
  "summary": "string — brief overall security assessment",
  "totalChecks": number,
  "passedChecks": number,
  "failedChecks": number,
  "criticalCount": number,
  "highCount": number,
  "mediumCount": number,
  "lowCount": number,
  "findings": [
    {
      "checkName": "string",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "title": "string",
      "description": "string",
      "evidence": "string (optional)",
      "recommendation": "string — specific actionable fix"
    }
  ],
  "overallRisk": "critical" | "high" | "medium" | "low" | "safe"
}

Overall risk guide:
- critical: Any critical severity finding present
- high: One or more high severity findings, no critical
- medium: One or more medium findings, no critical/high
- low: Only low severity findings
- safe: All checks passed`;
}

/**
 * Build the user prompt with security scan results.
 */
function buildUserPrompt(failedResults: SecurityCheckResult[], baseUrl: string): string {
  return `Security scan results for ${baseUrl}:

Failed checks (${failedResults.length}):
${JSON.stringify(failedResults, null, 2)}

Provide a comprehensive security report with specific remediation recommendations for each finding.`;
}

/**
 * Build a structured security report from scan results using Claude AI.
 *
 * @param results - All SecurityCheckResult from the security agent run
 * @param baseUrl - The base URL that was scanned
 * @returns Validated SecurityReport
 */
export async function buildSecurityReport(
  results: SecurityCheckResult[],
  baseUrl: string
): Promise<SecurityReport> {
  const failedResults = results.filter((r) => !r.passed);

  logger.info(
    { baseUrl, total: results.length, failed: failedResults.length },
    'Building security report'
  );

  // If no failures, return a safe report without calling Claude
  if (failedResults.length === 0) {
    return {
      summary: 'No security issues detected. All checks passed.',
      totalChecks: results.length,
      passedChecks: results.length,
      failedChecks: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      findings: [],
      overallRisk: 'safe',
    };
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(failedResults, baseUrl);

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
    logger.error({ err, raw: raw.slice(0, 500) }, 'Failed to parse security report response as JSON');
    throw new Error(
      `Failed to parse security report response: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const validated = securityReportSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error(
      { errors: validated.error.errors, parsed },
      'Security report response failed schema validation'
    );
    throw new Error(
      `Security report validation failed: ${validated.error.errors.map((e) => e.message).join(', ')}`
    );
  }

  logger.info(
    {
      baseUrl,
      overallRisk: validated.data.overallRisk,
      findings: validated.data.findings.length,
    },
    'Security report complete'
  );

  return validated.data;
}
