import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { authenticateJWT } from './middleware/auth';
import { generalRateLimit, createRunRateLimit } from './middleware/rateLimit';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import runsRouter from './routes/runs';
import reportsRouter from './routes/reports';
import testCasesRouter from './routes/testCases';
import schedulesRouter from './routes/schedules';
import testGroupsRouter from './routes/testGroups';
import { logger } from '../utils/logger';
import path from 'path';

/**
 * Creates and configures the Express application
 */
export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging (only log non-GET or non-/runs requests to reduce noise)
  app.use((req, _res, next) => {
    if (req.method !== 'GET' || !req.path.startsWith('/api/v1/runs')) {
      logger.info({ method: req.method, path: req.path }, 'Incoming request');
    }
    next();
  });

  // Public routes (no auth required)
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);

  // Apply rate limiting to all API routes
  app.use('/api', generalRateLimit);

  // Protected routes (require authentication)
  app.use('/api/v1/runs', authenticateJWT);
  app.use('/api/v1/reports', authenticateJWT);
  app.use('/api/v1/test-cases', authenticateJWT);
  app.use('/api/v1/schedules', authenticateJWT);
  app.use('/api/v1/test-groups', authenticateJWT);

  // Apply stricter rate limit to POST /runs
  app.post('/api/v1/runs', createRunRateLimit);

  // Mount API routes
  app.use('/api/v1/runs', runsRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/test-cases', testCasesRouter);
  // Run-scoped test-cases (GET /api/v1/runs/:runId/test-cases)
  app.use('/api/v1', testCasesRouter);
  app.use('/api/v1/schedules', schedulesRouter);
  app.use('/api/v1/test-groups', testGroupsRouter);

  // Screenshot serving with path traversal protection
  const screenshotBase = process.env.SCREENSHOT_STORAGE_PATH || '/tmp/agent-sessions';
  app.use('/api/v1/screenshots', authenticateJWT, (req, _res, next) => {
    // Block path traversal attempts
    const resolved = path.resolve(screenshotBase, req.path.slice(1));
    if (!resolved.startsWith(path.resolve(screenshotBase))) {
      _res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied', details: {} } });
      return;
    }
    next();
  }, express.static(screenshotBase));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        details: {},
      },
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
