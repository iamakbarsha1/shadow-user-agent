import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec } from '../specParser';
import { InvalidSpecError } from '../../utils/errors';

describe('parseOpenApiSpec', () => {
  describe('OpenAPI 3.x', () => {
    it('should parse a valid OA3 spec and return endpoints', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              summary: 'List all users',
              parameters: [
                { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
              ],
              responses: {
                '200': { description: 'Success' },
                '400': { description: 'Bad Request' },
              },
            },
            post: {
              operationId: 'createUser',
              summary: 'Create a user',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '201': { description: 'Created' },
                '422': { description: 'Validation Error' },
              },
            },
          },
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
              responses: {
                '200': { description: 'Success' },
                '404': { description: 'Not Found' },
              },
            },
          },
        },
      };

      const endpoints = parseOpenApiSpec(JSON.stringify(spec));

      expect(endpoints).toHaveLength(3);

      const listUsers = endpoints.find((e) => e.operationId === 'listUsers');
      expect(listUsers).toBeDefined();
      expect(listUsers?.method).toBe('GET');
      expect(listUsers?.path).toBe('/users');
      expect(listUsers?.summary).toBe('List all users');
      expect(listUsers?.expectedStatuses).toEqual(expect.arrayContaining([200, 400]));
      expect(listUsers?.parameters).toHaveLength(1);
      expect(listUsers?.parameters[0].name).toBe('limit');
      expect(listUsers?.parameters[0].in).toBe('query');
      expect(listUsers?.parameters[0].required).toBe(false);

      const createUser = endpoints.find((e) => e.operationId === 'createUser');
      expect(createUser?.method).toBe('POST');
      expect(createUser?.requestBodySchema).toBeDefined();
      expect(createUser?.expectedStatuses).toEqual(expect.arrayContaining([201, 422]));

      const getUser = endpoints.find((e) => e.operationId === 'getUser');
      expect(getUser?.path).toBe('/users/{id}');
      expect(getUser?.parameters[0].in).toBe('path');
      expect(getUser?.parameters[0].required).toBe(true);
    });

    it('should return empty array for spec with no paths', () => {
      const spec = { openapi: '3.0.0', info: { title: 'Empty', version: '1.0.0' }, paths: {} };
      const endpoints = parseOpenApiSpec(JSON.stringify(spec));
      expect(endpoints).toHaveLength(0);
    });

    it('should return empty array when paths key is absent', () => {
      const spec = { openapi: '3.1.0', info: { title: 'No paths', version: '1.0.0' } };
      const endpoints = parseOpenApiSpec(JSON.stringify(spec));
      expect(endpoints).toHaveLength(0);
    });
  });

  describe('Swagger 2.x', () => {
    it('should parse a valid Swagger 2 spec and return endpoints', () => {
      const spec = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        host: 'api.example.com',
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              summary: 'List all pets',
              parameters: [
                { name: 'limit', in: 'query', required: false },
              ],
              responses: {
                '200': { description: 'A list of pets' },
              },
            },
            post: {
              operationId: 'createPet',
              parameters: [
                {
                  name: 'body',
                  in: 'body',
                  required: true,
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                  },
                },
              ],
              responses: {
                '201': { description: 'Created' },
              },
            },
          },
        },
      };

      const endpoints = parseOpenApiSpec(JSON.stringify(spec));

      expect(endpoints).toHaveLength(2);

      const listPets = endpoints.find((e) => e.operationId === 'listPets');
      expect(listPets?.method).toBe('GET');
      expect(listPets?.path).toBe('/pets');
      expect(listPets?.expectedStatuses).toContain(200);

      const createPet = endpoints.find((e) => e.operationId === 'createPet');
      expect(createPet?.method).toBe('POST');
      expect(createPet?.requestBodySchema).toBeDefined();
      expect(createPet?.parameters[0].in).toBe('body');
    });
  });

  describe('Error handling', () => {
    it('should throw InvalidSpecError for malformed JSON', () => {
      expect(() => parseOpenApiSpec('{ not valid json }')).toThrow(InvalidSpecError);
      expect(() => parseOpenApiSpec('{ not valid json }')).toThrow(/Invalid API spec/);
    });

    it('should throw InvalidSpecError for empty string', () => {
      expect(() => parseOpenApiSpec('')).toThrow(InvalidSpecError);
    });

    it('should throw InvalidSpecError for unrecognized spec format', () => {
      const spec = JSON.stringify({ title: 'Not an OpenAPI spec' });
      expect(() => parseOpenApiSpec(spec)).toThrow(InvalidSpecError);
      expect(() => parseOpenApiSpec(spec)).toThrow(/unrecognized spec format/);
    });

    it('should throw InvalidSpecError for non-object JSON', () => {
      expect(() => parseOpenApiSpec('"just a string"')).toThrow(InvalidSpecError);
    });

    it('should throw InvalidSpecError for non-string input', () => {
      // @ts-expect-error testing runtime guard
      expect(() => parseOpenApiSpec(null)).toThrow(InvalidSpecError);
    });
  });

  describe('Edge cases', () => {
    it('should skip non-HTTP method keys in path items', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/health': {
            get: {
              responses: { '200': { description: 'OK' } },
            },
            // Non-method keys should be ignored
            summary: 'Health check path',
            parameters: [],
          },
        },
      };
      const endpoints = parseOpenApiSpec(JSON.stringify(spec));
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].method).toBe('GET');
    });

    it('should collect expected statuses from numeric response keys only', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/items': {
            get: {
              responses: {
                '200': { description: 'OK' },
                default: { description: 'Error' }, // non-numeric, should be ignored
              },
            },
          },
        },
      };
      const endpoints = parseOpenApiSpec(JSON.stringify(spec));
      expect(endpoints[0].expectedStatuses).toEqual([200]);
    });
  });
});
