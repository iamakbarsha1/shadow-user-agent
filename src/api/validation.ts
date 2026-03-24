import { z } from 'zod';

/**
 * Zod validation schemas for API requests
 */

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createRunSchema = z
  .object({
    url: z.string().url('Invalid URL format'),
    personaId: z.enum(['new_user', 'power_user', 'mobile_user', 'edge_case', 'security_scanner'], {
      errorMap: () => ({ message: 'Invalid persona ID' }),
    }),
    runType: z.enum(['browser', 'api', 'security']).optional().default('browser'),
    apiSpec: z.string().optional(),
    generateTests: z.boolean().optional(),
    prd: z.string().optional(),
    options: z
      .object({
        maxSteps: z.number().int().min(1).max(100).optional(),
        authCredentials: z
          .object({
            username: z.string(),
            password: z.string(),
          })
          .optional(),
        scopePathPrefix: z.string().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.runType === 'api') {
        return typeof data.apiSpec === 'string' && data.apiSpec.length > 0;
      }
      return true;
    },
    { message: 'apiSpec is required when runType is "api"', path: ['apiSpec'] }
  );

export const createScheduleSchema = z.object({
  url: z.string().url('Invalid URL format'),
  personaId: z.enum(['new_user', 'power_user', 'mobile_user', 'edge_case'], {
    errorMap: () => ({ message: 'Invalid persona ID' }),
  }),
  cronExpression: z
    .string()
    .min(1)
    .refine(
      (val) => {
        const parts = val.trim().split(/\s+/);
        return parts.length >= 5 && parts.length <= 6;
      },
      { message: 'Invalid cron expression (must have 5–6 fields)' }
    ),
  label: z.string().max(100).optional(),
  generateTests: z.boolean().optional(),
});

export const updateScheduleSchema = z.object({
  url: z.string().url('Invalid URL format').optional(),
  personaId: z
    .enum(['new_user', 'power_user', 'mobile_user', 'edge_case'], {
      errorMap: () => ({ message: 'Invalid persona ID' }),
    })
    .optional(),
  cronExpression: z
    .string()
    .min(1)
    .refine(
      (val) => {
        const parts = val.trim().split(/\s+/);
        return parts.length >= 5 && parts.length <= 6;
      },
      { message: 'Invalid cron expression (must have 5–6 fields)' }
    )
    .optional(),
  label: z.string().max(100).nullable().optional(),
  enabled: z.boolean().optional(),
  generateTests: z.boolean().optional(),
});

export const listSchedulesQuerySchema = z.object({
  enabled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listRunsQuerySchema = z.object({
  status: z.enum(['pending', 'running', 'complete', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Helper to validate request body with Zod schema
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    throw new ValidationError('Request validation failed', errors);
  }

  return result.data;
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  errors: Array<{ field: string; message: string }>;

  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
