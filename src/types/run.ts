/**
 * Run-related type definitions
 */

export type RunStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface CreateRunRequest {
  url: string;
  personaId: string;
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

export interface GetRunResponse {
  runId: string;
  url: string;
  personaId: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  observationCount: number;
  reportIds: string[];
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
