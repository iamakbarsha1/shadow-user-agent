import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

/**
 * Builds a Redis-backed store for production/staging.
 * Returns undefined in test environments so express-rate-limit uses
 * its default in-memory store (no Redis dependency in unit tests).
 */
function buildRedisStore(prefix: string): RedisStore | undefined {
  if (process.env.NODE_ENV === 'test') return undefined;

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  return new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: (async (...args: string[]) => {
      const [command, ...rest] = args;
      return redis.call(command, ...rest);
    }) as any,
    prefix,
  });
}

/**
 * Rate limiter for POST /runs endpoint (10 per hour)
 */
export const createRunRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  // max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('rl:create-run:'),
  message: {
    error: {
      code: 'RUN_LIMIT_EXCEEDED',
      message: 'Too many run requests. Maximum 100 per hour.',
      // message: 'Too many run requests. Maximum 10 per hour.',
      details: {},
    },
  },
});

/**
 * General rate limiter for all other endpoints (300 per minute)
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('rl:general:'),
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Maximum 300 per minute.',
      details: {},
    },
  },
});
