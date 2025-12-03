import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import apiRouter from './routes/api';
import exportRouter from './routes/export';
import uploadRouter from './routes/upload';

const app = express();
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

app.use(cors({
  origin: '*',
  methods: ['GET','POST','DELETE'],
}));
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (_req, res) => {
  res.redirect(FRONTEND_URL);
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'healthy',
      database: 'PostgreSQL (Prisma)',
      message: 'Database connection successful'
    });
  } catch (err:any) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'unhealthy', error: err.message || String(err), message: 'Database connection failed' });
  }
});

app.use('/api', apiRouter(prisma));
app.use('/export', exportRouter(prisma));
app.use('/upload', uploadRouter(prisma));

// Delete and clear routes at root level (matching Flask)
app.delete('/delete_record/:id', async (req, res) => {
  const { AttendanceService } = await import('./services/attendanceService');
  const attendanceService = new AttendanceService(prisma);
  const id = Number(req.params.id);
  try {
    const success = await attendanceService.deleteAttendanceRecord(id);
    if (success) {
      res.json({ success: true, message: 'Record deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Record not found' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

app.post('/clear_all_data', async (_req, res) => {
  const { AttendanceService } = await import('./services/attendanceService');
  const attendanceService = new AttendanceService(prisma);
  try {
    const success = await attendanceService.clearAllData();
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

// Start server with proper async/await
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database ready');
    
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
