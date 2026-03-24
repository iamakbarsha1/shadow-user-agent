import { Queue, type Job } from 'bullmq';
import type { Schedule } from '@prisma/client';
import { prisma } from '../db/client';
import { updateSchedule, listEnabledSchedules } from '../db/queries/schedules';
import { enqueueAgentRun } from './queue';
import { logger } from '../utils/logger';
/**
 * Scheduled Monitoring Runner
 *
 * Manages BullMQ repeatable jobs for cron-based recurring agent runs.
 * Each Schedule DB record maps to one BullMQ repeatable job keyed by `schedule:<id>`.
 */

// Repeatable job data — minimal, schedule ID drives the rest
export interface ScheduledJobData {
  scheduleId: string;
}

const SCHEDULED_QUEUE_NAME = 'scheduled-run';

let scheduledQueue: Queue<ScheduledJobData> | null = null;

/**
 * Returns (or lazily creates) the scheduled-run queue
 */
function getScheduledQueue(): Queue<ScheduledJobData> {
  if (!scheduledQueue) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(redisUrl);
    const connection = {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      db:
        parsed.pathname && parsed.pathname !== '/'
          ? parseInt(parsed.pathname.slice(1), 10)
          : 0,
      maxRetriesPerRequest: null,
    };

    scheduledQueue = new Queue<ScheduledJobData>(SCHEDULED_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { age: 24 * 60 * 60, count: 100 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
  }

  return scheduledQueue;
}

/**
 * Generates the repeatable job key used by BullMQ for a schedule
 */
function repeatableJobKey(scheduleId: string): string {
  return `schedule:${scheduleId}`;
}

/**
 * Registers a BullMQ repeatable job for the given schedule.
 * Safe to call even if already registered — BullMQ deduplicates by key.
 */
export async function registerSchedule(schedule: Schedule): Promise<void> {
  const queue = getScheduledQueue();

  // Basic cron validation: 5 or 6 space-separated fields
  const cronParts = schedule.cronExpression.trim().split(/\s+/);
  if (cronParts.length < 5 || cronParts.length > 6) {
    throw new Error(`Invalid cron expression: ${schedule.cronExpression}`);
  }

  await queue.add(
    'run-scheduled',
    { scheduleId: schedule.id },
    {
      jobId: repeatableJobKey(schedule.id),
      repeat: { pattern: schedule.cronExpression },
    }
  );

  logger.info(
    { scheduleId: schedule.id, cron: schedule.cronExpression },
    'Repeatable job registered'
  );
}

/**
 * Removes the BullMQ repeatable job for the given schedule ID.
 */
export async function unregisterSchedule(scheduleId: string): Promise<void> {
  const queue = getScheduledQueue();
  const key = repeatableJobKey(scheduleId);

  const repeatableJobs = await queue.getRepeatableJobs();
  const job = repeatableJobs.find((j) => j.key === key || j.id === key);

  if (job) {
    await queue.removeRepeatableByKey(job.key);
    logger.info({ scheduleId }, 'Repeatable job unregistered');
  }
}

/**
 * Processes a single scheduled job firing:
 * 1. Load schedule from DB
 * 2. Create a new Run record
 * 3. Enqueue agent job
 * 4. Update lastRunAt / nextRunAt on the Schedule
 */
export async function processScheduledJob(job: Job<ScheduledJobData>): Promise<void> {
  const { scheduleId } = job.data;

  logger.info({ scheduleId, jobId: job.id }, 'Processing scheduled run');

  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });

  if (!schedule) {
    logger.warn({ scheduleId }, 'Scheduled job fired but schedule not found — skipping');
    return;
  }

  if (!schedule.enabled) {
    logger.info({ scheduleId }, 'Schedule disabled — skipping execution');
    return;
  }

  // Create a new Run record for this scheduled execution
  const run = await prisma.run.create({
    data: {
      url: schedule.url,
      personaId: schedule.personaId,
      status: 'pending',
    },
  });

  logger.info({ scheduleId, runId: run.id }, 'Run created for scheduled execution');

  // Enqueue the agent job
  await enqueueAgentRun({
    runId: run.id,
    url: schedule.url,
    personaId: schedule.personaId,
    generateTests: schedule.generateTests,
  });

  // Update lastRunAt
  await updateSchedule(scheduleId, {
    lastRunAt: new Date(),
  });

  logger.info({ scheduleId, runId: run.id }, 'Scheduled run enqueued');
}

/**
 * Restores all enabled schedule repeatable jobs on worker startup.
 * Called once during worker initialisation.
 */
export async function restoreSchedules(): Promise<void> {
  const enabled = await listEnabledSchedules();

  logger.info({ count: enabled.length }, 'Restoring enabled schedules');

  for (const schedule of enabled) {
    try {
      await registerSchedule(schedule);
    } catch (err) {
      logger.error({ err, scheduleId: schedule.id }, 'Failed to restore schedule');
    }
  }
}

/**
 * Graceful shutdown — close the scheduled queue
 */
export async function closeScheduledQueue(): Promise<void> {
  if (scheduledQueue) {
    await scheduledQueue.close();
    scheduledQueue = null;
  }
}

export { SCHEDULED_QUEUE_NAME };
