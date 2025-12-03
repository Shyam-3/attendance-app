import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { AttendanceService } from '../services/attendanceService';
import { ExportUtils } from '../utils/exportUtils';

export default function exportRouter(prisma: PrismaClient) {
  const router = Router();
  const attendanceService = new AttendanceService(prisma);
  const exportUtils = new ExportUtils();

  router.get('/excel', async (req, res) => {
    try {
      const course = String(req.query.course || '');
      const threshold = Number(req.query.threshold || 75);
      const search = String(req.query.search || '');
      const excludeCoursesStr = String(req.query.exclude_courses || '');
      const excludeCourses = excludeCoursesStr ? excludeCoursesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

      // Get filtered records using service
      const records = await attendanceService.getFilteredAttendanceRecords(
        course,
        threshold >= 100 ? 101 : threshold,
        search,
        excludeCourses,
        1,
        0 // Get all records
      );

      // Prepare filter info (exclude "Excluded" courses from display)
      const filterInfo: string[] = [];
      if (course) filterInfo.push(`Course: ${course}`);
      if (threshold < 100) filterInfo.push(`Attendance below: ${threshold}%`);
      if (search) filterInfo.push(`Search: ${search}`);

      // Generate Excel
      const { buffer, filename } = await exportUtils.generateExcelExport(records, filterInfo);
      exportUtils.sendExcelResponse(res, buffer, filename);
    } catch (err: any) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get('/pdf', async (req, res) => {
    try {
      const course = String(req.query.course || '');
      const threshold = Number(req.query.threshold || 75);
      const search = String(req.query.search || '');
      const excludeCoursesStr = String(req.query.exclude_courses || '');
      const excludeCourses = excludeCoursesStr ? excludeCoursesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

      // Get filtered records using service
      const records = await attendanceService.getFilteredAttendanceRecords(
        course,
        threshold >= 100 ? 101 : threshold,
        search,
        excludeCourses,
        1,
        0 // Get all records
      );

      // Prepare filter info (exclude "Excluded" courses from display)
      const filterInfo: string[] = [];
      if (course) filterInfo.push(`Course: ${course}`);
      if (threshold < 100) filterInfo.push(`Attendance below: ${threshold}%`);
      if (search) filterInfo.push(`Search: ${search}`);

      // Generate PDF
      const { buffer, filename } = await exportUtils.generatePdfExport(records, filterInfo);
      exportUtils.sendPdfResponse(res, buffer, filename);
    } catch (err: any) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
