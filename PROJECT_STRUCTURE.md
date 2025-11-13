# Project Structure

## Overview
This is an Attendance Management System built with Flask (backend) and React (frontend).

## Directory Structure

```
attendance-report-react/
│
├── app.py                          # Main Flask application entry point
├── requirements.txt                # Python dependencies
├── .gitignore                      # Git ignore rules
│
├── backend/                        # Backend Python code
│   ├── __init__.py
│   ├── config.py                   # Configuration settings
│   ├── models.py                   # Database models (Student, Course, AttendanceRecord)
│   │
│   ├── services/                   # Business logic layer
│   │   ├── __init__.py
│   │   └── attendance_service.py  # Attendance calculations and statistics
│   │
│   └── utils/                      # Utility modules
│       ├── __init__.py
│       ├── excel_processor.py     # Excel file parsing and processing
│       └── export_utils.py        # PDF and Excel export functionality
│
├── frontend/                       # React frontend application
│   ├── package.json               # Frontend dependencies
│   ├── vite.config.ts             # Vite configuration
│   ├── tsconfig.json              # TypeScript configuration
│   ├── index.html                 # HTML entry point
│   │
│   └── src/                       # React source code
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Main app component
│       ├── App.css                # Global styles
│       ├── index.css              # Base styles
│       │
│       ├── lib/                   # API and utilities
│       │   └── api.ts             # Backend API client
│       │
│       └── pages/                 # Page components
│           ├── Dashboard.tsx      # Main dashboard with filters and table
│           └── Upload.tsx         # File upload page
│
├── instance/                       # Flask instance folder (gitignored)
│   └── attendance.db              # SQLite database
│
├── README.md                       # Main project documentation
├── CODE_EXPLANATION.md             # Detailed code documentation
└── PROJECT_STRUCTURE.md            # This file - project structure reference
```

## Key Files

### Backend
- **app.py**: Main Flask application with routes and endpoints
- **backend/config.py**: Configuration for database, CORS, frontend URL
- **backend/models.py**: SQLAlchemy ORM models
- **backend/services/attendance_service.py**: Business logic for attendance calculations
- **backend/utils/excel_processor.py**: Excel file parsing and data extraction
- **backend/utils/export_utils.py**: Export to PDF and Excel

### Frontend
- **frontend/src/pages/Dashboard.tsx**: Main dashboard with filters, statistics cards, and data table
- **frontend/src/pages/Upload.tsx**: File upload interface with ZIP support
- **frontend/src/lib/api.ts**: API client for backend communication
- **frontend/src/App.css**: Global CSS styles
- **frontend/src/App.tsx**: Main app component with routing

## API Endpoints

### Data Retrieval
- `GET /api/attendance` - Get filtered attendance records
  - Query params: `course`, `threshold`, `search`, `exclude_courses`
- `GET /api/stats` - Get overall statistics
- `GET /api/filtered_stats` - Get filtered statistics
  - Query params: `course`, `threshold`, `search`, `exclude_courses`
- `GET /api/courses` - Get all courses

### Data Modification
- `POST /upload` - Upload Excel or ZIP files (multipart/form-data)
- `DELETE /delete_record/:id` - Delete specific attendance record
- `POST /clear_all_data` - Clear all data from database

### Export
- `GET /export/excel` - Export filtered data to Excel
  - Query params: `course`, `threshold`, `search`, `exclude_courses`, `filter_info`
- `GET /export/pdf` - Export filtered data to PDF
  - Query params: `course`, `threshold`, `search`, `exclude_courses`, `filter_info`

## Features

### Dashboard
- **Advanced Filtering**:
  - Filter by specific course or view all courses
  - Filter by attendance threshold (below 75%, below 65%, or all students)
  - Search students by registration number or name
  - Exclude multiple courses from view (only available when viewing all courses)
  - Smart filter interactions (selecting a course disables exclude courses)
- **Statistics Cards**:
  - Total students / Filtered student count
  - Active courses / Selected course details
  - Students below 75%
  - Critical students (below 65%)
- **Interactive Table**:
  - Color-coded rows (green ≥75%, yellow 65-74%, red <65%)
  - Hover-to-open dropdown filters
  - Click-to-pin dropdown filters
  - Individual record deletion
- **Export Capabilities**:
  - Export filtered data to Excel (styled, with colored rows)
  - Export filtered data to PDF (formatted with title, filters, footer)
  - Timestamped filenames with filter information

### Upload
- Multi-file upload (up to 20 files)
- ZIP file extraction support (extracts Excel files from ZIP archives)
- Supports `.xlsx`, `.xls`, `.csv` file formats
- Handles nested folders within ZIP files
- Automatic Excel file processing
- Real-time progress feedback

## Database Schema

### Student
- `id` (Primary Key)
- `registration_no` (Unique) - Student's registration number
- `name` - Student's full name
- `created_at` - Timestamp

### Course
- `id` (Primary Key)
- `course_code` (Unique) - Course code (e.g., "BBA-101")
- `course_name` - Full course name
- `created_at` - Timestamp

### AttendanceRecord
- `id` (Primary Key)
- `student_id` (Foreign Key → Student)
- `course_id` (Foreign Key → Course)
- `attended_periods` - Number of periods attended
- `conducted_periods` - Total number of periods conducted
- `attendance_percentage` - Calculated percentage
- `created_at` - Timestamp
- **Unique constraint**: `(student_id, course_id)` - One record per student per course

## Tech Stack

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Flask | 3.0+ | Web framework |
| Flask-SQLAlchemy | 3.1+ | Database ORM |
| Flask-CORS | 4.0+ | Cross-origin support |
| Pandas | 2.0+ | Excel processing |
| OpenPyXL | 3.1+ | Excel reading |
| XlsxWriter | 3.2+ | Excel writing |
| ReportLab | 4.0+ | PDF generation |
| SQLAlchemy | 2.0+ | Database toolkit |
| Werkzeug | 2.3+ | WSGI utilities |

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| React | 19.1+ | UI framework |
| TypeScript | 5.8+ | Type safety |
| Vite | 7.1+ | Build tool |
| Bootstrap | 5.3+ | CSS framework |
| JSZip | 3.10+ | ZIP extraction |

## Development

### Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Run Flask server
python app.py
```
Server runs on: `http://127.0.0.1:5000`

### Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```
Server runs on: `http://127.0.0.1:5173`

### Production Build
```bash
cd frontend
npm run build
```
Builds optimized static files to `frontend/dist/`

## Configuration

### Environment Variables
- **Backend**:
  - `FRONTEND_URL` - Frontend URL for CORS (default: `http://127.0.0.1:5173`)
  
- **Frontend**:
  - `VITE_API_BASE_URL` - Backend API URL (default: `http://127.0.0.1:5000`)

### Database
- **Development**: SQLite database at `instance/attendance.db`
- **Production**: Configure PostgreSQL or MySQL in `backend/config.py`

## Notes
- Database file is automatically created on first run
- CORS is enabled for local development
- Uploads are temporarily stored in `uploads/` directory
- All exports are generated on-the-fly (not stored)
- Color-coded attendance: Green (≥75%), Yellow (65-74%), Red (<65%)
