import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express from 'express';
import * as functions from 'firebase-functions';
import morgan from 'morgan';
import { authenticateUser, type AuthRequest } from '../../backend/src/middleware/auth';
import apiRouter from '../../backend/src/routes/api';
import exportRouter from '../../backend/src/routes/export';
import uploadRouter from '../../backend/src/routes/upload';

const app = express();

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Middleware
app.use(cors({ origin: true }));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'healthy',
      database: 'PostgreSQL (Prisma)',
      message: 'Database connection successful'
    });
  } catch (err: any) {
    console.error('Health check error:', err);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: err.message || String(err), 
      message: 'Database connection failed' 
    });
  }
});

// Routes
app.use('/api', apiRouter());
app.use('/export', exportRouter());
app.use('/upload', uploadRouter());

// Delete and clear routes
app.delete('/delete_record/:id', authenticateUser, async (req: AuthRequest, res) => {
  const { AttendanceService } = await import('../../backend/src/services/attendanceService');
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
  const { AttendanceService } = await import('../../backend/src/services/attendanceService');
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Page not found' });
});

// Export the Express app as a Firebase Function
export const api = functions.https.onRequest(app);
