import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { validateEnv } from '../utils/envValidator';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';
import { processAgentJob } from './agentJob';
import { cleanupOldScreenshots } from './screenshotCleanup';
import type { AgentJobData } from './queue';

/**
 * BullMQ worker entry point.
 * Processes agent run jobs from the queue.
 */

let worker: Worker | null = null;

async function startWorker(): Promise<void> {
  try {
    // Validate environment variables
    validateEnv();
    logger.info('Environment variables validated');

    // Log database URL for debugging (mask password)
    const dbUrl = process.env.DATABASE_URL || '';
    const maskedDbUrl = dbUrl.replace(/:\w+@/, ':***@');
    logger.info({ DATABASE_URL: maskedDbUrl }, 'Worker using DATABASE_URL');

    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Redis connection URL for ioredis (event logging / graceful shutdown)
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

    connection.on('error', (err) => logger.error({ err }, 'Redis connection error'));
    connection.on('connect', () => logger.info('Redis connected'));

    // BullMQ needs plain connection options to avoid ioredis version type conflicts
    const parsedUrl = new URL(redisUrl);
    const bullConnection = {
      host: parsedUrl.hostname || 'localhost',
      port: parseInt(parsedUrl.port || '6379', 10),
      password: parsedUrl.password || undefined,
      db:
        parsedUrl.pathname && parsedUrl.pathname !== '/'
          ? parseInt(parsedUrl.pathname.slice(1), 10)
          : 0,
      maxRetriesPerRequest: null as null,
    };

    // Get max concurrency from env (default: 3)
    const maxConcurrency = parseInt(process.env.AGENT_MAX_CONCURRENCY || '3', 10);

    // Clean up orphaned jobs before starting worker
    // This handles the case where Redis persists jobs but DB was reset
    logger.info('Checking for orphaned jobs in queue...');
    const queueName = 'agent-run';
    const tempQueue = new Queue(queueName, {
      connection: bullConnection,
    });

    try {
      // Get all jobs from different states
      const allJobs = await Promise.all([
        tempQueue.getJobs(['waiting']),
        tempQueue.getJobs(['active']),
        tempQueue.getJobs(['delayed']),
        tempQueue.getJobs(['paused']),
        tempQueue.getJobs(['prioritized']),
      ]);

      const jobsToCheck = allJobs.flat();
      let orphanedCount = 0;

      // Check each job to see if the corresponding run exists in DB
      for (const job of jobsToCheck) {
        const runId = (job.data as AgentJobData).runId;
        const run = await prisma.run.findUnique({
          where: { id: runId },
          select: { id: true },
        });

        if (!run) {
          // Orphaned job - remove it
          await job.remove();
          orphanedCount++;
          logger.info({ jobId: job.id, runId }, 'Removed orphaned job from queue');
        }
      }

      if (orphanedCount > 0) {
        logger.warn({ orphanedCount }, 'Cleaned up orphaned jobs from Redis queue');
      } else {
        logger.info('No orphaned jobs found');
      }

      await tempQueue.close();
    } catch (err) {
      logger.warn({ err }, 'Error during orphaned job cleanup - continuing anyway');
      await tempQueue.close();
    }

    // Create BullMQ worker
    worker = new Worker<AgentJobData>('agent-run', processAgentJob, {
      connection: bullConnection,
      concurrency: maxConcurrency,
      limiter: {
        max: maxConcurrency,
        duration: 1000, // Max N jobs per second
      },
    });

    // Worker event handlers
    worker.on('ready', () => {
      logger.info({ concurrency: maxConcurrency }, 'Worker ready - listening for jobs');
    });

    worker.on('active', (job) => {
      logger.info(
        {
          jobId: job.id,
          runId: job.data.runId,
          personaId: job.data.personaId,
        },
        'Job started'
      );
    });

    worker.on('completed', (job, _result) => {
      logger.info(
        {
          jobId: job.id,
          runId: job.data.runId,
          duration: Date.now() - job.timestamp,
        },
        'Job completed'
      );
    });

    worker.on('failed', (job, error) => {
      logger.error(
        {
          jobId: job?.id,
          runId: job?.data.runId,
          error: error.message,
        },
        'Job failed'
      );
    });

    worker.on('error', (error) => {
      logger.error({ error }, 'Worker error');
    });

    // Screenshot cleanup — runs once at startup then every 24 hours
    const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
    const runCleanup = () => {
      cleanupOldScreenshots().catch((err) => {
        logger.error({ err }, 'Screenshot cleanup error');
      });
    };
    runCleanup();
    const cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received');

      clearInterval(cleanupTimer);

      if (worker) {
        logger.info('Closing worker...');
        await worker.close();
      }

      await prisma.$disconnect();
      await connection.quit();

      logger.info('Worker shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.info(
      {
        concurrency: maxConcurrency,
        timeout: process.env.AGENT_TIMEOUT_MS,
      },
      'Worker started successfully'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start worker');
    await prisma.$disconnect();
    process.exit(1);
  }
}

startWorker().catch((error) => {
  logger.error({ error }, 'Unhandled error in worker startup');
  process.exit(1);
});
