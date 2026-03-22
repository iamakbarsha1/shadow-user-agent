import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../../db/client';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';

describe('Runs API', () => {
  let app: Express;
  let testToken: string;

  beforeAll(async () => {
    app = createApp();

    // Generate test JWT token
    const privateKey = process.env.JWT_PRIVATE_KEY!;
    testToken = jwt.sign(
      { userId: 'test-user', email: 'test@example.com' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.run.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/runs', () => {
    it('should create a new run with valid input', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://demo.playwright.dev/todomvc',
          personaId: 'new_user',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('runId');
      expect(res.body.status).toBe('pending');
      expect(res.body).toHaveProperty('startedAt');
    });

    it('should return 400 for invalid URL', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'not-a-valid-url',
          personaId: 'new_user',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for unknown persona', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          personaId: 'invalid_persona',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/v1/runs').send({
        url: 'https://example.com',
        personaId: 'new_user',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should accept optional maxSteps parameter', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          personaId: 'power_user',
          options: {
            maxSteps: 50,
          },
        });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/v1/runs/:runId', () => {
    it('should return run details for valid runId', async () => {
      // Create a run first
      const createRes = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          personaId: 'new_user',
        });

      const runId = createRes.body.runId;

      // Get the run
      const res = await request(app)
        .get(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runId).toBe(runId);
      expect(res.body.url).toBe('https://example.com');
      expect(res.body.personaId).toBe('new_user');
      expect(res.body.status).toBe('pending');
      expect(res.body.observationCount).toBe(0);
      expect(res.body.reportIds).toEqual([]);
    });

    it('should return 404 for non-existent runId', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/runs/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RUN_NOT_FOUND');
    });
  });

  describe('GET /api/v1/runs', () => {
    it('should return empty list when no runs exist', async () => {
      const res = await request(app)
        .get('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runs).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.limit).toBe(20);
      expect(res.body.offset).toBe(0);
    });

    it('should return list of runs', async () => {
      // Create multiple runs
      await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ url: 'https://example.com', personaId: 'new_user' });

      await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ url: 'https://test.com', personaId: 'power_user' });

      // List runs
      const res = await request(app)
        .get('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runs).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should support pagination with limit and offset', async () => {
      // Create 3 runs
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/runs')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ url: 'https://example.com', personaId: 'new_user' });
      }

      // Get first page
      const res1 = await request(app)
        .get('/api/v1/runs?limit=2&offset=0')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res1.body.runs).toHaveLength(2);
      expect(res1.body.limit).toBe(2);
      expect(res1.body.offset).toBe(0);

      // Get second page
      const res2 = await request(app)
        .get('/api/v1/runs?limit=2&offset=2')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res2.body.runs).toHaveLength(1);
      expect(res2.body.limit).toBe(2);
      expect(res2.body.offset).toBe(2);
    });

    it('should filter by status', async () => {
      // Create runs with different statuses would require database manipulation
      // For now, just test the query parameter is accepted
      const res = await request(app)
        .get('/api/v1/runs?status=pending')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/runs/:runId', () => {
    it('should delete an existing run', async () => {
      // Create a run
      const createRes = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ url: 'https://example.com', personaId: 'new_user' });

      const runId = createRes.body.runId;

      // Delete the run
      const deleteRes = await request(app)
        .delete(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.deleted).toBe(true);

      // Verify it's deleted
      const getRes = await request(app)
        .get(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 when deleting non-existent run', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .delete(`/api/v1/runs/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RUN_NOT_FOUND');
    });
  });
});
