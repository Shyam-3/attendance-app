import pandas as pd
import re
import time
from backend.models import db, Student, Course, AttendanceRecord

class ExcelProcessor:
    def __init__(self):
        self.course_mapping = {}
        
    def extract_course_info_from_header(self, df):
        """Extract course information from the Excel header rows"""
        courses = {}
        
        # Look for course info in row 4 (index 4)
        if len(df) > 4:
            course_row = df.iloc[4]
            for col_idx, cell_value in enumerate(course_row):
                if pd.notna(cell_value) and isinstance(cell_value, str):
                    # Look for course code pattern like "22IT580", "22ECGDO", "22ITGB0", "22ITPK0", "22ITPQ0", etc.
                    # Pattern: 2 digits + 4-5 alphanumeric characters (updated to better match actual formats)
                    course_match = re.search(r'(\d{2}[A-Z0-9]{4,5})\s*-\s*(.+)', str(cell_value))
                    if course_match:
                        course_code = course_match.group(1)
                        course_name = course_match.group(2).strip()
                        courses[col_idx] = {
                            'code': course_code,
                            'name': course_name
                        }
        
        return courses
    
    def find_data_start_row(self, df):
        """Find the row where actual student data starts"""
        for idx, row in df.iterrows():
            row_str = ' '.join([str(x) for x in row.tolist() if pd.notna(x)]).upper()
            # Look for header row with these keywords
            if any(keyword in row_str for keyword in ['ADMISSION NO', 'REGISTRATION NO', 'STUDENT NAME']):
                return idx + 1  # Data starts after header
        return 7  # Default fallback based on our analysis
    
    def map_columns_to_courses(self, header_row, courses_info):
        """Map column indices to course data"""
        column_mapping = {}
        
        # Standard columns
        for idx, col_name in enumerate(header_row):
            if pd.notna(col_name):
                col_name_str = str(col_name).upper()
                if 'ADMISSION' in col_name_str:
                    column_mapping['admission_no'] = idx
                elif 'REGISTRATION' in col_name_str:
                    column_mapping['registration_no'] = idx
                elif 'STUDENT NAME' in col_name_str or 'NAME' in col_name_str:
                    column_mapping['student_name'] = idx
        
        # Course-specific columns
        # Based on our analysis, courses appear in groups of 3 columns (attended, conducted, percentage)
        course_columns = {}
        
        # Create a list of course codes in order they appear
        course_list = [(col_idx, info) for col_idx, info in sorted(courses_info.items())]
        
        # Find groups of 3 columns starting after basic student info (typically after column 2)
        attended_col_indices = []
        for idx in range(3, len(header_row)):
            if pd.notna(header_row[idx]):
                col_name = str(header_row[idx]).upper()
                if 'ATTENDED' in col_name:
                    attended_col_indices.append(idx)
        
        # Map each course to its corresponding column group
        for i, (course_col_idx, course_info) in enumerate(course_list):
            if i < len(attended_col_indices):
                course_code = course_info['code']
                attended_idx = attended_col_indices[i]
                
                course_columns[course_code] = {
                    'attended': attended_idx,
                    'conducted': attended_idx + 1,
                    'percentage': attended_idx + 2
                }
        
        column_mapping['courses'] = course_columns
        return column_mapping
    
    def process_excel_file_from_memory(self, file):
        """Process Excel/CSV file directly from memory and extract attendance data"""
        try:
            # Reset file pointer to beginning
            file.seek(0)
            
            if file.filename.lower().endswith(('.csv',)):
                df = pd.read_csv(file)
            else:
                df = pd.read_excel(file)
            
            return self._process_dataframe(df)
            
        except Exception as e:
            print(f"Error processing Excel file: {e}")
            return None
    
    def process_excel_file(self, file_path):
        """Process Excel/CSV file and extract attendance data"""
        try:
            if file_path.lower().endswith(('.csv',)):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            return self._process_dataframe(df)
            
        except Exception as e:
            print(f"Error processing Excel file: {e}")
            return None
    
    def _process_dataframe(self, df):
        """Common dataframe processing logic"""
        try:
            # Extract course information from header
            courses_info = self.extract_course_info_from_header(df)
            print(f"Found courses: {courses_info}")
            
            # Find where data starts
            data_start_row = self.find_data_start_row(df)
            header_row = df.iloc[data_start_row - 1].tolist()  # Row before data
            
            # Map columns to courses
            column_mapping = self.map_columns_to_courses(header_row, courses_info)
            print(f"Column mapping: {column_mapping}")
            
            # Process student data
            students_data = []
            attendance_data = []
            
            for idx in range(data_start_row, len(df)):
                row = df.iloc[idx]
                
                # Skip empty rows
                if row.isna().all():
                    continue
                
                # Extract student info
                try:
                    admission_no = str(row.iloc[column_mapping.get('admission_no', 0)]) if pd.notna(row.iloc[column_mapping.get('admission_no', 0)]) else ''
                    registration_no = str(row.iloc[column_mapping.get('registration_no', 1)]) if pd.notna(row.iloc[column_mapping.get('registration_no', 1)]) else ''
                    student_name = str(row.iloc[column_mapping.get('student_name', 2)]) if pd.notna(row.iloc[column_mapping.get('student_name', 2)]) else ''
                    
                    if not registration_no or registration_no == 'nan':
                        continue
                        
                    student_data = {
                        'admission_no': admission_no,
                        'registration_no': registration_no,
                        'name': student_name
                    }
                    students_data.append(student_data)
                    
                    # Extract attendance for each course
                    for course_code, course_cols in column_mapping.get('courses', {}).items():
                        try:
                            attended = row.iloc[course_cols.get('attended', -1)]
                            conducted = row.iloc[course_cols.get('conducted', -1)]
                            percentage = row.iloc[course_cols.get('percentage', -1)]
                            
                            # Handle cases where attendance might be '-' or empty
                            if pd.notna(attended) and str(attended) != '-' and pd.notna(conducted) and str(conducted) != '-':
                                attended = int(float(attended))
                                conducted = int(float(conducted))
                                
                                # Calculate percentage if not provided or invalid
                                if pd.isna(percentage) or str(percentage) == '-':
                                    percentage = (attended / conducted * 100) if conducted > 0 else 0
                                else:
                                    percentage = float(percentage)
                                
                                attendance_record = {
                                    'registration_no': registration_no,
                                    'course_code': course_code,
                                    'course_name': courses_info[list(courses_info.keys())[0]]['name'] if courses_info else '',
                                    'attended_periods': attended,
                                    'conducted_periods': conducted,
                                    'attendance_percentage': percentage
                                }
                                attendance_data.append(attendance_record)
                        except (ValueError, IndexError) as e:
                            print(f"Error processing attendance for {student_name}, course {course_code}: {e}")
                            continue
                            
                except (ValueError, IndexError) as e:
                    print(f"Error processing row {idx}: {e}")
                    continue
            
            return {
                'students': students_data,
                'attendance': attendance_data,
                'courses': courses_info
            }
            
        except Exception as e:
            print(f"Error processing dataframe: {e}")
            return None
    
        def save_to_database(self, processed_data, max_retries=2):
                """Save the processed data to database with bulk operations and retry logic.
                Returns a dict with metrics on success: {
                    'success': True,
                    'metrics': {
                         'courses_new', 'courses_existing', 'students_new', 'students_existing',
                         'total_in_file', 'inserted', 'skipped_min_periods', 'skipped_duplicate',
                         'processing_time_ms'
                    }
                }
                """
        if not processed_data:
            return False
        
        from sqlalchemy.exc import OperationalError
        
        for attempt in range(max_retries):
            start_time = time.perf_counter()
            try:
            # ------------------------------
            # 1. Prefetch existing courses
            # ------------------------------
                incoming_course_codes = {c['code'] for c in processed_data['courses'].values()}
                existing_courses = Course.query.filter(Course.course_code.in_(incoming_course_codes)).all() if incoming_course_codes else []
                course_map = {c.course_code: c for c in existing_courses}
                new_courses = []
                for c in incoming_course_codes:
                    if c not in course_map:
                        info = next(v for v in processed_data['courses'].values() if v['code'] == c)
                        new_courses.append(Course(course_code=info['code'], course_name=info['name']))
                if new_courses:
                    # Bulk insert new courses for performance
                    course_dicts = [{'course_code': c.course_code, 'course_name': c.course_name} for c in new_courses]
                    db.session.bulk_insert_mappings(Course, course_dicts)
                    db.session.flush()
                    # Refresh course_map by querying inserted + existing
                    existing_courses = Course.query.filter(Course.course_code.in_(incoming_course_codes)).all()
                    course_map = {c.course_code: c for c in existing_courses}
                
                # ------------------------------
                # 2. Prefetch existing students
                # ------------------------------
                incoming_reg_nos = {s['registration_no'] for s in processed_data['students'] if s['registration_no']}
                existing_students = Student.query.filter(Student.registration_no.in_(incoming_reg_nos)).all() if incoming_reg_nos else []
                student_map = {s.registration_no: s for s in existing_students}
                new_students = []
                for s in processed_data['students']:
                    reg = s['registration_no']
                    if reg and reg not in student_map:
                        new_students.append(Student(admission_no=s['admission_no'], registration_no=reg, name=s['name']))
                if new_students:
                    # Bulk insert new students for performance
                    student_dicts = [{'admission_no': s.admission_no, 'registration_no': s.registration_no, 'name': s.name} for s in new_students]
                    db.session.bulk_insert_mappings(Student, student_dicts)
                    db.session.flush()
                    # Refresh student_map by querying inserted + existing
                    existing_students = Student.query.filter(Student.registration_no.in_(incoming_reg_nos)).all()
                    student_map = {s.registration_no: s for s in existing_students}
                
                # Commit base entities (courses & students) to ensure IDs are persistent
                # Note: Using flush() instead of commit() to keep transaction open
                db.session.flush()
                
                # ------------------------------
                # 3. Filter attendance data by minimum conducted periods
                # ------------------------------
                MIN_CONDUCTED_PERIODS = 5
                total_attendance_records = len(processed_data['attendance'])
                filtered_attendance = []
                skipped_min_periods = 0
                
                for a in processed_data['attendance']:
                    if a['conducted_periods'] >= MIN_CONDUCTED_PERIODS:
                        filtered_attendance.append(a)
                    else:
                        skipped_min_periods += 1
                
                if not filtered_attendance:
                    from backend.services.attendance_service import invalidate_cache
                    invalidate_cache()
                    elapsed = (time.perf_counter() - start_time) * 1000
                    print(f"⚠ No attendance records meet minimum {MIN_CONDUCTED_PERIODS} conducted periods.")
                    print(f"  Total records: {total_attendance_records}, Skipped (< {MIN_CONDUCTED_PERIODS} classes): {skipped_min_periods}")
                    return {
                        'success': True,
                        'metrics': {
                            'courses_new': len(new_courses),
                            'courses_existing': len(course_map) - len(new_courses),
                            'students_new': len(new_students),
                            'students_existing': len(student_map) - len(new_students),
                            'total_in_file': total_attendance_records,
                            'inserted': 0,
                            'skipped_min_periods': skipped_min_periods,
                            'skipped_duplicate': 0,
                            'processing_time_ms': round(elapsed, 2)
                        }
                    }
                
                # ------------------------------
                # 4. Bulk fetch existing attendance records to detect duplicates
                # ------------------------------
                from sqlalchemy import tuple_
                pairs = []
                for a in filtered_attendance:
                    student = student_map.get(a['registration_no'])
                    course = course_map.get(a['course_code'])
                    if student and course:
                        pairs.append((student.id, course.id))
                
                attendance_map = set()
                if pairs:
                    rows = db.session.query(
                        AttendanceRecord.student_id,
                        AttendanceRecord.course_id
                    ).filter(
                        tuple_(AttendanceRecord.student_id, AttendanceRecord.course_id).in_(pairs)
                    ).all()
                    attendance_map = {(r[0], r[1]) for r in rows}

                # ------------------------------
                # 5. Prepare bulk insert mappings (skip existing records)
                # ------------------------------
                insert_mappings = []
                skipped_duplicate = 0

                for a in filtered_attendance:
                    student = student_map.get(a['registration_no'])
                    course = course_map.get(a['course_code'])
                    if not student or not course:
                        continue
                    
                    key = (student.id, course.id)
                    if key in attendance_map:
                        # Already exists, skip to avoid duplicates
                        skipped_duplicate += 1
                    else:
                        insert_mappings.append({
                            'student_id': student.id,
                            'course_id': course.id,
                            'attended_periods': a['attended_periods'],
                            'conducted_periods': a['conducted_periods'],
                            'attendance_percentage': a['attendance_percentage']
                        })

                # Bulk insert new attendance records
                if insert_mappings:
                    db.session.bulk_insert_mappings(AttendanceRecord, insert_mappings)
                
                # Don't commit here - let the caller control the transaction
                # db.session.commit()
                db.session.flush()
                
                # Invalidate cache after successful data import
                from backend.services.attendance_service import invalidate_cache
                invalidate_cache()
                
                elapsed = (time.perf_counter() - start_time) * 1000
                print(f"✓ Upload completed successfully!")
                print(f"  Courses: {len(new_courses)} new, {len(course_map)-len(new_courses)} existing")
                print(f"  Students: {len(new_students)} new, {len(student_map)-len(new_students)} existing")
                print(f"  Attendance records:")
                print(f"    • Total in file: {total_attendance_records}")
                print(f"    • Inserted: {len(insert_mappings)}")
                print(f"    • Skipped (< {MIN_CONDUCTED_PERIODS} classes): {skipped_min_periods}")
                print(f"    • Skipped (duplicate): {skipped_duplicate}")
                print(f"  Processing time: {elapsed:.2f} ms ({elapsed/1000:.2f}s)")
                return {
                    'success': True,
                    'metrics': {
                        'courses_new': len(new_courses),
                        'courses_existing': len(course_map) - len(new_courses),
                        'students_new': len(new_students),
                        'students_existing': len(student_map) - len(new_students),
                        'total_in_file': total_attendance_records,
                        'inserted': len(insert_mappings),
                        'skipped_min_periods': skipped_min_periods,
                        'skipped_duplicate': skipped_duplicate,
                        'processing_time_ms': round(elapsed, 2)
                    }
                }
            except OperationalError as e:
                if attempt == max_retries - 1:
                    db.session.rollback()
                    print(f"✗ Upload failed after {max_retries} attempts (OperationalError): {e}")
                    return {'success': False, 'error': str(e)}
                # Retry after disposing engine
                print(f"⚠ Connection error on attempt {attempt + 1}, retrying...")
                db.session.rollback()
                db.engine.dispose()
                time.sleep(0.5)
            except Exception as e:
                db.session.rollback()
                elapsed = (time.perf_counter() - start_time) * 1000
                print(f"✗ Upload failed after {elapsed:.2f} ms: {e}")
                return {'success': False, 'error': str(e)}
    
    def save_to_database(self, processed_data, max_retries=2):
        """Save the processed data to database with bulk operations and retry logic.
        Returns a dict with metrics on success: {
            'success': True,
            'metrics': {
                 'courses_new', 'courses_existing', 'students_new', 'students_existing',
                 'total_in_file', 'inserted', 'skipped_min_periods', 'skipped_duplicate',
                 'processing_time_ms'
            }
        }
        """
        if not processed_data:
            return False

        from sqlalchemy.exc import OperationalError

        for attempt in range(max_retries):
            start_time = time.perf_counter()
            try:
                # ------------------------------
                # 1. Prefetch existing courses
                # ------------------------------
                incoming_course_codes = {c['code'] for c in processed_data['courses'].values()} if processed_data.get('courses') else set()
                existing_courses = Course.query.filter(Course.course_code.in_(incoming_course_codes)).all() if incoming_course_codes else []
                course_map = {c.course_code: c for c in existing_courses}
                new_courses = []
                for c in incoming_course_codes:
                    if c not in course_map:
                        info = next(v for v in processed_data['courses'].values() if v['code'] == c)
                        new_courses.append(Course(course_code=info['code'], course_name=info['name']))
                if new_courses:
                    # Bulk insert new courses for performance
                    course_dicts = [{'course_code': c.course_code, 'course_name': c.course_name} for c in new_courses]
                    db.session.bulk_insert_mappings(Course, course_dicts)
                    db.session.flush()
                    # Refresh course_map by querying inserted + existing
                    existing_courses = Course.query.filter(Course.course_code.in_(incoming_course_codes)).all()
                    course_map = {c.course_code: c for c in existing_courses}

                # ------------------------------
                # 2. Prefetch existing students
                # ------------------------------
                incoming_reg_nos = {s['registration_no'] for s in processed_data['students'] if s['registration_no']}
                existing_students = Student.query.filter(Student.registration_no.in_(incoming_reg_nos)).all() if incoming_reg_nos else []
                student_map = {s.registration_no: s for s in existing_students}
                new_students = []
                for s in processed_data['students']:
                    reg = s['registration_no']
                    if reg and reg not in student_map:
                        new_students.append(Student(admission_no=s['admission_no'], registration_no=reg, name=s['name']))
                if new_students:
                    # Bulk insert new students for performance
                    student_dicts = [{'admission_no': s.admission_no, 'registration_no': s.registration_no, 'name': s.name} for s in new_students]
                    db.session.bulk_insert_mappings(Student, student_dicts)
                    db.session.flush()
                    # Refresh student_map by querying inserted + existing
                    existing_students = Student.query.filter(Student.registration_no.in_(incoming_reg_nos)).all()
                    student_map = {s.registration_no: s for s in existing_students}

                # Commit base entities (courses & students) to ensure IDs are persistent
                # Note: Using flush() instead of commit() to keep transaction open
                db.session.flush()

                # ------------------------------
                # 3. Filter attendance data by minimum conducted periods
                # ------------------------------
                MIN_CONDUCTED_PERIODS = 5
                total_attendance_records = len(processed_data['attendance'])
                filtered_attendance = []
                skipped_min_periods = 0

                for a in processed_data['attendance']:
                    if a['conducted_periods'] >= MIN_CONDUCTED_PERIODS:
                        filtered_attendance.append(a)
                    else:
                        skipped_min_periods += 1

                if not filtered_attendance:
                    from backend.services.attendance_service import invalidate_cache
                    invalidate_cache()
                    elapsed = (time.perf_counter() - start_time) * 1000
                    print(f"⚠ No attendance records meet minimum {MIN_CONDUCTED_PERIODS} conducted periods.")
                    print(f"  Total records: {total_attendance_records}, Skipped (< {MIN_CONDUCTED_PERIODS} classes): {skipped_min_periods}")
                    return {
                        'success': True,
                        'metrics': {
                            'courses_new': len(new_courses),
                            'courses_existing': len(course_map) - len(new_courses),
                            'students_new': len(new_students),
                            'students_existing': len(student_map) - len(new_students),
                            'total_in_file': total_attendance_records,
                            'inserted': 0,
                            'skipped_min_periods': skipped_min_periods,
                            'skipped_duplicate': 0,
                            'processing_time_ms': round(elapsed, 2)
                        }
                    }

                # ------------------------------
                # 4. Bulk fetch existing attendance records to detect duplicates
                # ------------------------------
                from sqlalchemy import tuple_
                pairs = []
                for a in filtered_attendance:
                    student = student_map.get(a['registration_no'])
                    course = course_map.get(a['course_code'])
                    if student and course:
                        pairs.append((student.id, course.id))

                attendance_map = set()
                if pairs:
                    rows = db.session.query(
                        AttendanceRecord.student_id,
                        AttendanceRecord.course_id
                    ).filter(
                        tuple_(AttendanceRecord.student_id, AttendanceRecord.course_id).in_(pairs)
                    ).all()
                    attendance_map = {(r[0], r[1]) for r in rows}

                # ------------------------------
                # 5. Prepare bulk insert mappings (skip existing records)
                # ------------------------------
                insert_mappings = []
                skipped_duplicate = 0

                for a in filtered_attendance:
                    student = student_map.get(a['registration_no'])
                    course = course_map.get(a['course_code'])
                    if not student or not course:
                        continue

                    key = (student.id, course.id)
                    if key in attendance_map:
                        # Already exists, skip to avoid duplicates
                        skipped_duplicate += 1
                    else:
                        insert_mappings.append({
                            'student_id': student.id,
                            'course_id': course.id,
                            'attended_periods': a['attended_periods'],
                            'conducted_periods': a['conducted_periods'],
                            'attendance_percentage': a['attendance_percentage']
                        })

                # Bulk insert new attendance records
                if insert_mappings:
                    db.session.bulk_insert_mappings(AttendanceRecord, insert_mappings)

                # Don't commit here - let the caller control the transaction
                # db.session.commit()
                db.session.flush()

                # Invalidate cache after successful data import
                from backend.services.attendance_service import invalidate_cache
                invalidate_cache()

                elapsed = (time.perf_counter() - start_time) * 1000
                print(f"✓ Upload completed successfully!")
                print(f"  Courses: {len(new_courses)} new, {len(course_map)-len(new_courses)} existing")
                print(f"  Students: {len(new_students)} new, {len(student_map)-len(new_students)} existing")
                print(f"  Attendance records:")
                print(f"    • Total in file: {total_attendance_records}")
                print(f"    • Inserted: {len(insert_mappings)}")
                print(f"    • Skipped (< {MIN_CONDUCTED_PERIODS} classes): {skipped_min_periods}")
                print(f"    • Skipped (duplicate): {skipped_duplicate}")
                print(f"  Processing time: {elapsed:.2f} ms ({elapsed/1000:.2f}s)")
                return {
                    'success': True,
                    'metrics': {
                        'courses_new': len(new_courses),
                        'courses_existing': len(course_map) - len(new_courses),
                        'students_new': len(new_students),
                        'students_existing': len(student_map) - len(new_students),
                        'total_in_file': total_attendance_records,
                        'inserted': len(insert_mappings),
                        'skipped_min_periods': skipped_min_periods,
                        'skipped_duplicate': skipped_duplicate,
                        'processing_time_ms': round(elapsed, 2)
                    }
                }
            except OperationalError as e:
                if attempt == max_retries - 1:
                    db.session.rollback()
                    print(f"✗ Upload failed after {max_retries} attempts (OperationalError): {e}")
                    return {'success': False, 'error': str(e)}
                # Retry after disposing engine
                print(f"⚠ Connection error on attempt {attempt + 1}, retrying...")
                db.session.rollback()
                db.engine.dispose()
                time.sleep(0.5)
            except Exception as e:
                db.session.rollback()
                elapsed = (time.perf_counter() - start_time) * 1000
                print(f"✗ Upload failed after {elapsed:.2f} ms: {e}")
                return {'success': False, 'error': str(e)}

    def cleanup_insufficient_records(self, min_conducted_periods=5):
        """Remove existing records that don't meet minimum conducted periods requirement"""
        try:
            # Find and delete records with less than minimum conducted periods
            insufficient_records = AttendanceRecord.query.filter(
                AttendanceRecord.conducted_periods < min_conducted_periods
            ).all()
            
            deleted_count = len(insufficient_records)
            
            for record in insufficient_records:
                print(f"Removing record for {record.student.registration_no} - {record.course.course_code}: Only {record.conducted_periods} classes")
                db.session.delete(record)
            
            db.session.commit()
            print(f"Cleaned up {deleted_count} records with insufficient conducted periods")
            
            # Invalidate cache after cleanup
            from backend.services.attendance_service import invalidate_cache
            invalidate_cache()
            
            return deleted_count
            
        except Exception as e:
            db.session.rollback()
            print(f"Error during cleanup: {e}")
            return 0
