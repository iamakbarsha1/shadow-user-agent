import { InvalidSpecError } from '../utils/errors';

/**
 * Represents a single parsed API endpoint from an OpenAPI/Swagger spec.
 */
export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  requestBodySchema?: unknown;
  expectedStatuses: number[];
  parameters: Array<{
    name: string;
    in: 'query' | 'path' | 'header' | 'body';
    required: boolean;
    schema?: unknown;
  }>;
}

// Internal type helpers for spec parsing

interface OpenApi3Parameter {
  name?: unknown;
  in?: unknown;
  required?: unknown;
  schema?: unknown;
}

interface OpenApi3RequestBody {
  content?: Record<string, { schema?: unknown }>;
}

interface OpenApi3Operation {
  operationId?: string;
  summary?: string;
  parameters?: OpenApi3Parameter[];
  requestBody?: OpenApi3RequestBody;
  responses?: Record<string, unknown>;
}

interface OpenApi3Spec {
  openapi: string;
  paths?: Record<string, Record<string, OpenApi3Operation>>;
}

interface Swagger2Parameter {
  name?: unknown;
  in?: unknown;
  required?: unknown;
  schema?: unknown;
}

interface Swagger2Operation {
  operationId?: string;
  summary?: string;
  parameters?: Swagger2Parameter[];
  responses?: Record<string, unknown>;
}

interface Swagger2Spec {
  swagger: string;
  paths?: Record<string, Record<string, Swagger2Operation>>;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);

/**
 * Parse numeric HTTP status codes from the responses object keys.
 * Filters out non-numeric keys like 'default'.
 */
function parseExpectedStatuses(responses: Record<string, unknown> | undefined): number[] {
  if (!responses) return [200];
  return Object.keys(responses)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n));
}

/**
 * Parse an OpenAPI 3.x spec and extract endpoints.
 */
function parseOpenApi3(spec: OpenApi3Spec): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  const paths = spec.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!operation || typeof operation !== 'object') continue;

      const op = operation as OpenApi3Operation;

      // Parse parameters
      const parameters: ParsedEndpoint['parameters'] = [];
      for (const param of op.parameters ?? []) {
        const paramIn = String(param.in ?? 'query');
        if (!['query', 'path', 'header', 'body'].includes(paramIn)) continue;
        parameters.push({
          name: String(param.name ?? ''),
          in: paramIn as 'query' | 'path' | 'header' | 'body',
          required: Boolean(param.required),
          schema: param.schema,
        });
      }

      // Parse requestBody (OA3)
      let requestBodySchema: unknown = undefined;
      if (op.requestBody?.content) {
        const jsonContent = op.requestBody.content['application/json'];
        if (jsonContent?.schema) {
          requestBodySchema = jsonContent.schema;
        } else {
          // Use first content type available
          const first = Object.values(op.requestBody.content)[0];
          if (first?.schema) {
            requestBodySchema = first.schema;
          }
        }
      }

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        summary: op.summary,
        requestBodySchema,
        expectedStatuses: parseExpectedStatuses(op.responses),
        parameters,
      });
    }
  }

  return endpoints;
}

/**
 * Parse a Swagger 2.x spec and extract endpoints.
 */
function parseSwagger2(spec: Swagger2Spec): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  const paths = spec.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!operation || typeof operation !== 'object') continue;

      const op = operation as Swagger2Operation;

      // Parse parameters
      const parameters: ParsedEndpoint['parameters'] = [];
      let requestBodySchema: unknown = undefined;

      for (const param of op.parameters ?? []) {
        const paramIn = String(param.in ?? 'query');
        if (paramIn === 'body') {
          // Swagger 2 body parameter
          requestBodySchema = param.schema;
          parameters.push({
            name: String(param.name ?? 'body'),
            in: 'body',
            required: Boolean(param.required),
            schema: param.schema,
          });
        } else {
          if (!['query', 'path', 'header'].includes(paramIn)) continue;
          parameters.push({
            name: String(param.name ?? ''),
            in: paramIn as 'query' | 'path' | 'header',
            required: Boolean(param.required),
            schema: param.schema,
          });
        }
      }

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        summary: op.summary,
        requestBodySchema,
        expectedStatuses: parseExpectedStatuses(op.responses),
        parameters,
      });
    }
  }

  return endpoints;
}

/**
 * Parse an OpenAPI 3.x or Swagger 2.x JSON spec string into an array of endpoints.
 * Only JSON input is supported in this MVP (no YAML library dependency).
 *
 * @throws {InvalidSpecError} if the spec is malformed or unrecognized
 */
export function parseOpenApiSpec(specJson: string): ParsedEndpoint[] {
  if (!specJson || typeof specJson !== 'string') {
    throw new InvalidSpecError('spec must be a non-empty string');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(specJson);
  } catch (err) {
    throw new InvalidSpecError(
      `failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new InvalidSpecError('spec must be a JSON object');
  }

  const spec = parsed as Record<string, unknown>;

  if (typeof spec['openapi'] === 'string' && spec['openapi'].startsWith('3.')) {
    return parseOpenApi3(spec as unknown as OpenApi3Spec);
  }

  if (typeof spec['swagger'] === 'string' && spec['swagger'].startsWith('2.')) {
    return parseSwagger2(spec as unknown as Swagger2Spec);
  }

  throw new InvalidSpecError(
    'unrecognized spec format — expected OpenAPI 3.x (openapi: "3.x.x") or Swagger 2.x (swagger: "2.0")'
  );
}
