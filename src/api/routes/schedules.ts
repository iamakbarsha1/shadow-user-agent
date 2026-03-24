import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  validateRequest,
  createScheduleSchema,
  updateScheduleSchema,
  listSchedulesQuerySchema,
} from '../validation';
import {
  createSchedule,
  findScheduleById,
  listSchedules,
  updateSchedule,
  deleteSchedule,
} from '../../db/queries/schedules';
import { registerSchedule, unregisterSchedule } from '../../worker/scheduledRunner';
import { validateTargetUrl } from '../../utils/urlValidator';
import { ScheduleNotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import type {
  CreateScheduleRequest,
  UpdateScheduleRequest,
} from '../../types/schedule';

const router = Router();

/** Serialise a Prisma Schedule to API response shape */
function toResponse(s: {
  id: string;
  url: string;
  personaId: string;
  cronExpression: string;
  enabled: boolean;
  label: string | null;
  generateTests: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    url: s.url,
    personaId: s.personaId,
    cronExpression: s.cronExpression,
    enabled: s.enabled,
    label: s.label,
    generateTests: s.generateTests,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    nextRunAt: s.nextRunAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/**
 * POST /api/v1/schedules
 * Create a new schedule and register the repeatable BullMQ job
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateRequest(createScheduleSchema, req.body) as CreateScheduleRequest;

    validateTargetUrl(body.url);

    const schedule = await createSchedule({
      url: body.url,
      personaId: body.personaId,
      cronExpression: body.cronExpression,
      label: body.label,
      generateTests: body.generateTests ?? false,
    });

    // Register BullMQ repeatable job
    await registerSchedule(schedule);

    logger.info(
      { scheduleId: schedule.id, cron: schedule.cronExpression, userId: req.user?.userId },
      'Schedule created'
    );

    res.status(201).json(toResponse(schedule));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/schedules
 * List all schedules
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = listSchedulesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: {} } });
      return;
    }
    const query = parsed.data;

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const { schedules, total } = await listSchedules({
      enabled: query.enabled,
      limit,
      offset,
    });

    res.status(200).json({
      schedules: schedules.map(toResponse),
      total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/schedules/:id
 * Get a single schedule
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const schedule = await findScheduleById(id);

    if (!schedule) {
      throw new ScheduleNotFoundError(id);
    }

    res.status(200).json(toResponse(schedule));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/schedules/:id
 * Update a schedule — re-registers the repeatable job if cron/enabled changes
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const body = validateRequest(updateScheduleSchema, req.body) as UpdateScheduleRequest;

    const existing = await findScheduleById(id);
    if (!existing) {
      throw new ScheduleNotFoundError(id);
    }

    if (body.url) {
      validateTargetUrl(body.url);
    }

    const updated = await updateSchedule(id, {
      url: body.url,
      personaId: body.personaId,
      cronExpression: body.cronExpression,
      label: body.label ?? undefined,
      enabled: body.enabled,
      generateTests: body.generateTests,
    });

    // Re-register if cron expression changed or enabled toggled
    const cronChanged = body.cronExpression && body.cronExpression !== existing.cronExpression;
    const enabledChanged = body.enabled !== undefined && body.enabled !== existing.enabled;

    if (cronChanged || enabledChanged) {
      await unregisterSchedule(id);
      if (updated.enabled) {
        await registerSchedule(updated);
      }
    }

    logger.info({ scheduleId: id, userId: req.user?.userId }, 'Schedule updated');

    res.status(200).json(toResponse(updated));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/schedules/:id
 * Delete a schedule and remove its repeatable job
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);

    const existing = await findScheduleById(id);
    if (!existing) {
      throw new ScheduleNotFoundError(id);
    }

    // Remove the repeatable job before deleting the DB record
    await unregisterSchedule(id);
    await deleteSchedule(id);

    logger.info({ scheduleId: id, userId: req.user?.userId }, 'Schedule deleted');

    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
