import { prisma } from '../client';
import type { Schedule } from '@prisma/client';

/**
 * Database query helpers for the Schedule model
 */

/**
 * Creates a new schedule record
 */
export async function createSchedule(data: {
  url: string;
  personaId: string;
  cronExpression: string;
  label?: string;
  generateTests?: boolean;
  nextRunAt?: Date;
}): Promise<Schedule> {
  return prisma.schedule.create({ data });
}

/**
 * Retrieves a schedule by ID
 */
export async function findScheduleById(id: string): Promise<Schedule | null> {
  return prisma.schedule.findUnique({ where: { id } });
}

/**
 * Lists schedules with optional filtering
 */
export async function listSchedules(opts?: {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ schedules: Schedule[]; total: number }> {
  const where = opts?.enabled !== undefined ? { enabled: opts.enabled } : {};

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
      skip: opts?.offset ?? 0,
    }),
    prisma.schedule.count({ where }),
  ]);

  return { schedules, total };
}

/**
 * Updates a schedule
 */
export async function updateSchedule(
  id: string,
  data: Partial<{
    url: string;
    personaId: string;
    cronExpression: string;
    label: string | null;
    enabled: boolean;
    generateTests: boolean;
    lastRunAt: Date;
    nextRunAt: Date | null;
  }>
): Promise<Schedule> {
  return prisma.schedule.update({ where: { id }, data });
}

/**
 * Deletes a schedule
 */
export async function deleteSchedule(id: string): Promise<void> {
  await prisma.schedule.delete({ where: { id } });
}

/**
 * Returns all enabled schedules (used on worker startup)
 */
export async function listEnabledSchedules(): Promise<Schedule[]> {
  return prisma.schedule.findMany({ where: { enabled: true } });
}
