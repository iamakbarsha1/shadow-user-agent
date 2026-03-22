import { Router, type Request, type Response } from 'express';
import { prisma } from '../../db/client';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

const router = Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * GET /health
 * Health check endpoint for load balancers and monitoring
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';

    // Check Redis connection
    await redis.ping();
    const redisStatus = 'connected';

    // Check AI provider configuration
    const aiProvider = process.env.KIE_AI_API_KEY
      ? 'kie'
      : process.env.OPENROUTER_API_KEY
        ? 'openrouter'
        : process.env.ANTHROPIC_API_KEY
          ? 'anthropic'
          : 'missing';

    res.status(200).json({
      status: 'ok',
      db: dbStatus,
      redis: redisStatus,
      ai_provider: aiProvider,
      version: '1.0.0',
    });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({
      status: 'degraded',
      error: 'One or more services unavailable',
    });
  }
});

export default router;
