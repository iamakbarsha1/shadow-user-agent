import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiAgent } from '../apiAgent';
import type { ParsedEndpoint } from '../specParser';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeEndpoint(overrides: Partial<ParsedEndpoint> = {}): ParsedEndpoint {
  return {
    method: 'GET',
    path: '/api/test',
    operationId: 'testOp',
    summary: 'Test endpoint',
    requestBodySchema: undefined,
    expectedStatuses: [200],
    parameters: [],
    ...overrides,
  };
}

function makeFetchResponse(status: number, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('ApiAgent', () => {
  let agent: ApiAgent;

  beforeEach(() => {
    agent = new ApiAgent();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('run()', () => {
    it('should make a request for each endpoint', async () => {
      const endpoints: ParsedEndpoint[] = [
        makeEndpoint({ path: '/api/users', operationId: 'listUsers' }),
        makeEndpoint({ path: '/api/posts', operationId: 'listPosts' }),
      ];

      mockFetch.mockResolvedValue(makeFetchResponse(200, { data: [] }));

      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect maxEndpoints limit', async () => {
      const endpoints: ParsedEndpoint[] = Array.from({ length: 10 }, (_, i) =>
        makeEndpoint({ path: `/api/items/${i}`, operationId: `op${i}` })
      );

      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints, maxEndpoints: 3 });

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should default maxEndpoints to 50', async () => {
      const endpoints: ParsedEndpoint[] = Array.from({ length: 60 }, (_, i) =>
        makeEndpoint({ path: `/api/items/${i}`, operationId: `op${i}` })
      );

      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results).toHaveLength(50);
    });

    it('should return empty array for empty endpoints', async () => {
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints: [] });
      expect(results).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('pass/fail logic', () => {
    it('should mark result as passed when status is in expectedStatuses', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, { users: [] }));

      const endpoints = [makeEndpoint({ expectedStatuses: [200, 201] })];
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results[0].passed).toBe(true);
      expect(results[0].status).toBe(200);
      expect(results[0].failureReason).toBeUndefined();
    });

    it('should mark result as failed when status is not in expectedStatuses', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(500, { error: 'Internal Server Error' }));

      const endpoints = [makeEndpoint({ expectedStatuses: [200] })];
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results[0].passed).toBe(false);
      expect(results[0].status).toBe(500);
      expect(results[0].failureReason).toMatch(/500/);
      expect(results[0].failureReason).toMatch(/200/);
    });

    it('should mark 404 as failed when not in expectedStatuses', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(404, { error: 'Not Found' }));

      const endpoints = [makeEndpoint({ expectedStatuses: [200] })];
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results[0].passed).toBe(false);
      expect(results[0].status).toBe(404);
    });

    it('should mark 404 as passed when 404 is in expectedStatuses', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(404));

      const endpoints = [makeEndpoint({ expectedStatuses: [200, 404] })];
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results[0].passed).toBe(true);
    });
  });

  describe('network errors', () => {
    it('should mark result as failed on network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const endpoints = [makeEndpoint()];
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results[0].passed).toBe(false);
      expect(results[0].status).toBe(0);
      expect(results[0].failureReason).toMatch(/ECONNREFUSED/);
    });

    it('should mark result as failed on timeout (AbortError)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const endpoints = [makeEndpoint()];
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results[0].passed).toBe(false);
      expect(results[0].status).toBe(0);
      expect(results[0].failureReason).toMatch(/timed out/i);
    });

    it('should still return results for other endpoints after a network error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(makeFetchResponse(200));

      const endpoints = [
        makeEndpoint({ path: '/api/fail' }),
        makeEndpoint({ path: '/api/ok' }),
      ];
      const results = await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(false);
      expect(results[1].passed).toBe(true);
    });
  });

  describe('request construction', () => {
    it('should expand path parameters with placeholder values', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const endpoints = [
        makeEndpoint({
          path: '/api/users/{id}',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        }),
      ];

      await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      const calledUrl = (mockFetch.mock.calls[0] as [string, RequestInit])[0];
      expect(calledUrl).not.toContain('{id}');
      expect(calledUrl).toContain('/api/users/');
    });

    it('should include required query params in URL', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const endpoints = [
        makeEndpoint({
          path: '/api/search',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        }),
      ];

      await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      const calledUrl = (mockFetch.mock.calls[0] as [string, RequestInit])[0];
      expect(calledUrl).toContain('?q=');
    });

    it('should send request body for POST endpoints with schema', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(201));

      const endpoints = [
        makeEndpoint({
          method: 'POST',
          path: '/api/users',
          expectedStatuses: [201],
          requestBodySchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'integer' },
            },
          },
        }),
      ];

      await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      const [, init] = (mockFetch.mock.calls[0] as [string, RequestInit]);
      expect(init.method).toBe('POST');
      expect(init.body).toBeDefined();
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('age');
    });

    it('should not send body for GET requests', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const endpoints = [makeEndpoint({ method: 'GET' })];
      await agent.run({ baseUrl: 'http://localhost:4000', endpoints });

      const [, init] = (mockFetch.mock.calls[0] as [string, RequestInit]);
      expect(init.body).toBeUndefined();
    });
  });

  describe('result fields', () => {
    it('should record response time in milliseconds', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const results = await agent.run({
        baseUrl: 'http://localhost:4000',
        endpoints: [makeEndpoint()],
      });

      expect(results[0].responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include endpoint label in result', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const results = await agent.run({
        baseUrl: 'http://localhost:4000',
        endpoints: [makeEndpoint({ method: 'GET', path: '/api/test' })],
      });

      expect(results[0].endpoint).toBe('GET /api/test');
    });

    it('should include operationId when present', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200));

      const results = await agent.run({
        baseUrl: 'http://localhost:4000',
        endpoints: [makeEndpoint({ operationId: 'myOperation' })],
      });

      expect(results[0].operationId).toBe('myOperation');
    });

    it('should capture response body (truncated to 500 chars)', async () => {
      const longBody = 'x'.repeat(1000);
      const response = {
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(longBody),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      const results = await agent.run({
        baseUrl: 'http://localhost:4000',
        endpoints: [makeEndpoint()],
      });

      // responseBody should be the truncated string (500 chars)
      expect(typeof results[0].responseBody).toBe('string');
      expect((results[0].responseBody as string).length).toBeLessThanOrEqual(500);
    });
  });
});
