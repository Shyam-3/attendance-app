import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import { query, runMigrations } from './db';
import { authenticateUser, type AuthRequest } from './middleware/auth';
import apiRouter from './routes/api';
import exportRouter from './routes/export';
import uploadRouter from './routes/upload';

const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

function parseEnvUrls(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function resolveFrontendUrl(): string {
  const fromPrimary = parseEnvUrls(process.env.FRONTEND_URL);
  const fromFallback = parseEnvUrls(process.env.FRONTEND_URL_FALLBACK);
  const fromDev = parseEnvUrls(process.env.DEV_FRONTEND_URL);
  return fromPrimary[0] || fromFallback[0] || fromDev[0] || 'http://127.0.0.1:5173';
}

const FRONTEND_URL = resolveFrontendUrl();
const allowedOrigins = Array.from(new Set([
  ...parseEnvUrls(process.env.FRONTEND_URL),
  ...parseEnvUrls(process.env.FRONTEND_URL_FALLBACK),
  ...parseEnvUrls(process.env.DEV_FRONTEND_URL),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://attendance-app-501df.web.app',
  'https://attendance-app-501df.firebaseapp.com'
]));

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (_req, res) => {
  res.redirect(FRONTEND_URL);
});

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      database: 'PostgreSQL (pg)',
      message: 'Database connection successful'
    });
  } catch (err:any) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'unhealthy', error: err.message || String(err), message: 'Database connection failed' });
  }
});

app.use('/api', apiRouter());
app.use('/export', exportRouter());
app.use('/mobile/export', exportRouter());
app.use('/upload', uploadRouter());

// Delete and clear routes at root level (matching Flask)
app.delete('/delete_record/:id', authenticateUser, async (req: AuthRequest, res) => {
  const { AttendanceService } = await import('./services/attendanceService.js');
  const userId = req.userId!;
  const id = Number(req.params.id);
  try {
    const success = await AttendanceService.deleteAttendanceRecord(userId, id);
    if (success) {
      res.json({ success: true, message: 'Record deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Record not found' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

app.post('/clear_all_data', authenticateUser, async (req: AuthRequest, res) => {
  const { AttendanceService } = await import('./services/attendanceService.js');
  const userId = req.userId!;
  try {
    const success = await AttendanceService.clearAllData(userId);
    if (success) {
      res.json({ success: true, message: 'All data cleared successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Error clearing data' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Page not found' });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await query('SELECT 1');
    console.log('✅ Database ready');
    
    // Run migrations to create tables if needed
    await runMigrations();
    
    app.listen(PORT, () => {
      console.log('🚀 Starting Attendance Management System...');
      console.log(`📱 Backend API: http://127.0.0.1:${PORT}`);
      console.log(`📊 Health check: http://127.0.0.1:${PORT}/health`);
    });
  } catch (err: any) {
    console.error('❌ Server failed to start:', err.message);
    process.exit(1);
  }
}

startServer();
