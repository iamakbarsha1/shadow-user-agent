// Vitest global setup
import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup
});
