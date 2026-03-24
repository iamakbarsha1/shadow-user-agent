import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { validateRequest, loginSchema } from '../validation';
import type { LoginRequest, LoginResponse } from '../../types/auth';
import { UnauthorizedError } from '../../utils/errors';
import { createApiKey, listApiKeys, deleteApiKey } from '../../db/queries/apiKeys';
import { authenticateJWT } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

// Pre-compute password hash at module load time for consistent comparison
const VALID_PASSWORD_HASH = bcrypt.hashSync('shadow_dev_2025', 10);

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

/**
 * POST /auth/api-key
 * Generate a new API key for programmatic access (MCP server, CLI)
 */
router.post('/api-key', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const label = (req.body as { label?: string }).label ?? 'unnamed';
    const record = await createApiKey(String(label));

    logger.info({ keyId: record.id, label }, 'API key created');

    // Return the key once — it cannot be retrieved again
    res.status(201).json({
      id: record.id,
      key: record.key,
      label: record.label,
      createdAt: record.createdAt.toISOString(),
      note: 'Save this key — it cannot be retrieved again',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/api-keys
 * List all API keys (without key values)
 */
router.get('/api-keys', authenticateJWT, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = await listApiKeys();
    res.status(200).json({ apiKeys: keys });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /auth/api-key/:id
 * Revoke an API key
 */
router.delete('/api-key/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    await deleteApiKey(id);
    logger.info({ keyId: id }, 'API key deleted');
    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
