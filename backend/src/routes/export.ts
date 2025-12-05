import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth';
import { AttendanceService } from '../services/attendanceService';
import { ExportUtils } from '../utils/exportUtils';

export default function exportRouter() {
  const router = Router();
  const exportUtils = new ExportUtils();

  // Apply authentication to all routes
  router.use(authenticateUser);

  router.post('/excel', async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const course = String(req.body.course || '').trim();
      const threshold = Number(req.body.threshold || 75);
      const search = String(req.body.search || '').trim();
      const excludeCoursesStr = String(req.body.exclude_courses || '').trim();
      const excludeCourses = excludeCoursesStr ? excludeCoursesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

      // Get filtered records using service (get all records for export - use high limit)
      const records = await AttendanceService.getFilteredAttendanceRecords(
        userId,
        course,
        threshold >= 100 ? 101 : threshold,
        search,
        excludeCourses,
        1,
        999999 // Get all records for export
      );

      console.log(`Exporting ${records.length} records to Excel`);

      // Prepare filter info for filename (exclude exclude_courses from display)
      const filterInfo: string[] = [];
      if (course) filterInfo.push(`Course: ${course}`);
      if (threshold < 100) filterInfo.push(`Attendance below: ${threshold}.0%`);
      if (search) filterInfo.push(`Search: ${search}`);

      console.log('Excel export - Request body:', req.body);
      console.log('Excel export - filterInfo:', filterInfo);

      // Generate Excel
      const { buffer, filename } = await exportUtils.generateExcelExport(records, filterInfo);
      console.log('Excel export - Generated filename:', filename);
      exportUtils.sendExcelResponse(res, buffer, filename);
    } catch (err: any) {
      console.error('Excel export error:', err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post('/pdf', async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const course = String(req.body.course || '').trim();
      const threshold = Number(req.body.threshold || 75);
      const search = String(req.body.search || '').trim();
      const excludeCoursesStr = String(req.body.exclude_courses || '').trim();
      const excludeCourses = excludeCoursesStr ? excludeCoursesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

      // Get filtered records using service (get all records for export - use high limit)
      const records = await AttendanceService.getFilteredAttendanceRecords(
        userId,
        course,
        threshold >= 100 ? 101 : threshold,
        search,
        excludeCourses,
        1,
        999999 // Get all records for export
      );

      console.log(`Exporting ${records.length} records to PDF`);

      // Prepare filter info for filename (exclude exclude_courses from display)
      const filterInfo: string[] = [];
      if (course) filterInfo.push(`Course: ${course}`);
      if (threshold < 100) filterInfo.push(`Attendance below: ${threshold}.0%`);
      if (search) filterInfo.push(`Search: ${search}`);

      console.log('PDF export - Request body:', req.body);
      console.log('PDF export - filterInfo:', filterInfo);

      // Generate PDF
      const { buffer, filename } = await exportUtils.generatePdfExport(records, filterInfo);
      console.log('PDF export - Generated filename:', filename);
      exportUtils.sendPdfResponse(res, buffer, filename);
    } catch (err: any) {
      console.error('PDF export error:', err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
