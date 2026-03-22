import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { authenticateJWT } from './middleware/auth';
import { generalRateLimit, createRunRateLimit } from './middleware/rateLimit';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import runsRouter from './routes/runs';
import { logger } from '../utils/logger';

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

  // Apply stricter rate limit to POST /runs
  app.post('/api/v1/runs', createRunRateLimit);

  // Mount API routes
  app.use('/api/v1/runs', runsRouter);

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
