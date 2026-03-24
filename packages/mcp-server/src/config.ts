/**
 * MCP Server configuration — loaded from environment variables
 */
export interface ShadowConfig {
  apiUrl: string;
  apiKey: string;
}

export function loadConfig(): ShadowConfig {
  const apiUrl = process.env.SHADOW_API_URL ?? 'http://localhost:4000';
  const apiKey = process.env.SHADOW_API_KEY ?? '';

  if (!apiKey) {
    throw new Error(
      'SHADOW_API_KEY environment variable is required. ' +
      'Generate one with: POST /auth/api-key'
    );
  }

  return { apiUrl, apiKey };
}
