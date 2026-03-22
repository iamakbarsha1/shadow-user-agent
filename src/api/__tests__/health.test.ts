import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import type { Express } from 'express';

describe('Health API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /health', () => {
    it('should return 200 with service status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('db');
      expect(res.body).toHaveProperty('redis');
      expect(res.body).toHaveProperty('ai_provider');
      expect(res.body).toHaveProperty('version');
      expect(res.body.version).toBe('1.0.0');
    });

    it('should not require authentication', async () => {
      // Health check should work without auth
      const res = await request(app).get('/health');

      expect(res.status).not.toBe(401);
    });
  });
});
