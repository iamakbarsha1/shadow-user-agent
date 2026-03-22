import { z } from 'zod';
import type { AnalysisReport, CodeReviewReport } from '../types/report';
import type { SessionLog } from '../types/observation';
import { logger } from '../utils/logger';

const BugSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['P1', 'P2', 'P3', 'P4']),
  description: z.string(),
  stepsToReproduce: z.array(z.string()),
  observationId: z.string(),
  screenshotRef: z.string().optional(),
  fixSuggestion: z.string(),
});

const UXFrictionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  impactedPersona: z.string(),
  observationId: z.string(),
  screenshotRef: z.string().optional(),
});

const AnalysisReportSchema = z.object({
  sessionSummary: z.string(),
  bugs: z.array(BugSchema),
  uxFrictionPoints: z.array(UXFrictionSchema),
});

const CodeIssueSchema = z.object({
  title: z.string(),
  description: z.string(),
  linkedBugId: z.string().optional(),
  codeLocation: z.string().optional(),
  suggestedFix: z.string(),
});

const CodeReviewReportSchema = z.object({
  overallAssessment: z.string(),
  criticalIssues: z.array(CodeIssueSchema),
  improvements: z.array(CodeIssueSchema),
  positives: z.array(z.string()),
  recommendations: z.array(z.string()),
});

/**
 * Strips markdown code fences from JSON responses.
 * Handles both ```json ... ``` and ``` ... ``` formats.
 */
function stripMarkdownCodeFences(response: string): string {
  const trimmed = response.trim();

  // Remove markdown code fence wrapper if present
  if (trimmed.startsWith('```')) {
    // Find the closing ```
    const endIndex = trimmed.lastIndexOf('```');
    if (endIndex > 3) {
      // Extract content between fences
      let content = trimmed.slice(3, endIndex).trim();
      // Remove language identifier if present (e.g., "json\n" at the start)
      const firstNewline = content.indexOf('\n');
      if (firstNewline >= 0) {
        const beforeNewline = content.substring(0, firstNewline).trim();
        // If there's no { before the newline, it's the language identifier
        if (!beforeNewline.includes('{')) {
          content = content.slice(firstNewline + 1).trim();
        }
      }
      return content;
    }
  }

  return trimmed;
}

/**
 * Extracts JSON from response, even if wrapped in markdown.
 * Finds the first { and last } to extract the JSON object.
 */
function extractJSON(response: string): string {
  const cleaned = stripMarkdownCodeFences(response);
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

export function parseAnalysisReport(response: string, sessionLog: SessionLog): AnalysisReport {
  try {
    const jsonString = extractJSON(response);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = JSON.parse(jsonString) as unknown;
    const validated = AnalysisReportSchema.parse(json);

    // Hallucination guard: remove bugs with invalid observationIds
    const validObservationIds = new Set(sessionLog.observations.map((o) => o.id));

    validated.bugs = validated.bugs.filter((bug) => {
      if (!validObservationIds.has(bug.observationId)) {
        logger.warn({ bugId: bug.id }, 'Discarding bug with invalid observationId');
        return false;
      }
      return true;
    });

    validated.uxFrictionPoints = validated.uxFrictionPoints.filter((friction) => {
      if (!validObservationIds.has(friction.observationId)) {
        logger.warn(
          { frictionId: friction.id },
          'Discarding UX friction with invalid observationId'
        );
        return false;
      }
      return true;
    });

    return validated;
  } catch (error) {
    logger.warn(
      { error, response: response.substring(0, 200) },
      'Failed to parse analysis report, generating default'
    );

    // Generate default report when parsing fails (e.g., incomplete JSON from token limit)
    return {
      sessionSummary:
        'Session completed but detailed analysis could not be generated due to token limits. The session log is available for manual review.',
      bugs: [],
      uxFrictionPoints: [],
    };
  }
}

export function parseCodeReviewReport(response: string): CodeReviewReport {
  try {
    const jsonString = extractJSON(response);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = JSON.parse(jsonString) as unknown;
    return CodeReviewReportSchema.parse(json);
  } catch (error) {
    logger.warn(
      { error, response: response.substring(0, 200) },
      'Failed to parse code review report, generating default'
    );

    // Generate default report when parsing fails
    return {
      overallAssessment:
        'Code review could not be completed due to token limits. Please review the QA findings manually.',
      criticalIssues: [],
      improvements: [],
      positives: [],
      recommendations: [],
    };
  }
}
