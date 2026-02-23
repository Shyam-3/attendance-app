# 📊 Attendance Management System

A modern, full-stack web application for managing student attendance records with user authentication, powerful filtering, analytics, and export capabilities.

## 🎯 What is this project?

This is a complete **Attendance Management System** built with a Node.js/Express backend (TypeScript, REST API) and React frontend (TypeScript + Vite). It allows teachers to securely manage their students' attendance data with full isolation between users. Key capabilities include:

- **Authenticate** with a personal teacher account (sign up / login via Supabase Auth)
- **Upload** student attendance data from Excel files (including bulk uploads via ZIP files)
- **Track** attendance percentages across multiple courses
- **Filter** students by course, attendance threshold, or search criteria
- **Exclude** specific courses from analysis
- **Export** filtered data to professionally formatted Excel and PDF reports
- **Manage** records with individual delete and bulk clear operations

The system provides real-time statistics, color-coded attendance indicators, and an intuitive dashboard for quick insights into student performance. All data is isolated per user — each teacher only sees their own records.

---

## ✨ Key Features

### 🔐 Authentication & Multi-User Support
- **Sign up / Login**: Teacher accounts powered by Supabase Auth
- **Protected routes**: Dashboard and Upload pages require authentication
- **Per-user data isolation**: Each teacher's students, courses, and attendance records are fully separate
- **Persistent sessions**: Stay logged in across browser refreshes
- **Logout**: Securely end your session from the navbar

### 📤 File Upload & Processing
- **Multi-file upload**: Upload up to 20 Excel files at once with per-file progress tracking
- **ZIP file support**: Extract and process multiple Excel files from ZIP archives (client-side extraction via JSZip)
- **Format support**: `.xlsx`, `.xls`, `.csv` files
- **Smart parsing**: Automatically detects and extracts student data, course info, and attendance records
- **Nested folder support**: Handles Excel files in subdirectories within ZIP files
- **Upload progress bar**: Visual progress indicator with per-file status (processing / success / error)

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
- **Pagination**: Efficiently browse large datasets with server-side pagination

### 📥 Export Capabilities
- **Excel Export**: Professionally formatted with styled headers, auto-sized columns, and colored rows
- **PDF Export**: Clean reports with title, filter information, colored rows, and timestamp footer
- **Filtered exports**: Exports respect all active filters (course, threshold, search, exclude)
- **Timestamped filenames**: Automatic naming with date and filter info

### 🔧 Data Management
- **Individual record deletion**: Remove specific attendance records
- **Bulk data clearing**: Clear all your data with confirmation prompt
- **Real-time updates**: UI updates immediately after data modifications
- **Data persistence**: PostgreSQL (Supabase) for reliable, cloud-hosted storage

---

## 🏗️ Architecture

### Backend (Express.js + TypeScript)
- **Framework**: Express 4.19+ with RESTful API design
- **Database**: PostgreSQL via `pg` (raw SQL, connection pooling)
- **Auth**: Supabase Auth JWT verification middleware
- **Structure**:
  - `backend/src/index.ts` - Main application entry point, server startup, and migrations
  - `backend/src/routes/api.ts` - Attendance, stats, and courses endpoints
  - `backend/src/routes/upload.ts` - File upload and processing route
  - `backend/src/routes/export.ts` - Excel and PDF export routes
  - `backend/src/services/attendanceService.ts` - Business logic, statistics, and caching
  - `backend/src/utils/excelProcessor.ts` - Excel file parsing and database operations
  - `backend/src/utils/exportUtils.ts` - PDF and Excel report generation
  - `backend/src/middleware/auth.ts` - Supabase JWT authentication middleware
  - `backend/src/db/index.ts` - Database pool, queries, and migration runner

### Frontend (React + TypeScript)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7 for fast development and optimized builds
- **UI Library**: Bootstrap 5 for responsive design
- **Structure**:
  - `frontend/src/App.tsx` - Main app component with routing and auth provider
  - `frontend/src/pages/Dashboard.tsx` - Main dashboard with filters and table
  - `frontend/src/pages/Upload.tsx` - File upload interface with progress tracking
  - `frontend/src/pages/Login.tsx` - Sign-in page
  - `frontend/src/pages/Signup.tsx` - Teacher account registration page
  - `frontend/src/components/Navbar.tsx` - Navigation bar with user info and logout
  - `frontend/src/components/ProtectedRoute.tsx` - Auth guard for protected pages
  - `frontend/src/contexts/AuthContext.tsx` - Supabase Auth state and helpers
  - `frontend/src/lib/api.ts` - API client (attaches auth tokens to every request)
  - `frontend/src/lib/supabase.ts` - Supabase client initialization

### Firebase (Deployment)
- **Firebase Hosting**: Serves the compiled React frontend (`frontend/dist`)
- **Firebase Functions**: `functions/src/index.ts` — Express app exported as a Cloud Function (`api`)

---

## 🚀 How to Run

### Prerequisites
- **Node.js**: 18 or higher
- **npm**: Comes with Node.js
- **Supabase project**: For database and authentication ([supabase.com](https://supabase.com))

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the `backend/` directory:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   PORT=5000
   FRONTEND_URL=http://127.0.0.1:5173
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The backend API will run on `http://127.0.0.1:5000`.  
   Tables and indexes are created automatically on first start.

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the `frontend/` directory:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_BASE_URL=http://127.0.0.1:5000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://127.0.0.1:5173`

5. **Open in browser**:
   Navigate to `http://127.0.0.1:5173` and sign up for a teacher account.

### One-command setup (from repo root)

```bash
npm run setup   # installs dependencies for backend, frontend, and functions
npm run dev:backend   # start backend
npm run dev:frontend  # start frontend (in a separate terminal)
```

---

## 📡 API Endpoints

> All endpoints (except `/health`) require a valid Supabase JWT in the `Authorization: Bearer <token>` header.

### Data Retrieval
- `GET /api/attendance` - Get filtered, paginated attendance records
  - Query params: `course`, `threshold`, `search`, `exclude_courses`, `page`, `per_page`
- `GET /api/stats` - Get overall statistics (total students, courses, etc.)
- `GET /api/filtered_stats` - Get statistics for the current filter view
  - Query params: `course`, `threshold`, `search`, `exclude_courses`
- `GET /api/courses` - Get list of all courses for the authenticated user

### Data Upload & Modification
- `POST /upload` - Upload Excel files (multipart/form-data, up to 20 files)
- `DELETE /delete_record/:id` - Delete a specific attendance record
- `POST /clear_all_data` - Clear all data for the authenticated user

### Export
- `POST /export/excel` - Export filtered data to Excel
  - Body (JSON): `course`, `threshold`, `search`, `exclude_courses`
- `POST /export/pdf` - Export filtered data to PDF
  - Body (JSON): `course`, `threshold`, `search`, `exclude_courses`

### Health
- `GET /health` - Check server and database connectivity

---

## 💻 Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.19+ | Web framework and REST API |
| TypeScript | 5.6+ | Type-safe JavaScript |
| pg | 8.0+ | PostgreSQL client with connection pooling |
| @supabase/supabase-js | 2.86+ | Supabase Auth JWT verification |
| Multer | 1.4+ | Multipart file upload handling |
| ExcelJS | 4.4+ | Excel file reading and export |
| PDFKit | 0.15+ | PDF generation |
| dotenv | 16+ | Environment variable management |
| cors | 2.8+ | Cross-origin resource sharing |
| Morgan | 1.10+ | HTTP request logging |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.1+ | UI framework |
| TypeScript | 5.8+ | Type-safe JavaScript |
| Vite | 7.1+ | Build tool and dev server |
| React Router | 7.9+ | Client-side routing |
| Bootstrap | 5.3+ | CSS framework |
| @supabase/supabase-js | 2.86+ | Authentication (sign up / login / session) |
| JSZip | 3.10+ | Client-side ZIP file extraction |

### Deployment
| Technology | Purpose |
|-----------|---------|
| Firebase Hosting | Serves the compiled React frontend |
| Firebase Functions | Hosts the Express backend as a Cloud Function |
| Supabase | PostgreSQL database + Auth provider |

---

## 🗄️ Database Schema

### students
- `id` (Primary Key, serial)
- `user_id` (VARCHAR — Supabase Auth user ID)
- `admission_no` (VARCHAR, optional)
- `registration_no` (VARCHAR, not null)
- `name` (VARCHAR, not null)
- `created_at` (TIMESTAMP)
- **Unique constraint**: `(user_id, registration_no)`

### courses
- `id` (Primary Key, serial)
- `user_id` (VARCHAR — Supabase Auth user ID)
- `course_code` (VARCHAR, not null)
- `course_name` (VARCHAR, not null)
- `created_at` (TIMESTAMP)
- **Unique constraint**: `(user_id, course_code)`

### attendance_records
- `id` (Primary Key, serial)
- `user_id` (VARCHAR — Supabase Auth user ID)
- `student_id` (Foreign Key → students)
- `course_id` (Foreign Key → courses)
- `attended_periods` (INTEGER)
- `conducted_periods` (INTEGER)
- `attendance_percentage` (DECIMAL 5,2)
- `upload_date` (TIMESTAMP)
- **Unique constraint**: `(user_id, student_id, course_id)`

> Tables and indexes are created automatically at server startup via the built-in migration runner.

---

## 📁 Project Structure

```
attendance-app/
├── backend/                    # Express.js + TypeScript backend
│   ├── src/
│   │   ├── index.ts            # App entry point, server startup
│   │   ├── db/index.ts         # PostgreSQL pool, queries, migrations
│   │   ├── middleware/auth.ts  # Supabase JWT auth middleware
│   │   ├── routes/
│   │   │   ├── api.ts          # Attendance, stats, courses endpoints
│   │   │   ├── upload.ts       # File upload route
│   │   │   └── export.ts       # Excel & PDF export routes
│   │   ├── services/
│   │   │   └── attendanceService.ts  # Business logic & caching
│   │   └── utils/
│   │       ├── excelProcessor.ts     # Excel parsing & DB save
│   │       └── exportUtils.ts        # Excel/PDF report generation
│   └── package.json
├── frontend/                   # React + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx             # Router + AuthProvider setup
│   │   ├── components/
│   │   │   ├── Navbar.tsx      # Top navigation bar
│   │   │   └── ProtectedRoute.tsx  # Auth guard
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx # Supabase auth state & helpers
│   │   ├── lib/
│   │   │   ├── api.ts          # API client (attaches auth tokens)
│   │   │   └── supabase.ts     # Supabase client
│   │   └── pages/
│   │       ├── Dashboard.tsx   # Main dashboard
│   │       ├── Upload.tsx      # File upload page
│   │       ├── Login.tsx       # Sign-in page
│   │       └── Signup.tsx      # Sign-up page
│   └── package.json
├── functions/                  # Firebase Cloud Functions
│   └── src/index.ts            # Express app as Firebase Function
├── firebase.json               # Firebase Hosting + Functions config
├── package.json                # Root scripts (setup, build, deploy)
└── README.md
```

---

## 🎨 User Interface Features

### Authentication Pages
- Clean login and signup forms with validation
- Show/hide password toggle
- Error messages for invalid credentials or duplicate accounts
- Auto-redirect to dashboard after successful authentication

### Navbar
- Displays the logged-in teacher's name or email
- Links to Dashboard and Upload pages with active highlighting
- Logout button to securely end the session

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

## 🔒 Data Management & Security

- **User data isolation**: All database queries are scoped by `user_id` — no cross-user data leakage
- **JWT authentication**: Every API request is verified via Supabase Auth before touching the database
- **Database**: PostgreSQL hosted on Supabase (cloud-managed, auto-backups)
- All exports are generated on-the-fly and never stored permanently on the server

---

## 🚀 Deployment

### Firebase Hosting (Frontend)
```bash
npm run build:frontend          # Build the React app
npm run deploy:hosting          # Deploy to Firebase Hosting
```

### Firebase Functions (Backend)
```bash
npm run deploy:functions        # Build & deploy backend as Cloud Function
```

### Full deployment
```bash
npm run deploy                  # Build frontend + deploy both hosting and functions
```

### Environment Variables for Production
- **Backend**: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FRONTEND_URL`
- **Frontend**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`

---

This project is built for academic purposes.

---

**Built with ❤️ for academic excellence**