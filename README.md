# Attendance Tracker (TypeScript)

A full-stack attendance management app for educators. It supports secure login, Excel upload, filtering, analytics, and export to Excel/PDF.

## Core features

- Authenticated, per-user attendance management (Supabase Auth)
- Upload attendance sheets (`.xlsx`, `.xls`, `.csv`)
- Filter by course, threshold, search text, and excluded courses
- View dashboard statistics and paginated records
- Export filtered results to formatted Excel and PDF
- Delete individual records or clear all data

## Tech stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database/Auth: Supabase (PostgreSQL + Auth)
- Export: ExcelJS, PDFKit

## Setup and run

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=5000
FRONTEND_URL=https://your-frontend-domain
```

Start backend:

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=https://your-api-domain
```

Start frontend:

```bash
npm run dev
```

Open your deployed frontend URL.

## API summary

- `GET /api/attendance` – list filtered/paginated attendance rows
- `GET /api/stats` – overall statistics
- `POST /upload` – upload attendance files
- `POST /export/excel` – export filtered data to Excel
- `POST /export/pdf` – export filtered data to PDF

## Notes

- Data is isolated per authenticated user.
- Tables are initialized by backend startup logic.