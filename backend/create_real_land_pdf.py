#!/usr/bin/env python3
"""Create a real, text-based land record PDF for testing Bhoomi AI.
Designed to be perfectly parsed by pypdf + FIELD_PATTERNS (no scanned image needed).
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib import colors
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "real_land_record_test.pdf")
# also keep a copy in backend/uploads for direct backend testing
OUT2 = os.path.join(os.path.dirname(__file__), "uploads", "real_land_record_test.pdf")

NAVY = HexColor("#0A1F44")
BLUE = HexColor("#0B57D0")
LIGHT_BG = HexColor("#F1F4F9")
BORDER = HexColor("#C9D2E0")
styles = getSampleStyleSheet()
s_title = ParagraphStyle('title', parent=styles['Title'], fontSize=16, leading=18, textColor=NAVY, alignment=TA_CENTER, fontName='Helvetica-Bold', spaceAfter=2)
s_sub = ParagraphStyle('sub', parent=styles['Normal'], fontSize=8, leading=10, textColor=HexColor("#64748B"), alignment=TA_CENTER, fontName='Helvetica', spaceAfter=6)
s_h = ParagraphStyle('h', parent=styles['Heading3'], fontSize=9, leading=11, textColor=HexColor("#0F172A"), fontName='Helvetica-Bold', spaceBefore=8, spaceAfter=6)
s_n = ParagraphStyle('n', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=HexColor("#0F172A"), fontName='Helvetica', spaceAfter=3)
s_label = ParagraphStyle('label', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=HexColor("#475569"), fontName='Helvetica-Bold')
s_val = ParagraphStyle('val', parent=styles['Normal'], fontSize=9, leading=11, textColor=HexColor("#0F172A"), fontName='Helvetica')
s_small = ParagraphStyle('small', parent=styles['Normal'], fontSize=7, leading=8, textColor=HexColor("#64748B"), fontName='Helvetica', alignment=TA_CENTER)
s_cell = ParagraphStyle('cell', parent=styles['Normal'], fontSize=7.5, leading=9, textColor=HexColor("#0F172A"), fontName='Helvetica', alignment=TA_LEFT)
s_cell_b = ParagraphStyle('cellb', parent=s_cell, fontName='Helvetica-Bold', textColor=NAVY)

def build():
    doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=14*mm, rightMargin=14*mm, topMargin=10*mm, bottomMargin=10*mm,
                            title="Khatauni Land Record - Test", author="Bhoomi AI SIH 2026")
    story = []
    # Govt header
    story.append(Paragraph("भारत सरकार &nbsp;|&nbsp; Government of Uttar Pradesh", ParagraphStyle('gov', parent=s_sub, fontSize=7, textColor=colors.white, backColor=NAVY, borderPadding=(3,6,3), alignment=TA_CENTER)))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("Department of Revenue &amp; Land Records (भू-अभिलेख विभाग)", s_sub))
    story.append(Paragraph("Khatauni Nakal / खतौनी नकल &nbsp;—&nbsp; Real Test Record for Bhoomi AI Digitization", s_title))
    story.append(Paragraph("District Agra &nbsp;•&nbsp; Fasli Year 1432 (2024-25) &nbsp;•&nbsp; Computerized Copy u/s 33", s_sub))
    story.append(HRFlowable(width="100%", thickness=0.7, color=BLUE, spaceAfter=4*mm))
    # Important: Each labelled field on its OWN line with "Label: Value" — this is what pypdf + FIELD_PATTERNS parses
    story.append(Paragraph("Land Record Details (labeled for OCR verification)", s_h))
    fields = [
        ("State", "Uttar Pradesh"),
        ("District", "Agra"),
        ("Tehsil", "Sadar"),
        ("Village", "Rampur"),
        ("Fasli Year", "1432"),
        ("Khata Number", "45"),
        ("Khasra Number", "45/2B"),
        ("Survey Number", "45/2B"),
        ("Plot Area", "2.4500 hectares"),
        ("Landowner Name", "Rajesh Kumar Sharma"),
        ("Father's Name", "Ram Prasad Sharma"),
        ("Land Classification", "Agricultural"),
        ("Mutation Record", "MUT-2024-0123 Approved"),
        ("Registration Info", "Deed No. 4521/2024 dated 12-03-2024"),
    ]
    tdata = [[Paragraph(f"<b>{k}:</b>", s_label), Paragraph(v, s_val)] for k,v in fields]
    t = Table(tdata, colWidths=[42*mm, 115*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.white),
        ('BOX', (0,0), (-1,-1), 0.6, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.4, HexColor("#EEF1F6")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, HexColor("#F8FAFC")]),
    ]))
    story.append(t)
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("Khasra-wise Land Coverage (as per cadastral register)", s_h))
    # Table that also triggers khasra regex: Khasra | Owner | Area rows
    kdata = [
        [Paragraph("<b>Khasra No.</b>", s_cell_b), Paragraph("<b>Landowner Name</b>", s_cell_b), Paragraph("<b>Plot Area (ha)</b>", s_cell_b), Paragraph("<b>Village</b>", s_cell_b), Paragraph("<b>Land Type</b>", s_cell_b)],
        [Paragraph("45/2B", s_cell), Paragraph("Rajesh Kumar Sharma", s_cell), Paragraph("2.4500", s_cell), Paragraph("Rampur", s_cell), Paragraph("Agricultural", s_cell)],
        [Paragraph("88/1A", s_cell), Paragraph("Sunil Joshi", s_cell), Paragraph("1.2000", s_cell), Paragraph("Rampur", s_cell), Paragraph("Residential", s_cell)],
    ]
    kt = Table(kdata, colWidths=[22*mm, 48*mm, 24*mm, 32*mm, 31*mm])
    kt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 0.6, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.4, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, HexColor("#F1F6FF")]),
    ]))
    story.append(kt)
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("Total Area: 3.6500 hectares &nbsp;|&nbsp; Total Parcels: 2 &nbsp;|&nbsp; Mutation Status: Approved &nbsp;|&nbsp; Recorded Holder: Rajesh Kumar Sharma", s_small))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("Spatial Reference &amp; Cadastral Boundary (for PostGIS testing)", s_h))
    story.append(Paragraph("Cadastral Polygon (EPSG:4326) for Survey No. 45/2B — Rampur, Agra: <b>POLYGON((78.0420 27.1720, 78.0470 27.1720, 78.0470 27.1765, 78.0420 27.1765, 78.0420 27.1720))</b> — demo 500m × 500m parcel. Area ~25,000 m². This polygon is pre-seeded in <i>cadastral_parcels</i> for GIS lookup <b>45/2B</b>.", s_n))
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width="100%", thickness=0.4, color=BORDER, spaceAfter=3*mm))
    story.append(Paragraph("Note: This is a <b>text-based PDF</b> generated for testing Bhoomi AI — pypdf will extract it without needing Gemini/PaddleOCR. Upload via <b>Document Intake → Upload</b> with Language <b>Hindi/English</b>. All fields above use <i>Label: Value</i> format to guarantee high-confidence extraction.", s_small))
    story.append(Paragraph("© Revenue Department, Govt. of UP — Test record only • Generated by Bhoomi AI SIH 2026 • For demo verification, use Field Inspector login verifier@lrds.gov.in / verify123 to approve.", s_small))
    doc.build(story)
    # copy to backend/uploads
    try:
        import shutil
        os.makedirs(os.path.dirname(OUT2), exist_ok=True)
        shutil.copyfile(OUT, OUT2)
        print(f"PDF created at {OUT} and {OUT2}")
    except Exception as e:
        print(f"PDF created at {OUT}, copy failed: {e}")
    return OUT

if __name__ == "__main__":
    print(build())
