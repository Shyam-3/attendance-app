"""
Utilities for exporting attendance data to Excel and PDF with formatting.
Matches the layout shown in export_utils1.py (styled headers, auto widths, timestamped filenames),
while keeping the same public methods used by the app.
"""
import io
from datetime import datetime
import pandas as pd
from flask import make_response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics


class ExportUtils:
    def _timestamp_for_filename(self) -> str:
        # Example: 01.10.2025 23 05 42
        return datetime.now().strftime("%d.%m.%Y %H %M %S")

    def generate_excel_export(self, data, filter_info=None, filename_prefix: str = "attendance"):
        """Generate formatted Excel from export-ready rows (list of dict)."""
        df = pd.DataFrame(data or [])

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            sheet_name = 'Low Attendance Report'
            df.to_excel(writer, sheet_name=sheet_name, index=False)

            workbook = writer.book
            worksheet = writer.sheets[sheet_name]

            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'fg_color': '#D7E4BC',
                'border': 1,
            })

            # Apply header styling
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)

            # Auto-fit columns
            for i, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).apply(len).max() if not df.empty else 0, len(str(col))) + 2
                worksheet.set_column(i, i, max_len)

        output.seek(0)

        # Build dynamic filename based on filter_info
        if filter_info:
            filter_str = " ".join(str(f).replace(":", "").replace(",", "").replace("|", "") for f in filter_info)
            filename = f"{filter_str}.xlsx"
        else:
            filename = "attendance.xlsx"
        
        # Sanitize filename to prevent header issues
        filename = filename.replace('"', '').replace("'", "")
        
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def generate_pdf_export(self, records, filter_info=None, filename_prefix: str = "attendance"):
        """Generate formatted PDF table for AttendanceRecord rows with wrapped cells and header-based column widths."""
        output = io.BytesIO()
        # Tighter margins to maximize usable width while staying printable
        doc = SimpleDocTemplate(
            output,
            pagesize=A4,
            leftMargin=24,
            rightMargin=24,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle', parent=styles['Heading1'], fontSize=18, spaceAfter=7, alignment=1
        )
        filter_style = ParagraphStyle(
            'FilterInfo', parent=styles['Normal'], fontSize=11, leading=11, wordWrap='CJK'
        )
        cell_style = ParagraphStyle(
            'Cell', parent=styles['Normal'], fontSize=8, leading=10, wordWrap='LTR', alignment=1
        )

        content = []
        content.append(Paragraph("Attendance Report", title_style))
        content.append(Spacer(1, 8))

        if filter_info:
            filter_text = "Filters Applied: " + " | ".join(filter_info)
            content.append(Paragraph(filter_text, filter_style))
            content.append(Spacer(1, 8))

        headers = [
            'S.No', 'Course Code', 'Registration No', 'Student Name', 
            'Attended', 'Total', 'Attendance %'
        ]

        # Build table rows; wrap Student Name with Paragraph for proper wrapping
        table_data = [headers]
        for i, r in enumerate(records or [], 1):
            table_data.append([
                str(i),
                str(r.course.course_code),
                str(r.student.registration_no),
                Paragraph(str(r.student.name or ''), cell_style),
                str(r.attended_periods),
                str(r.conducted_periods),
                f"{r.attendance_percentage:.0f}",
            ])

        # Compute column widths based on header text width + padding
        header_font = 'Helvetica-Bold'
        header_font_size = 10
        padding_lr = 12  # space on both sides

        header_min_widths = []
        for text in headers:
            w = pdfmetrics.stringWidth(text, header_font, header_font_size)
            header_min_widths.append(w + 2 * padding_lr)

        available_width = doc.width

        # Fixed columns (all except Student Name at index 3)
        fixed_indexes = [0, 1, 2, 4, 5, 6]
        fixed_sum = sum(header_min_widths[i] for i in fixed_indexes)

        # Allocate remaining width to Student Name while ensuring at least header width
        name_min = header_min_widths[3]
        name_width = max(name_min, available_width - fixed_sum)

        # If even header minimums exceed available width, cap name to its minimum
        # and proportionally scale other columns but never below their header minimums.
        col_widths = list(header_min_widths)
        col_widths[3] = name_width
        total_width = sum(col_widths)
        if total_width > available_width:
            # Compute scaling factor but clamp to not go below header minimums.
            # Start by setting all to their header minimums, then if still too wide,
            # slightly reduce numeric columns font size effect by trimming a tiny padding.
            # This preserves the requirement for at least header text width plus some space.
            # We will reduce padding on non-name columns if needed.
            excess = total_width - available_width
            adjustable_indexes = [i for i in fixed_indexes if i != 1]  # leave reg no mostly intact
            # Try to shave up to 4 points of padding from each adjustable column
            shave_per_col = min(4, excess / max(1, len(adjustable_indexes)))
            for i in adjustable_indexes:
                col_widths[i] = max(header_min_widths[i] - shave_per_col, header_min_widths[i] - 4)
            total_width = sum(col_widths)
            if total_width > available_width:
                # As a last resort, shave a bit from Registration No padding as well
                i = 1
                can_shave = min(4, total_width - available_width)
                col_widths[i] = max(header_min_widths[i] - can_shave, header_min_widths[i] - 4)

        table = Table(table_data, colWidths=col_widths)
        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (3, 1), (3, -1), 'CENTER'),  # Student Name center aligned
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ])

        # Row highlighting like the original utility
        for i, r in enumerate(records or [], 1):
            row_index = i
            if r.attendance_percentage < 65:
                table_style.add('BACKGROUND', (0, row_index), (-1, row_index), colors.lightcoral)
            elif r.attendance_percentage < 75:
                table_style.add('BACKGROUND', (0, row_index), (-1, row_index), colors.lightyellow)
            else:
                table_style.add('BACKGROUND', (0, row_index), (-1, row_index), colors.lightgreen)

        table.setStyle(table_style)
        content.append(table)
        content.append(Spacer(1, 16))
        content.append(Paragraph(
            f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M:%S')} | Total Records: {len(records or [])}",
            styles['Normal']
        ))
        doc.title = "Attendance Report"
        doc.build(content)
        output.seek(0)

        # Build dynamic filename
        if filter_info:
            filter_str = " ".join(str(f).replace(":", "").replace(",", "").replace("|", "") for f in filter_info)
            filename = f"{filter_str}.pdf"
        else:
            filename = "attendance.pdf"
        
        # Sanitize filename to prevent header issues
        filename = filename.replace('"', '').replace("'", "")
        
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


