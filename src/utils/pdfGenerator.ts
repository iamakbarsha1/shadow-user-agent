import PDFDocument from 'pdfkit';

export interface Bug {
  id: string;
  title: string;
  severity: string;
  description: string;
  stepsToReproduce: string[];
  fixSuggestion: string;
}

export interface UXFriction {
  id: string;
  title: string;
  description: string;
  impactedPersona: string;
}

export interface BugReportContent {
  sessionSummary: string;
  bugs: Bug[];
  uxFrictionPoints: UXFriction[];
}

export interface CodeIssue {
  title: string;
  description: string;
  codeLocation?: string;
  suggestedFix: string;
}

export interface CodeReviewContent {
  overallAssessment: string;
  criticalIssues: CodeIssue[];
  improvements: CodeIssue[];
  positives: string[];
  recommendations: string[];
}

export interface RunData {
  runId: string;
  url: string;
  personaId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  observationCount: number;
}

/**
 * Generate a PDF report from bug report and code review data
 */
export async function generateReportPDF(
  run: RunData,
  bugReport?: BugReportContent,
  codeReview?: CodeReviewContent
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('Shadow User Agent - Test Report', { align: 'center' })
      .moveDown(0.5);

    // Run metadata
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Run ID: ${run.runId}`, { align: 'center' })
      .text(`URL: ${run.url}`, { align: 'center' })
      .text(`Persona: ${run.personaId.replace('_', ' ')}`, { align: 'center' })
      .text(`Status: ${run.status.toUpperCase()}`, { align: 'center' })
      .text(`Observations: ${run.observationCount}`, { align: 'center' })
      .moveDown(1);

    // Add horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Bug Report Section
    if (bugReport) {
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Bug Report', { underline: true })
        .moveDown(0.5);

      // Session Summary
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Session Summary:')
        .moveDown(0.2);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(bugReport.sessionSummary || 'No summary available.')
        .moveDown(1);

      // Bugs
      if (bugReport.bugs && bugReport.bugs.length > 0) {
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(`Bugs Found: ${bugReport.bugs.length}`)
          .moveDown(0.5);

        bugReport.bugs.forEach((bug, index) => {
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(`${index + 1}. ${bug.title} [${bug.severity}]`);
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(bug.description)
            .moveDown(0.3);

          if (bug.stepsToReproduce && bug.stepsToReproduce.length > 0) {
            doc.font('Helvetica-Bold').text('Steps to Reproduce:');
            bug.stepsToReproduce.forEach((step, i) => {
              doc.font('Helvetica').text(`  ${i + 1}. ${step}`);
            });
            doc.moveDown(0.3);
          }

          if (bug.fixSuggestion) {
            doc.font('Helvetica-Bold').text('Fix Suggestion:');
            doc.font('Helvetica-Oblique').text(bug.fixSuggestion);
          }

          doc.moveDown(0.5);
        });
      } else {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text('No bugs detected.')
          .moveDown(1);
      }

      // UX Friction Points
      if (bugReport.uxFrictionPoints && bugReport.uxFrictionPoints.length > 0) {
        doc.moveDown(0.5);
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(`UX Friction Points: ${bugReport.uxFrictionPoints.length}`)
          .moveDown(0.5);

        bugReport.uxFrictionPoints.forEach((friction, index) => {
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(`${index + 1}. ${friction.title}`);
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(friction.description)
            .text(`Impacted Persona: ${friction.impactedPersona?.replace('_', ' ') || 'N/A'}`)
            .moveDown(0.5);
        });
      }

      doc.moveDown(1);
    }

    // Add page break before code review
    doc.addPage();

    // Code Review Section
    if (codeReview) {
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Code Review', { underline: true })
        .moveDown(0.5);

      // Overall Assessment
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Overall Assessment:')
        .moveDown(0.2);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(codeReview.overallAssessment || 'No assessment available.')
        .moveDown(1);

      // Critical Issues
      if (codeReview.criticalIssues && codeReview.criticalIssues.length > 0) {
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#dc2626')
          .text(`Critical Issues: ${codeReview.criticalIssues.length}`)
          .moveDown(0.5);

        codeReview.criticalIssues.forEach((issue, index) => {
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(`${index + 1}. ${issue.title}`);
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(issue.description)
            .moveDown(0.3);

          if (issue.codeLocation) {
            doc.font('Helvetica-Oblique').text(`Location: ${issue.codeLocation}`);
            doc.moveDown(0.2);
          }

          if (issue.suggestedFix) {
            doc.font('Helvetica-Bold').text('Suggested Fix:');
            doc.font('Helvetica').text(issue.suggestedFix);
          }

          doc.moveDown(0.5);
        });

        doc.fillColor('#000000');
      }

      // Improvements
      if (codeReview.improvements && codeReview.improvements.length > 0) {
        doc.moveDown(0.5);
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#ea580c')
          .text(`Improvements: ${codeReview.improvements.length}`)
          .moveDown(0.5);

        codeReview.improvements.forEach((item, index) => {
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(`${index + 1}. ${item.title}`);
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(item.description)
            .moveDown(0.3);

          if (item.suggestedFix) {
            doc.font('Helvetica-Bold').text('Suggestion:');
            doc.font('Helvetica').text(item.suggestedFix);
          }

          doc.moveDown(0.5);
        });

        doc.fillColor('#000000');
      }

      // Positives
      if (codeReview.positives && codeReview.positives.length > 0) {
        doc.moveDown(0.5);
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#16a34a')
          .text('Positives:')
          .moveDown(0.5);

        codeReview.positives.forEach((positive) => {
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#000000')
            .text(`+ ${positive}`);
        });

        doc.fillColor('#000000');
        doc.moveDown(1);
      }

      // Recommendations
      if (codeReview.recommendations && codeReview.recommendations.length > 0) {
        doc.moveDown(0.5);
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Recommendations:')
          .moveDown(0.5);

        codeReview.recommendations.forEach((rec) => {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(`- ${rec}`);
        });
      }
    }

    // Footer with generation timestamp
    doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .text(
        `Generated by Shadow User Agent on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

    doc.end();
  });
}
