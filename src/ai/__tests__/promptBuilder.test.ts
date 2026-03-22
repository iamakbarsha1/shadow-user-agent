import { describe, it, expect } from 'vitest';
import { buildSessionAnalysisPrompt, buildCodeReviewPrompt } from '../promptBuilder';
import type { SessionLog } from '../../types/observation';
import type { AnalysisReport } from '../../types/report';

const mockSessionLog: SessionLog = {
  runId: 'run-001',
  url: 'https://example.com',
  personaId: 'new_user',
  startTime: '2026-01-01T00:00:00Z',
  endTime: '2026-01-01T00:01:00Z',
  observations: [
    {
      id: 'obs-001',
      eventType: 'console_error',
      timestamp: '2026-01-01T00:00:10Z',
      payload: { message: 'JS Error', url: 'https://example.com' },
    },
  ],
  screenshotPaths: ['/tmp/screenshot.png'],
  totalSteps: 5,
  status: 'complete',
};

const mockAnalysisReport: AnalysisReport = {
  sessionSummary: 'Session found 1 bug.',
  bugs: [
    {
      id: 'bug-001',
      title: 'Console error',
      severity: 'P2',
      description: 'JS error on load',
      stepsToReproduce: ['Open page', 'Check console'],
      observationId: 'obs-001',
      fixSuggestion: 'Fix the JS error',
    },
  ],
  uxFrictionPoints: [],
};

describe('buildSessionAnalysisPrompt', () => {
  it('should return an object with system and user properties', () => {
    const result = buildSessionAnalysisPrompt(mockSessionLog, 'A cautious new user');

    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
  });

  it('should include the persona context in the system prompt', () => {
    const personaContext = 'A cautious new user who reads carefully';
    const result = buildSessionAnalysisPrompt(mockSessionLog, personaContext);

    expect(result.system).toContain(personaContext);
  });

  it('should include the session log in the user prompt', () => {
    const result = buildSessionAnalysisPrompt(mockSessionLog, 'new_user');

    expect(result.user).toContain('run-001');
    expect(result.user).toContain('https://example.com');
  });

  it('should instruct Claude to respond with JSON only', () => {
    const result = buildSessionAnalysisPrompt(mockSessionLog, 'power_user');

    expect(result.system).toContain('JSON');
    expect(result.user).toContain('JSON');
  });

  it('should serialize the full session log as JSON in user prompt', () => {
    const result = buildSessionAnalysisPrompt(mockSessionLog, 'edge_case');
    const parsedLog = JSON.parse(result.user.replace('\n\nRespond with JSON only.', ''));

    expect(parsedLog.runId).toBe('run-001');
    expect(parsedLog.observations).toHaveLength(1);
  });
});

describe('buildCodeReviewPrompt', () => {
  it('should return an object with system and user properties', () => {
    const result = buildCodeReviewPrompt(mockAnalysisReport);

    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
  });

  it('should include instructions about code review in system prompt', () => {
    const result = buildCodeReviewPrompt(mockAnalysisReport);

    expect(result.system).toContain('JSON');
    expect(result.system).toContain('engineer');
  });

  it('should serialize the analysis report in user prompt', () => {
    const result = buildCodeReviewPrompt(mockAnalysisReport);

    expect(result.user).toContain('bug-001');
    expect(result.user).toContain('Session found 1 bug.');
  });

  it('should instruct Claude to respond with JSON only', () => {
    const result = buildCodeReviewPrompt(mockAnalysisReport);

    expect(result.user).toContain('JSON');
  });
});
