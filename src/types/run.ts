/**
 * Run-related type definitions
 */

export type RunStatus = 'pending' | 'running' | 'complete' | 'failed';

export type RunType = 'browser' | 'api' | 'security';

export interface CreateRunRequest {
  url: string;
  personaId: string;
  runType?: RunType;
  apiSpec?: string;
  generateTests?: boolean;
  prd?: string;
  options?: {
    maxSteps?: number;
    authCredentials?: {
      username: string;
      password: string;
    };
    scopePathPrefix?: string;
  };
}

export interface CreateRunResponse {
  runId: string;
  status: RunStatus;
  startedAt: string;
}

export interface ApiTestResult {
  endpoint: string;
  operationId?: string;
  status: number;
  responseTime: number;
  passed: boolean;
  failureReason?: string;
  expectedStatuses: number[];
}

export interface GetRunResponse {
  runId: string;
  url: string;
  personaId: string;
  status: RunStatus;
  runType: RunType;
  startedAt: string;
  completedAt?: string;
  observationCount: number;
  reportIds: string[];
  apiTestResults?: ApiTestResult[];
}

export interface ListRunsResponse {
  runs: Array<{
    runId: string;
    url: string;
    personaId: string;
    status: RunStatus;
    startedAt: string;
    completedAt?: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
