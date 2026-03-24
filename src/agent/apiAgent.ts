import { logger } from '../utils/logger';
import type { ParsedEndpoint } from './specParser';

/**
 * Result of testing a single API endpoint.
 */
export interface ApiTestResult {
  endpoint: string;
  operationId?: string;
  status: number;
  responseTime: number;
  passed: boolean;
  failureReason?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  expectedStatuses: number[];
}

/**
 * Options for running the API agent.
 */
export interface ApiAgentOptions {
  baseUrl: string;
  endpoints: ParsedEndpoint[];
  maxEndpoints?: number;
}

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ENDPOINTS = 50;

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

/**
 * Generate a minimal placeholder value for a JSON schema property.
 * Uses simple heuristics: string → "test-value", number → 1, boolean → true.
 */
function generatePlaceholderValue(schema: unknown, fieldName: string): unknown {
  if (!schema || typeof schema !== 'object') {
    return 'test-value';
  }
  const s = schema as JsonSchema;

  if (s.type === 'integer' || s.type === 'number') {
    return 1;
  }
  if (s.type === 'boolean') {
    return true;
  }
  if (s.type === 'array') {
    return [];
  }
  if (s.type === 'object' && s.properties) {
    return buildObjectFromSchema(s);
  }

  // Infer from field name
  const lower = fieldName.toLowerCase();
  if (lower.includes('id')) return 'test-id';
  if (lower.includes('email')) return 'test@example.com';
  if (lower.includes('name')) return 'test-name';
  if (lower.includes('url')) return 'http://example.com';

  return 'test-value';
}

/**
 * Build a minimal valid object from a JSON schema with properties.
 */
function buildObjectFromSchema(schema: JsonSchema): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  if (!schema.properties) return obj;
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    obj[key] = generatePlaceholderValue(propSchema, key);
  }
  return obj;
}

/**
 * Expand path parameters with placeholder values.
 * e.g. /api/v1/users/{id} → /api/v1/users/test-id
 */
function expandPathParams(
  path: string,
  parameters: ParsedEndpoint['parameters']
): string {
  let expanded = path;
  for (const param of parameters) {
    if (param.in === 'path') {
      const value = generatePlaceholderValue(param.schema, param.name);
      expanded = expanded.replace(`{${param.name}}`, String(value));
    }
  }
  // Replace any remaining unresolved path params with placeholder
  expanded = expanded.replace(/\{[^}]+\}/g, 'test-id');
  return expanded;
}

/**
 * Build query string from required query parameters.
 */
function buildQueryString(parameters: ParsedEndpoint['parameters']): string {
  const queryParams = parameters.filter((p) => p.in === 'query' && p.required);
  if (queryParams.length === 0) return '';

  const params = new URLSearchParams();
  for (const param of queryParams) {
    const value = generatePlaceholderValue(param.schema, param.name);
    params.set(param.name, String(value));
  }
  return `?${params.toString()}`;
}

/**
 * Build a minimal request body from schema if present.
 */
function buildRequestBody(
  requestBodySchema: unknown
): Record<string, unknown> | null {
  if (!requestBodySchema || typeof requestBodySchema !== 'object') return null;
  const schema = requestBodySchema as JsonSchema;

  if (schema.type === 'object' || schema.properties) {
    return buildObjectFromSchema(schema);
  }
  return null;
}

/**
 * Fetch with a timeout using AbortController.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * HTTP-based API test runner.
 * Executes requests per endpoint spec and records pass/fail results.
 */
export class ApiAgent {
  /**
   * Run API tests against the given endpoints.
   * Tests each endpoint, records status code, response time, and pass/fail.
   *
   * @param options - baseUrl, endpoints list, and optional maxEndpoints limit
   * @returns Array of ApiTestResult for each tested endpoint
   */
  async run(options: ApiAgentOptions): Promise<ApiTestResult[]> {
    const { baseUrl, endpoints, maxEndpoints = DEFAULT_MAX_ENDPOINTS } = options;
    const results: ApiTestResult[] = [];
    const limited = endpoints.slice(0, maxEndpoints);

    for (const endpoint of limited) {
      const result = await this.testEndpoint(baseUrl, endpoint);
      results.push(result);
    }

    logger.info(
      {
        baseUrl,
        total: results.length,
        passed: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
      },
      'API agent run complete'
    );

    return results;
  }

  private async testEndpoint(
    baseUrl: string,
    endpoint: ParsedEndpoint
  ): Promise<ApiTestResult> {
    const expandedPath = expandPathParams(endpoint.path, endpoint.parameters);
    const queryString = buildQueryString(endpoint.parameters);
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const url = `${normalizedBase}${expandedPath}${queryString}`;

    const endpointLabel = `${endpoint.method} ${endpoint.path}`;

    const requestBody = buildRequestBody(endpoint.requestBodySchema);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const init: RequestInit = {
      method: endpoint.method,
      headers,
    };

    if (requestBody !== null && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      init.body = JSON.stringify(requestBody);
    }

    const start = Date.now();

    try {
      const response = await fetchWithTimeout(url, init, REQUEST_TIMEOUT_MS);
      const responseTime = Date.now() - start;

      // Capture first 500 chars of response body
      let responseBody: unknown;
      try {
        const text = await response.text();
        const trimmed = text.slice(0, 500);
        try {
          responseBody = JSON.parse(trimmed);
        } catch {
          responseBody = trimmed;
        }
      } catch {
        responseBody = null;
      }

      const passed = endpoint.expectedStatuses.includes(response.status);
      const failureReason = passed
        ? undefined
        : `Received status ${response.status}, expected one of [${endpoint.expectedStatuses.join(', ')}]`;

      logger.info(
        {
          endpoint: endpointLabel,
          status: response.status,
          responseTime,
          passed,
        },
        'API endpoint tested'
      );

      return {
        endpoint: endpointLabel,
        operationId: endpoint.operationId,
        status: response.status,
        responseTime,
        passed,
        failureReason,
        requestBody: requestBody ?? undefined,
        responseBody,
        expectedStatuses: endpoint.expectedStatuses,
      };
    } catch (err) {
      const responseTime = Date.now() - start;
      const isTimeout =
        err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));

      const failureReason = isTimeout
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : `Network error: ${err instanceof Error ? err.message : String(err)}`;

      logger.warn(
        { endpoint: endpointLabel, failureReason, responseTime },
        'API endpoint test failed (network error)'
      );

      return {
        endpoint: endpointLabel,
        operationId: endpoint.operationId,
        status: 0,
        responseTime,
        passed: false,
        failureReason,
        requestBody: requestBody ?? undefined,
        responseBody: undefined,
        expectedStatuses: endpoint.expectedStatuses,
      };
    }
  }
}
