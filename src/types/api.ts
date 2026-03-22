/**
 * API error response types
 */

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ErrorCode =
  | 'INVALID_URL'
  | 'UNKNOWN_PERSONA'
  | 'UNAUTHORIZED'
  | 'RUN_NOT_FOUND'
  | 'REPORT_NOT_FOUND'
  | 'RUN_LIMIT_EXCEEDED'
  | 'AGENT_CRASH'
  | 'AI_TIMEOUT'
  | 'VALIDATION_ERROR';
