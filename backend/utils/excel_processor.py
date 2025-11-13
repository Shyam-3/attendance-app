import pandas as pd
import re
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
    
    def save_to_database(self, processed_data):
        """Save the processed data to database"""
        if not processed_data:
            return False
        
        try:
            # Save courses
            for course_info in processed_data['courses'].values():
                existing_course = Course.query.filter_by(course_code=course_info['code']).first()
                if not existing_course:
                    course = Course(
                        course_code=course_info['code'],
                        course_name=course_info['name']
                    )
                    db.session.add(course)
            
            # Save students
            for student_data in processed_data['students']:
                existing_student = Student.query.filter_by(registration_no=student_data['registration_no']).first()
                if not existing_student:
                    student = Student(
                        admission_no=student_data['admission_no'],
                        registration_no=student_data['registration_no'],
                        name=student_data['name']
                    )
                    db.session.add(student)
            
            db.session.commit()  # Commit students and courses first
            
            # Save attendance records with improved logic
            for attendance_data in processed_data['attendance']:
                # Skip records with less than 5 conducted periods
                if attendance_data['conducted_periods'] < 5:
                    print(f"Skipping record for {attendance_data['registration_no']} - {attendance_data['course_code']}: Only {attendance_data['conducted_periods']} classes conducted (minimum 5 required)")
                    continue
                
                student = Student.query.filter_by(registration_no=attendance_data['registration_no']).first()
                course = Course.query.filter_by(course_code=attendance_data['course_code']).first()
                
                if student and course:
                    # Check if record already exists
                    existing_record = AttendanceRecord.query.filter_by(
                        student_id=student.id,
                        course_id=course.id
                    ).first()
                    
                    if existing_record:
                        # Only update if new record has more conducted periods
                        if attendance_data['conducted_periods'] > existing_record.conducted_periods:
                            print(f"Updating record for {attendance_data['registration_no']} - {attendance_data['course_code']}: {existing_record.conducted_periods} -> {attendance_data['conducted_periods']} classes")
                            existing_record.attended_periods = attendance_data['attended_periods']
                            existing_record.conducted_periods = attendance_data['conducted_periods']
                            existing_record.attendance_percentage = attendance_data['attendance_percentage']
                        else:
                            print(f"Skipping record for {attendance_data['registration_no']} - {attendance_data['course_code']}: Existing record has more/equal classes ({existing_record.conducted_periods} >= {attendance_data['conducted_periods']})")
                    else:
                        # Create new record
                        print(f"Adding new record for {attendance_data['registration_no']} - {attendance_data['course_code']}: {attendance_data['conducted_periods']} classes")
                        record = AttendanceRecord(
                            student_id=student.id,
                            course_id=course.id,
                            attended_periods=attendance_data['attended_periods'],
                            conducted_periods=attendance_data['conducted_periods'],
                            attendance_percentage=attendance_data['attendance_percentage']
                        )
                        db.session.add(record)
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Error saving to database: {e}")
            return False
    
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
            return deleted_count
            
        except Exception as e:
            db.session.rollback()
            print(f"Error during cleanup: {e}")
            return 0
