import pino from 'pino';

/**
 * Application-wide logger using pino.
 * Configured with pretty printing in development and JSON output in production.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  serializers: {
    error: pino.stdSerializers.err,
    err: pino.stdSerializers.err,
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
