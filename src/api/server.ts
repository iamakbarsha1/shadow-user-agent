import 'dotenv/config';
import { validateEnv } from '../utils/envValidator';
import { logger } from '../utils/logger';
import { createApp } from './app';
import { prisma } from '../db/client';

/**
 * API server entry point.
 * Validates environment, sets up Express app, and starts the server.
 */

async function startServer(): Promise<void> {
  try {
    // Validate environment variables
    validateEnv();
    logger.info('Environment variables validated');

    // Log database URL for debugging (mask password)
    const dbUrl = process.env.DATABASE_URL || '';
    const maskedDbUrl = dbUrl.replace(/:\w+@/, ':***@');
    logger.info({ DATABASE_URL: maskedDbUrl }, 'API using DATABASE_URL');

    // Test database connection
    await prisma.$connect();
    logger.info('API connected to database');

    // Create Express app
    const app = createApp();
    const port = parseInt(process.env.APP_PORT || '4000', 10);

    // Start server
    const server = app.listen(port, () => {
      logger.info({ port }, `API server running on port ${port}`);
      logger.info({ url: `http://localhost:${port}` }, 'API ready to accept requests');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        void prisma.$disconnect().then(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer().catch((error) => {
  logger.error({ error }, 'Unhandled error in server startup');
  process.exit(1);
});
