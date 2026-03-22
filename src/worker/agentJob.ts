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
import { logger } from '../utils/logger';
import type { SessionLog } from '../types/observation';

/**
 * Agent Job Processor
 *
 * Processes agent-run jobs from the BullMQ queue.
 * Executes the browser agent and saves results to the database.
 */

export async function processAgentJob(job: Job<AgentJobData>): Promise<SessionLog | SkippedJobResult> {
  const { runId, url, personaId, options } = job.data;

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
