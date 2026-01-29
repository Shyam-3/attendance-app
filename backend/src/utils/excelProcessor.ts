/**
 * ExcelProcessor - TypeScript port of backend/utils/excel_processor.py
 * Handles Excel/CSV file parsing and database operations with retry logic
 */
import ExcelJS from 'exceljs';
import { query } from '../db';

interface CourseInfo {
  code: string;
  name: string;
}

interface StudentData {
  admission_no: string;
  registration_no: string;
  name: string;
}

interface AttendanceData {
  registration_no: string;
  course_code: string;
  course_name: string;
  attended_periods: number;
  conducted_periods: number;
  attendance_percentage: number;
}

interface ProcessedData {
  students: StudentData[];
  attendance: AttendanceData[];
  courses: Record<number, CourseInfo>;
}

interface UploadMetrics {
  courses_new: number;
  courses_existing: number;
  students_new: number;
  students_existing: number;
  total_in_file: number;
  inserted: number;
  skipped_min_periods: number;
  skipped_duplicate: number;
  processing_time_ms: number;
}

export class ExcelProcessor {
  private MIN_CONDUCTED_PERIODS = 5;
  
  constructor() {}

  /**
   * Extract course information from Excel header rows
   * Python: df.iloc[4] (0-based index 4, which is row 5 in 1-based Excel)
   */
  private extractCourseInfoFromHeader(sheet: ExcelJS.Worksheet): Record<number, CourseInfo> {
    const courses: Record<number, CourseInfo> = {};
    
    // Python uses df.iloc[4] which is 0-based index 4 (row 5 in Excel 1-based)
    // Try rows 4-7 to handle variations in Excel format
    for (let rowNum = 4; rowNum <= Math.min(7, sheet.rowCount); rowNum++) {
      const courseRow = sheet.getRow(rowNum);
      const rowCourses: Record<number, CourseInfo> = {};
      let foundCourses = 0;
      
      courseRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const cellValue = cell.value;

        if (cellValue && typeof cellValue === 'string') {
          const courseMatch = cellValue.match(/(\d{2}[A-Z0-9]{4,5})\s*-\s*(.+)/);
          if (courseMatch) {
            const code = courseMatch[1].trim();
            // Avoid duplicate course codes inflating metrics
            if (!Object.values(courses).some(c => c.code === code) && !Object.values(rowCourses).some(c => c.code === code)) {
              rowCourses[colNumber] = {
                code,
                name: courseMatch[2].trim()
              };
              foundCourses++;
            }
          }
        }
      });
      
      // Use the row with the most courses found (typically row 5)
      if (foundCourses > Object.keys(courses).length) {
        Object.assign(courses, rowCourses);
      }
    }
    
    console.log(`Found courses:`, courses);
    return courses;
  }

  /**
   * Find the row where actual student data starts
   */
  private findDataStartRow(sheet: ExcelJS.Worksheet): number {
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const rowStr = row.values ? (row.values as any[]).filter(v => v).join(' ').toUpperCase() : '';
      if (rowStr.includes('ADMISSION NO') || rowStr.includes('REGISTRATION NO') || rowStr.includes('STUDENT NAME')) {
        return i + 1;
      }
    }
    return 8; // Default fallback
  }

  /**
   * Map columns to courses based on header row
   */
  private mapColumnsToCourses(headerRow: any[], coursesInfo: Record<number, CourseInfo>) {
    const columnMapping: any = {};
    
    // Find standard columns
    headerRow.forEach((colName, idx) => {
      if (!colName) return;
      const colStr = String(colName).toUpperCase();
      if (colStr.includes('ADMISSION')) columnMapping.admission_no = idx;
      else if (colStr.includes('REGISTRATION')) columnMapping.registration_no = idx;
      else if (colStr.includes('STUDENT NAME') || colStr.includes('NAME')) columnMapping.student_name = idx;
    });

    // Find course columns (groups of 3: attended, conducted, percentage)
    const attendedIndices: number[] = [];
    headerRow.forEach((colName, idx) => {
      if (colName && String(colName).toUpperCase().includes('ATTENDED')) {
        attendedIndices.push(idx);
      }
    });

    // Map each course to its column group
    const courseList = Object.entries(coursesInfo).sort((a, b) => Number(a[0]) - Number(b[0]));
    const courseColumns: Record<string, { attended: number; conducted: number; percentage: number }> = {};
    
    courseList.forEach(([colIdx, courseInfo], i) => {
      if (i < attendedIndices.length) {
        const attendedIdx = attendedIndices[i];
        courseColumns[courseInfo.code] = {
          attended: attendedIdx,
          conducted: attendedIdx + 1,
          percentage: attendedIdx + 2
        };
      }
    });

    columnMapping.courses = courseColumns;
    return columnMapping;
  }

  /**
   * Process Excel/CSV file from buffer
   */
  async processExcelFileFromMemory(buffer: Buffer, filename: string): Promise<ProcessedData | null> {
    try {
      const workbook = new ExcelJS.Workbook();
      
      if (filename.toLowerCase().endsWith('.csv')) {
        await workbook.csv.readFile(buffer as any);
      } else {
        await workbook.xlsx.load(buffer as any);
      }

      const sheet = workbook.worksheets[0];
      if (!sheet) return null;

      return this.processWorksheet(sheet);
    } catch (err) {
      console.error(`Error processing Excel file: ${err}`);
      return null;
    }
  }

  /**
   * Process worksheet and extract data
   */
  private processWorksheet(sheet: ExcelJS.Worksheet): ProcessedData | null {
    try {
      const coursesInfo = this.extractCourseInfoFromHeader(sheet);
      console.log(`Found courses:`, coursesInfo);

      const dataStartRow = this.findDataStartRow(sheet);
      const headerRow = sheet.getRow(dataStartRow - 1).values as any[];
      
      const columnMapping = this.mapColumnsToCourses(headerRow, coursesInfo);
      console.log(`Column mapping:`, columnMapping);

      const studentsData: StudentData[] = [];
      const attendanceData: AttendanceData[] = [];

      for (let i = dataStartRow; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const rowValues = row.values as any[];
        
        // Skip empty rows
        if (!rowValues || rowValues.every(v => v === null || v === undefined || String(v).trim() === '')) continue;

        try {
          const admission_no = columnMapping.admission_no !== undefined ? (rowValues[columnMapping.admission_no] ? String(rowValues[columnMapping.admission_no]).trim() : '') : '';
          const registration_no = columnMapping.registration_no !== undefined ? (rowValues[columnMapping.registration_no] ? String(rowValues[columnMapping.registration_no]).trim() : '') : '';
          const student_name = columnMapping.student_name !== undefined ? (rowValues[columnMapping.student_name] ? String(rowValues[columnMapping.student_name]).trim() : '') : '';

          const regUpper = registration_no.toUpperCase();
          const nameUpper = student_name.toUpperCase();

          // Robust skip conditions mimicking Python pd.notna() semantics and excluding cumulative/summary rows
          if (!registration_no || ['UNDEFINED','NAN','-'].includes(regUpper)) continue;
          if (nameUpper.includes('CUMULATIVE') || nameUpper.includes('TOTAL') || nameUpper.includes('SUMMARY')) continue;
          if (regUpper.includes('CUMULATIVE') || regUpper.includes('TOTAL')) continue;

          studentsData.push({
            admission_no,
            registration_no,
            name: student_name
          });

          // Extract attendance for each course
          const courses = columnMapping.courses || {};
          for (const [courseCode, courseCols] of Object.entries(courses)) {
            try {
              const cols = courseCols as { attended: number; conducted: number; percentage: number };
              const attendedVal = rowValues[cols.attended];
              const conductedVal = rowValues[cols.conducted];
              let percentageVal = rowValues[cols.percentage];
              const invalid = (val: any) => val === null || val === undefined || String(val).trim() === '' || String(val).trim() === '-' || String(val).toUpperCase() === 'NAN';
              if (invalid(attendedVal) || invalid(conductedVal)) {
                continue;
              }
              const attended = Number(attendedVal);
              const conducted = Number(conductedVal);
              if (!Number.isFinite(attended) || !Number.isFinite(conducted)) continue;
              // Avoid obviously cumulative combined rows (e.g., extremely large conducted > 1000)
              if (conducted > 1000) continue;
              if (invalid(percentageVal)) {
                percentageVal = conducted > 0 ? (attended / conducted * 100) : 0;
              } else {
                const pctNum = Number(percentageVal);
                percentageVal = Number.isFinite(pctNum) ? pctNum : (conducted > 0 ? (attended / conducted * 100) : 0);
              }
              const courseInfo = Object.values(coursesInfo).find(c => c.code === courseCode);
              attendanceData.push({
                registration_no,
                course_code: courseCode,
                course_name: courseInfo?.name || '',
                attended_periods: attended,
                conducted_periods: conducted,
                attendance_percentage: percentageVal
              });
            } catch (err) {
              console.error(`Error processing attendance for ${student_name}, course ${courseCode}: ${err}`);
            }
          }
        } catch (err) {
          console.error(`Error processing row ${i}: ${err}`);
        }
      }

      return {
        students: studentsData,
        attendance: attendanceData,
        courses: coursesInfo
      };
    } catch (err) {
      console.error(`Error processing worksheet: ${err}`);
      return null;
    }
  }

  /**
   * Save processed data to database with bulk operations and retry logic
   */
  async saveToDatabase(processedData: ProcessedData, userId: string, maxRetries = 2): Promise<{ success: boolean; metrics?: UploadMetrics; error?: string }> {
    if (!processedData) {
      return { success: false, error: 'No data to process' };
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const startTime = performance.now();
      
      try {
        // 1. Prefetch existing courses for this user
        const incomingCourseCodes = Array.from(new Set(Object.values(processedData.courses).map(c => c.code)));
        const existingCoursesResult = await query(
          'SELECT id, course_code FROM courses WHERE user_id = $1 AND course_code = ANY($2)',
          [userId, incomingCourseCodes]
        );
        
        const courseMap = new Map(existingCoursesResult.rows.map((c: any) => [c.course_code, c]));
        const newCourseCodes = incomingCourseCodes.filter(code => !courseMap.has(code));
        
        // Bulk insert new courses
        if (newCourseCodes.length > 0) {
          const coursesToCreate = newCourseCodes.map(code => {
            const info = Object.values(processedData.courses).find(c => c.code === code)!;
            return [userId, info.code, info.name];
          });
          
          const placeholders = coursesToCreate.map((_, i) => `($${i * 3 + 1},$${i * 3 + 2},$${i * 3 + 3})`).join(',');
          const flatParams = coursesToCreate.flat();
          
          const createResult = await query(
            `INSERT INTO courses (user_id, course_code, course_name) VALUES ${placeholders}
             ON CONFLICT (user_id, course_code) DO NOTHING RETURNING id, course_code`,
            flatParams
          );
          
          // Add newly created courses to map
          createResult.rows.forEach((c: any) => courseMap.set(c.course_code, c));
        }

        // 2. Prefetch existing students for this user
        const incomingRegNos = processedData.students.map(s => s.registration_no).filter(Boolean);
        const existingStudentsResult = await query(
          'SELECT id, registration_no FROM students WHERE user_id = $1 AND registration_no = ANY($2)',
          [userId, incomingRegNos]
        );
        
        const studentMap = new Map(existingStudentsResult.rows.map((s: any) => [s.registration_no, s]));
        const newStudents = processedData.students.filter(s => !studentMap.has(s.registration_no));
        
        // Bulk insert new students
        if (newStudents.length > 0) {
          const studentsToCreate = newStudents.map(s => [userId, s.admission_no, s.registration_no, s.name]);
          const placeholders = studentsToCreate.map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',');
          const flatParams = studentsToCreate.flat();
          
          const createResult = await query(
            `INSERT INTO students (user_id, admission_no, registration_no, name) VALUES ${placeholders}
             ON CONFLICT (user_id, registration_no) DO NOTHING RETURNING id, registration_no`,
            flatParams
          );
          
          // Add newly created students to map
          createResult.rows.forEach((s: any) => studentMap.set(s.registration_no, s));
        }

        // 3. Filter attendance by minimum conducted periods
        const totalAttendanceRecords = processedData.attendance.length;
        const filteredAttendance = processedData.attendance.filter(
          a => a.conducted_periods >= this.MIN_CONDUCTED_PERIODS
        );
        const skippedMinPeriods = totalAttendanceRecords - filteredAttendance.length;

        if (filteredAttendance.length === 0) {
          const elapsed = performance.now() - startTime;
          console.log(`⚠ No attendance records meet minimum ${this.MIN_CONDUCTED_PERIODS} conducted periods.`);
          console.log(`  Total records: ${totalAttendanceRecords}, Skipped (< ${this.MIN_CONDUCTED_PERIODS} classes): ${skippedMinPeriods}`);
          
          return {
            success: true,
            metrics: {
              courses_new: newCourseCodes.length,
              courses_existing: courseMap.size - newCourseCodes.length,
              students_new: newStudents.length,
              students_existing: studentMap.size - newStudents.length,
              total_in_file: totalAttendanceRecords,
              inserted: 0,
              skipped_min_periods: skippedMinPeriods,
              skipped_duplicate: 0,
              processing_time_ms: Math.round(elapsed)
            }
          };
        }

        // 4. Fetch existing attendance records for this user
        const pairs = filteredAttendance
          .map(a => {
            const student = studentMap.get(a.registration_no);
            const course = courseMap.get(a.course_code);
            if (student && course) return { student_id: student.id, course_id: course.id };
            return null;
          })
          .filter((p): p is { student_id: number; course_id: number } => p !== null);

        let attendanceSet = new Set<string>();
        
        if (pairs.length > 0) {
          // Split into smaller batches to avoid query size issues
          const batchSize = 100;
          for (let i = 0; i < pairs.length; i += batchSize) {
            const batch = pairs.slice(i, i + batchSize);
            const studentIds = batch.map(p => p.student_id);
            const courseIds = batch.map(p => p.course_id);
            
            const existingRecordsResult = await query(
              `SELECT student_id, course_id FROM attendance_records 
               WHERE user_id = $1 AND student_id = ANY($2) AND course_id = ANY($3)`,
              [userId, studentIds, courseIds]
            );
            
            existingRecordsResult.rows.forEach((r: any) => {
              attendanceSet.add(`${r.student_id}-${r.course_id}`);
            });
          }
        }

        // 5. Prepare bulk insert (skip duplicates)
        const toInsert: any[] = [];
        let skippedDuplicate = 0;

        filteredAttendance.forEach(a => {
          const student = studentMap.get(a.registration_no);
          const course = courseMap.get(a.course_code);
          
          if (!student || !course) return;
          
          const key = `${student.id}-${course.id}`;
          if (attendanceSet.has(key)) {
            skippedDuplicate++;
          } else {
            toInsert.push([userId, student.id, course.id, a.attended_periods, a.conducted_periods, a.attendance_percentage]);
          }
        });

        // Bulk insert attendance records
        if (toInsert.length > 0) {
          const placeholders = toInsert.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(',');
          const flatParams = toInsert.flat();
          
          await query(
            `INSERT INTO attendance_records (user_id, student_id, course_id, attended_periods, conducted_periods, attendance_percentage) 
             VALUES ${placeholders} ON CONFLICT (user_id, student_id, course_id) DO NOTHING`,
            flatParams
          );
        }

        const elapsed = performance.now() - startTime;
        console.log(`✓ Upload completed successfully!`);
        const coursesExisting = Math.max(courseMap.size - newCourseCodes.length, 0);
        console.log(`  Courses: ${newCourseCodes.length} new, ${coursesExisting} existing`);
        console.log(`  Students: ${newStudents.length} new, ${studentMap.size - newStudents.length} existing`);
        console.log(`  Attendance records:`);
        console.log(`    • Total in file: ${totalAttendanceRecords}`);
        console.log(`    • Inserted: ${toInsert.length}`);
        console.log(`    • Skipped (< ${this.MIN_CONDUCTED_PERIODS} classes): ${skippedMinPeriods}`);
        console.log(`    • Skipped (duplicate): ${skippedDuplicate}`);
        console.log(`  Processing time: ${elapsed.toFixed(2)} ms (${(elapsed/1000).toFixed(2)}s)`);

        return {
          success: true,
          metrics: {
            courses_new: newCourseCodes.length,
            courses_existing: coursesExisting,
            students_new: newStudents.length,
            students_existing: studentMap.size - newStudents.length,
            total_in_file: totalAttendanceRecords,
            inserted: toInsert.length,
            skipped_min_periods: skippedMinPeriods,
            skipped_duplicate: skippedDuplicate,
            processing_time_ms: Math.round(elapsed)
          }
        };

      } catch (err: any) {
        console.error(`Upload attempt ${attempt + 1} failed: ${err}`);
        
        if (attempt === maxRetries - 1) {
          return { success: false, error: String(err) };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Cleanup records with insufficient conducted periods
   */
  async cleanupInsufficientRecords(minConductedPeriods = 5): Promise<number> {
    try {
      const result = await query(
        'DELETE FROM attendance_records WHERE conducted_periods < $1',
        [minConductedPeriods]
      );
      
      const count = (result as any).rowCount || 0;
      console.log(`Cleaned up ${count} records with insufficient conducted periods`);
      return count;
    } catch (err) {
      console.error(`Error during cleanup: ${err}`);
      return 0;
    }
  }
}
