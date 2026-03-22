import { Router, type Request, type Response, type NextFunction } from 'express';
import { findReportById } from '../../db/queries/reports';
import { ReportNotFoundError } from '../../utils/errors';

const router = Router();

/**
 * GET /api/v1/reports/:reportId
 * Fetch a single report by ID
 */
router.get('/:reportId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reportId = String(req.params['reportId']);

    const report = await findReportById(reportId);
    if (!report) {
      throw new ReportNotFoundError(reportId);
    }

    res.status(200).json({
      reportId: report.id,
      runId: report.runId,
      reportType: report.reportType,
      content: report.content,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
