"""Generate Activity Report PDF for 17 March 2026"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import os

# Colors
PRIMARY = HexColor('#1e40af')    # Blue-800
ACCENT = HexColor('#2563eb')     # Blue-600
LIGHT_BG = HexColor('#eff6ff')   # Blue-50
GREEN = HexColor('#166534')      # Green-800
GREEN_BG = HexColor('#f0fdf4')   # Green-50
RED = HexColor('#991b1b')        # Red-800
RED_BG = HexColor('#fef2f2')     # Red-50
AMBER = HexColor('#92400e')      # Amber-800
AMBER_BG = HexColor('#fffbeb')   # Amber-50
GRAY = HexColor('#475569')       # Slate-600
LIGHT_GRAY = HexColor('#f1f5f9') # Slate-100
BORDER = HexColor('#cbd5e1')     # Slate-300
DARK = HexColor('#0f172a')       # Slate-900

OUTPUT = os.path.join(os.path.dirname(__file__), 'Activity_Report_17_March_2026.pdf')

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=15*mm, bottomMargin=15*mm,
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle('ReportTitle', parent=styles['Title'],
    fontSize=22, textColor=PRIMARY, spaceAfter=2, fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('ReportSubtitle', parent=styles['Normal'],
    fontSize=10, textColor=GRAY, spaceAfter=8))
styles.add(ParagraphStyle('SectionHead', parent=styles['Heading2'],
    fontSize=13, textColor=PRIMARY, spaceBefore=14, spaceAfter=6,
    fontName='Helvetica-Bold', borderPadding=(0,0,2,0)))
styles.add(ParagraphStyle('SubHead', parent=styles['Heading3'],
    fontSize=11, textColor=DARK, spaceBefore=8, spaceAfter=4,
    fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('Body', parent=styles['Normal'],
    fontSize=9.5, textColor=DARK, leading=14, spaceAfter=3))
styles.add(ParagraphStyle('BulletItem', parent=styles['Normal'],
    fontSize=9, textColor=DARK, leading=13, leftIndent=16, bulletIndent=6,
    spaceAfter=2))
styles.add(ParagraphStyle('SmallGray', parent=styles['Normal'],
    fontSize=8, textColor=GRAY))
styles.add(ParagraphStyle('CommitMsg', parent=styles['Normal'],
    fontSize=8, textColor=GRAY, fontName='Courier', leading=11, leftIndent=8))
styles.add(ParagraphStyle('StatValue', parent=styles['Normal'],
    fontSize=20, textColor=PRIMARY, fontName='Helvetica-Bold', alignment=TA_CENTER))
styles.add(ParagraphStyle('StatLabel', parent=styles['Normal'],
    fontSize=8, textColor=GRAY, alignment=TA_CENTER))

story = []

# ─── HEADER ───
story.append(Paragraph('Activity Report', styles['ReportTitle']))
story.append(Paragraph('CPIPL HR System — eod.colorpapers.in &nbsp;|&nbsp; 17 March 2026 (Monday)', styles['ReportSubtitle']))
story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

# ─── SUMMARY STATS ───
stat_data = [
    ['44', '5,646', '1,214', '43'],
    ['Commits', 'Lines Added', 'Lines Removed', 'Files Changed'],
]
stat_table = Table(stat_data, colWidths=[doc.width/4]*4, rowHeights=[30, 16])
stat_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
    ('TEXTCOLOR', (0,0), (-1,0), PRIMARY),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,0), 22),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TEXTCOLOR', (0,1), (-1,1), GRAY),
    ('FONTSIZE', (0,1), (-1,1), 8),
    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
    ('LINEBELOW', (0,0), (-1,0), 0.5, BORDER),
    ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,0), 8),
    ('BOTTOMPADDING', (0,0), (-1,0), 4),
    ('ROUNDEDCORNERS', [4,4,4,4]),
]))
story.append(stat_table)
story.append(Spacer(1, 10))

# ─── FEATURE AREAS ───
def section(title):
    story.append(Paragraph(title, styles['SectionHead']))

def subsection(title):
    story.append(Paragraph(title, styles['SubHead']))

def bullet(text):
    story.append(Paragraph(f'<bullet>&bull;</bullet> {text}', styles['BulletItem']))

def body(text):
    story.append(Paragraph(text, styles['Body']))

# ═══════════════════════════════════════════════════
section('1. Biometric Integration & Device Sync')
body('Built complete biometric punch synchronization system connecting physical devices to the HR platform.')

subsection('New Features')
bullet('Dedicated <b>/api/agent/</b> endpoints for biometric sync agent with secure key authentication')
bullet('Multi-device Windows agent with Sync Now (per device), Sync All, configurable lookback days')
bullet('Batch sync and bulk recalculate-all endpoint for entire months')
bullet('Full year sync support for historical data backfill')
bullet('Session-based attendance recalculation matching greytHR logic')
bullet('Recalculate buttons added to attendance calendar view')

subsection('Bug Fixes')
bullet('Fixed IN/OUT direction using greytHR-style alternating logic (even=IN, odd=OUT)')
bullet('Fixed "Last Out" not updating to latest out punch')
bullet('Fixed agent key mismatch with existing CPSERVER setup')
bullet('Removed broken Sync/Test buttons from biometric dashboard')
bullet('Updated biometric banner to show active sync status')

# ═══════════════════════════════════════════════════
section('2. Attendance Calendar & Views')
body('Redesigned employee and team attendance views to match greytHR layout with IST-correct calculations.')

subsection('New Features')
bullet('List & Calendar view tabs for employee My Attendance page')
bullet('Calendar View tab for Team Attendance with employee search')
bullet('Green present cells, IST-fixed work hours, greytHR-style session details')
bullet('Attendance Exceptions: exempt specific employees from all attendance rules')

subsection('Bug Fixes')
bullet('Fixed timezone bug: convert checkIn/checkOut to IST for late/early calculations')
bullet('Fixed grace period, early out, break hours, work hours calculations in calendar')
bullet('Fixed calendar view losing state on page refresh')
bullet('Fixed Late In column to always show late minutes')
bullet('Fixed shortHours calculation: use total office time vs shift duration')
bullet('Excluded today from lateMarks/shortHours counts (day not complete)')
bullet('Subtracted 15-min grace from Late In column display')
bullet('Formatted late minutes as hours + minutes when >= 60 minutes')
bullet('Yellow highlight only for penalty groups of 3 late marks')

# ═══════════════════════════════════════════════════
section('3. Shift Management Enhancements')
body('Enhanced shift assignment workflow with bulk operations and employee picker.')

bullet('"Assign Employees" button on Shift Management with employee picker modal')
bullet('Bulk shift assignment: checkboxes + one-click assign to multiple employees')

# ═══════════════════════════════════════════════════
section('4. Attendance Regularization (greytHR-style)')
body('Complete redesign of the regularization workflow to match greytHR\'s per-period approach with biometric swipe analysis.')

subsection('New Features')
bullet('Month navigation with filter by selected month')
bullet('Pre-fill check-in/out times and show reporting manager as approver')
bullet('Bulk regularization: select multiple late marks and submit at once')
bullet('Removed "New Request" button — employees only regularize actual missing periods')
bullet('<b>Per-period regularization:</b> each biometric gap (late arrival + out-periods) gets its own reason')
bullet('Biometric swipe analysis: compute ALL missing time from IN/OUT punches')
bullet('Missing time display (e.g., 10:15 to 10:21) instead of actual check-in/check-out')

subsection('Bug Fixes')
bullet('Fixed empty state showing "No Regularization Requests" when late marks existed')
bullet('Fixed regularization form showing wrong times (was showing actual attendance, not gap)')
bullet('Fixed duplicate detection: changed from per-date to per-time-range (date|from|to)')
bullet('Fixed bulk submit error: moved error alert above scroll area so errors are visible')
bullet('Added local error state with explicit messages for validation failures')
bullet('After success, scroll to top and show prominent green success banner')
bullet('Added backend logging for bulk endpoint debugging')

# ═══════════════════════════════════════════════════
section('5. Average Work Hours Metrics')
body('Iterated through multiple approaches to match greytHR\'s hours display.')

bullet('Added Avg Work Hrs and Avg Actual Hrs like greytHR')
bullet('Changed to Total Monthly Hrs (work hrs and actual hrs)')
bullet('Reverted to per-day averages as final approach')
bullet('Fixed Avg Actual Hrs: fallback to officeTime - 1hr break when workHours is null')

# ═══════════════════════════════════════════════════
section('6. Files Modified (Key)')

files_data = [
    ['File', 'Type', 'Purpose'],
    ['AttendanceRegularization.jsx', 'Frontend', 'Complete rewrite — per-period bulk regularization UI'],
    ['attendanceService.js', 'Backend', 'BiometricPunch analysis, period computation, late marks'],
    ['regularization.js (route)', 'Backend', 'Bulk endpoint, per-time-range dedup, backend logging'],
    ['MyAttendance.jsx', 'Frontend', 'List + Calendar tabs, avg hours display'],
    ['TeamAttendance.jsx', 'Frontend', 'Calendar view tab, employee search'],
    ['ShiftManagement.jsx', 'Frontend', 'Employee assignment modal, bulk assign'],
    ['biometricSyncService.js', 'Backend', 'Alternating IN/OUT, session recalculation'],
    ['attendance.js (route)', 'Backend', 'Exceptions, calendar data, IST fixes'],
]
file_table = Table(files_data, colWidths=[doc.width*0.38, doc.width*0.15, doc.width*0.47])
file_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), PRIMARY),
    ('TEXTCOLOR', (0,0), (-1,0), white),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,0), 8),
    ('FONTSIZE', (0,1), (-1,-1), 8),
    ('FONTNAME', (0,1), (0,-1), 'Courier'),
    ('TEXTCOLOR', (0,1), (-1,-1), DARK),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_GRAY]),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
]))
story.append(file_table)
story.append(Spacer(1, 8))

# ═══════════════════════════════════════════════════
section('7. Commit Log (44 commits)')

commits = [
    ('b178350', 'Fix bulk regularization submit: show errors prominently in modal'),
    ('1ac369a', 'Per-period regularization like greytHR: each gap needs its own reason'),
    ('7d3106e', 'Show ALL missing time from biometric swipes in regularization'),
    ('89f06b4', 'Redesign regularization to show missing time instead of check-in/check-out'),
    ('3e31405', 'Remove New Request button, improve empty state for regularization'),
    ('06518c5', 'Add bulk regularization: select multiple late marks and submit at once'),
    ('a976692', 'Add month navigation to Regularization page, filter by month'),
    ('b0b3256', 'Pre-fill check-in/out times in regularization form and show approver'),
    ('aaa31bd', 'Add Avg Work Hrs and Avg Actual Hrs (per-day averages)'),
    ('c56b960', 'Revert avg/total hrs changes -- restore original single Avg Hours metric'),
    ('058bf12', 'Change Avg Hrs to Total Monthly Hrs (work hrs and actual hrs)'),
    ('3b04b2d', 'Fix Avg Actual Hrs: fallback to officeTime - 1hr break when workHours is null'),
    ('ac9f550', 'Add Avg Work Hrs and Avg Actual Hrs like greytHR'),
    ('b7d933a', 'Add List and Calendar view tabs to employee My Attendance page'),
    ('88d3557', 'Yellow highlight only for penalty groups of 3 late marks'),
    ('76c76e4', 'Subtract 15-min grace from Late In column display'),
    ('0298552', 'Fix late minutes to subtract 15-min grace period and use IST date for today'),
    ('1b514b7', 'Exclude today from lateMarks/shortHours counts (day not complete)'),
    ('67300c4', 'Unify attendance regularization banner format'),
    ('c25507d', 'Format late minutes as hrs + min when >= 60 minutes'),
    ('86c2537', 'Fix shortHours calculation: use total office time vs shift duration'),
    ('00dca64', 'Add Calendar View tab to Team Attendance with employee search'),
    ('3297b2d', 'Add Attendance Exceptions: exempt employees bypass all attendance rules'),
    ('a6097e0', 'Add "Assign Employees" to Shift Management with employee picker modal'),
    ('e1afda7', 'Add bulk shift assignment: checkboxes + one-click assign to multiple employees'),
    ('dc3bdc1', 'Enhance calendar view: green present cells, IST-fixed work hrs, sessions'),
    ('27308e0', 'Fix timezone bug: convert checkIn/checkOut to IST for late/early calc'),
    ('9be341e', 'Fix Late In column to always show late minutes'),
    ('acd1ad3', 'Fix attendance calendar: grace period, early out, break hrs, work hrs'),
    ('cdb64a3', 'Update calendar view to match greytHR style'),
    ('d202366', 'Fix attendance calendar view losing state on page refresh'),
    ('eab6e15', 'Remove broken Sync/Test buttons from biometric dashboard'),
    ('0346fe7', 'Update biometric banner to show active sync status'),
    ('7253992', 'Biometric bulk recalculate and full year sync support'),
    ('12ec553', 'Add bulk recalculate-all endpoint for entire month'),
    ('5da3873', 'Fix IN/OUT direction: use greytHR-style alternating logic'),
    ('9e71dc4', 'Add Recalculate buttons to attendance calendar view'),
    ('061ddb3', 'Remove Vercel cron (blocked deploys on Hobby plan)'),
    ('2ee479b', 'Add greytHR-style session-based attendance recalculation'),
    ('edc5959', 'Fix biometric: Last Out now updates to latest out punch'),
    ('a359fa8', 'Fix agent key to match existing cpserver setup'),
    ('f4db756', 'Add dedicated /api/agent/ endpoints for biometric sync agent'),
    ('87da823', 'Biometric: Test Connection, batch sync, Windows agent setup, diagnostics'),
    ('7625558', 'Biometric: add Sync Now per device, Sync All, lookback days, multi-device agent'),
]

commit_data = [['Hash', 'Message']]
for h, msg in commits:
    commit_data.append([h[:7], msg[:90]])

commit_table = Table(commit_data, colWidths=[doc.width*0.12, doc.width*0.88])
commit_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), PRIMARY),
    ('TEXTCOLOR', (0,0), (-1,0), white),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,0), 8),
    ('FONTNAME', (0,1), (0,-1), 'Courier'),
    ('FONTSIZE', (0,1), (-1,-1), 7),
    ('TEXTCOLOR', (0,1), (0,-1), ACCENT),
    ('TEXTCOLOR', (1,1), (1,-1), DARK),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID', (0,0), (-1,-1), 0.2, BORDER),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_GRAY]),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ('LEFTPADDING', (0,0), (-1,-1), 4),
]))
story.append(commit_table)
story.append(Spacer(1, 12))

# ─── PENDING / IN PROGRESS ───
section('8. Pending / In Progress')
bullet('<b>Regularization bulk submit:</b> Error visibility fixed; awaiting user confirmation that submit works')
bullet('<b>Admin regularization review:</b> May need updates to handle per-period approve/reject')
bullet('<b>Browser caching:</b> Recurring issue — user frequently sees stale JS bundles on Vercel')

# ─── FOOTER ───
story.append(Spacer(1, 20))
story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6))
story.append(Paragraph(
    'Generated by Claude Code &nbsp;|&nbsp; CPIPL HR System &nbsp;|&nbsp; eod.colorpapers.in &nbsp;|&nbsp; 17 March 2026',
    styles['SmallGray']
))

# Build PDF
doc.build(story)
print(f'PDF generated: {OUTPUT}')
