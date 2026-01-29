# 📊 Attendance Management System

A modern, full-stack web application for managing student attendance records with powerful filtering, analytics, and export capabilities.

## 🎯 What is this project?

This is a complete **Attendance Management System** built with a Flask backend (REST API) and React frontend (TypeScript + Vite). It allows educational institutions to:

- **Upload** student attendance data from Excel files (including bulk uploads via ZIP files)
- **Track** attendance percentages across multiple courses
- **Filter** students by course, attendance threshold, or search criteria
- **Exclude** specific courses from analysis
- **Export** filtered data to professionally formatted Excel and PDF reports
- **Manage** records with individual delete and bulk clear operations

The system provides real-time statistics, color-coded attendance indicators, and an intuitive dashboard for quick insights into student performance.

---

## ✨ Key Features

### 📤 File Upload & Processing
- **Multi-file upload**: Upload up to 20 Excel files at once
- **ZIP file support**: Extract and process multiple Excel files from ZIP archives
- **Format support**: `.xlsx`, `.xls`, `.csv` files
- **Smart parsing**: Automatically detects and extracts student data, course info, and attendance records
- **Nested folder support**: Handles Excel files in subdirectories within ZIP files

### 📊 Dashboard & Analytics
- **Real-time statistics cards**:
  - Total students / Filtered student count
  - Active courses / Selected course details
  - Students below 75% attendance
  - Critical students (below 65% attendance)
- **Advanced filtering**:
  - Filter by specific course or view all courses
  - Filter by attendance threshold (below 75%, below 65%, or all students)
  - Search students by registration number or name
  - Exclude multiple courses from view (when viewing all courses)
- **Interactive data table**:
  - Color-coded rows (green ≥75%, yellow 65-75%, red <65%)
  - Sortable columns
  - Hover-to-open dropdown filters
  - Click-to-pin dropdown filters

### 📥 Export Capabilities
- **Excel Export**: Professionally formatted with styled headers, auto-sized columns, and colored rows
- **PDF Export**: Clean reports with title, filter information, colored rows, and timestamp footer
- **Filtered exports**: Exports respect all active filters (course, threshold, search, exclude)
- **Timestamped filenames**: Automatic naming with date and filter info

### 🔧 Data Management
- **Individual record deletion**: Remove specific attendance records
- **Bulk data clearing**: Clear all data with confirmation prompt
- **Real-time updates**: UI updates immediately after data modifications
- **Data persistence**: PostgreSQL (Supabase) or SQLite database for reliable storage

---

## 🏗️ Architecture

### Backend (Flask + SQLAlchemy)
- **Framework**: Flask 3.0+ with RESTful API design
- **Database**: PostgreSQL (Supabase) or SQLite with SQLAlchemy ORM
- **Structure**:
  - `app.py` - Main application with route definitions
  - `backend/models.py` - Database models (Student, Course, AttendanceRecord)
  - `backend/services/attendance_service.py` - Business logic and statistics
  - `backend/utils/excel_processor.py` - Excel file parsing
  - `backend/utils/export_utils.py` - PDF and Excel generation
  - `backend/config.py` - Configuration settings

### Frontend (React + TypeScript)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7 for fast development and optimized builds
- **UI Library**: Bootstrap 5 for responsive design
- **Structure**:
  - `frontend/src/pages/Dashboard.tsx` - Main dashboard with filters and table
  - `frontend/src/pages/Upload.tsx` - File upload interface
  - `frontend/src/lib/api.ts` - API client for backend communication
  - `frontend/src/App.tsx` - Main app component with routing

---

## 🚀 How to Run

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher
- **npm**: Comes with Node.js

### Backend Setup

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Database** (Choose one):
   
   **Option A: PostgreSQL (Supabase) - Recommended for production**
   - See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed setup instructions
   - Create a `.env` file with your Supabase connection string:
     ```
     DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
     ```
   
   **Option B: SQLite - Quick local development**
   - No configuration needed
   - Database file will be created automatically at `instance/attendance.db`

3. **Start the Flask server**:
   ```bash
   python app.py
   ```
   The backend API will run on `http://127.0.0.1:5000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://127.0.0.1:5173`

4. **Open in browser**:
   Navigate to `http://127.0.0.1:5173`

### Configuration (Optional)

- **Frontend API URL**: Set `VITE_API_BASE_URL` in `frontend/.env` if backend runs on a different port
- **Backend CORS**: Set `FRONTEND_URL` environment variable if frontend runs on a different port

---

## 📡 API Endpoints

### Data Retrieval
- `GET /api/attendance` - Get filtered attendance records
  - Query params: `course`, `threshold`, `search`, `exclude_courses`
- `GET /api/stats` - Get overall statistics (total students, courses, etc.)
- `GET /api/filtered_stats` - Get statistics for filtered view
  - Query params: `course`, `threshold`, `search`, `exclude_courses`
- `GET /api/courses` - Get list of all courses

### Data Upload & Modification
- `POST /upload` - Upload Excel or ZIP files (multipart/form-data)
- `DELETE /delete_record/:id` - Delete specific attendance record
- `POST /clear_all_data` - Clear all data from database

### Export
- `GET /export/excel` - Export filtered data to Excel
  - Query params: `course`, `threshold`, `search`, `exclude_courses`, `filter_info`
- `GET /export/pdf` - Export filtered data to PDF
  - Query params: `course`, `threshold`, `search`, `exclude_courses`, `filter_info`

---

## 💻 Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Flask | 3.0+ | Web framework and REST API |
| Flask-SQLAlchemy | 3.1+ | Database ORM |
| Flask-CORS | 4.0+ | Cross-origin resource sharing |
| Pandas | 2.0+ | Excel file processing |
| OpenPyXL | 3.1+ | Excel file reading |
| XlsxWriter | 3.2+ | Excel file writing/export |
| ReportLab | 4.0+ | PDF generation |
| SQLAlchemy | 2.0+ | Database toolkit |
| psycopg2-binary | 2.9+ | PostgreSQL adapter |
| python-dotenv | 1.0+ | Environment variable management |
| Werkzeug | 2.3+ | WSGI utilities |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.1+ | UI framework |
| TypeScript | 5.8+ | Type-safe JavaScript |
| Vite | 7.1+ | Build tool and dev server |
| Bootstrap | 5.3+ | CSS framework |
| JSZip | 3.10+ | ZIP file extraction |

---

## 🗄️ Database Schema

### Student
- `id` (Primary Key)
- `registration_no` (Unique)
- `name`
- `created_at`

### Course
- `id` (Primary Key)
- `course_code` (Unique)
- `course_name`
- `created_at`

### AttendanceRecord
- `id` (Primary Key)
- `student_id` (Foreign Key → Student)
- `course_id` (Foreign Key → Course)
- `attended_periods`
- `conducted_periods`
- `attendance_percentage`
- `created_at`
- **Unique constraint**: `(student_id, course_id)`

---

## 📁 Project Structure

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for detailed directory structure and file descriptions.

---

## 🎨 User Interface Features

### Hover-to-Open Dropdowns
- Dropdowns open automatically on hover for quick access
- Click to "pin" dropdown open for selection
- Radio dropdowns (Course, Threshold) close immediately after selection
- Checkbox dropdown (Exclude Courses) stays open for multiple selections

### Smart Filter Interactions
- Selecting a specific course disables and resets "Exclude Courses"
- Exclude Courses only available when viewing "All Courses"
- Clear button resets all filters instantly

### Color-Coded Attendance
- 🟢 **Green**: ≥75% attendance (good standing)
- 🟡 **Yellow**: 65-74% attendance (warning)
- 🔴 **Red**: <65% attendance (critical)

---

## 🔒 Data Management

- Database options:
  - **PostgreSQL (Supabase)**: Cloud-hosted, recommended for production
  - **SQLite**: Local file stored in `instance/attendance.db` (auto-created)
- Uploaded files temporarily stored in `uploads/` directory
- All exports are generated on-the-fly (not stored permanently)

---

## 🚀 Deployment Notes

- **Database**: Use PostgreSQL (Supabase recommended) for production - see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
- **Static Files**: Use a CDN for frontend assets
- **Environment Variables**: Configure `FRONTEND_URL` and `VITE_API_BASE_URL`
- **Security**: Add authentication/authorization for production use
- **CORS**: Restrict CORS origins in production

---

## 📝 License

This project is built for academic purposes.

---

**Built with ❤️ for academic excellence**