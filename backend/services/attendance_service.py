"""
Business logic for attendance calculations and data processing
"""
from backend.models import db, Student, Course, AttendanceRecord
from sqlalchemy import func, distinct

class AttendanceService:
    
    @staticmethod
    def calculate_dashboard_stats():
        """Calculate statistics for the dashboard (overall stats)"""
        total_students = db.session.query(distinct(Student.id)).count()
        total_courses = Course.query.count()
        
        low_attendance_count = AttendanceRecord.query.filter(
            AttendanceRecord.attendance_percentage < 75
        ).count()
        
        critical_attendance_count = AttendanceRecord.query.filter(
            AttendanceRecord.attendance_percentage < 65
        ).count()
        
        return {
            'total_students': total_students,
            'total_courses': total_courses,
            'low_attendance_count': low_attendance_count,
            'critical_attendance_count': critical_attendance_count
        }
    
    @staticmethod
    def calculate_filtered_stats(course_code=None, threshold=75, search=None, exclude_courses=None):
        """Calculate statistics based on applied filters"""
        # Base query
        query = db.session.query(AttendanceRecord).join(Student).join(Course)
        
        # Apply course filter
        if course_code:
            query = query.filter(Course.course_code == course_code)
        
        # Apply exclude courses filter
        if exclude_courses:
            query = query.filter(~Course.course_code.in_(exclude_courses))
        
        # Apply search filter (for student info)
        if search:
            search_lower = search.lower()
            query = query.filter(
                db.or_(
                    func.lower(Student.name).contains(search_lower),
                    func.lower(Student.registration_no).contains(search_lower)
                )
            )
        
        # Get all filtered records
        filtered_records = query.all()
        
        # Calculate stats from filtered records
        unique_students = set()
        unique_courses = set()
        low_attendance_records = []
        critical_attendance_records = []
        student_details = None
        
        for record in filtered_records:
            unique_students.add(record.student.id)
            unique_courses.add(record.course.id)
            
            # Store student details if search matches specific student
            if search and len(unique_students) == 1:
                student_details = {
                    'name': record.student.name,
                    'registration_no': record.student.registration_no
                }
            
            # Check thresholds based on actual percentage, not filter threshold
            if record.attendance_percentage < 75:
                low_attendance_records.append(record)
            if record.attendance_percentage < 65:
                critical_attendance_records.append(record)
        
        # Determine if showing all courses or filtered
        total_courses_in_system = Course.query.count()
        
        # Get course details if specific course is selected
        course_details = None
        if course_code:
            course_obj = Course.query.filter_by(course_code=course_code).first()
            if course_obj:
                course_details = {
                    'code': course_obj.course_code,
                    'name': course_obj.course_name
                }
        
        # Get student's course count when searching for a student
        student_course_info = None
        if search and len(unique_students) == 1:
            student_course_count = len(unique_courses)
            # If single course selected, show the course code
            if course_code:
                student_course_info = course_code
            else:
                # Show count of courses
                student_course_info = f"{student_course_count} course{'s' if student_course_count != 1 else ''}"
        
        return {
            'total_students': len(unique_students),
            'total_courses': len(unique_courses),
            'low_attendance_count': len(low_attendance_records),
            'critical_attendance_count': len(critical_attendance_records),
            'is_single_student': len(unique_students) == 1 and search,
            'student_details': student_details,
            'total_courses_in_system': total_courses_in_system,
            'course_details': course_details,
            'student_course_info': student_course_info
        }
    
    @staticmethod
    def get_filtered_attendance_records(course_code=None, threshold=75, search=None, exclude_courses=None):
        """Get attendance records with applied filters"""
        query = db.session.query(AttendanceRecord).join(Student).join(Course)
        
        # Apply filters
        if course_code:
            query = query.filter(Course.course_code == course_code)
        
        # Apply exclude courses filter
        if exclude_courses:
            query = query.filter(~Course.course_code.in_(exclude_courses))
        
        if threshold < 100:
            query = query.filter(AttendanceRecord.attendance_percentage < threshold)
        
        if search:
            search_lower = search.lower()
            query = query.filter(
                db.or_(
                    func.lower(Student.name).contains(search_lower),
                    func.lower(Student.registration_no).contains(search_lower)
                )
            )
        
        return query.order_by(
            Course.course_code.asc(),
            AttendanceRecord.attendance_percentage.asc(),
            Student.registration_no.asc()
        ).all()
    
    @staticmethod
    def get_all_courses():
        """Get all available courses sorted alphabetically"""
        return Course.query.order_by(Course.course_code.asc()).all()
    
    @staticmethod
    def get_low_attendance_records():
        """Get records with attendance below 75%"""
        return db.session.query(AttendanceRecord).join(Student).join(Course).filter(
            AttendanceRecord.attendance_percentage < 75
        ).order_by(
            AttendanceRecord.attendance_percentage.asc(),
            Student.registration_no.asc(),
            Course.course_code.asc()
        ).all()
    
    @staticmethod
    def format_attendance_data_for_export(records):
        """Format attendance records for export"""
        data = []
        for i, record in enumerate(records, 1):
            data.append({
                'id': record.id,
                'S.No': i,
                'Registration No': record.student.registration_no,
                'Student Name': record.student.name,
                'Course Code': record.course.course_code,
                'Course Name': record.course.course_name,
                'Attended Periods': record.attended_periods,
                'Conducted Periods': record.conducted_periods,
                'Attendance %': round(record.attendance_percentage, 1)
            })
        return data
    
    @staticmethod
    def delete_attendance_record(record_id):
        """Delete a specific attendance record"""
        try:
            from backend.models import AttendanceRecord
            record = AttendanceRecord.query.get(record_id)
            if record:
                db.session.delete(record)
                db.session.commit()
                return True
            return False
        except Exception as e:
            db.session.rollback()
            print(f"Error deleting record: {e}")
            return False
    
    @staticmethod
    def clear_all_data():
        """Clear all attendance data from database"""
        try:
            from backend.models import AttendanceRecord, Student, Course
            # Delete all attendance records
            AttendanceRecord.query.delete()
            # Delete all students
            Student.query.delete()
            # Delete all courses
            Course.query.delete()
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Error clearing all data: {e}")
            return False
    
