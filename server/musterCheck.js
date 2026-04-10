/**
 * Muster Check — verify no remaining mismatches
 * Checks TWO cases:
 *   1. Excel=Present, EOD record MISSING (should be 0 after musterSync)
 *   2. Excel=Present, EOD record EXISTS but status='absent' → fix these
 */

const XLSX   = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path   = require('path');

const p = new PrismaClient();
const EXCEL_PATH = 'C:\\Users\\91992\\Downloads\\Attendance Muster Report.xlsx';

const FY_START = '2025-04-01';
const FY_END   = '2026-03-31';

const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toDateStr(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    const d = new Date(val);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

function isPresent(s) {
  return s && String(s).trim().toUpperCase() === 'P';
}

async function main() {
  // Parse Excel
  console.log('Loading Excel...');
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Re-parse employee blocks
  const empBlocks = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (
      row && row[0] && typeof row[0] === 'string' &&
      /^[A-Z]{2,}[0-9]+$/i.test(String(row[0]).trim()) &&
      row[1] && typeof row[1] === 'string' && row[1].trim().length > 2
    ) {
      const empNo = String(row[0]).trim();
      const name  = String(row[1]).trim();
      i++;
      const headerRow = rows[i];
      let colDate = 1, colS1 = 2, colS2 = 3;
      if (headerRow) {
        for (let c = 0; c < headerRow.length; c++) {
          const h = headerRow[c] ? String(headerRow[c]).trim().toLowerCase() : '';
          if (h.includes('attendance date')) colDate = c;
          if (h.includes('session1') && colS1 === 2) colS1 = c;
          if (h.includes('session2') && colS2 === 3) colS2 = c;
        }
      }
      i++;
      const records = [];
      while (i < rows.length) {
        const dr = rows[i];
        if (!dr || (!dr[0] && !dr[1] && !dr[2])) { i++; break; }
        if (
          dr[0] && typeof dr[0] === 'string' &&
          /^[A-Z]{2,}[0-9]+$/i.test(String(dr[0]).trim()) &&
          dr[1] && typeof dr[1] === 'string' && dr[1].trim().length > 2 &&
          String(dr[0]).trim() !== empNo
        ) break;
        const dateStr = toDateStr(dr[colDate]);
        if (dateStr && dateStr >= FY_START && dateStr <= FY_END) {
          records.push({ date: dateStr, s1: dr[colS1], s2: dr[colS2] });
        }
        i++;
      }
      if (records.length) empBlocks.push({ empNo, name, records });
    } else { i++; }
  }

  console.log(`Parsed ${empBlocks.length} employee blocks`);

  // Load EOD users
  const users = await p.user.findMany({ select: { id: true, name: true, employeeId: true } });
  const userByEmpId = {};
  for (const u of users) if (u.employeeId) userByEmpId[u.employeeId.trim().toUpperCase()] = u;

  // Load ALL EOD attendance records (with status)
  const attRecords = await p.attendance.findMany({
    where: { date: { gte: FY_START, lte: FY_END } },
    select: { id: true, userId: true, date: true, status: true }
  });
  // Map: "userId|date" → {id, status}
  const attMap = {};
  for (const r of attRecords) attMap[`${r.userId}|${r.date}`] = r;

  const missing   = []; // Excel=P, EOD=no record
  const wrongStatus = []; // Excel=P, EOD=absent

  for (const block of empBlocks) {
    const user = userByEmpId[block.empNo.toUpperCase()];
    if (!user) continue;

    for (const rec of block.records) {
      if (!isPresent(rec.s1) && !isPresent(rec.s2)) continue;
      const key = `${user.id}|${rec.date}`;
      const existing = attMap[key];
      if (!existing) {
        missing.push({ userId: user.id, date: rec.date, empNo: block.empNo, name: block.name || user.name });
      } else if (existing.status === 'absent') {
        wrongStatus.push({ id: existing.id, userId: user.id, date: rec.date, empNo: block.empNo, name: block.name || user.name });
      }
    }
  }

  console.log(`\nCase 1 — Excel=Present, EOD missing record : ${missing.length}`);
  console.log(`Case 2 — Excel=Present, EOD status=absent  : ${wrongStatus.length}`);

  // Fix Case 1 — insert missing
  if (missing.length > 0) {
    console.log('\nInserting missing records...');
    const result = await p.attendance.createMany({
      data: missing.map(r => ({ userId: r.userId, date: r.date, status: 'present' })),
      skipDuplicates: true,
    });
    console.log(`Inserted: ${result.count}`);
    // Report
    const byEmp = {};
    for (const r of missing) {
      if (!byEmp[r.name]) byEmp[r.name] = { empNo: r.empNo, byMonth: {} };
      const ym = r.date.slice(0,7);
      if (!byEmp[r.name].byMonth[ym]) byEmp[r.name].byMonth[ym] = [];
      byEmp[r.name].byMonth[ym].push(r.date.slice(8));
    }
    console.log('\n--- Case 1 Detail ---');
    for (const [name, emp] of Object.entries(byEmp).sort()) {
      const total = Object.values(emp.byMonth).reduce((s,d) => s+d.length, 0);
      console.log(`\n${emp.empNo}  ${name}  [${total}d]`);
      for (const [ym, days] of Object.entries(emp.byMonth).sort()) {
        const [yr,mo] = ym.split('-');
        console.log(`  ${MONTH_NAMES[+mo]} ${yr} (${days.length}d): ${days.join(', ')}`);
      }
    }
  }

  // Fix Case 2 — update status to present
  if (wrongStatus.length > 0) {
    console.log('\nFixing absent→present...');
    let fixed = 0;
    for (const r of wrongStatus) {
      await p.attendance.update({ where: { id: r.id }, data: { status: 'present' } });
      fixed++;
      if (fixed % 50 === 0) process.stdout.write(`\r  Updated ${fixed}/${wrongStatus.length}...`);
    }
    console.log(`\nFixed: ${fixed}`);
    // Report
    const byEmp = {};
    for (const r of wrongStatus) {
      if (!byEmp[r.name]) byEmp[r.name] = { empNo: r.empNo, byMonth: {} };
      const ym = r.date.slice(0,7);
      if (!byEmp[r.name].byMonth[ym]) byEmp[r.name].byMonth[ym] = [];
      byEmp[r.name].byMonth[ym].push(r.date.slice(8));
    }
    console.log('\n--- Case 2 Detail (absent→present) ---');
    for (const [name, emp] of Object.entries(byEmp).sort()) {
      const total = Object.values(emp.byMonth).reduce((s,d) => s+d.length, 0);
      console.log(`\n${emp.empNo}  ${name}  [${total}d]`);
      for (const [ym, days] of Object.entries(emp.byMonth).sort()) {
        const [yr,mo] = ym.split('-');
        console.log(`  ${MONTH_NAMES[+mo]} ${yr} (${days.length}d): ${days.join(', ')}`);
      }
    }
  }

  if (missing.length === 0 && wrongStatus.length === 0) {
    console.log('\n✅ All clear — no mismatches found. Excel and EOD are fully in sync.');
  } else {
    console.log(`\n✅ Done — fixed ${missing.length} missing + ${wrongStatus.length} wrong-status records.`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
