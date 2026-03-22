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

let authToken: string | null = null;

export function setAuthToken(token: string) {
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

async function fetchAPI(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }

  return response.json();
}

export const api = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async createRun(data: CreateRunRequest) {
    return fetchAPI('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRun(runId: string) {
    return fetchAPI(`/api/v1/runs/${runId}`);
  },

  async listRuns(params?: { status?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return fetchAPI(`/api/v1/runs${query ? `?${query}` : ''}`);
  },

  async deleteRun(runId: string) {
    return fetchAPI(`/api/v1/runs/${runId}`, { method: 'DELETE' });
  },
};
