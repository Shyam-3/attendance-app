import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth';
import { AttendanceService } from '../services/attendanceService';

export default function apiRouter() {
  const router = Router();

  // Disable caching for all API routes to ensure 200 OK responses (not 304)
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  // Apply authentication to all routes
  router.use(authenticateUser);

  router.get('/attendance', async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const course = String(req.query.course || '');
    const threshold = Number(req.query.threshold || 75);
    const search = String(req.query.search || '');
    const excludeCoursesStr = String(req.query.exclude_courses || '');
    const excludeCourses = excludeCoursesStr ? excludeCoursesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const page = Number(req.query.page || 1);
    const perPage = Number(req.query.per_page || 100);

    try {
      const [records, total] = await Promise.all([
        AttendanceService.getFilteredAttendanceRecords(userId, course, threshold, search, excludeCourses, page, perPage),
        AttendanceService.getFilteredAttendanceCount(userId, course, threshold, search, excludeCourses)
      ]);

      // Format records for frontend (matches Python format_attendance_data_for_export)
      const formattedRecords = records.map((r: any, i: number) => ({
        id: r.id,
        'S.No': (page - 1) * perPage + i + 1,
        'Registration No': r.registration_no,
        'Student Name': r.student_name,
        'Course Code': r.course_code,
        'Course Name': r.course_name,
        'Attended Periods': r.attended_periods,
        'Conducted Periods': r.conducted_periods,
        'Attendance %': r.attendance_percentage
      }));

      res.status(200).json({
        records: formattedRecords,
        total,
        page,
        per_page: perPage,
        total_pages: perPage > 0 ? Math.ceil(total / perPage) : 0
      });
    } catch (err: any) {
      console.error('Error in /api/attendance:', err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get('/stats', async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
      const stats = await AttendanceService.calculateDashboardStats(userId);
      res.status(200).json(stats);
    } catch (err: any) {
      console.error('Error in /api/stats:', err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get('/filtered_stats', async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const course = String(req.query.course || '');
    const threshold = Number(req.query.threshold || 75);
    const search = String(req.query.search || '');
    const excludeCoursesStr = String(req.query.exclude_courses || '');
    const excludeCourses = excludeCoursesStr ? excludeCoursesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    try {
      const stats = await AttendanceService.calculateFilteredStats(userId, course, threshold, search, excludeCourses);
      res.status(200).json(stats);
    } catch (err: any) {
      console.error('Error in /api/filtered_stats:', err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get('/courses', async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
      const courses = await AttendanceService.getAllCourses(userId);
      res.status(200).json(courses.map((c: any) => ({ code: c.course_code, name: c.course_name })));
    } catch (err: any) {
      console.error('Error in /api/courses:', err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
