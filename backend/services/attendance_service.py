"""
Business logic for attendance calculations and data processing
OPTIMIZED VERSION with SQL aggregations, pagination, and caching
"""
from backend.models import db, Student, Course, AttendanceRecord
from sqlalchemy import func, distinct, case
from functools import wraps
import time

# Simple in-memory cache
_cache = {}
_cache_timestamps = {}
CACHE_TTL = 300  # 5 minutes

def cached(key_prefix, ttl=CACHE_TTL):
    """Simple cache decorator"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and args
            cache_key = f"{key_prefix}:{':'.join(map(str, args))}"
            
            # Check if cached and not expired
            if cache_key in _cache:
                timestamp = _cache_timestamps.get(cache_key, 0)
                if time.time() - timestamp < ttl:
                    return _cache[cache_key]
            
            # Call function and cache result
            result = func(*args, **kwargs)
            _cache[cache_key] = result
            _cache_timestamps[cache_key] = time.time()
            return result
        return wrapper
    return decorator

def invalidate_cache():
    """Clear all cached data"""
    _cache.clear()
    _cache_timestamps.clear()

def retry_on_operational_error(max_retries=2):
    """Retry decorator for handling transient database errors"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            from sqlalchemy.exc import OperationalError
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except OperationalError as e:
                    if attempt == max_retries - 1:
                        raise
                    # Dispose of the engine and retry
                    print(f"OperationalError on attempt {attempt + 1}, retrying...")
                    db.engine.dispose()
                    time.sleep(0.5)  # Brief delay before retry
            
        return wrapper
    return decorator


class AttendanceService:
    
    @staticmethod
    @retry_on_operational_error()
    @cached('dashboard_stats', ttl=60)  # Cache for 1 minute
    def calculate_dashboard_stats():
        """Calculate statistics for the dashboard (overall stats) - OPTIMIZED"""
        # Single query with all aggregations
        stats = db.session.query(
            func.count(distinct(Student.id)).label('total_students'),
            func.count(distinct(Course.id)).label('total_courses'),
            func.sum(case((AttendanceRecord.attendance_percentage < 75, 1), else_=0)).label('low_attendance'),
            func.sum(case((AttendanceRecord.attendance_percentage < 65, 1), else_=0)).label('critical_attendance')
        ).select_from(AttendanceRecord).join(Student).join(Course).first()
        
        return {
            'total_students': stats.total_students or 0,
            'total_courses': stats.total_courses or 0,
            'low_attendance_count': int(stats.low_attendance or 0),
            'critical_attendance_count': int(stats.critical_attendance or 0)
        }
    
    @staticmethod
    @retry_on_operational_error()
    def calculate_filtered_stats(course_code=None, threshold=75, search=None, exclude_courses=None):
        """Calculate statistics based on applied filters - OPTIMIZED with SQL aggregation"""
        # Build base query with aggregations
        query = db.session.query(
            func.count(distinct(AttendanceRecord.student_id)).label('total_students'),
            func.count(distinct(AttendanceRecord.course_id)).label('total_courses'),
            func.sum(case((AttendanceRecord.attendance_percentage < 75, 1), else_=0)).label('low_attendance'),
            func.sum(case((AttendanceRecord.attendance_percentage < 65, 1), else_=0)).label('critical_attendance')
        ).select_from(AttendanceRecord).join(Student).join(Course)
        
        # Apply filters
        if course_code:
            query = query.filter(Course.course_code == course_code)
        
        if exclude_courses:
            query = query.filter(~Course.course_code.in_(exclude_courses))
        
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                db.or_(
                    Student.name.ilike(pattern),
                    Student.registration_no.ilike(pattern)
                )
            )
        
        # Execute single aggregation query
        stats = query.first()
        
        # Get total courses in system (cached)
        total_courses_in_system = AttendanceService.get_total_courses_count()
        
        # Get additional details if needed
        student_details = None
        course_details = None
        student_course_info = None
        
        # Only fetch details if we have a specific context
        if search and stats.total_students == 1:
            # Get student details with a targeted query
            student_record = db.session.query(
                Student.name,
                Student.registration_no,
                func.count(distinct(AttendanceRecord.course_id)).label('course_count')
            ).select_from(AttendanceRecord).join(Student).join(Course).filter(
                db.or_(
                    Student.name.ilike(f"%{search}%"),
                    Student.registration_no.ilike(f"%{search}%")
                )
            )
            
            if course_code:
                student_record = student_record.filter(Course.course_code == course_code)
            if exclude_courses:
                student_record = student_record.filter(~Course.course_code.in_(exclude_courses))
            
            student_record = student_record.group_by(Student.id, Student.name, Student.registration_no).first()
            
            if student_record:
                student_details = {
                    'name': student_record.name,
                    'registration_no': student_record.registration_no
                }
                student_course_count = student_record.course_count
                student_course_info = course_code if course_code else f"{student_course_count} course{'s' if student_course_count != 1 else ''}"
        
        if course_code:
            course_obj = Course.query.filter_by(course_code=course_code).first()
            if course_obj:
                course_details = {
                    'code': course_obj.course_code,
                    'name': course_obj.course_name
                }
        
        return {
            'total_students': stats.total_students or 0,
            'total_courses': stats.total_courses or 0,
            'low_attendance_count': int(stats.low_attendance or 0),
            'critical_attendance_count': int(stats.critical_attendance or 0),
            'is_single_student': stats.total_students == 1 and search,
            'student_details': student_details,
            'total_courses_in_system': total_courses_in_system,
            'course_details': course_details,
            'student_course_info': student_course_info
        }
    
    @staticmethod
    @retry_on_operational_error()
    def get_filtered_attendance_records(course_code=None, threshold=75, search=None, exclude_courses=None, page=1, per_page=100):
        """Get attendance records with applied filters - OPTIMIZED with pagination and column projection"""
        # Use optimized query with only needed columns
        query = db.session.query(
            AttendanceRecord.id,
            Student.registration_no,
            Student.name.label('student_name'),
            Course.course_code,
            Course.course_name,
            AttendanceRecord.attended_periods,
            AttendanceRecord.conducted_periods,
            AttendanceRecord.attendance_percentage
        ).select_from(AttendanceRecord).join(Student).join(Course)
        
        # Apply filters
        if course_code:
            query = query.filter(Course.course_code == course_code)
        
        if exclude_courses:
            query = query.filter(~Course.course_code.in_(exclude_courses))
        
        if threshold < 100:
            query = query.filter(AttendanceRecord.attendance_percentage < threshold)
        
        if search:
            # Use ILIKE for PostgreSQL which can be accelerated with trigram indexes if needed
            pattern = f"%{search}%"
            query = query.filter(
                db.or_(
                    Student.name.ilike(pattern),
                    Student.registration_no.ilike(pattern)
                )
            )
        
        # Apply ordering
        query = query.order_by(
            Course.course_code.asc(),
            AttendanceRecord.attendance_percentage.asc(),
            Student.registration_no.asc()
        )
        
        # Apply pagination if requested
        if per_page and per_page > 0:
            offset = (page - 1) * per_page
            query = query.limit(per_page).offset(offset)
        
        # Execute and return as list of dicts for better JSON serialization
        results = query.all()
        
        # Convert to dict format
        records = []
        for r in results:
            records.append({
                'id': r.id,
                'registration_no': r.registration_no,
                'student_name': r.student_name,
                'course_code': r.course_code,
                'course_name': r.course_name,
                'attended_periods': r.attended_periods,
                'conducted_periods': r.conducted_periods,
                'attendance_percentage': round(r.attendance_percentage, 1)
            })
        
        return records
    
    @staticmethod
    @retry_on_operational_error()
    def get_filtered_attendance_count(course_code=None, threshold=75, search=None, exclude_courses=None):
        """Get total count of filtered attendance records for pagination"""
        # Build query for count
        query = db.session.query(func.count(AttendanceRecord.id)).select_from(AttendanceRecord).join(Student).join(Course)
        
        # Apply filters (same as get_filtered_attendance_records)
        if course_code:
            query = query.filter(Course.course_code == course_code)
        
        if exclude_courses:
            query = query.filter(~Course.course_code.in_(exclude_courses))
        
        if threshold < 100:
            query = query.filter(AttendanceRecord.attendance_percentage < threshold)
        
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                db.or_(
                    Student.name.ilike(pattern),
                    Student.registration_no.ilike(pattern)
                )
            )
        
        return query.scalar() or 0
    
    @staticmethod
    @cached('all_courses', ttl=300)  # Cache for 5 minutes
    @retry_on_operational_error()
    def get_all_courses():
        """Get all available courses sorted alphabetically - CACHED"""
        return Course.query.order_by(Course.course_code.asc()).all()
    
    @staticmethod
    @cached('total_courses_count', ttl=300)
    @retry_on_operational_error()
    def get_total_courses_count():
        """Get total number of courses - CACHED"""
        return db.session.query(func.count(Course.id)).scalar() or 0
    
    @staticmethod
    @retry_on_operational_error()
    def get_low_attendance_records():
        """Get records with attendance below 75% - OPTIMIZED"""
        query = db.session.query(
            AttendanceRecord.id,
            Student.registration_no,
            Student.name.label('student_name'),
            Course.course_code,
            Course.course_name,
            AttendanceRecord.attended_periods,
            AttendanceRecord.conducted_periods,
            AttendanceRecord.attendance_percentage
        ).select_from(AttendanceRecord).join(Student).join(Course).filter(
            AttendanceRecord.attendance_percentage < 75
        ).order_by(
            AttendanceRecord.attendance_percentage.asc(),
            Student.registration_no.asc(),
            Course.course_code.asc()
        )
        
        results = query.all()
        
        # Convert to dict format
        records = []
        for r in results:
            records.append({
                'id': r.id,
                'registration_no': r.registration_no,
                'student_name': r.student_name,
                'course_code': r.course_code,
                'course_name': r.course_name,
                'attended_periods': r.attended_periods,
                'conducted_periods': r.conducted_periods,
                'attendance_percentage': round(r.attendance_percentage, 1)
            })
        
        return records
    
    @staticmethod
    def format_attendance_data_for_export(records):
        """Format attendance records for export - handles both ORM objects and dicts"""
        data = []
        for i, record in enumerate(records, 1):
            # Handle both dict and ORM object formats
            if isinstance(record, dict):
                data.append({
                    'id': record['id'],
                    'S.No': i,
                    'Registration No': record['registration_no'],
                    'Student Name': record['student_name'],
                    'Course Code': record['course_code'],
                    'Course Name': record['course_name'],
                    'Attended Periods': record['attended_periods'],
                    'Conducted Periods': record['conducted_periods'],
                    'Attendance %': round(record['attendance_percentage'], 1)
                })
            else:
                # ORM object format (fallback)
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
    @retry_on_operational_error()
    def delete_attendance_record(record_id):
        """Delete a specific attendance record"""
        try:
            from backend.models import AttendanceRecord
            record = AttendanceRecord.query.get(record_id)
            if record:
                db.session.delete(record)
                db.session.commit()
                # Invalidate cache after data change
                invalidate_cache()
                return True
            return False
        except Exception as e:
            db.session.rollback()
            print(f"Error deleting record: {e}")
            return False
    
    @staticmethod
    @retry_on_operational_error()
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
            # Invalidate cache after data change
            invalidate_cache()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Error clearing all data: {e}")
            return False
    
