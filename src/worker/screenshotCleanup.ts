import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';

const RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes screenshots and run data older than RETENTION_DAYS days.
 *
 * Runs as a scheduled BullMQ job. Steps:
 * 1. Find all runs completed more than 30 days ago
 * 2. Delete the screenshot directories from disk
 * 3. Delete the run records from DB (cascades to observations, reports, screenshots)
 */
export async function cleanupOldScreenshots(): Promise<{ deletedRuns: number; errors: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * MS_PER_DAY);
  const storagePath = process.env.SCREENSHOT_STORAGE_PATH || '/tmp/agent-sessions';

  let deletedRuns = 0;
  let errors = 0;

  try {
    // Find old completed/failed runs
    const oldRuns = await prisma.run.findMany({
      where: {
        status: { in: ['complete', 'failed'] },
        startedAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (oldRuns.length === 0) {
      // Only log if explicitly in verbose mode (to reduce noise)
      return { deletedRuns: 0, errors: 0 };
    }

    logger.info({ count: oldRuns.length }, 'Found old runs to clean up');

    for (const run of oldRuns) {
      try {
        // Delete screenshot directory from disk
        const runDir = path.join(storagePath, run.id);
        await fs.rm(runDir, { recursive: true, force: true });

        // Delete DB record (cascades to observations, reports, screenshots)
        await prisma.run.delete({ where: { id: run.id } });

        deletedRuns++;
        logger.debug({ runId: run.id }, 'Deleted old run and screenshots');
      } catch (err) {
        errors++;
        logger.error({ err, runId: run.id }, 'Failed to delete run during cleanup');
      }
    }

    logger.info({ deletedRuns, errors }, 'Screenshot cleanup completed');
    return { deletedRuns, errors };
  } catch (err) {
    logger.error({ err }, 'Screenshot cleanup job failed');
    throw err;
  }
}
