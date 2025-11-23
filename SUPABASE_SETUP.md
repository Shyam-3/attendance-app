# Attendance Management System - Supabase PostgreSQL Setup

## 🎯 Overview

This application is optimized to work with **Supabase PostgreSQL** for reliable, scalable, cloud-based data storage accessible from anywhere.

## 🚀 Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Project Name**: attendance-monitor (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click "Create new project" and wait ~2 minutes for provisioning

### 2. Get Connection String

1. In your Supabase project, go to **Project Settings** (gear icon)
2. Click **Database** in the left sidebar
3. Scroll to **Connection String** section
4. Select **URI** tab
5. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with your actual database password

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

The key packages for PostgreSQL support:
- `psycopg2-binary` - PostgreSQL database adapter
- `python-dotenv` - Environment variable management

### 4. Configure Environment

Create a `.env` file in the project root:

```bash
# Copy from example
cp .env.example .env
```

Edit `.env` and add your Supabase connection string:

```env
DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
SECRET_KEY=your-secret-key-here
DEBUG=True
FRONTEND_URL=http://127.0.0.1:5173
```

**Important:** 
- Replace the entire `DATABASE_URL` with your copied string
- Generate a secure `SECRET_KEY`: `python -c "import secrets; print(secrets.token_hex(32))"`

### 5. Run the Application

```bash
python app.py
```

On first run, the app will:
- Connect to your Supabase database
- Automatically create all required tables
- Show connection status in console

You should see:
```
✓ Using PostgreSQL database at: db.xxxxxxxxxxxxx.supabase.co:5432/postgres
✓ Database initialized successfully!
Database tables created successfully!
```

### 6. Verify Connection

Visit: `http://127.0.0.1:5000/health`

You should see:
```json
{
  "status": "healthy",
  "database": "PostgreSQL (Supabase)",
  "message": "Database connection successful"
}
```

## 🔧 Advanced Configuration

### Connection Pooling (Production)

For production deployments with many concurrent users, use Supabase's connection pooler:

```env
# Use port 6543 instead of 5432
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:6543/postgres
```

**Benefits:**
- Handles up to 200+ concurrent connections
- Better performance under load
- Automatic connection management

**Current Settings (already configured):**
```python
pool_size: 10          # Number of persistent connections
pool_recycle: 280      # Recycle before 300s timeout
pool_pre_ping: True    # Verify connection health
pool_timeout: 30       # Wait time for available connection
max_overflow: 5        # Extra connections when needed
```

### Performance Optimizations

The app includes several PostgreSQL optimizations:

1. **Indexes**: Added on frequently queried columns
   - `registration_no`, `name`, `course_code`
   - `student_id`, `course_id`, `attendance_percentage`
   - Composite index on `(student_id, course_id, attendance_percentage)`

2. **Timezone-aware datetimes**: All timestamps use UTC
3. **Cascade deletes**: Foreign keys with `ondelete='CASCADE'`
4. **Connection pooling**: Reuses database connections efficiently

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://postgres:pass@host:5432/db` |
| `SECRET_KEY` | Yes | Flask secret key for sessions | Generate with `secrets.token_hex(32)` |
| `DEBUG` | No | Enable debug mode | `True` or `False` (default: `True`) |
| `FRONTEND_URL` | No | Frontend URL for CORS | `http://127.0.0.1:5173` |

## 🐛 Troubleshooting

### Connection Refused

**Problem:** Can't connect to database

**Solutions:**
1. Verify DATABASE_URL is correct in `.env`
2. Check your Supabase project is active (not paused)
3. Ensure password is URL-encoded (special characters)
4. Test connection: visit `/health` endpoint

### SSL Certificate Errors

**Problem:** SSL verification failed

**Solution:** Add SSL mode to connection string:
```env
DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/postgres?sslmode=require
```

### Connection Timeout

**Problem:** Database connection times out

**Solutions:**
1. Check your internet connection
2. Verify Supabase project region (use closest region)
3. Increase timeout in config if needed
4. Use connection pooler (port 6543) for better reliability

### Tables Not Created

**Problem:** Database tables don't exist

**Solution:**
```bash
# Delete any .pyc files
rm -rf __pycache__

# Restart the app
python app.py
```

The app creates tables automatically on first run.

### Password Special Characters

**Problem:** Connection fails with special characters in password

**Solution:** URL-encode your password
- Find special chars in your password
- Replace with URL-encoded versions:
  - `@` → `%40`
  - `#` → `%23`
  - `$` → `%24`
  - `%` → `%25`
  - `&` → `%26`

Or use Python to encode:
```python
from urllib.parse import quote_plus
password = "your-password-here"
encoded = quote_plus(password)
print(encoded)
```

## 🔒 Security Best Practices

### For Production Deployments

1. **Environment Variables**
   - Never commit `.env` to git (already in `.gitignore`)
   - Use platform environment variables (Heroku, Vercel, etc.)
   - Rotate secrets regularly

2. **Database Security**
   - Enable Row Level Security (RLS) in Supabase
   - Create specific database users with limited permissions
   - Use connection pooler (port 6543)
   - Enable SSL: `sslmode=require`

3. **Application Security**
   - Set `DEBUG=False` in production
   - Use strong `SECRET_KEY` (32+ bytes)
   - Implement rate limiting
   - Add authentication/authorization

4. **Supabase Dashboard**
   - Enable database backups
   - Monitor connection metrics
   - Set up alerts for failures
   - Review logs regularly

## 📊 Database Schema

The app creates these tables automatically:

### `students`
- Primary key: `id`
- Unique: `registration_no`
- Indexed: `registration_no`, `name`

### `courses`
- Primary key: `id`
- Unique: `course_code`
- Indexed: `course_code`

### `attendance_records`
- Primary key: `id`
- Foreign keys: `student_id`, `course_id` (CASCADE)
- Unique constraint: `(student_id, course_id)`
- Indexed: `student_id`, `course_id`, `attendance_percentage`
- Composite index: `(student_id, course_id, attendance_percentage)`

## 🔄 Data Migration

### From SQLite to PostgreSQL

If you have existing SQLite data:

**Option 1: Re-upload Excel files**
1. Keep your original Excel files
2. Configure Supabase connection
3. Upload files through web interface

**Option 2: Manual migration**
```python
# migration_script.py
from app import app, db
from backend.models import Student, Course, AttendanceRecord

# Export from SQLite
with app.app_context():
    students = Student.query.all()
    # Save to JSON or CSV

# Import to PostgreSQL
# Configure DATABASE_URL to PostgreSQL
with app.app_context():
    # Load and insert data
    db.session.bulk_insert_mappings(Student, data)
    db.session.commit()
```

## 🚀 Deployment Tips

### Heroku
```bash
heroku config:set DATABASE_URL="your-supabase-url"
heroku config:set SECRET_KEY="your-secret-key"
heroku config:set DEBUG=False
```

### Vercel (Frontend) + Flask (Backend)
1. Deploy React frontend to Vercel
2. Deploy Flask backend to Render/Railway
3. Set FRONTEND_URL to Vercel URL
4. Set DATABASE_URL in backend platform

### Docker
```dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

## 📞 Support

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Flask-SQLAlchemy**: https://flask-sqlalchemy.palletsprojects.com/

### SSL Connection Issues

If you encounter SSL errors, modify your DATABASE_URL:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
```

### Connection Pooling

The app is configured with connection pooling settings:
- `pool_pre_ping`: Checks connection health before using
- `pool_recycle`: Recycles connections every 300 seconds

### Migration from SQLite

If you have existing SQLite data, you'll need to:
1. Export data from SQLite
2. Upload the Excel files again through the web interface
3. Or write a migration script to transfer data

## Security Notes

- Never commit `.env` file to version control
- Keep your database password secure
- Use Row Level Security (RLS) in Supabase for production
- Consider using Supabase's connection pooler for production deployments
