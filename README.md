# 📊 Attendance Tracker

A full-stack attendance management system for educators. Upload Excel attendance sheets, track student performance across courses, filter by thresholds, and export reports — all behind a secure, per-user authentication system.

🌐 **Live**: [attendance-app-501df.web.app](https://attendance-app-501df.web.app)
🔧 **API**: [attendance-app-3a47.onrender.com](https://attendance-app-3a47.onrender.com)

---

## ✨ Features

### Core
- **Secure Authentication** — Email/password login and signup via Supabase Auth
- **Per-user Data Isolation** — Each teacher sees only their own uploaded data
- **Excel Upload** — Upload `.xlsx`, `.xls`, `.csv` files (single or ZIP bundles)
- **Dashboard Analytics** — Real-time stats cards showing total students, active courses, low/critical attendance counts
- **Advanced Filtering** — Filter by course, attendance threshold (75%/65%/All), search by student name or reg number, and exclude specific courses
- **Paginated Records** — Server-side pagination with configurable rows per page
- **Export** — Download filtered results as formatted Excel (`.xlsx`) or PDF
- **Record Management** — Delete individual records or clear all data with typed confirmation

### UI/UX
- **Modern Design** — Indigo-themed with Inter font, glassmorphism auth pages, gradient headers
- **Fully Responsive** — Optimized for phones (≤480px), tablets (≤768px), laptops (≤1024px), and large desktops (≥1400px)
- **Mobile Table Cards** — Attendance table converts to card layout on small screens
- **Touch-Friendly Dropdowns** — Filter dropdowns work with both hover (desktop) and tap (mobile)
- **Soft Light Theme** — Warm off-white backgrounds to reduce eye strain

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Styling** | Bootstrap 5 (grid), Custom CSS with design tokens, Google Fonts (Inter) |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (via Supabase) |
| **Auth** | Supabase Auth (JWT-based) |
| **File Processing** | JSZip (frontend), ExcelJS (backend) |
| **Export** | ExcelJS (Excel), PDFKit (PDF) |
| **Hosting** | Firebase Hosting (frontend), Render (backend API) |

---

## 📁 Project Structure

```
attendance-tracker-ts/
├── frontend/                        # React SPA
│   ├── index.html                   # Entry HTML + Google Fonts
│   ├── src/
│   │   ├── main.tsx                 # React root
│   │   ├── App.tsx                  # Router + AuthProvider
│   │   ├── App.css                  # Shared global styles
│   │   ├── index.css                # Design tokens + resets
│   │   ├── components/
│   │   │   ├── Navbar.tsx + .css    # Navigation bar
│   │   │   ├── ConfirmDialog.tsx    # Reusable modal dialog
│   │   │   ├── ProtectedRoute.tsx   # Auth guard
│   │   │   └── dashboard/
│   │   │       ├── StatsCards.tsx + .css
│   │   │       ├── FilterBar.tsx + .css
│   │   │       ├── AttendanceTable.tsx + .css
│   │   │       └── Pagination.tsx + .css
│   │   ├── pages/
│   │   │   ├── Login.tsx + Auth.css
│   │   │   ├── Signup.tsx
│   │   │   ├── Dashboard.tsx        # Main dashboard (orchestrator)
│   │   │   └── Upload.tsx + .css
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx      # Supabase auth state
│   │   └── lib/
│   │       ├── api.ts              # API client
│   │       └── supabase.ts         # Supabase config
│   ├── .env / .env.local / .env.production
│   └── vite.config.ts
│
├── backend/                         # Express API server
│   └── src/
│       ├── index.ts                 # Express app entry
│       ├── db/                      # Database connection + migrations
│       ├── middleware/              # Auth middleware (JWT verification)
│       ├── routes/                  # API route handlers
│       ├── services/               # Business logic (attendance, export)
│       └── utils/                  # Helpers
│
├── functions/                       # Firebase Cloud Functions (optional)
├── firebase.json                    # Firebase hosting config
├── .env.example                     # Environment template
└── package.json                     # Root scripts (dev, build, deploy)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project (free tier works)
- (Optional) [Firebase CLI](https://firebase.google.com/docs/cli) for deployment

### 1. Clone and Install

```bash
git clone <repo-url>
cd attendance-tracker-ts
npm run setup   # installs backend + frontend + functions deps
```

### 2. Configure Environment

Copy `.env.example` and fill in your credentials:

**Backend** (`backend/.env`):
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=5000
FRONTEND_URL=https://attendance-app-501df.web.app
DEV_FRONTEND_URL=http://localhost:5173
```

**Frontend** (`frontend/.env.local`):
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://127.0.0.1:5000
```

### 3. Run Locally

```bash
# Start both frontend + backend concurrently
npm run dev:full
```

- Frontend: `http://localhost:5173`
- Backend API: `http://127.0.0.1:5000`

### 4. Build for Production

```bash
npm run build              # builds frontend only
npm run build:frontend     # builds frontend
npm run build:backend      # builds backend
```

### 5. Deploy

```bash
npm run deploy:hosting     # deploy frontend to Firebase Hosting
npm run deploy:functions   # deploy Cloud Functions
npm run deploy             # deploy everything
```

---

## 📡 API Endpoints

All endpoints require `Authorization: Bearer <access_token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/attendance` | List filtered, paginated attendance records |
| `GET` | `/api/stats` | Overall statistics (total students, courses, etc.) |
| `GET` | `/api/filtered_stats` | Statistics for current filter selection |
| `GET` | `/api/courses` | List all uploaded courses |
| `POST` | `/upload` | Upload attendance files (multipart form) |
| `POST` | `/export/excel` | Export filtered data as `.xlsx` |
| `POST` | `/export/pdf` | Export filtered data as `.pdf` |
| `DELETE` | `/delete_record/:id` | Delete a single attendance record |
| `POST` | `/clear_all_data` | Delete all data for the current user |
| `GET` | `/health` | Health check |

### Query Parameters for `/api/attendance`

| Param | Type | Description |
|-------|------|-------------|
| `course` | string | Filter by course code |
| `threshold` | number | Attendance threshold (default: 75) |
| `search` | string | Search by student name or registration number |
| `exclude_courses` | string | Comma-separated course codes to exclude |
| `page` | number | Page number (default: 1) |
| `per_page` | number | Records per page (default: 50) |

---

## 📝 Notes

- All data is **isolated per authenticated user** — teachers cannot see each other's data
- Database tables (`students`, `courses`, `attendance_records`) are auto-created on backend startup
- The frontend auto-detects whether to use local or production API based on the current hostname
- Print styles are included — use the browser's print function to get a clean printout of attendance data