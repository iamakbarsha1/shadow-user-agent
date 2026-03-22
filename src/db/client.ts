import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Prisma Client singleton.
 * Ensures only one instance of PrismaClient is created in the application.
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn'] // Disable 'query' logs in dev to reduce noise
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('Disconnecting Prisma Client');
  await prisma.$disconnect();
});
