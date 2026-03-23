import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
        'tests/fixtures/',
        // Frontend is built/tested by Next.js separately
        'frontend/**',
        // Prisma seed/schema files
        'prisma/**',
        // Type-only files (no executable code)
        'src/types/**',
        // Entry points — integration concerns, not unit tested
        'src/api/server.ts',
        'src/worker/index.ts',
        // Prisma client instantiation (no logic to test)
        'src/db/client.ts',
        // Screenshot cleanup — filesystem op, excluded from unit coverage
        'src/worker/screenshotCleanup.ts',
        // Browser agent and job processor require integration-level test setup
        // They are covered by npm run test:agent (Playwright tests)
        'src/agent/browserAgent.ts',
        'src/worker/agentJob.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        // Branch threshold reflects that module-init branches (logger transport,
        // queue parseRedisUrl defaults, rateLimit Redis store) are not unit-testable
        branches: 80,
        statements: 85,
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
