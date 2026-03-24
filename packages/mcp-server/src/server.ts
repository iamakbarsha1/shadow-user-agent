import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ShadowConfig } from './config';
import { ShadowApiClient } from './apiClient';
import { runTest, runTestSchema } from './tools/runTest';
import { generateTests, generateTestsSchema } from './tools/generateTests';
import { getResults, getResultsSchema } from './tools/getResults';
import { listTestCases, listTestCasesSchema } from './tools/listTestCases';
import { executeTestCase, executeTestCaseSchema } from './tools/executeTestCase';
import { getReport, getReportSchema } from './tools/getReport';
import { getFixSuggestions, getFixSuggestionsSchema } from './tools/getFixSuggestions';
import { applyFix, applyFixSchema } from './tools/applyFix';

const TOOLS = [
  {
    name: 'shadow_run_test',
    description: 'Trigger a full Shadow User Agent run against a URL. Simulates a user persona navigating the app and detects bugs, UX friction, and errors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to test' },
        personaId: { type: 'string', enum: ['new_user', 'power_user', 'mobile_user', 'edge_case'], description: 'User persona to simulate' },
        maxSteps: { type: 'number', description: 'Max navigation steps (1-100)' },
        generateTests: { type: 'boolean', description: 'Generate Playwright test cases from session' },
        prd: { type: 'string', description: 'Optional PRD/description for better test context' },
        waitForCompletion: { type: 'boolean', description: 'Wait for run to complete (default: true)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'shadow_generate_tests',
    description: 'Run the Shadow Agent and generate executable Playwright test cases from the session. Returns test code ready to use.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to test' },
        personaId: { type: 'string', enum: ['new_user', 'power_user', 'mobile_user', 'edge_case'] },
        prd: { type: 'string', description: 'Optional product requirements for better tests' },
        maxSteps: { type: 'number', description: 'Max navigation steps (1-100)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'shadow_get_results',
    description: 'Get the status and report list for a specific run ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        runId: { type: 'string', description: 'Run ID to retrieve results for' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'shadow_list_test_cases',
    description: 'List all generated Playwright test cases for a run.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        runId: { type: 'string', description: 'Run ID to list test cases for' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'shadow_execute_test',
    description: 'Retrieve a specific test case by ID, including its full Playwright test code.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        testCaseId: { type: 'string', description: 'Test case ID to retrieve' },
      },
      required: ['testCaseId'],
    },
  },
  {
    name: 'shadow_get_report',
    description: 'Get the full content of a bug report or code review by report ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        reportId: { type: 'string', description: 'Report ID to retrieve' },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'shadow_get_fix_suggestions',
    description: 'Get AI-generated fix suggestions for all failing tests in a test group. Returns diagnosis and healed code for each failing member.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        testGroupId: { type: 'string', description: 'Test group ID to get fix suggestions for' },
      },
      required: ['testGroupId'],
    },
  },
  {
    name: 'shadow_apply_fix',
    description: 'Trigger auto-healing for a failing test case. Runs the test, diagnoses the failure, and attempts to fix broken selectors automatically.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        testCaseId: { type: 'string', description: 'Test case ID to apply fix to' },
      },
      required: ['testCaseId'],
    },
  },
];

/**
 * Creates and returns the MCP server instance
 */
export function createMcpServer(config: ShadowConfig): Server {
  const client = new ShadowApiClient(config);

  const server = new Server(
    { name: 'shadow-agent', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      if (name === 'shadow_run_test') {
        result = await runTest(client, runTestSchema.parse(args));
      } else if (name === 'shadow_generate_tests') {
        result = await generateTests(client, generateTestsSchema.parse(args));
      } else if (name === 'shadow_get_results') {
        result = await getResults(client, getResultsSchema.parse(args));
      } else if (name === 'shadow_list_test_cases') {
        result = await listTestCases(client, listTestCasesSchema.parse(args));
      } else if (name === 'shadow_execute_test') {
        result = await executeTestCase(client, executeTestCaseSchema.parse(args));
      } else if (name === 'shadow_get_report') {
        result = await getReport(client, getReportSchema.parse(args));
      } else if (name === 'shadow_get_fix_suggestions') {
        result = await getFixSuggestions(client, getFixSuggestionsSchema.parse(args));
      } else if (name === 'shadow_apply_fix') {
        result = await applyFix(client, applyFixSchema.parse(args));
      } else {
        return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Starts the MCP server over stdio transport
 */
export async function startMcpServer(config: ShadowConfig): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
