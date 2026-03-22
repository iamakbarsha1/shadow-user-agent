import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';

describe('Auth API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /auth/login', () => {
    it('should return JWT token for valid credentials', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'admin@concertIDC.internal',
        password: 'shadow_dev_2025',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('expiresIn');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.expiresIn).toBe(24 * 60 * 60); // 24 hours

      // Verify the token is valid
      const publicKey = process.env.JWT_PUBLIC_KEY!;
      const decoded = jwt.verify(res.body.token, publicKey, {
        algorithms: ['RS256'],
      });

      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
    });

    it('should return 401 for invalid email', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'wrong@example.com',
        password: 'shadow_dev_2025',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Invalid email or password');
    });

    it('should return 401 for invalid password', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'admin@concertIDC.internal',
        password: 'wrong_password',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app).post('/auth/login').send({
        password: 'shadow_dev_2025',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'not-an-email',
        password: 'shadow_dev_2025',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for short password', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'admin@concertIDC.internal',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Internal API Key authentication', () => {
    it('should accept X-API-Key header for authentication', async () => {
      const apiKey = process.env.INTERNAL_API_KEY!;

      const res = await request(app)
        .post('/api/v1/runs')
        .set('X-API-Key', apiKey)
        .send({
          url: 'https://example.com',
          personaId: 'new_user',
        });

      // Should not return 401
      expect(res.status).not.toBe(401);
    });

    it('should reject invalid API key', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('X-API-Key', 'invalid-key')
        .send({
          url: 'https://example.com',
          personaId: 'new_user',
        });

      expect(res.status).toBe(401);
    });
  });
});
