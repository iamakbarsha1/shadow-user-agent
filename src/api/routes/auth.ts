import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { validateRequest, loginSchema } from '../validation';
import type { LoginRequest, LoginResponse } from '../../types/auth';
import { UnauthorizedError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /auth/login
 * Authenticate user and issue JWT token
 *
 * For Phase 1, we use hardcoded credentials for development.
 * In production, this would query a users table.
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateRequest(loginSchema, req.body) as LoginRequest;

    // Hardcoded dev credentials (matching DEPLOYMENT.md)
    const VALID_EMAIL = 'admin@concertIDC.internal';
    const VALID_PASSWORD_HASH = await bcrypt.hash('shadow_dev_2025', 10);

    // Validate credentials
    if (body.email !== VALID_EMAIL) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await bcrypt.compare(body.password, VALID_PASSWORD_HASH);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate JWT
    const privateKey = process.env.JWT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('JWT_PRIVATE_KEY not configured');
    }

    const expiresIn = 24 * 60 * 60; // 24 hours
    const token = jwt.sign(
      {
        userId: 'admin-001',
        email: body.email,
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn,
      }
    );

    logger.info({ email: body.email }, 'User logged in');

    const response: LoginResponse = {
      token,
      expiresIn,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
