/**
 * Custom error classes for the Shadow User Agent.
 * All errors thrown in the application should extend one of these classes.
 */

export class InvalidUrlError extends Error {
  code = 'INVALID_URL';
  constructor(url: string) {
    super(`URL is invalid or not reachable: ${url}`);
    this.name = 'InvalidUrlError';
  }
}

export class UnknownPersonaError extends Error {
  code = 'UNKNOWN_PERSONA';
  constructor(personaId: string) {
    super(`Unknown persona ID: ${personaId}`);
    this.name = 'UnknownPersonaError';
  }
}

export class RunNotFoundError extends Error {
  code = 'RUN_NOT_FOUND';
  constructor(runId: string) {
    super(`Run not found: ${runId}`);
    this.name = 'RunNotFoundError';
  }
}

export class ReportNotFoundError extends Error {
  code = 'REPORT_NOT_FOUND';
  constructor(reportId: string) {
    super(`Report not found: ${reportId}`);
    this.name = 'ReportNotFoundError';
  }
}

export class UnauthorizedError extends Error {
  code = 'UNAUTHORIZED';
  constructor(message = 'Missing or invalid authentication token') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class RunLimitExceededError extends Error {
  code = 'RUN_LIMIT_EXCEEDED';
  constructor() {
    super('User has too many active runs');
    this.name = 'RunLimitExceededError';
  }
}

export class AgentCrashError extends Error {
  code = 'AGENT_CRASH';
  constructor(message: string) {
    super(`Agent process exited unexpectedly: ${message}`);
    this.name = 'AgentCrashError';
  }
}

export class AITimeoutError extends Error {
  code = 'AI_TIMEOUT';
  constructor() {
    super('Claude API did not respond within timeout period');
    this.name = 'AITimeoutError';
  }
}

export class InsufficientCreditsError extends Error {
  code = 'INSUFFICIENT_CREDITS';
  availableTokens: number;
  constructor(availableTokens: number) {
    super(`Insufficient OpenRouter credits: can only afford ${availableTokens} tokens`);
    this.name = 'InsufficientCreditsError';
    this.availableTokens = availableTokens;
  }
}

export class TestCaseNotFoundError extends Error {
  code = 'TEST_CASE_NOT_FOUND';
  constructor(id: string) {
    super(`Test case not found: ${id}`);
    this.name = 'TestCaseNotFoundError';
  }
}

export class ScheduleNotFoundError extends Error {
  code = 'SCHEDULE_NOT_FOUND';
  constructor(id: string) {
    super(`Schedule not found: ${id}`);
    this.name = 'ScheduleNotFoundError';
  }
}
