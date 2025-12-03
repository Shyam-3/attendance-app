import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { AttendanceService } from '../services/attendanceService';
import { ExcelProcessor } from '../utils/excelProcessor';

const upload = multer({ limits: { fileSize: 16 * 1024 * 1024 } });

export default function uploadRouter(prisma: PrismaClient) {
  const router = Router();
  const excelProcessor = new ExcelProcessor(prisma);

  router.get('/', (_req, res) => {
    const frontend = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
    res.redirect(`${frontend}/upload`);
  });

  router.post('/', upload.array('files', 21), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files selected' });
    }
    if (files.length > 21) {
      return res.status(400).json({ success: false, error: 'Maximum 20 files allowed at once' });
    }

    const allowed = new Set(['xlsx', 'xls', 'csv']);
    const errors: string[] = [];
    const file_logs: any[] = [];
    let processed = 0;
    const totalStart = performance.now();

    for (const file of files) {
      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      if (!allowed.has(ext)) {
        errors.push(`Invalid file type: ${file.originalname}`);
        continue;
      }

      const start = performance.now();
      console.log(`➡️  Starting processing for file: ${file.originalname}`);

      try {
        // Process Excel file using ExcelProcessor
        const processedData = await excelProcessor.processExcelFileFromMemory(file.buffer, file.originalname);

        if (processedData) {
          // Save to database with metrics
          const result = await excelProcessor.saveToDatabase(processedData);

          if (result.success && result.metrics) {
            processed += 1;
            const elapsed = performance.now() - start;
            const fileLog: any = {
              name: file.originalname,
              elapsed_ms: Math.round(elapsed),
              ...result.metrics
            };
            file_logs.push(fileLog);
            console.log(`✅ Finished processing ${file.originalname} in ${elapsed.toFixed(2)} ms`);
          } else {
            errors.push(`Failed to process: ${file.originalname}`);
            return res.status(500).json({ success: false, error: `Failed to process: ${file.originalname}` });
          }
        } else {
          errors.push(`Failed to process: ${file.originalname}`);
          return res.status(500).json({ success: false, error: `Failed to process: ${file.originalname}` });
        }
      } catch (e: any) {
        errors.push(`Failed to process: ${file.originalname}`);
        return res.status(500).json({ success: false, error: `Failed to process: ${file.originalname}` });
      }
    }

    if (processed > 0) {
      const totalElapsed = performance.now() - totalStart;
      console.log(`⏱️  Total processing time for this upload: ${totalElapsed.toFixed(2)} ms`);
      const message = `Successfully processed ${processed} file(s).${errors.length ? ` ${errors.length} file(s) had errors.` : ''}`;
      
      // Invalidate cache after successful upload
      AttendanceService.invalidateCache();
      
      return res.json({
        success: true,
        message,
        files: file_logs,
        total_elapsed_ms: Math.round(totalElapsed)
      });
    } else {
      const error_msg = `No files were processed successfully.${errors.length ? ` Errors: ${errors.slice(0, 3).join('; ')}` : ''}`;
      return res.status(500).json({ success: false, error: error_msg });
    }
  });

  return router;
}
