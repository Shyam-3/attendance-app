"""
Clean Flask Application for Attendance Management System
Focuses on backend logic, routing, and business operations
"""
import sys
# Prevent Python from generating .pyc files and __pycache__ folders
sys.dont_write_bytecode = True

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, redirect, jsonify
import time
from flask_cors import CORS

# Import our modules
from backend.config import Config
from backend.models import db, init_db
from backend.services.attendance_service import AttendanceService
from backend.utils.excel_processor import ExcelProcessor
from backend.utils.export_utils import ExportUtils

def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enable CORS for React dev server (default: http://localhost:5173)
    CORS(app, resources={r"/api/*": {"origins": "*"},
                         r"/export/*": {"origins": "*"},
                         r"/upload": {"origins": "*"},
                         r"/delete_record/*": {"origins": "*"},
                         r"/clear_all_data": {"origins": "*"},
                         r"/health": {"origins": "*"}})
    
    # Initialize configuration first
    Config.init_app(app)
    
    # Initialize database with retry logic
    try:
        init_db(app)
        print("✓ Database initialized successfully!")
    except Exception as e:
        print(f"✗ Database initialization failed: {e}")
        print("Please check your DATABASE_URL in .env file")
        raise
    
    return app

app = create_app()
excel_processor = ExcelProcessor()
attendance_service = AttendanceService()
export_utils = ExportUtils()

def allowed_file(filename):
    """Check if uploaded file has valid extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'xlsx', 'xls', 'csv'}

@app.route('/')
def dashboard():
    """Redirect root to React frontend"""
    return redirect(Config.FRONTEND_URL)

@app.route('/health')
def health_check():
    """Health check endpoint to verify database connection"""
    try:
        # Test database connection
        db.session.execute(db.text('SELECT 1'))
        db.session.commit()
        
        return jsonify({
            'status': 'healthy',
            'database': 'PostgreSQL (Supabase)',
            'message': 'Database connection successful'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'message': 'Database connection failed'
        }), 500

@app.route('/upload')
def upload_page():
    """Redirect upload path to React frontend"""
    return redirect(f"{Config.FRONTEND_URL}/upload")


@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    """Handle file upload processing (linear processing - one file at a time)"""
    if request.method == 'GET':
        return redirect(f"{Config.FRONTEND_URL}/upload")
    
    # Handle POST request (file upload)
    if 'files' not in request.files:
        return jsonify({ 'success': False, 'error': 'No files selected' }), 400
    
    files = request.files.getlist('files')
    if not files or len(files) == 0 or (len(files) == 1 and files[0].filename == ''):
        return jsonify({ 'success': False, 'error': 'No files selected' }), 400
    
    if len(files) > 21:
        return jsonify({ 'success': False, 'error': 'Maximum 20 files allowed at once' }), 400

    processed_files = 0
    errors = []
    file_logs = []  # per-file timings for browser console
    total_start = time.perf_counter()
    
    # Process files linearly (typically one file per request from frontend)
    try:
        for file in files:
            if not file or not allowed_file(file.filename):
                errors.append(f"Invalid file type: {file.filename}")
                continue
            
            # Process the file based on its type
            if file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
                print(f"➡️  Starting processing for file: {file.filename}")
                file_start = time.perf_counter()
                success = process_excel_file_from_memory(file)
                if isinstance(success, dict):
                    success_flag = bool(success.get('success', False))
                else:
                    success_flag = bool(success)
                if success_flag:
                    processed_files += 1
                    # Commit after each file for linear processing
                    db.session.commit()
                    file_elapsed = (time.perf_counter() - file_start) * 1000
                    metrics = success.get('metrics') if isinstance(success, dict) else None
                    file_log = {
                        'name': file.filename,
                        'elapsed_ms': round(file_elapsed, 2)
                    }
                    if metrics:
                        file_log.update({
                            'courses_new': metrics.get('courses_new'),
                            'courses_existing': metrics.get('courses_existing'),
                            'students_new': metrics.get('students_new'),
                            'students_existing': metrics.get('students_existing'),
                            'total_in_file': metrics.get('total_in_file'),
                            'inserted': metrics.get('inserted'),
                            'skipped_min_periods': metrics.get('skipped_min_periods'),
                            'skipped_duplicate': metrics.get('skipped_duplicate'),
                            'server_processing_ms': metrics.get('processing_time_ms')
                        })
                    file_logs.append(file_log)
                    print(f"✅ Finished processing {file.filename} in {file_elapsed:.2f} ms")
                else:
                    errors.append(f"Failed to process: {file.filename}")
                    db.session.rollback()
                    return jsonify({ 'success': False, 'error': f"Failed to process: {file.filename}" }), 500
            else:
                errors.append(f"Unsupported file format: {file.filename}")
        
        if processed_files > 0:
            total_elapsed = (time.perf_counter() - total_start) * 1000
            print(f"⏱️  Total processing time for this upload: {total_elapsed:.2f} ms")
            message = f"Successfully processed {processed_files} file(s)."
            if errors:
                message += f" {len(errors)} file(s) had errors."
            return jsonify({ 'success': True, 'message': message, 'files': file_logs, 'total_elapsed_ms': round(total_elapsed, 2) })
        else:
            error_msg = "No files were processed successfully."
            if errors:
                error_msg += f" Errors: {'; '.join(errors[:3])}"  # Show first 3 errors
            return jsonify({ 'success': False, 'error': error_msg }), 500
            
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error processing uploads: {e}")
        return jsonify({ 'success': False, 'error': 'An error occurred while processing the file.' }), 500

def process_excel_file_from_memory(file):
    """Process Excel file directly from memory and save to database"""
    try:
        # Process Excel file directly from uploaded file object
        processed_data = excel_processor.process_excel_file_from_memory(file)
        
        if processed_data:
            # Save to database
            return excel_processor.save_to_database(processed_data)
        return False
        
    except Exception as e:
        app.logger.error(f"Error processing Excel file: {e}")
        return False

@app.route('/api/attendance')
def api_attendance():
    """API endpoint for filtered attendance data"""
    course_code = request.args.get('course', '')
    threshold = float(request.args.get('threshold', 75))
    search = request.args.get('search', '')
    exclude_courses_str = request.args.get('exclude_courses', '')
    
    # Parse excluded courses (comma-separated)
    exclude_courses = [c.strip() for c in exclude_courses_str.split(',') if c.strip()] if exclude_courses_str else None
    
    # Pagination support
    try:
        page = int(request.args.get('page', 1))
    except ValueError:
        page = 1
    try:
        per_page = int(request.args.get('per_page', 100))
    except ValueError:
        per_page = 100

    # Get filtered records (with pagination)
    records = attendance_service.get_filtered_attendance_records(
        course_code=course_code,
        threshold=threshold,
        search=search,
        exclude_courses=exclude_courses,
        page=page,
        per_page=per_page
    )
    
    # Get total count for pagination
    total_count = attendance_service.get_filtered_attendance_count(
        course_code=course_code,
        threshold=threshold,
        search=search,
        exclude_courses=exclude_courses
    )
    
    # Format for JSON response with pagination info
    data = attendance_service.format_attendance_data_for_export(records)
    return jsonify({
        'records': data,
        'total': total_count,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_count + per_page - 1) // per_page if per_page > 0 else 0
    })

@app.route('/api/stats')
def api_stats():
    """API endpoint for dashboard statistics (overall)"""
    return jsonify(attendance_service.calculate_dashboard_stats())

@app.route('/api/filtered_stats')
def api_filtered_stats():
    """API endpoint for filtered dashboard statistics"""
    course_code = request.args.get('course', '')
    threshold = float(request.args.get('threshold', 75))
    search = request.args.get('search', '')
    exclude_courses_str = request.args.get('exclude_courses', '')
    
    # Parse excluded courses (comma-separated)
    exclude_courses = [c.strip() for c in exclude_courses_str.split(',') if c.strip()] if exclude_courses_str else None
    
    return jsonify(attendance_service.calculate_filtered_stats(
        course_code=course_code, 
        threshold=threshold, 
        search=search,
        exclude_courses=exclude_courses
    ))

@app.route('/api/courses')
def api_courses():
    """API endpoint for course list"""
    courses = attendance_service.get_all_courses()
    return jsonify([{'code': c.course_code, 'name': c.course_name} for c in courses])

@app.route('/export/excel')
def export_excel():
    """Export attendance data to Excel"""
    course_code = request.args.get('course', '')
    threshold = float(request.args.get('threshold', 75))
    search = request.args.get('search', '')
    exclude_courses = request.args.get('exclude_courses', '')
    exclude_courses = [c for c in exclude_courses.split(',') if c] if exclude_courses else []


    # Get filtered records
    # If threshold is 100, ignore threshold filter (export all students)
    if threshold == 100:
        # Remove threshold filter, get all students for other filters
        records = attendance_service.get_filtered_attendance_records(
            course_code=course_code,
            threshold=101,  # Use a value above 100 to skip filter
            search=search,
            exclude_courses=exclude_courses,
            page=1,
            per_page=None
        )
    else:
        records = attendance_service.get_filtered_attendance_records(
            course_code=course_code,
            threshold=threshold,
            search=search,
            exclude_courses=exclude_courses,
            page=1,
            per_page=None
        )


    # Prepare filter info for Excel
    filter_info = []
    if course_code:
        filter_info.append(f"Course: {course_code}")
    if threshold < 100:
        filter_info.append(f"Attendance below: {threshold}%")
    if search:
        filter_info.append(f"Search: {search}")
    # Do not include excluded courses in filter_info/filename

    # Format data for export
    data = attendance_service.format_attendance_data_for_export(records)

    # Generate Excel file with filter info
    return export_utils.generate_excel_export(data, filter_info=filter_info)

@app.route('/export/pdf')
def export_pdf():
    """Export attendance data to PDF"""
    course_code = request.args.get('course', '')
    threshold = float(request.args.get('threshold', 75))
    search = request.args.get('search', '')
    exclude_courses = request.args.get('exclude_courses', '')
    exclude_courses = [c for c in exclude_courses.split(',') if c] if exclude_courses else []

    # Get filtered records
    if threshold == 100:
        records = attendance_service.get_filtered_attendance_records(
            course_code=course_code,
            threshold=101,
            search=search,
            exclude_courses=exclude_courses,
            page=1,
            per_page=None
        )
    else:
        records = attendance_service.get_filtered_attendance_records(
            course_code=course_code,
            threshold=threshold,
            search=search,
            exclude_courses=exclude_courses,
            page=1,
            per_page=None
        )


    # Prepare filter info for PDF
    filter_info = []
    if course_code:
        filter_info.append(f"Course: {course_code}")
    if threshold < 100:
        filter_info.append(f"Attendance below: {threshold}%")
    if search:
        filter_info.append(f"Search: {search}")
    # Do not include excluded courses in filter_info/filename

    # Generate PDF file
    return export_utils.generate_pdf_export(records, filter_info)

@app.route('/delete_record/<int:record_id>', methods=['DELETE'])
def delete_record(record_id):
    """Delete a specific attendance record"""
    try:
        success = attendance_service.delete_attendance_record(record_id)
        if success:
            return jsonify({'success': True, 'message': 'Record deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Record not found'}), 404
    except Exception as e:
        app.logger.error(f"Error deleting record {record_id}: {e}")
        return jsonify({'success': False, 'message': 'Error deleting record'}), 500

@app.route('/clear_all_data', methods=['POST'])
def clear_all_data():
    """Clear all attendance data from database"""
    try:
        success = attendance_service.clear_all_data()
        if success:
            return jsonify({'success': True, 'message': 'All data cleared successfully'})
        else:
            return jsonify({'success': False, 'message': 'Error clearing data'}), 500
    except Exception as e:
        app.logger.error(f"Error clearing all data: {e}")
        return jsonify({'success': False, 'message': 'Error clearing data'}), 500


@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors"""
    return jsonify({ 'success': False, 'error': 'Page not found' }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    db.session.rollback()
    return jsonify({ 'success': False, 'error': 'Internal server error' }), 500

if __name__ == '__main__':
    with app.app_context():
        print("✅ Database ready")
        print("🚀 Starting Attendance Management System...")
        print("📱 Backend API: http://127.0.0.1:5000")
        print("📊 Health check: http://127.0.0.1:5000/health")
    
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=app.config['DEBUG'],
        use_reloader=app.config['DEBUG']
    )