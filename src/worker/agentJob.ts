import type { Job } from 'bullmq';
import type { AgentJobData } from './queue';

interface SkippedJobResult {
  status: 'skipped';
  totalSteps: number;
  observations: never[];
  timestamp: string;
}
import { BrowserAgent } from '../agent/browserAgent';
import { getPersonaConfig } from '../agent/personaEngine';
import { updateRunStatus, findRunById } from '../db/queries/runs';
import { saveObservations } from '../db/queries/observations';
import { saveReport } from '../db/queries/reports';
import { analyzeWithClaude } from '../ai/claudeClient';
import { buildSessionAnalysisPrompt, buildCodeReviewPrompt } from '../ai/promptBuilder';
import { parseAnalysisReport, parseCodeReviewReport } from '../ai/responseParser';
import { generateTestCases } from '../ai/testCodeGenerator';
import { parseOpenApiSpec } from '../agent/specParser';
import { ApiAgent } from '../agent/apiAgent';
import { analyzeApiTestResults } from '../ai/apiTestAnalyzer';
import { logger } from '../utils/logger';
import type { SessionLog } from '../types/observation';
import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';

/**
 * Agent Job Processor
 *
 * Processes agent-run jobs from the BullMQ queue.
 * Executes the browser agent and saves results to the database.
 */

/**
 * Process an API testing job: parse spec, run API agent, save results, analyze.
 */
async function processApiJob(
  job: Job<AgentJobData>,
  run: { id: string; url: string }
): Promise<{ status: 'api_complete'; endpointCount: number }> {
  const { runId, apiSpec } = job.data;

  logger.info({ runId }, 'Starting API test job');

  // Parse the OpenAPI spec
  const endpoints = parseOpenApiSpec(apiSpec ?? '');
  logger.info({ runId, endpointCount: endpoints.length }, 'Spec parsed');

  await job.updateProgress(30);

  // Run API agent
  const agent = new ApiAgent();
  const results = await agent.run({ baseUrl: run.url, endpoints });

  await job.updateProgress(70);

  // Save each result as an observation
  for (const result of results) {
    await prisma.observation.create({
      data: {
        runId,
        eventType: 'api_test_result',
        payload: result as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await job.updateProgress(80);

  // AI analysis
  try {
    const report = await analyzeApiTestResults(results, run.url);
    await saveReport(runId, 'api_test_report', report);
    logger.info({ runId, issues: report.issues.length }, 'API analysis report saved');
  } catch (analysisError) {
    logger.error({ analysisError, runId }, 'API analysis failed (non-fatal)');
  }

  // Mark run complete
  await updateRunStatus(runId, 'complete');

  await job.updateProgress(100);

  logger.info({ runId, endpointCount: results.length }, 'API test job completed');

  return { status: 'api_complete', endpointCount: results.length };
}

/**
 * Agent Job Processor
 *
 * Processes agent-run jobs from the BullMQ queue.
 * Executes the browser agent and saves results to the database.
 */
export async function processAgentJob(job: Job<AgentJobData>): Promise<SessionLog | SkippedJobResult | { status: 'api_complete'; endpointCount: number }> {
  const { runId, url, personaId, options, generateTests, prd } = job.data;

  logger.info(
    {
      runId,
      jobId: job.id,
      url,
      personaId,
    },
    'Starting agent job processing'
  );

  try {
    // Retry logic: try to find the run with exponential backoff
    // This handles race conditions where the run hasn't been committed yet
    let existingRun = null;
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 50; // Start with 50ms

    while (!existingRun && attempts < maxAttempts) {
      existingRun = await findRunById(runId);
      if (!existingRun) {
        attempts++;
        if (attempts < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
          logger.warn({ runId, attempt: attempts, delayMs: delay }, 'Run not found, retrying...');
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (!existingRun) {
      // Run not found after retries - likely an orphaned job from Redis
      // This can happen when:
      // 1. Database is reset but Redis queue persists
      // 2. Job was queued but DB transaction never committed
      // Solution: Skip this job gracefully instead of failing
      logger.warn(
        { runId, maxAttempts },
        'Run not found after retries - skipping orphaned job. This may indicate a database reset or stale queue.'
      );

      // Gracefully complete the job without error so it doesn't retry
      // This prevents the job from getting stuck in a retry loop
      return {
        status: 'skipped' as const,
        totalSteps: 0,
        observations: [],
        timestamp: new Date().toISOString(),
      };
    }

    logger.info({ runId, foundAfterAttempts: attempts }, 'Run found in database');

    // Update run status to 'running'
    await updateRunStatus(runId, 'running');
    logger.info({ runId }, 'Run status updated to running');

    // Report progress
    await job.updateProgress(10);

    // Branch: API testing run
    if (job.data.runType === 'api') {
      return await processApiJob(job, existingRun);
    }

    // Get persona configuration
    const persona = getPersonaConfig(personaId);

    // Override maxSteps if provided in options
    if (options?.maxSteps) {
      persona.maxSteps = options.maxSteps;
    }

    await job.updateProgress(20);

    // Create and run browser agent
    logger.info({ runId, personaId }, 'Initializing browser agent');

    const agent = new BrowserAgent({
      runId,
      targetUrl: url,
      persona,
    });

    await job.updateProgress(30);

    // Execute agent run
    logger.info({ runId }, 'Executing browser agent');
    const sessionLog = await agent.run();

    await job.updateProgress(80);

    // Save observations to database
    logger.info(
      {
        runId,
        observationCount: sessionLog.observations.length,
      },
      'Saving observations to database'
    );

    await saveObservations(runId, sessionLog.observations);

    await job.updateProgress(90);

    // AI Analysis
    logger.info({ runId }, 'Starting AI analysis');

    try {
      const prompts = buildSessionAnalysisPrompt(sessionLog, persona.promptContext);
      const analysisResponse = await analyzeWithClaude(prompts.system, prompts.user);
      const analysisReport = parseAnalysisReport(analysisResponse, sessionLog);

      await saveReport(runId, 'bug_report', analysisReport);
      logger.info({ runId, bugCount: analysisReport.bugs.length }, 'Bug report saved');

      // Code review
      const reviewPrompts = buildCodeReviewPrompt(analysisReport);
      const reviewResponse = await analyzeWithClaude(reviewPrompts.system, reviewPrompts.user);
      const codeReview = parseCodeReviewReport(reviewResponse);

      await saveReport(runId, 'code_review', codeReview);
      logger.info({ runId }, 'Code review saved');

      // Test code generation (optional, triggered by generateTests flag)
      if (generateTests) {
        try {
          await generateTestCases(runId, url, sessionLog, prd);
        } catch (genError) {
          // Non-fatal: log and continue — failing to generate tests shouldn't fail the run
          logger.error({ genError, runId }, 'Test code generation failed (non-fatal)');
        }
      }
    } catch (error) {
      logger.error({ error, runId }, 'AI analysis failed');
      throw error; // propagates to outer catch → marks run as 'failed'
    }

    // Update run status to 'complete'
    await updateRunStatus(runId, 'complete');

    await job.updateProgress(100);

    logger.info(
      {
        runId,
        totalSteps: sessionLog.totalSteps,
        observationCount: sessionLog.observations.length,
        status: sessionLog.status,
      },
      'Agent job completed successfully'
    );

    return sessionLog;
  } catch (error) {
    logger.error(
      {
        error,
        runId,
        jobId: job.id,
      },
      'Agent job failed'
    );

    // Update run status to 'failed'
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await updateRunStatus(runId, 'failed', errorMessage);

    throw error;
  }
}
