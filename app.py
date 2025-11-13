"""
Clean Flask Application for Attendance Management System
Focuses on backend logic, routing, and business operations
"""
import sys
# Prevent Python from generating .pyc files and __pycache__ folders
sys.dont_write_bytecode = True

from flask import Flask, request, redirect, jsonify
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
                         r"/clear_all_data": {"origins": "*"}})
    
    # Initialize database
    init_db(app)
    
    # Initialize configuration
    Config.init_app(app)
    
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

@app.route('/upload')
def upload_page():
    """Redirect upload path to React frontend"""
    return redirect(f"{Config.FRONTEND_URL}/upload")


@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    """Handle upload page display and multiple file upload processing"""
    if request.method == 'GET':
        return redirect(f"{Config.FRONTEND_URL}/upload")
    
    # Handle POST request (multiple file upload)
    if 'files' not in request.files:
        return jsonify({ 'success': False, 'error': 'No files selected' }), 400
    
    files = request.files.getlist('files')
    if not files or len(files) == 0 or (len(files) == 1 and files[0].filename == ''):
        return jsonify({ 'success': False, 'error': 'No files selected' }), 400
    
    if len(files) > 21:
        return jsonify({ 'success': False, 'error': 'Maximum 20 files allowed at once' }), 400

    processed_files = 0
    errors = []
    
    try:
        # Process each file directly from memory
        for file in files:
            if not file or not allowed_file(file.filename):
                errors.append(f"Invalid file type: {file.filename}")
                continue
            
            # Process the file based on its type
            if file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
                success = process_excel_file_from_memory(file)
                if success:
                    processed_files += 1
                else:
                    errors.append(f"Failed to process: {file.filename}")
            else:
                errors.append(f"Unsupported file format: {file.filename}")
        
        if processed_files > 0:
            message = f"Successfully processed {processed_files} file(s)."
            if errors:
                message += f" {len(errors)} file(s) had errors."
            return jsonify({ 'success': True, 'message': message })
        else:
            error_msg = "No files were processed successfully."
            if errors:
                error_msg += f" Errors: {'; '.join(errors[:3])}"  # Show first 3 errors
            return jsonify({ 'success': False, 'error': error_msg }), 500
            
    except Exception as e:
        app.logger.error(f"Error processing uploads: {e}")
        return jsonify({ 'success': False, 'error': 'An error occurred while processing the files.' }), 500

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
    
    # Get filtered records
    records = attendance_service.get_filtered_attendance_records(
        course_code=course_code, 
        threshold=threshold, 
        search=search,
        exclude_courses=exclude_courses
    )
    
    # Format for JSON response
    data = attendance_service.format_attendance_data_for_export(records)
    return jsonify(data)

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
            exclude_courses=exclude_courses
        )
    else:
        records = attendance_service.get_filtered_attendance_records(
            course_code=course_code,
            threshold=threshold,
            search=search,
            exclude_courses=exclude_courses
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
            exclude_courses=exclude_courses
        )
    else:
        records = attendance_service.get_filtered_attendance_records(
            course_code=course_code,
            threshold=threshold,
            search=search,
            exclude_courses=exclude_courses
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
        db.create_all()
        print("✅ Database initialized successfully")
        print("🚀 Starting Attendance Management System...")
        print("📱 Access at: http://127.0.0.1:5000")
    
    app.run(debug=True)