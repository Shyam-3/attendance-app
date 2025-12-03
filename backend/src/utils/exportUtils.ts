import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
/**
 * ExportUtils - TypeScript port of backend/utils/export_utils.py
 * Handles Excel and PDF export generation with formatting
 */
import type { Response } from 'express';

interface ExportRecord {
  id: number;
  registration_no: string;
  student_name: string;
  course_code: string;
  course_name: string;
  attended_periods: number;
  conducted_periods: number;
  attendance_percentage: number;
}

export class ExportUtils {
  /**
   * Generate timestamp for filename
   */
  private timestampForFilename(): string {
    const now = new Date();
    return now.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/[/:]/g, ' ');
  }

  /**
   * Generate formatted Excel export
   */
  async generateExcelExport(
    data: ExportRecord[],
    filterInfo?: string[],
    filenamePrefix = 'attendance'
  ): Promise<{ buffer: Buffer; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Low Attendance Report');

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Registration No', key: 'registration_no', width: 18 },
      { header: 'Student Name', key: 'student_name', width: 30 },
      { header: 'Course Code', key: 'course_code', width: 15 },
      { header: 'Course Name', key: 'course_name', width: 40 },
      { header: 'Attended Periods', key: 'attended_periods', width: 18 },
      { header: 'Conducted Periods', key: 'conducted_periods', width: 18 },
      { header: 'Attendance %', key: 'attendance_percentage', width: 15 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD7E4BC' }
    };
    worksheet.getRow(1).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Add data rows
    data.forEach((record, index) => {
      worksheet.addRow({
        sno: index + 1,
        registration_no: record.registration_no,
        student_name: record.student_name,
        course_code: record.course_code,
        course_name: record.course_name,
        attended_periods: record.attended_periods,
        conducted_periods: record.conducted_periods,
        attendance_percentage: Number(record.attendance_percentage.toFixed(1))
      });
    });

    // Add filter info at bottom
    if (filterInfo && filterInfo.length > 0) {
      worksheet.addRow([]);
      worksheet.addRow(['Filters', filterInfo.join(' | ')]);
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Build filename
    let filename = 'attendance.xlsx';
    if (filterInfo && filterInfo.length > 0) {
      const filterStr = filterInfo
        .join(' ')
        .replace(/[:,'"|]/g, '')
        .trim();
      filename = `${filterStr}.xlsx`;
    }

    return { buffer: Buffer.from(buffer), filename };
  }

  /**
   * Generate formatted PDF export
   */
  async generatePdfExport(
    records: ExportRecord[],
    filterInfo?: string[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margins: { left: 24, right: 24, top: 36, bottom: 36 } });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let filename = 'attendance.pdf';
        if (filterInfo && filterInfo.length > 0) {
          const filterStr = filterInfo.join(' ').replace(/[:,'"|]/g, '').trim();
          filename = `${filterStr}.pdf`;
        }
        resolve({ buffer, filename });
      });
      doc.on('error', reject);

      // Title
      doc.font('Helvetica-Bold').fontSize(18).text('Attendance Report', { align: 'center' });
      doc.moveDown(0.7);

      // Filter info
      if (filterInfo && filterInfo.length > 0) {
        doc.font('Helvetica').fontSize(11).text(`  Filters Applied: ${filterInfo.join(' | ')}`);
        doc.moveDown(0.4);
      }

      // Headers
      const headers = ['S.No', 'Course Code', 'Registration No', 'Student Name', 'Attended', 'Total', 'Attendance %'];
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const paddingLR = 12;
      const headerFont = 'Helvetica-Bold';
      const headerSize = 10;

      // pdfkit does not take font in options for widthOfString; set font first
      doc.font(headerFont).fontSize(headerSize);
      const headerMinWidths = headers.map(h => doc.widthOfString(h) + 2 * paddingLR);
      const fixedIdx = [0, 1, 2, 4, 5, 6];
      const fixedSum = fixedIdx.reduce((sum, i) => sum + headerMinWidths[i], 0);
      const nameMin = headerMinWidths[3];
      let nameWidth = Math.max(nameMin, pageWidth - fixedSum);

      let colWidths = [...headerMinWidths];
      colWidths[3] = nameWidth;
      let totalWidth = colWidths.reduce((a, b) => a + b, 0);
      if (totalWidth > pageWidth) {
        const adjustable = fixedIdx.filter(i => i !== 2); // keep Registration No mostly intact
        const excess = totalWidth - pageWidth;
        const shavePerCol = Math.min(4, excess / Math.max(1, adjustable.length));
        adjustable.forEach(i => { colWidths[i] = Math.max(headerMinWidths[i] - shavePerCol, headerMinWidths[i] - 4); });
        totalWidth = colWidths.reduce((a, b) => a + b, 0);
        if (totalWidth > pageWidth) {
          const i = 2; // Registration No
          const canShave = Math.min(4, totalWidth - pageWidth);
          colWidths[i] = Math.max(headerMinWidths[i] - canShave, headerMinWidths[i] - 4);
        }
      }

      // Table rendering with header as first row
      let y = doc.y;
      const rowHeight = 20; // Consistent row height matching Python
      const bodyFont = 'Helvetica';
      const bodySize = 8;

      const drawRow = (row: any[], isHeader: boolean, highlight: 'low' | 'mid' | 'high' | null) => {
        let cx = doc.page.margins.left;
        let cy = y;
        
        // Background color
        let bgColor: string;
        if (isHeader) {
          bgColor = '#808080'; // grey for header
        } else {
          bgColor = highlight === 'low' ? '#F08080' : highlight === 'mid' ? '#FFFFE0' : highlight === 'high' ? '#90EE90' : '#F5F5DC';
        }
        
        // Draw background
        doc.save();
        doc.rect(cx, cy, pageWidth, rowHeight).fill(bgColor);
        doc.restore();
        
        // Set font for row
        if (isHeader) {
          doc.font(headerFont).fontSize(headerSize).fillColor('#FFFFFF');
        } else {
          doc.font(bodyFont).fontSize(bodySize).fillColor('#000000');
        }
        
        // Draw text cells
        row.forEach((text, i) => {
          const w = colWidths[i];
          doc.text(String(text ?? ''), cx + 4, cy + 5, { width: w - 8, align: 'center' });
          cx += w;
        });
        
        // Draw grid lines
        doc.save();
        doc.strokeColor('#000000').lineWidth(1);
        let gx = doc.page.margins.left;
        doc.rect(gx, cy, pageWidth, rowHeight).stroke();
        colWidths.forEach(w => { 
          doc.moveTo(gx + w, cy).lineTo(gx + w, cy + rowHeight).stroke(); 
          gx += w; 
        });
        doc.restore();
        
        y += rowHeight;
        if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
          doc.addPage();
          y = doc.page.margins.top;
        }
      };

      // Draw header row first
      drawRow(headers, true, null);

      const rowsOut = (records || []).map((r, i) => {
        const pct = Math.round(r.attendance_percentage || 0);
        const highlight = pct < 65 ? 'low' : pct < 75 ? 'mid' : 'high';
        return {
          row: [
            String(i + 1),
            String(r.course_code ?? ''),
            String(r.registration_no ?? ''),
            String(r.student_name ?? ''),
            String(r.attended_periods ?? ''),
            String(r.conducted_periods ?? ''),
            String(pct)
          ],
          highlight
        };
      });

      rowsOut.forEach(r => drawRow(r.row, false, r.highlight as 'low' | 'mid' | 'high' | null));

      // Footer
      doc.moveDown(2);
      const generated = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${pad(generated.getDate())}-${pad(generated.getMonth() + 1)}-${generated.getFullYear()} ${pad(generated.getHours())}:${pad(generated.getMinutes())}:${pad(generated.getSeconds())}`;
      // Left-aligned footer
      doc.font('Helvetica').fontSize(10).fillColor('#000000')
        .text(`  Generated on: ${ts} | Total Records: ${records?.length ?? 0}`, doc.page.margins.left, doc.y, { align: 'left' });

      doc.end();
    });
  }

  /**
   * Send Excel export as HTTP response
   */
  sendExcelResponse(res: Response, buffer: Buffer, filename: string): void {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * Send PDF export as HTTP response
   */
  sendPdfResponse(res: Response, buffer: Buffer, filename: string): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
