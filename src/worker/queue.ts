import { Queue } from 'bullmq';
import { logger } from '../utils/logger';

/**
 * BullMQ Queue Configuration
 *
 * Manages agent run jobs with Redis-backed queue.
 * Uses plain connection options to avoid ioredis version conflicts.
 */

// Agent run job data interface
export interface AgentJobData {
  runId: string;
  url: string;
  personaId: string;
  options?: {
    maxSteps?: number;
    authCredentials?: {
      username: string;
      password: string;
    };
    scopePathPrefix?: string;
  };
}

/**
 * Parses a Redis URL into a plain connection options object
 * suitable for BullMQ (avoids ioredis version type conflicts).
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? parseInt(parsed.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: null,
  };
}

const connection = parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379');

// Create the agent-run queue
export const agentQueue = new Queue<AgentJobData>('agent-run', {
  connection,
  defaultJobOptions: {
    attempts: 1, // No retries (runs are expensive)
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 100, // Keep last 100 completed
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Adds an agent run job to the queue
 */
export async function enqueueAgentRun(data: AgentJobData): Promise<string> {
  const job = await agentQueue.add('execute-agent', data, {
    jobId: data.runId, // Use runId as job ID for idempotency
    // Timeout is enforced at Worker level via AGENT_TIMEOUT_MS env var
  });

  logger.info(
    { runId: data.runId, jobId: job.id, personaId: data.personaId },
    'Agent run job enqueued'
  );

  return job.id as string;
}

/**
 * Gets the status of a job
 */
export async function getJobStatus(
  jobId: string
): Promise<{ state: string; progress?: number; returnvalue?: unknown; failedReason?: string }> {
  const job = await agentQueue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const state = await job.getState();
  const progress = typeof job.progress === 'number' ? job.progress : undefined;
  const returnvalue = job.returnvalue as unknown;
  const failedReason = job.failedReason;

  return { state, progress, returnvalue, failedReason };
}

/**
 * Graceful shutdown - closes queue connections
 */
export async function closeQueue(): Promise<void> {
  await agentQueue.close();
  logger.info('Queue connections closed');
}
