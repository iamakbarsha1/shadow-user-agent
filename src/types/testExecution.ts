/**
 * TypeScript type definitions for the TestExecution domain
 */

export type TestExecutionStatus = 'passed' | 'failed' | 'healed' | 'error';

export interface FailureDiagnosis {
  failureType: 'selector' | 'timeout' | 'assertion' | 'network' | 'unknown';
  affectedSelectors: string[];
  diagnosis: string;
  suggestedFix: string;
}

export interface TestExecution {
  id: string;
  testCaseId: string;
  status: TestExecutionStatus;
  duration: number;
  output: string | null;
  diagnosis: FailureDiagnosis | null;
  healedCode: string | null;
  executedAt: string;
}

export interface ExecuteTestCaseResponse {
  executionId: string;
  status: TestExecutionStatus;
  duration: number;
  output: string | null;
  diagnosis: FailureDiagnosis | null;
  healed: boolean;
}

export interface ListTestExecutionsResponse {
  testCaseId: string;
  executions: TestExecution[];
  total: number;
}
