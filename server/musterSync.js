/**
 * Attendance Muster Sync
 * Parses Attendance Muster Report.xlsx (eSSL source of truth),
 * finds dates where Excel=Present but EOD has no attendance record,
 * inserts those records as status='present', and reports changes.
 *
 * Excel block structure (repeating per employee):
 *   Row: [Employee No] [Name] [DOJ] [ManagerNo] [ManagerName] [] [Dept] [Location]
 *   Row: [SNO] [Attendance Date] [Session1 Status] [Session2 Status] [In Time] ...
 *   Rows: daily data...
 *   (blank row separates blocks)
 */

const XLSX   = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path   = require('path');

const p = new PrismaClient();
const EXCEL_PATH = 'C:\\Users\\91992\\Downloads\\Attendance Muster Report.xlsx';

// Only consider FY 2025-26
const FY_START = '2025-04-01';
const FY_END   = '2026-03-31';

const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Convert Excel serial date or JS Date or string to 'YYYY-MM-DD' */
function toDateStr(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    const mm = String(d.m).padStart(2, '0');
    const dd = String(d.d).padStart(2, '0');
    return `${d.y}-${mm}-${dd}`;
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    // Could be "2025-04-01" or "01 Apr 2025" or similar
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    const d = new Date(val);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

function isPresent(status) {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === 'P';
}

async function main() {
  console.log('Loading Excel file...');
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true, dateNF: 'yyyy-mm-dd' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  console.log(`Total rows: ${rows.length}`);

  // ── Parse employee blocks ───────────────────────────────────────────────
  // We detect employee header rows by looking for a row where:
  //   col[0] looks like an employee ID (e.g. "COLOR001") AND col[1] is a name
  // The NEXT row will have column headers (SNO, Attendance Date, ...)
  // Then daily rows follow until a blank/next-employee row

  const empBlocks = []; // { empNo, name, records: [{date, session1, session2}] }

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];

    // Detect employee info row: row[0] starts with letters+digits (e.g. COLOR001)
    // and row[1] is a non-empty name string
    if (
      row &&
      row[0] && typeof row[0] === 'string' && /^[A-Z]{2,}[0-9]+$/i.test(String(row[0]).trim()) &&
      row[1] && typeof row[1] === 'string' && row[1].trim().length > 2
    ) {
      const empNo = String(row[0]).trim();
      const name  = String(row[1]).trim();

      // Next row should be column headers (SNO | Attendance Date | Session1 | Session2 | ...)
      i++;
      const headerRow = rows[i];

      // Find column indices dynamically
      let colDate = -1, colS1 = -1, colS2 = -1;
      if (headerRow) {
        for (let c = 0; c < headerRow.length; c++) {
          const h = headerRow[c] ? String(headerRow[c]).trim().toLowerCase() : '';
          if (h.includes('attendance date') || h.includes('date')) colDate = c;
          if ((h.includes('session1') || h === 's1') && colS1 === -1) colS1 = c;
          if ((h.includes('session2') || h === 's2') && colS2 === -1) colS2 = c;
        }
        // Fallback: typical column order
        // SNO=0, Date=1, S1=2, S2=3, InTime=4, OutTime=5 ...
        if (colDate === -1) colDate = 1;
        if (colS1  === -1) colS1  = 2;
        if (colS2  === -1) colS2  = 3;
      }

      i++; // move past header row
      const records = [];

      // Read daily rows until blank row or next employee header
      while (i < rows.length) {
        const dr = rows[i];
        // Blank row or next employee block
        if (!dr || (!dr[0] && !dr[1] && !dr[2])) { i++; break; }
        // Next employee header detected
        if (
          dr[0] && typeof dr[0] === 'string' && /^[A-Z]{2,}[0-9]+$/i.test(String(dr[0]).trim()) &&
          dr[1] && typeof dr[1] === 'string' && dr[1].trim().length > 2 &&
          String(dr[0]).trim() !== empNo
        ) {
          break; // don't advance i — outer loop will detect this row
        }

        const dateVal = dr[colDate];
        const s1      = dr[colS1];
        const s2      = dr[colS2];

        const dateStr = toDateStr(dateVal);
        if (dateStr && dateStr >= FY_START && dateStr <= FY_END) {
          records.push({ date: dateStr, session1: s1, session2: s2 });
        }
        i++;
      }

      if (records.length > 0) {
        empBlocks.push({ empNo, name, records });
      }
    } else {
      i++;
    }
  }

  console.log(`Parsed ${empBlocks.length} employee blocks from Excel`);

  // ── Load EOD employees ─────────────────────────────────────────────────
  const users = await p.user.findMany({
    select: { id: true, name: true, employeeId: true }
  });
  // Map employeeId → user
  const userByEmpId = {};
  for (const u of users) {
    if (u.employeeId) userByEmpId[u.employeeId.trim().toUpperCase()] = u;
  }

  // ── Load existing EOD attendance for FY ────────────────────────────────
  const attRecords = await p.attendance.findMany({
    where: { date: { gte: FY_START, lte: FY_END } },
    select: { userId: true, date: true }
  });
  const attSet = new Set(attRecords.map(r => `${r.userId}|${r.date}`));

  console.log(`Existing EOD attendance records in FY: ${attSet.size}`);

  // ── Compare & collect inserts ──────────────────────────────────────────
  const toInsert = []; // {userId, date, empNo, name}
  const notFound = [];

  for (const block of empBlocks) {
    const key = block.empNo.toUpperCase();
    const user = userByEmpId[key];

    if (!user) {
      notFound.push(block.empNo);
      continue;
    }

    for (const rec of block.records) {
      if (!isPresent(rec.session1) && !isPresent(rec.session2)) continue;
      const attKey = `${user.id}|${rec.date}`;
      if (!attSet.has(attKey)) {
        toInsert.push({ userId: user.id, date: rec.date, empNo: block.empNo, name: block.name || user.name });
      }
    }
  }

  console.log(`\nRecords to insert (Excel=Present, EOD=no record): ${toInsert.length}`);
  if (notFound.length > 0) {
    console.log(`Employee IDs in Excel not found in EOD (${notFound.length}): ${[...new Set(notFound)].join(', ')}`);
  }

  if (toInsert.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  // ── Insert in batches ──────────────────────────────────────────────────
  let inserted = 0;
  const BATCH = 200;
  for (let b = 0; b < toInsert.length; b += BATCH) {
    const batch = toInsert.slice(b, b + BATCH);
    const result = await p.attendance.createMany({
      data: batch.map(r => ({ userId: r.userId, date: r.date, status: 'present' })),
      skipDuplicates: true,
    });
    inserted += result.count;
    process.stdout.write(`\rInserted ${inserted} / ${toInsert.length}...`);
  }
  console.log(`\nDone. Total inserted: ${inserted}`);

  // ── Build report grouped by employee → month ───────────────────────────
  // Group toInsert by name
  const byEmp = {};
  for (const r of toInsert) {
    if (!byEmp[r.name]) byEmp[r.name] = { empNo: r.empNo, byMonth: {} };
    const ym = r.date.slice(0, 7); // "2025-04"
    if (!byEmp[r.name].byMonth[ym]) byEmp[r.name].byMonth[ym] = [];
    byEmp[r.name].byMonth[ym].push(r.date.slice(8)); // day "01"
  }

  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('  ATTENDANCE CORRECTIONS — Excel Present → EOD Updated');
  console.log(`  FY 2025-26  |  ${toInsert.length} records updated`);
  console.log('═══════════════════════════════════════════════════════════════════');

  const empNames = Object.keys(byEmp).sort();
  for (const name of empNames) {
    const emp = byEmp[name];
    const total = Object.values(emp.byMonth).reduce((s, d) => s + d.length, 0);
    console.log(`\n${emp.empNo}  ${name}  [${total} day(s) corrected]`);
    for (const [ym, days] of Object.entries(emp.byMonth).sort()) {
      const [yr, mo] = ym.split('-');
      const label = `  ${MONTH_NAMES[+mo]} ${yr} (${days.length}d):`;
      console.log(`${label.padEnd(20)} ${days.join(', ')}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`Total employees corrected : ${empNames.length}`);
  console.log(`Total attendance records  : ${toInsert.length}`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => p.$disconnect());
