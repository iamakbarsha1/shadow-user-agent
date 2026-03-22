import type { SessionLog } from '../types/observation';
import type { AnalysisReport } from '../types/report';

export function buildSessionAnalysisPrompt(
  sessionLog: SessionLog,
  personaContext: string
): { system: string; user: string } {
  const system = `You are a QA analyst. Respond with ONLY a JSON object—nothing else, no markdown.

Persona: ${personaContext}

Rules:
- Only report issues supported by session data
- P1=blocks user, P2=significant, P3=minor, P4=suggestion
- Response must be valid JSON starting with { and ending with }
- NO CODE FENCES, NO MARKDOWN, NO EXPLANATIONS

{"sessionSummary":"","bugs":[],"uxFrictionPoints":[]}`;

  const user = `${JSON.stringify(sessionLog, null, 2)}\n\nRespond with JSON only.`;

  return { system, user };
}

export function buildCodeReviewPrompt(analysisReport: AnalysisReport): {
  system: string;
  user: string;
} {
  const system = `You are a senior engineer. Respond with ONLY JSON—nothing else, no markdown.

Rules:
- Response must be valid JSON starting with { and ending with }
- NO CODE FENCES, NO MARKDOWN, NO EXPLANATIONS

{"overallAssessment":"","criticalIssues":[],"improvements":[],"positives":[],"recommendations":[]}`;

  const user = `${JSON.stringify(analysisReport, null, 2)}\n\nRespond with JSON only.`;

  return { system, user };
}
