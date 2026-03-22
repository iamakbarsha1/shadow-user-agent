/**
 * Report-related type definitions
 */

export type ReportType = 'bug_report' | 'ux_friction' | 'code_review';

export type BugSeverity = 'P1' | 'P2' | 'P3' | 'P4';

export interface Bug {
  id: string;
  title: string;
  severity: BugSeverity;
  description: string;
  stepsToReproduce: string[];
  observationId: string;
  screenshotRef?: string;
  fixSuggestion: string;
}

export interface UXFriction {
  id: string;
  title: string;
  description: string;
  impactedPersona: string;
  observationId: string;
  screenshotRef?: string;
}

export interface AnalysisReport {
  sessionSummary: string;
  bugs: Bug[];
  uxFrictionPoints: UXFriction[];
}

export interface CodeIssue {
  title: string;
  description: string;
  linkedBugId?: string;
  codeLocation?: string;
  suggestedFix: string;
}

export interface CodeReviewReport {
  overallAssessment: string;
  criticalIssues: CodeIssue[];
  improvements: CodeIssue[];
  positives: string[];
  recommendations: string[];
}

export interface GetReportResponse {
  reportId: string;
  runId: string;
  reportType: ReportType;
  content: AnalysisReport | CodeReviewReport;
  createdAt: string;
}

export interface GetReportsResponse {
  runId: string;
  reports: {
    reportId: string;
    reportType: ReportType;
    content: AnalysisReport | CodeReviewReport;
    createdAt: string;
  }[];
}
