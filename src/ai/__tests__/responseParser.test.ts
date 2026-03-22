import { describe, it, expect, vi } from 'vitest';
import { parseAnalysisReport, parseCodeReviewReport } from '../responseParser';
import type { SessionLog } from '../../types/observation';

// Suppress logger output in tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

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
      payload: { message: 'Error', url: 'https://example.com' },
    },
  ],
  screenshotPaths: [],
  totalSteps: 5,
  status: 'complete',
};

const validBugReport = {
  sessionSummary: 'Session completed with 1 bug found.',
  bugs: [
    {
      id: 'bug-001',
      title: 'Console error on load',
      severity: 'P2',
      description: 'Error appears on page load',
      stepsToReproduce: ['Open the page', 'Check console'],
      observationId: 'obs-001',
      fixSuggestion: 'Fix the JavaScript error',
    },
  ],
  uxFrictionPoints: [
    {
      id: 'ux-001',
      title: 'Slow load',
      description: 'Page loads slowly',
      impactedPersona: 'new_user',
      observationId: 'obs-001',
    },
  ],
};

const validCodeReview = {
  overallAssessment: 'Code quality is acceptable.',
  criticalIssues: [
    {
      title: 'Memory leak',
      description: 'Event listeners not cleaned up',
      suggestedFix: 'Add cleanup in useEffect return',
    },
  ],
  improvements: [],
  positives: ['Good error boundaries'],
  recommendations: ['Add TypeScript strict mode'],
};

describe('parseAnalysisReport', () => {
  it('should parse a valid JSON analysis report', () => {
    const response = JSON.stringify(validBugReport);
    const result = parseAnalysisReport(response, mockSessionLog);

    expect(result.sessionSummary).toBe(validBugReport.sessionSummary);
    expect(result.bugs).toHaveLength(1);
    expect(result.bugs[0].id).toBe('bug-001');
    expect(result.uxFrictionPoints).toHaveLength(1);
  });

  it('should parse JSON wrapped in markdown code fences', () => {
    const response = `\`\`\`json\n${JSON.stringify(validBugReport)}\n\`\`\``;
    const result = parseAnalysisReport(response, mockSessionLog);

    expect(result.sessionSummary).toBe(validBugReport.sessionSummary);
    expect(result.bugs).toHaveLength(1);
  });

  it('should parse JSON wrapped in generic code fences', () => {
    const response = `\`\`\`\n${JSON.stringify(validBugReport)}\n\`\`\``;
    const result = parseAnalysisReport(response, mockSessionLog);

    expect(result.sessionSummary).toBe(validBugReport.sessionSummary);
  });

  it('should apply hallucination guard and discard bugs with invalid observationIds', () => {
    const reportWithInvalidObs = {
      ...validBugReport,
      bugs: [
        ...validBugReport.bugs,
        {
          id: 'bug-002',
          title: 'Fake bug',
          severity: 'P3',
          description: 'References non-existent observation',
          stepsToReproduce: ['Step 1'],
          observationId: 'obs-INVALID',
          fixSuggestion: 'N/A',
        },
      ],
    };

    const result = parseAnalysisReport(JSON.stringify(reportWithInvalidObs), mockSessionLog);

    expect(result.bugs).toHaveLength(1);
    expect(result.bugs[0].id).toBe('bug-001');
  });

  it('should apply hallucination guard and discard UX friction with invalid observationIds', () => {
    const reportWithInvalidUX = {
      ...validBugReport,
      uxFrictionPoints: [
        ...validBugReport.uxFrictionPoints,
        {
          id: 'ux-bad',
          title: 'Invalid friction',
          description: 'Points to fake obs',
          impactedPersona: 'new_user',
          observationId: 'obs-FAKE',
        },
      ],
    };

    const result = parseAnalysisReport(JSON.stringify(reportWithInvalidUX), mockSessionLog);

    expect(result.uxFrictionPoints).toHaveLength(1);
    expect(result.uxFrictionPoints[0].id).toBe('ux-001');
  });

  it('should return a default report when JSON is invalid', () => {
    const result = parseAnalysisReport('not valid json at all', mockSessionLog);

    expect(result.sessionSummary).toContain('token limits');
    expect(result.bugs).toHaveLength(0);
    expect(result.uxFrictionPoints).toHaveLength(0);
  });

  it('should return a default report when schema validation fails', () => {
    const invalidSchema = { sessionSummary: 'ok', bugs: 'not-an-array' };
    const result = parseAnalysisReport(JSON.stringify(invalidSchema), mockSessionLog);

    expect(result.bugs).toHaveLength(0);
  });

  it('should handle JSON embedded in surrounding text', () => {
    const response = `Here is the analysis:\n${JSON.stringify(validBugReport)}\nEnd of analysis.`;
    const result = parseAnalysisReport(response, mockSessionLog);

    expect(result.sessionSummary).toBe(validBugReport.sessionSummary);
  });

  it('should keep all valid bugs when all observationIds are valid', () => {
    const result = parseAnalysisReport(JSON.stringify(validBugReport), mockSessionLog);

    expect(result.bugs).toHaveLength(1);
    expect(result.uxFrictionPoints).toHaveLength(1);
  });
});

describe('parseCodeReviewReport', () => {
  it('should parse a valid code review JSON response', () => {
    const result = parseCodeReviewReport(JSON.stringify(validCodeReview));

    expect(result.overallAssessment).toBe(validCodeReview.overallAssessment);
    expect(result.criticalIssues).toHaveLength(1);
    expect(result.criticalIssues[0].title).toBe('Memory leak');
    expect(result.improvements).toHaveLength(0);
    expect(result.positives).toContain('Good error boundaries');
    expect(result.recommendations).toContain('Add TypeScript strict mode');
  });

  it('should parse code review wrapped in markdown fences', () => {
    const response = `\`\`\`json\n${JSON.stringify(validCodeReview)}\n\`\`\``;
    const result = parseCodeReviewReport(response);

    expect(result.overallAssessment).toBe(validCodeReview.overallAssessment);
  });

  it('should return a default report when JSON is invalid', () => {
    const result = parseCodeReviewReport('invalid json!!!');

    expect(result.overallAssessment).toContain('token limits');
    expect(result.criticalIssues).toHaveLength(0);
    expect(result.improvements).toHaveLength(0);
    expect(result.positives).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
  });

  it('should return a default report when schema is invalid', () => {
    const invalid = { overallAssessment: 'ok', criticalIssues: 'wrong-type' };
    const result = parseCodeReviewReport(JSON.stringify(invalid));

    expect(result.criticalIssues).toHaveLength(0);
  });

  it('should handle optional fields in CodeIssue', () => {
    const withOptionals = {
      ...validCodeReview,
      criticalIssues: [
        {
          title: 'Issue with location',
          description: 'Details here',
          linkedBugId: 'bug-001',
          codeLocation: 'src/app.ts:42',
          suggestedFix: 'Fix it',
        },
      ],
    };

    const result = parseCodeReviewReport(JSON.stringify(withOptionals));

    expect(result.criticalIssues[0].linkedBugId).toBe('bug-001');
    expect(result.criticalIssues[0].codeLocation).toBe('src/app.ts:42');
  });
});
