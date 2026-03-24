/**
 * TestCase-related type definitions
 */

export type TestCaseStatus = 'generated' | 'passing' | 'failing' | 'stale';
export type TestFramework = 'playwright' | 'cypress';

export interface TestCase {
  id: string;
  runId: string;
  title: string;
  description?: string;
  testCode: string;
  framework: TestFramework;
  status: TestCaseStatus;
  lastRunAt?: string;
  lastResult?: Record<string, unknown>;
  selectorMap?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface TestExecutionResult {
  passed: boolean;
  duration: number;
  errorOutput?: string;
}

export interface TestGenerationRequest {
  runId: string;
  url: string;
  sessionLog: unknown;
  prd?: string;
}

export interface TestGenerationResponse {
  testCases: GeneratedTestCase[];
}

export interface GeneratedTestCase {
  title: string;
  description: string;
  testCode: string;
  selectorMap: Record<string, string>;
}

export interface ListTestCasesResponse {
  runId: string;
  testCases: TestCase[];
  total: number;
}

export interface GetTestCaseResponse extends TestCase {}

export interface UpdateTestCaseRequest {
  title?: string;
  description?: string;
  testCode?: string;
}
