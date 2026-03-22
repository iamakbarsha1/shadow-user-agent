import { prisma } from '../client';
import type { RunStatus } from '../../types/run';

/**
 * Database queries for runs
 */

export interface CreateRunData {
  url: string;
  personaId: string;
}

export interface ListRunsParams {
  status?: RunStatus;
  limit?: number;
  offset?: number;
}

/**
 * Creates a new run record with 'pending' status
 */
export async function createRun(data: CreateRunData) {
  return await prisma.run.create({
    data: {
      url: data.url,
      personaId: data.personaId,
      status: 'pending',
    },
  });
}

/**
 * Finds a run by ID
 */
export async function findRunById(runId: string) {
  return await prisma.run.findUnique({
    where: { id: runId },
    include: {
      observations: true,
      reports: true,
    },
  });
}

/**
 * Lists runs with optional filtering and pagination
 */
export async function listRuns(params: ListRunsParams) {
  const { status, limit = 20, offset = 0 } = params;

  const where = status ? { status } : {};

  const [runs, total] = await Promise.all([
    prisma.run.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100), // Max 100
      skip: offset,
    }),
    prisma.run.count({ where }),
  ]);

  return { runs, total };
}

/**
 * Updates run status
 * Includes defensive handling for P2025 (record not found) errors
 * which can occur if worker and API use different databases
 */
export async function updateRunStatus(runId: string, status: RunStatus, errorMessage?: string) {
  const data: { status: RunStatus; completedAt?: Date; errorMessage?: string } = {
    status,
  };

  if (status === 'complete' || status === 'failed') {
    data.completedAt = new Date();
  }

  if (errorMessage) {
    data.errorMessage = errorMessage;
  }

  try {
    return await prisma.run.update({
      where: { id: runId },
      data,
    });
  } catch (err: any) {
    // P2025 error: record not found in database
    // This indicates the worker is likely using a different database than the API
    if (err.code === 'P2025') {
      const msg = `[P2025] Run not found when updating status to '${status}'. runId: ${runId}. This likely indicates API and worker are using different DATABASE_URLs.`;
      console.error(msg);
      console.error('Database URL:', process.env.DATABASE_URL);

      // Re-throw so worker can see the error in logs
      throw new Error(msg);
    }

    throw err;
  }
}

/**
 * Deletes a run and all related data (cascades to observations, reports, screenshots)
 */
export async function deleteRun(runId: string) {
  return await prisma.run.delete({
    where: { id: runId },
  });
}

/**
 * Counts active runs (pending or running status)
 */
export async function countActiveRuns() {
  return await prisma.run.count({
    where: {
      status: {
        in: ['pending', 'running'],
      },
    },
  });
}
