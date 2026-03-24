import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../utils/errors';
import { findApiKeyByValue } from '../../db/queries/apiKeys';
import type { JWTPayload } from '../../types/auth';

/**
 * Extends Express Request with authenticated user info
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT authentication middleware.
 * Validates Bearer token or x-api-key header (DB-stored keys or INTERNAL_API_KEY).
 * In development mode, allows unauthenticated requests for testing.
 */
export function authenticateJWT(req: Request, _res: Response, next: NextFunction): void {
  // Development mode bypass - allow unauthenticated requests
  if (process.env.NODE_ENV === 'development') {
    req.user = {
      userId: 'dev-user',
      email: 'dev@localhost',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    };
    return next();
  }

  // Check for x-api-key header — check INTERNAL_API_KEY first (sync), then DB keys (async)
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    const keyValue = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

    // Internal static key check (synchronous)
    if (keyValue === process.env.INTERNAL_API_KEY) {
      req.user = {
        userId: 'internal',
        email: 'internal@system',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      };
      return next();
    }

    // DB-stored API key check (asynchronous)
    findApiKeyByValue(keyValue)
      .then((record) => {
        if (!record) {
          return next(new UnauthorizedError('Invalid API key'));
        }
        req.user = {
          userId: `apikey:${record.id}`,
          email: `apikey:${record.label}`,
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 3600,
        };
        next();
      })
      .catch(() => next(new UnauthorizedError('Invalid API key')));

    return; // async path — do not fall through
  }

  try {
    // Check for Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify JWT
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('JWT_PUBLIC_KEY not configured');
    }

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as JWTPayload;

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired token'));
    } else {
      next(error);
    }
  }
}
