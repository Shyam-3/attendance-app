/**
 * AttendanceService - TypeScript port of backend/services/attendance_service.py
 * Business logic for attendance calculations and data processing with caching
 */
import type { PrismaClient } from '@prisma/client';

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
  constructor(private prisma: PrismaClient) {}

  /**
   * Invalidate all cached data
   */
  static invalidateCache(): void {
    cache.clear();
  }

  /**
   * Get from cache or execute function
   */
  private async cached<T>(key: string, fn: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
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
   * Python: db.session.query(func.count(distinct(Student.id)), func.count(distinct(Course.id)))
   *         .select_from(AttendanceRecord).join(Student).join(Course).first()
   */
  async calculateDashboardStats(): Promise<DashboardStats> {
    return this.cached('dashboard_stats', async () => {
      // Count DISTINCT student_ids and course_ids from attendance_records ONLY
      // This matches Python's SQL aggregation exactly
      const [studentIds, courseIds, lowAttendance, criticalAttendance] = await Promise.all([
        this.prisma.attendanceRecord.groupBy({
          by: ['student_id']
        }),
        this.prisma.attendanceRecord.groupBy({
          by: ['course_id']
        }),
        this.prisma.attendanceRecord.count({ where: { attendance_percentage: { lt: 75 } } }),
        this.prisma.attendanceRecord.count({ where: { attendance_percentage: { lt: 65 } } })
      ]);

      return {
        total_students: studentIds.length,
        total_courses: courseIds.length,
        low_attendance_count: lowAttendance,
        critical_attendance_count: criticalAttendance
      };
    }, 60000); // Cache for 1 minute (Python uses 60 seconds)
  }

  /**
   * Calculate filtered statistics
   * Python: Uses SQL aggregation with func.count(distinct(AttendanceRecord.student_id/course_id))
   * NOTE: Threshold is NOT used for stats aggregation - only course, search, exclude_courses
   * Includes student_details when search yields single student
   */
  async calculateFilteredStats(
    courseCode?: string,
    threshold = 75,
    search?: string,
    excludeCourses?: string[]
  ): Promise<FilteredStats> {
    // Build where clause WITHOUT threshold (Python doesn't use threshold for stats aggregation)
    const where = this.buildWhereClause(courseCode, 100, search, excludeCourses);

    // Count distinct students and courses using groupBy (matches Python SQL aggregation)
    const [studentIds, courseIds, lowAttendance, criticalAttendance, totalCoursesInSystem] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['student_id'],
        where
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['course_id'],
        where
      }),
      this.prisma.attendanceRecord.count({ where: { ...where, attendance_percentage: { lt: 75 } } }),
      this.prisma.attendanceRecord.count({ where: { ...where, attendance_percentage: { lt: 65 } } }),
      this.cached('total_courses_count', () => this.prisma.course.count(), 300000)
    ]);

    const totalStudents = studentIds.length;
    const totalCourses = courseIds.length;

    // Get course details if filtering by course
    let courseDetails = null;
    if (courseCode) {
      const course = await this.prisma.course.findFirst({ where: { course_code: courseCode } });
      if (course) {
        courseDetails = { code: course.course_code, name: course.course_name };
      }
    }

    // Get student details if search yields single student (matches Python logic)
    let studentDetails = null;
    let studentCourseInfo = null;
    if (search && totalStudents === 1) {
      const studentRecord = await this.prisma.attendanceRecord.groupBy({
        by: ['student_id'],
        where,
        _count: {
          course_id: true
        }
      });

      if (studentRecord.length > 0) {
        const student = await this.prisma.student.findUnique({
          where: { id: studentRecord[0].student_id }
        });
        
        if (student) {
          studentDetails = {
            name: student.name,
            registration_no: student.registration_no
          };
          const courseCount = studentRecord[0]._count.course_id;
          studentCourseInfo = courseCode || `${courseCount} course${courseCount !== 1 ? 's' : ''}`;
        }
      }
    }

    return {
      total_students: totalStudents,
      total_courses: totalCourses,
      low_attendance_count: lowAttendance,
      critical_attendance_count: criticalAttendance,
      is_single_student: !!search && totalStudents === 1,
      student_details: studentDetails,
      total_courses_in_system: totalCoursesInSystem as number,
      course_details: courseDetails,
      student_course_info: studentCourseInfo
    };
  }

  /**
   * Get filtered attendance records with pagination
   */
  async getFilteredAttendanceRecords(
    courseCode?: string,
    threshold = 75,
    search?: string,
    excludeCourses?: string[],
    page = 1,
    perPage = 100
  ) {
    const where = this.buildWhereClause(courseCode, threshold, search, excludeCourses);

    const results = await this.prisma.attendanceRecord.findMany({
      where,
      include: { student: true, course: true },
      orderBy: [
        { course: { course_code: 'asc' } },
        { attendance_percentage: 'asc' },
        { student: { registration_no: 'asc' } }
      ],
      skip: perPage > 0 ? (page - 1) * perPage : undefined,
      take: perPage > 0 ? perPage : undefined
    });

    return results.map((r: any) => ({
      id: r.id,
      registration_no: r.student.registration_no,
      student_name: r.student.name,
      course_code: r.course.course_code,
      course_name: r.course.course_name,
      attended_periods: r.attended_periods,
      conducted_periods: r.conducted_periods,
      attendance_percentage: Number(r.attendance_percentage.toFixed(1))
    }));
  }

  /**
   * Get count of filtered records
   */
  async getFilteredAttendanceCount(
    courseCode?: string,
    threshold = 75,
    search?: string,
    excludeCourses?: string[]
  ): Promise<number> {
    const where = this.buildWhereClause(courseCode, threshold, search, excludeCourses);
    return this.prisma.attendanceRecord.count({ where });
  }

  /**
   * Get all courses sorted alphabetically
   */
  async getAllCourses() {
    return this.cached('all_courses', async () => {
      return this.prisma.course.findMany({ orderBy: { course_code: 'asc' } });
    }, 300000);
  }

  /**
   * Delete attendance record
   */
  async deleteAttendanceRecord(recordId: number): Promise<boolean> {
    try {
      await this.prisma.attendanceRecord.delete({ where: { id: recordId } });
      AttendanceService.invalidateCache();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<boolean> {
    try {
      await this.prisma.attendanceRecord.deleteMany({});
      await this.prisma.student.deleteMany({});
      await this.prisma.course.deleteMany({});
      AttendanceService.invalidateCache();
      return true;
    } catch (err) {
      console.error(`Error clearing data: ${err}`);
      return false;
    }
  }

  /**
   * Build where clause for queries
   */
  private buildWhereClause(
    courseCode?: string,
    threshold = 75,
    search?: string,
    excludeCourses?: string[]
  ): any {
    const where: any = {};

    if (courseCode) {
      where.course = { course_code: courseCode };
    }

    if (excludeCourses && excludeCourses.length > 0) {
      where.course = {
        ...(where.course || {}),
        course_code: { notIn: excludeCourses }
      };
    }

    if (threshold < 100) {
      where.attendance_percentage = { lt: threshold };
    }

    if (search) {
      where.OR = [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { student: { registration_no: { contains: search, mode: 'insensitive' } } }
      ];
    }

    return where;
  }

  /**
   * Format attendance data for export
   */
  formatAttendanceDataForExport(records: any[]) {
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
