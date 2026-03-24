import type { ShadowConfig } from './config';

/**
 * HTTP client wrapping the Shadow User Agent API
 */
export class ShadowApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ShadowConfig) {
    this.baseUrl = config.apiUrl;
    this.apiKey = config.apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        ...(options.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Shadow API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async createRun(url: string, personaId: string, options?: {
    maxSteps?: number;
    generateTests?: boolean;
    prd?: string;
  }) {
    return this.request<{ runId: string; status: string; startedAt: string }>('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify({ url, personaId, ...options }),
    });
  }

  async getRun(runId: string) {
    return this.request<{
      runId: string;
      url: string;
      personaId: string;
      status: string;
      startedAt: string;
      completedAt?: string;
      observationCount: number;
      reportIds: string[];
    }>(`/api/v1/runs/${runId}`);
  }

  async getReports(runId: string) {
    return this.request<{
      runId: string;
      reports: Array<{ reportId: string; reportType: string; content: unknown; createdAt: string }>;
    }>(`/api/v1/runs/${runId}/reports`);
  }

  async getReport(reportId: string) {
    return this.request<{
      reportId: string;
      runId: string;
      reportType: string;
      content: unknown;
      createdAt: string;
    }>(`/api/v1/reports/${reportId}`);
  }

  async listTestCases(runId: string) {
    return this.request<{
      runId: string;
      testCases: Array<{
        id: string;
        title: string;
        description?: string;
        testCode: string;
        status: string;
        framework: string;
        createdAt: string;
      }>;
      total: number;
    }>(`/api/v1/runs/${runId}/test-cases`);
  }

  async getTestCase(id: string) {
    return this.request<{
      id: string;
      runId: string;
      title: string;
      testCode: string;
      status: string;
    }>(`/api/v1/test-cases/${id}`);
  }

  async pollRunUntilComplete(runId: string, timeoutMs = 300000): Promise<{ status: string }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const run = await this.getRun(runId);
      if (run.status === 'complete' || run.status === 'failed') {
        return run;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error(`Run ${runId} did not complete within ${timeoutMs}ms`);
  }
}
