const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface LoginResponse {
  token: string;
  expiresIn: number;
}

interface CreateRunRequest {
  url: string;
  personaId: string;
  runType?: 'browser' | 'api';
  apiSpec?: string;
  generateTests?: boolean;
  prd?: string;
  options?: {
    maxSteps?: number;
    authCredentials?: { username: string; password: string };
    scopePathPrefix?: string;
  };
}

interface CreateRunResponse {
  runId: string;
  status: string;
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

interface RunResponse {
  runId: string;
  url: string;
  personaId: string;
  status: string;
  runType?: 'browser' | 'api';
  startedAt: string;
  completedAt?: string;
  observationCount: number;
  reportIds: string[];
  apiTestResults?: ApiTestResult[];
}

interface ListRunsResponse {
  runs: {
    runId: string;
    url: string;
    personaId: string;
    status: string;
    startedAt: string;
    completedAt?: string;
  }[];
  total: number;
  limit: number;
  offset: number;
}

interface ReportItem {
  reportId: string;
  reportType: string;
  content: Record<string, unknown>;
  createdAt: string;
}

interface ReportsResponse {
  runId: string;
  reports: ReportItem[];
}

interface ReportResponse {
  reportId: string;
  runId: string;
  reportType: string;
  content: Record<string, unknown>;
  createdAt: string;
}

export interface TestCase {
  id: string;
  runId: string;
  title: string;
  description?: string;
  testCode: string;
  framework: string;
  status: string;
  lastRunAt?: string;
  selectorMap?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface ListTestCasesResponse {
  runId: string;
  testCases: TestCase[];
  total: number;
}

interface UpdateTestCaseRequest {
  title?: string;
  description?: string;
  testCode?: string;
}

export interface FailureDiagnosis {
  failureType: 'selector' | 'timeout' | 'assertion' | 'network' | 'unknown';
  affectedSelectors: string[];
  diagnosis: string;
  suggestedFix: string;
}

export interface TestExecution {
  id: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'healed' | 'error';
  duration: number;
  output: string | null;
  diagnosis: FailureDiagnosis | null;
  healedCode: string | null;
  executedAt: string;
}

export interface ExecuteTestCaseResponse {
  executionId: string;
  status: 'passed' | 'failed' | 'healed' | 'error';
  duration: number;
  output: string | null;
  diagnosis: FailureDiagnosis | null;
  healed: boolean;
}

interface ListTestExecutionsResponse {
  testCaseId: string;
  executions: TestExecution[];
  total: number;
}

export interface Schedule {
  id: string;
  url: string;
  personaId: string;
  cronExpression: string;
  enabled: boolean;
  label: string | null;
  generateTests: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateScheduleRequest {
  url: string;
  personaId: string;
  cronExpression: string;
  label?: string;
  generateTests?: boolean;
}

interface UpdateScheduleRequest {
  url?: string;
  personaId?: string;
  cronExpression?: string;
  label?: string;
  enabled?: boolean;
  generateTests?: boolean;
}

interface ListSchedulesResponse {
  schedules: Schedule[];
  total: number;
  limit: number;
  offset: number;
}

export type UsageAction = 'run' | 'test_generation' | 'test_execution' | 'group_execution';

export interface UsageRecord {
  id: string;
  userId: string;
  action: UsageAction;
  cost: number;
  relatedId?: string;
  createdAt: string;
}

export interface CreditAllocation {
  id: string;
  userId: string;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  periodStart: string;
  periodEnd: string;
}

export interface UsageSummary {
  allocation: CreditAllocation;
  recentRecords: UsageRecord[];
  totalRecords: number;
  byAction: Record<UsageAction, { count: number; totalCost: number }>;
}

export interface TestGroupMember {
  id: string;
  testGroupId: string;
  testCaseId: string;
  order: number;
  testCase?: { id: string; title: string; status: string; framework: string };
}

export interface TestGroup {
  id: string;
  name: string;
  description?: string;
  runOnSchedule: boolean;
  createdAt: string;
  updatedAt: string;
  memberships?: TestGroupMember[];
}

interface ListTestGroupsResponse {
  testGroups: TestGroup[];
  total: number;
}

export interface GroupExecutionResult {
  testGroupId: string;
  testGroupName: string;
  results: Array<{
    testCaseId: string;
    testCaseTitle: string;
    executionId: string;
    status: 'passed' | 'failed' | 'healed' | 'error';
    duration: number;
    healed: boolean;
  }>;
  passed: number;
  failed: number;
  healed: number;
  total: number;
}

let authToken: string | null = null;

export function setAuthToken(token: string): void {
  authToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
}

async function fetchAPI<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = (await response.json()) as { error?: { message?: string } };
    throw new Error(errorBody.error?.message || 'API request failed');
  }

  return response.json() as Promise<T>;
}

export const api = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return fetchAPI<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async createRun(data: CreateRunRequest): Promise<CreateRunResponse> {
    return fetchAPI<CreateRunResponse>('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRun(runId: string): Promise<RunResponse> {
    return fetchAPI<RunResponse>(`/api/v1/runs/${runId}`);
  },

  async listRuns(params?: { status?: string; limit?: number; offset?: number }): Promise<ListRunsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString();
    return fetchAPI<ListRunsResponse>(`/api/v1/runs${query ? `?${query}` : ''}`);
  },

  async deleteRun(runId: string): Promise<{ deleted: boolean }> {
    return fetchAPI<{ deleted: boolean }>(`/api/v1/runs/${runId}`, { method: 'DELETE' });
  },

  async getReports(runId: string): Promise<ReportsResponse> {
    return fetchAPI<ReportsResponse>(`/api/v1/runs/${runId}/reports`);
  },

  async getReport(reportId: string): Promise<ReportResponse> {
    return fetchAPI<ReportResponse>(`/api/v1/reports/${reportId}`);
  },

  async listTestCases(runId: string): Promise<ListTestCasesResponse> {
    return fetchAPI<ListTestCasesResponse>(`/api/v1/runs/${runId}/test-cases`);
  },

  async getTestCase(id: string): Promise<TestCase> {
    return fetchAPI<TestCase>(`/api/v1/test-cases/${id}`);
  },

  async updateTestCase(id: string, data: UpdateTestCaseRequest): Promise<TestCase> {
    return fetchAPI<TestCase>(`/api/v1/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTestCase(id: string): Promise<{ deleted: boolean }> {
    return fetchAPI<{ deleted: boolean }>(`/api/v1/test-cases/${id}`, { method: 'DELETE' });
  },

  getTestCaseDownloadUrl(id: string): string {
    return `${API_BASE_URL}/api/v1/test-cases/${id}/download`;
  },

  async executeTestCase(id: string): Promise<ExecuteTestCaseResponse> {
    return fetchAPI<ExecuteTestCaseResponse>(`/api/v1/test-cases/${id}/execute`, { method: 'POST' });
  },

  async listTestExecutions(id: string): Promise<ListTestExecutionsResponse> {
    return fetchAPI<ListTestExecutionsResponse>(`/api/v1/test-cases/${id}/executions`);
  },

  async listSchedules(params?: { enabled?: boolean; limit?: number; offset?: number }): Promise<ListSchedulesResponse> {
    const searchParams = new URLSearchParams();
    if (params?.enabled !== undefined) searchParams.set('enabled', String(params.enabled));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString();
    return fetchAPI<ListSchedulesResponse>(`/api/v1/schedules${query ? `?${query}` : ''}`);
  },

  async createSchedule(data: CreateScheduleRequest): Promise<Schedule> {
    return fetchAPI<Schedule>('/api/v1/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSchedule(id: string, data: UpdateScheduleRequest): Promise<Schedule> {
    return fetchAPI<Schedule>(`/api/v1/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteSchedule(id: string): Promise<{ deleted: boolean }> {
    return fetchAPI<{ deleted: boolean }>(`/api/v1/schedules/${id}`, { method: 'DELETE' });
  },

  async listTestGroups(): Promise<ListTestGroupsResponse> {
    return fetchAPI<ListTestGroupsResponse>('/api/v1/test-groups');
  },

  async getTestGroup(id: string): Promise<TestGroup> {
    return fetchAPI<TestGroup>(`/api/v1/test-groups/${id}`);
  },

  async createTestGroup(data: { name: string; description?: string; runOnSchedule?: boolean }): Promise<TestGroup> {
    return fetchAPI<TestGroup>('/api/v1/test-groups', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateTestGroup(id: string, data: { name?: string; description?: string; runOnSchedule?: boolean }): Promise<TestGroup> {
    return fetchAPI<TestGroup>(`/api/v1/test-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async deleteTestGroup(id: string): Promise<{ deleted: boolean }> {
    return fetchAPI<{ deleted: boolean }>(`/api/v1/test-groups/${id}`, { method: 'DELETE' });
  },

  async addGroupMember(groupId: string, testCaseId: string, order?: number): Promise<TestGroup> {
    return fetchAPI<TestGroup>(`/api/v1/test-groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ testCaseId, order }),
    });
  },

  async removeGroupMember(groupId: string, testCaseId: string): Promise<TestGroup> {
    return fetchAPI<TestGroup>(`/api/v1/test-groups/${groupId}/members/${testCaseId}`, { method: 'DELETE' });
  },

  async executeTestGroup(groupId: string): Promise<GroupExecutionResult> {
    return fetchAPI<GroupExecutionResult>(`/api/v1/test-groups/${groupId}/execute`, { method: 'POST' });
  },

  async getUsage(): Promise<UsageSummary> {
    return fetchAPI<UsageSummary>('/api/v1/usage');
  },

  async resetUsage(): Promise<{ reset: boolean }> {
    return fetchAPI<{ reset: boolean }>('/api/v1/usage/reset', { method: 'POST' });
  },

  async downloadReportPDF(runId: string): Promise<Blob> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/runs/${runId}/reports/pdf`, {
      headers,
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as { error?: { message?: string } };
      throw new Error(errorBody.error?.message || 'PDF export failed');
    }

    return response.blob();
  },
};
