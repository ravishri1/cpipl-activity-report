// Three-way comparison: Muster XLS + Leave TXN XLS + EOD Portal DB — April 2025
// Muster structure: Row0=title, Row1=name/id header, Row2=day numbers, Row3+=data
//   Col0=Name, Col1=EmpId, Col4-33=Days 1-30
// TXN structure: Row0-2=company, Row3=col headers, then date-group rows (col1=null) + data rows
//   Cols: 0=SlNo, 1=EmpId, 2=Name, 5=LeaveType, 6=FromDate(serial), 7=ToDate(serial), 8=TxnType, 9=Days

const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();
const MUSTER_FILE = 'C:/Users/91992/Downloads/Attendance_Muster__April-2025.xls';
const TXN_FILE   = 'C:/Users/91992/Downloads/Day Wise Leave Transaction Report (1).xls';

function excelSerialToDate(serial) {
  const ms = (serial - 25569) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}
function normLeaveType(raw) {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase();
  if (s.includes('privilege')) return 'PL';
  if (s.includes('comp'))     return 'COF';
  if (s.includes('loss'))     return 'LOP';
  if (s.includes('casual'))   return 'CL';
  if (s.includes('sick'))     return 'SL';
  return raw.toString().trim();
}
function musterLeaveType(code) {
  if (!code) return null;
  const c = code.toUpperCase();
  if (c.includes('PL'))  return 'PL';
  if (c.includes('COF')) return 'COF';
  if (c.includes('LOP')) return 'LOP';
  if (c.includes('CL'))  return 'CL';
  if (c.includes('SL'))  return 'SL';
  return null;
}
function isLeaveCode(code) { return musterLeaveType(code) !== null; }
function isAbsentCode(code) {
  if (!code) return false;
  const c = code.toString().toUpperCase().trim();
  return c === 'A' || c === 'ABSENT';
}

// ─── PARSE MUSTER ───────────────────────────────────────────────────────────
// Row1=headers(col0=Name,col1=EmpId), Row2=day-numbers(col4..33), Row3+=data
function parseMuster() {
  const wb = XLSX.readFile(MUSTER_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const employees = [];
  // Data starts at row 3 (0-indexed), days at cols 4..33
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const name  = r[0] ? r[0].toString().trim() : null;
    const empId = r[1] ? r[1].toString().trim() : null;
    if (!name) continue;
    const days = {};
    for (let d = 1; d <= 30; d++) {
      const v = r[3 + d]; // col4=day1, col5=day2, ..., col33=day30
      days[d] = v ? v.toString().trim() : null;
    }
    employees.push({ name, empId, days });
  }
  return employees;
}

// ─── PARSE TXN ───────────────────────────────────────────────────────────────
// Row3=headers, then date-group rows (r[1]==null) interleaved with data rows
// Data cols: 1=EmpId, 2=Name, 5=LeaveType, 6=FromDate, 7=ToDate, 8=TxnType, 9=Days
function parseTxn() {
  const wb = XLSX.readFile(TXN_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const records = [];
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r[1] === null || r[1] === undefined) continue; // date-group header row
    const empId  = r[1] ? r[1].toString().trim() : null;
    const name   = r[2] ? r[2].toString().trim() : null;
    const ltype  = normLeaveType(r[5]);
    const txnType= r[8] ? r[8].toString().trim() : null;
    let fromDate = r[6];
    let toDate   = r[7];
    if (fromDate && !isNaN(fromDate)) fromDate = excelSerialToDate(Number(fromDate));
    if (toDate   && !isNaN(toDate))   toDate   = excelSerialToDate(Number(toDate));
    const days = r[9] !== null && r[9] !== undefined ? parseFloat(r[9]) : null;
    if (!empId || !fromDate) continue;
    records.push({ empId, name, leaveType: ltype, txnType, fromDate, toDate: toDate || fromDate, days });
  }
  return records;
}

function expandDates(from, to) {
  const dates = [];
  const d = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const apr1  = new Date('2025-04-01T00:00:00Z');
  const apr30 = new Date('2025-04-30T00:00:00Z');
  while (d <= end) {
    const ds = d.toISOString().slice(0, 10);
    if (d >= apr1 && d <= apr30) dates.push(ds);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(80));
  console.log('THREE-WAY COMPARISON: Muster XLS | Leave TXN XLS | EOD DB — April 2025');
  console.log('='.repeat(80));

  const musterEmps = parseMuster();
  const txnRecords = parseTxn();
  console.log(`\nMuster: ${musterEmps.length} employees`);
  console.log(`Leave TXN: ${txnRecords.length} records`);

  // Load EOD DB
  const dbLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'approved',
      OR: [
        { startDate: { gte: '2025-04-01', lte: '2025-04-30' } },
        { endDate:   { gte: '2025-04-01', lte: '2025-04-30' } },
      ],
    },
    select: { userId: true, startDate: true, endDate: true, leaveTypeId: true },
  });
  const dbLT = await prisma.leaveType.findMany({ select: { id: true, code: true, name: true } });
  const ltMap = {};
  dbLT.forEach(lt => { ltMap[lt.id] = lt.code || (lt.name || '').slice(0,3).toUpperCase(); });

  const dbAtt = await prisma.attendance.findMany({
    where: { date: { gte: '2025-04-01', lte: '2025-04-30' } },
    select: { userId: true, date: true, status: true },
  });

  const dbUsers = await prisma.user.findMany({
    select: { id: true, name: true, employeeId: true, isAttendanceExempt: true },
  });
  const userByEmpId = {};
  const userById = {};
  dbUsers.forEach(u => { if (u.employeeId) userByEmpId[u.employeeId] = u; userById[u.id] = u; });

  // EOD leave map: userId → date → code
  const eodLeaveMap = {};
  for (const lr of dbLeaves) {
    if (!eodLeaveMap[lr.userId]) eodLeaveMap[lr.userId] = {};
    const dates = expandDates(lr.startDate, lr.endDate);
    for (const ds of dates) eodLeaveMap[lr.userId][ds] = ltMap[lr.leaveTypeId] || 'L';
  }

  // EOD att map: userId → date → status
  const eodAttMap = {};
  for (const att of dbAtt) {
    if (!eodAttMap[att.userId]) eodAttMap[att.userId] = {};
    eodAttMap[att.userId][att.date] = att.status;
  }

  // TXN map: empId → date → code
  const txnMap = {};
  for (const rec of txnRecords) {
    if (!txnMap[rec.empId]) txnMap[rec.empId] = {};
    for (const ds of expandDates(rec.fromDate, rec.toDate)) {
      txnMap[rec.empId][ds] = rec.leaveType;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 1: MUSTER XLS
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('VIEW 1: MUSTER XLS — GreytHR day-by-day status for April 2025');
  console.log('═'.repeat(80));
  for (const emp of musterEmps) {
    const leaveDays = [], absDays = [], lopDays = [];
    for (let d = 1; d <= 30; d++) {
      const v = emp.days[d];
      if (!v) continue;
      const lt = musterLeaveType(v);
      if (lt === 'LOP') lopDays.push(`${d}(${v})`);
      else if (lt)      leaveDays.push(`${d}(${v})`);
      else if (isAbsentCode(v)) absDays.push(d);
    }
    const parts = [];
    if (leaveDays.length) parts.push(`Leave: ${leaveDays.join(' ')}`);
    if (lopDays.length)   parts.push(`LOP: ${lopDays.join(' ')}`);
    if (absDays.length)   parts.push(`Absent: ${absDays.join(',')}`);
    if (parts.length) {
      console.log(`  ${(emp.empId||'?').padEnd(10)} ${emp.name.padEnd(32)} | ${parts.join(' | ')}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 2: LEAVE TXN XLS
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('VIEW 2: LEAVE TRANSACTION XLS — GreytHR approved leave grants');
  console.log('═'.repeat(80));
  // Group by empId
  const byEmp = {};
  for (const r of txnRecords) {
    if (!byEmp[r.empId]) byEmp[r.empId] = [];
    byEmp[r.empId].push(r);
  }
  for (const [eid, recs] of Object.entries(byEmp)) {
    for (const r of recs) {
      console.log(`  ${eid.padEnd(10)} ${(r.name||'').padEnd(32)} ${(r.leaveType||'?').padEnd(5)} ${r.fromDate}→${r.toDate} ${(r.txnType||'').padEnd(12)} ${r.days}d`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 3: THREE-WAY COMPARISON
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('VIEW 3: THREE-WAY COMPARISON — per employee, per day');
  console.log('   Date       | Muster   | TXN   | EOD-Leave | EOD-Att      | Status');
  console.log('═'.repeat(80));

  let totalIssues = 0;
  const summary = { noTxn: [], noEodLeave: [], typeMismatch: [], extraLeave: [] };

  for (const emp of musterEmps) {
    const dbUser = userByEmpId[emp.empId];
    const userId = dbUser?.id;
    const exempt = dbUser?.isAttendanceExempt;
    const notInEod = !userId;

    const rows = [];
    for (let day = 1; day <= 30; day++) {
      const mCode = emp.days[day] ? emp.days[day].toUpperCase().trim() : null;
      const ds = `2025-04-${String(day).padStart(2,'0')}`;
      const txnCode  = txnMap[emp.empId]?.[ds] || null;
      const eodLeave = userId ? (eodLeaveMap[userId]?.[ds] || null) : '?';
      const eodAtt   = userId ? (eodAttMap[userId]?.[ds]   || null) : '?';

      const mlt = musterLeaveType(mCode);
      const mIsLeave  = mlt !== null;
      const mIsAbsent = isAbsentCode(mCode);

      const issues = [];
      if (mIsLeave) {
        if (!txnCode) { issues.push('NO TXN'); summary.noTxn.push(`${emp.empId} ${ds}`); }
        else if (txnCode !== mlt) { issues.push(`TXN-type:${txnCode}≠${mlt}`); summary.typeMismatch.push(`${emp.empId} ${ds} muster=${mlt} txn=${txnCode}`); }
        if (!notInEod && !eodLeave) { issues.push('NO EOD LEAVE'); summary.noEodLeave.push(`${emp.empId} ${ds} ${mlt}`); }
        else if (!notInEod && eodLeave && eodLeave !== mlt) { issues.push(`EOD-type:${eodLeave}≠${mlt}`); summary.typeMismatch.push(`${emp.empId} ${ds} muster=${mlt} eod=${eodLeave}`); }
      }
      if (txnCode && !mIsLeave) {
        issues.push(`TXN has ${txnCode} but muster=${mCode||'—'}`);
        summary.extraLeave.push(`${emp.empId} ${ds} txn=${txnCode} muster=${mCode}`);
      }
      if (!notInEod && eodLeave && !mIsLeave && mCode && !['OFF','P'].includes(mCode)) {
        issues.push(`EOD has ${eodLeave} but muster=${mCode}`);
      }

      const showRow = mIsLeave || mIsAbsent || issues.length > 0;
      if (showRow) {
        rows.push({ ds, mCode, txnCode, eodLeave, eodAtt, issues });
        totalIssues += issues.length;
      }
    }

    if (rows.length > 0) {
      const hasIssues = rows.some(r => r.issues.length > 0);
      const flags = [notInEod ? 'NOT-IN-EOD' : '', exempt ? 'EXEMPT' : ''].filter(Boolean).join(',');
      console.log(`\n  ${emp.empId||'?'} | ${emp.name}${flags ? ' ['+flags+']' : ''}`);
      for (const r of rows) {
        const ok = r.issues.length === 0 ? '✓' : `⚠ ${r.issues.join(' | ')}`;
        console.log(`    ${r.ds}  Muster=${String(r.mCode||'—').padEnd(7)} TXN=${String(r.txnCode||'—').padEnd(5)} EOD-L=${String(r.eodLeave||'—').padEnd(5)} Att=${String(r.eodAtt||'—').padEnd(12)} ${ok}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('ISSUE SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total issues: ${totalIssues}`);
  console.log(`\nLeave in Muster but NO TXN record (${summary.noTxn.length}):`);
  summary.noTxn.forEach(s => console.log('  ' + s));
  console.log(`\nLeave in Muster but NOT in EOD portal (${summary.noEodLeave.length}):`);
  summary.noEodLeave.forEach(s => console.log('  ' + s));
  console.log(`\nLeave type MISMATCH between sources (${summary.typeMismatch.length}):`);
  summary.typeMismatch.forEach(s => console.log('  ' + s));
  console.log(`\nTXN has leave but Muster does NOT (${summary.extraLeave.length}):`);
  summary.extraLeave.forEach(s => console.log('  ' + s));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
