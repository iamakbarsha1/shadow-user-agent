const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface LoginResponse {
  token: string;
  expiresIn: number;
}

interface CreateRunRequest {
  url: string;
  personaId: string;
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

interface RunResponse {
  runId: string;
  url: string;
  personaId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  observationCount: number;
  reportIds: string[];
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
