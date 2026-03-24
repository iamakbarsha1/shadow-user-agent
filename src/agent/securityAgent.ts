import { randomUUID } from 'crypto';
import {
  checkSecurityHeaders,
  checkCookieFlags,
  checkXssReflection,
  checkCsrfHeaders,
  checkOpenRedirect,
  checkMixedContent,
  checkClickjacking,
  type SecurityCheckResult,
} from './securityChecks';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import type { Prisma } from '@prisma/client';

export type { SecurityCheckResult };

/**
 * Options for running the security agent.
 */
export interface SecurityAgentOptions {
  baseUrl: string;
  runId: string;
}

/**
 * Security Agent
 *
 * Orchestrates all 7 HTTP-based security checks in parallel,
 * saves each result as a security_finding observation, and returns all results.
 */
export class SecurityAgent {
  /**
   * Run all security checks against the target URL.
   * Results are saved as observations in the database.
   *
   * @param options - baseUrl and runId for this security scan
   * @returns Array of all SecurityCheckResult (passed + failed)
   */
  async run(options: SecurityAgentOptions): Promise<SecurityCheckResult[]> {
    const { baseUrl, runId } = options;

    logger.info({ runId, baseUrl }, 'SecurityAgent: starting all checks');

    // Run all 7 checks in parallel
    const settled = await Promise.allSettled([
      checkSecurityHeaders(baseUrl),
      checkCookieFlags(baseUrl),
      checkXssReflection(baseUrl),
      checkCsrfHeaders(baseUrl),
      checkOpenRedirect(baseUrl),
      checkMixedContent(baseUrl),
      checkClickjacking(baseUrl),
    ]);

    // Flatten results from all checks
    const allResults: SecurityCheckResult[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        // If a check promise itself rejected (shouldn't happen since checks catch internally)
        const errorMessage =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        allResults.push({
          checkName: 'unknown',
          severity: 'info',
          title: 'Check failed unexpectedly',
          description: 'A security check threw an unhandled error.',
          evidence: errorMessage,
          passed: false,
        });
      }
    }

    // Save each result as a security_finding observation
    for (const checkResult of allResults) {
      logger.info(
        {
          runId,
          checkName: checkResult.checkName,
          passed: checkResult.passed,
          severity: checkResult.severity,
        },
        'SecurityAgent: check result'
      );

      await prisma.observation.create({
        data: {
          id: randomUUID(),
          runId,
          eventType: 'security_finding',
          payload: {
            checkName: checkResult.checkName,
            severity: checkResult.severity,
            title: checkResult.title,
            description: checkResult.description,
            evidence: checkResult.evidence,
            url: baseUrl,
            passed: checkResult.passed,
          } as Prisma.InputJsonValue,
        },
      });
    }

    logger.info(
      {
        runId,
        total: allResults.length,
        passed: allResults.filter((r) => r.passed).length,
        failed: allResults.filter((r) => !r.passed).length,
      },
      'SecurityAgent: all checks complete'
    );

    return allResults;
  }
}
