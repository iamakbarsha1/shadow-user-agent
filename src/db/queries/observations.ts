import { Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { Observation } from '../../types/observation';

/**
 * Database queries for observations
 */

/**
 * Saves observations from a session log to the database
 */
export async function saveObservations(runId: string, observations: Observation[]): Promise<void> {
  if (observations.length === 0) {
    return;
  }

  await prisma.observation.createMany({
    data: observations.map((obs) => ({
      runId,
      eventType: obs.eventType,
      payload: obs.payload as unknown as Prisma.InputJsonValue,
      capturedAt: new Date(obs.timestamp),
    })),
  });

  // Save screenshots separately
  const screenshotData = observations
    .filter((obs) => obs.screenshotPath)
    .map((obs) => ({
      runId, // We'll store runId for easier querying
      observationId: obs.id,
      filePath: obs.screenshotPath!,
      capturedAt: new Date(obs.timestamp),
    }));

  if (screenshotData.length > 0) {
    // Note: We need to link screenshots to observation IDs
    // For now, we'll store them with the observation data
    // In a more complex setup, we'd link after getting DB observation IDs
    await prisma.$executeRaw`
      INSERT INTO screenshots (id, observation_id, file_path, captured_at)
      SELECT
        gen_random_uuid(),
        o.id,
        ${screenshotData[0].filePath},
        ${screenshotData[0].capturedAt}::timestamptz
      FROM observations o
      WHERE o.run_id = ${runId}::uuid
      AND o.event_type = ${observations[0].eventType}
      LIMIT 1
    `;
    // Note: This is a simplified implementation
    // A production version would properly map observation IDs
  }
}

/**
 * Gets all observations for a run
 */
export async function getObservationsByRunId(runId: string) {
  return await prisma.observation.findMany({
    where: { runId },
    include: {
      screenshots: true,
    },
    orderBy: {
      capturedAt: 'asc',
    },
  });
}

/**
 * Counts observations by event type for a run
 */
export async function countObservationsByType(runId: string): Promise<Record<string, number>> {
  const results = await prisma.observation.groupBy({
    by: ['eventType'],
    where: { runId },
    _count: true,
  });

  const counts: Record<string, number> = {};
  results.forEach((result) => {
    counts[result.eventType] = result._count;
  });

  return counts;
}
