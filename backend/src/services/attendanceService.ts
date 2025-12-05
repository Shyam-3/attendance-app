/**
 * AttendanceService - Direct pg implementation
 * Business logic for attendance calculations and data processing with caching
 */
import { query } from '../db';

interface DashboardStats {
  total_students: number;
  total_courses: number;
  low_attendance_count: number;
  critical_attendance_count: number;
}

interface FilteredStats extends DashboardStats {
  is_single_student: boolean;
  student_details: any;
  total_courses_in_system: number;
  course_details: any;
  student_course_info: any;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 60000; // 60 seconds
const cache = new Map<string, CacheEntry>();

export class AttendanceService {
  /**
   * Invalidate all cached data
   */
  static invalidateCache(): void {
    cache.clear();
  }

  /**
   * Get from cache or execute function
   */
  private static async cached<T>(key: string, fn: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) {
      return entry.data as T;
    }

    const data = await fn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Calculate dashboard statistics (overall)
   */
  static async calculateDashboardStats(userId: string): Promise<DashboardStats> {
    return this.cached(`dashboard_stats_${userId}`, async () => {
      const result = await query(
        `
        SELECT 
          COUNT(DISTINCT student_id) as total_students,
          COUNT(DISTINCT course_id) as total_courses,
          SUM(CASE WHEN attendance_percentage < 75 THEN 1 ELSE 0 END) as low_attendance_count,
          SUM(CASE WHEN attendance_percentage < 65 THEN 1 ELSE 0 END) as critical_attendance_count
        FROM attendance_records
        WHERE user_id = $1
        `,
        [userId]
      );

      const row = result.rows[0];
      return {
        total_students: parseInt(row.total_students) || 0,
        total_courses: parseInt(row.total_courses) || 0,
        low_attendance_count: parseInt(row.low_attendance_count) || 0,
        critical_attendance_count: parseInt(row.critical_attendance_count) || 0
      };
    }, 60000);
  }

  /**
   * Calculate filtered statistics
   */
  static async calculateFilteredStats(
    userId: string,
    courseCode?: string,
    threshold = 75,
    search?: string,
    excludeCourses?: string[]
  ): Promise<FilteredStats> {
    // Build WHERE clause
    const whereParts: string[] = ['a.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (courseCode) {
      whereParts.push(`c.course_code = $${paramIndex}`);
      params.push(courseCode);
      paramIndex++;
    }

    if (excludeCourses && excludeCourses.length > 0) {
      whereParts.push(`c.course_code NOT IN (${excludeCourses.map((_, i) => `$${paramIndex + i}`).join(',')})`);
      params.push(...excludeCourses);
      paramIndex += excludeCourses.length;
    }

    if (search) {
      whereParts.push(`(s.name ILIKE $${paramIndex} OR s.registration_no ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereParts.join(' AND ');

    // Get stats
    const statsResult = await query(
      `
      SELECT 
        COUNT(DISTINCT a.student_id) as total_students,
        COUNT(DISTINCT a.course_id) as total_courses,
        SUM(CASE WHEN a.attendance_percentage < 75 THEN 1 ELSE 0 END) as low_attendance_count,
        SUM(CASE WHEN a.attendance_percentage < 65 THEN 1 ELSE 0 END) as critical_attendance_count
      FROM attendance_records a
      JOIN students s ON a.student_id = s.id
      JOIN courses c ON a.course_id = c.id
      WHERE ${whereClause}
      `,
      params
    );

    const statsRow = statsResult.rows[0];
    const totalStudents = parseInt(statsRow.total_students) || 0;
    const totalCourses = parseInt(statsRow.total_courses) || 0;

    // Get total courses in system
    const totalCoursesResult = await query(
      'SELECT COUNT(*) as count FROM courses WHERE user_id = $1',
      [userId]
    );
    const totalCoursesInSystem = parseInt(totalCoursesResult.rows[0].count) || 0;

    // Get course details if filtering by course
    let courseDetails = null;
    if (courseCode) {
      const courseResult = await query(
        'SELECT course_code, course_name FROM courses WHERE user_id = $1 AND course_code = $2',
        [userId, courseCode]
      );
      if (courseResult.rows.length > 0) {
        const row = courseResult.rows[0];
        courseDetails = { code: row.course_code, name: row.course_name };
      }
    }

    // Get student details if search yields single student
    let studentDetails = null;
    let studentCourseInfo = null;
    if (search && totalStudents === 1) {
      const studentResult = await query(
        `
        SELECT DISTINCT a.student_id, s.name, s.registration_no, COUNT(DISTINCT a.course_id) as course_count
        FROM attendance_records a
        JOIN students s ON a.student_id = s.id
        JOIN courses c ON a.course_id = c.id
        WHERE ${whereClause}
        GROUP BY a.student_id, s.name, s.registration_no
        `,
        params
      );

      if (studentResult.rows.length > 0) {
        const row = studentResult.rows[0];
        studentDetails = {
          name: row.name,
          registration_no: row.registration_no
        };
        const courseCount = parseInt(row.course_count) || 0;
        studentCourseInfo = courseCode || `${courseCount} course${courseCount !== 1 ? 's' : ''}`;
      }
    }

    return {
      total_students: totalStudents,
      total_courses: totalCourses,
      low_attendance_count: parseInt(statsRow.low_attendance_count) || 0,
      critical_attendance_count: parseInt(statsRow.critical_attendance_count) || 0,
      is_single_student: !!search && totalStudents === 1,
      student_details: studentDetails,
      total_courses_in_system: totalCoursesInSystem,
      course_details: courseDetails,
      student_course_info: studentCourseInfo
    };
  }

  /**
   * Get filtered attendance records with pagination
   */
  static async getFilteredAttendanceRecords(
    userId: string,
    courseCode?: string,
    threshold = 75,
    search?: string,
    excludeCourses?: string[],
    page = 1,
    perPage = 100
  ) {
    const whereParts: string[] = ['a.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (courseCode) {
      whereParts.push(`c.course_code = $${paramIndex}`);
      params.push(courseCode);
      paramIndex++;
    }

    if (excludeCourses && excludeCourses.length > 0) {
      whereParts.push(`c.course_code NOT IN (${excludeCourses.map((_, i) => `$${paramIndex + i}`).join(',')})`);
      params.push(...excludeCourses);
      paramIndex += excludeCourses.length;
    }

    if (threshold < 100) {
      whereParts.push(`a.attendance_percentage < $${paramIndex}`);
      params.push(threshold);
      paramIndex++;
    }

    if (search) {
      whereParts.push(`(s.name ILIKE $${paramIndex} OR s.registration_no ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereParts.join(' AND ');
    const offset = (page - 1) * perPage;

    const result = await query(
      `
      SELECT 
        a.id,
        s.registration_no,
        s.name as student_name,
        c.course_code,
        c.course_name,
        a.attended_periods,
        a.conducted_periods,
        a.attendance_percentage
      FROM attendance_records a
      JOIN students s ON a.student_id = s.id
      JOIN courses c ON a.course_id = c.id
      WHERE ${whereClause}
      ORDER BY c.course_code ASC, a.attendance_percentage ASC, s.registration_no ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, perPage, offset]
    );

    return result.rows.map(row => ({
      id: row.id,
      registration_no: row.registration_no,
      student_name: row.student_name,
      course_code: row.course_code,
      course_name: row.course_name,
      attended_periods: row.attended_periods,
      conducted_periods: row.conducted_periods,
      attendance_percentage: Number(row.attendance_percentage.toFixed(1))
    }));
  }

  /**
   * Get count of filtered records
   */
  static async getFilteredAttendanceCount(
    userId: string,
    courseCode?: string,
    threshold = 75,
    search?: string,
    excludeCourses?: string[]
  ): Promise<number> {
    const whereParts: string[] = ['a.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (courseCode) {
      whereParts.push(`c.course_code = $${paramIndex}`);
      params.push(courseCode);
      paramIndex++;
    }

    if (excludeCourses && excludeCourses.length > 0) {
      whereParts.push(`c.course_code NOT IN (${excludeCourses.map((_, i) => `$${paramIndex + i}`).join(',')})`);
      params.push(...excludeCourses);
      paramIndex += excludeCourses.length;
    }

    if (threshold < 100) {
      whereParts.push(`a.attendance_percentage < $${paramIndex}`);
      params.push(threshold);
      paramIndex++;
    }

    if (search) {
      whereParts.push(`(s.name ILIKE $${paramIndex} OR s.registration_no ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereParts.join(' AND ');

    const result = await query(
      `
      SELECT COUNT(*) as count
      FROM attendance_records a
      JOIN students s ON a.student_id = s.id
      JOIN courses c ON a.course_id = c.id
      WHERE ${whereClause}
      `,
      params
    );

    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Get all courses sorted alphabetically
   */
  static async getAllCourses(userId: string) {
    return this.cached(`all_courses_${userId}`, async () => {
      const result = await query(
        'SELECT id, course_code, course_name FROM courses WHERE user_id = $1 ORDER BY course_code ASC',
        [userId]
      );
      return result.rows;
    }, 300000);
  }

  /**
   * Delete attendance record
   */
  static async deleteAttendanceRecord(userId: string, recordId: number): Promise<boolean> {
    try {
      const result = await query(
        'DELETE FROM attendance_records WHERE id = $1 AND user_id = $2',
        [recordId, userId]
      );
      AttendanceService.invalidateCache();
      return (result as any).rowCount > 0;
    } catch (err) {
      console.error(`Error deleting record: ${err}`);
      return false;
    }
  }

  /**
   * Clear all data for a user
   */
  static async clearAllData(userId: string): Promise<boolean> {
    try {
      await query('DELETE FROM attendance_records WHERE user_id = $1', [userId]);
      await query('DELETE FROM students WHERE user_id = $1', [userId]);
      await query('DELETE FROM courses WHERE user_id = $1', [userId]);
      AttendanceService.invalidateCache();
      return true;
    } catch (err) {
      console.error(`Error clearing data: ${err}`);
      return false;
    }
  }

  /**
   * Format attendance data for export
   */
  static formatAttendanceDataForExport(records: any[]) {
    return records.map((r, i) => ({
      id: r.id,
      'S.No': i + 1,
      'Registration No': r.registration_no,
      'Student Name': r.student_name,
      'Course Code': r.course_code,
      'Course Name': r.course_name,
      'Attended Periods': r.attended_periods,
      'Conducted Periods': r.conducted_periods,
      'Attendance %': Number(r.attendance_percentage.toFixed(1))
    }));
  }
}