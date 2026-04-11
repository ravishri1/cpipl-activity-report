// Scan all employees: find days where muster=P but EOD=A or no record
// April 2025
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

const MUSTER_FILE = 'C:/Users/91992/Downloads/Attendance_Muster__April-2025.xls';

function parseMuster() {
  const wb = XLSX.readFile(MUSTER_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const employees = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const name  = r[0].toString().trim();
    const empId = r[1] ? r[1].toString().trim() : null;
    if (!name) continue;
    const days = {};
    for (let d = 1; d <= 30; d++) {
      const v = r[3 + d];
      days[d] = v ? v.toString().trim().toUpperCase() : null;
    }
    employees.push({ name, empId, days });
  }
  return employees;
}

function musterIsPresent(code) {
  if (!code) return false;
  // P, P:PL, P:COF, PL:P, COF:P etc. — contains P component meaning physically present
  // But pure leave codes (PL, COF, LOP, OFF, W) are NOT present-only
  const c = code.toUpperCase().trim();
  if (c === 'P') return true;
  // half-day combos with P (P:PL, P:COF, P:LOP, PL:P, COF:P, LOP:P etc.)
  if (c.startsWith('P:') || c.endsWith(':P')) return true;
  return false;
}

function musterIsOff(code) {
  if (!code) return false;
  const c = code.toUpperCase().trim();
  return c === 'OFF' || c === 'W' || c === 'H';
}

function musterIsLeaveOnly(code) {
  if (!code) return false;
  const c = code.toUpperCase().trim();
  return ['PL','COF','LOP','CL','SL','EL'].includes(c);
}

async function main() {
  const musterEmps = parseMuster();

  const dbUsers = await prisma.user.findMany({
    select: { id: true, name: true, employeeId: true, isAttendanceExempt: true },
  });
  const userByEmpId = {};
  dbUsers.forEach(u => { if (u.employeeId) userByEmpId[u.employeeId] = u; });

  // Load all April 2025 attendance
  const attRecords = await prisma.attendance.findMany({
    where: { date: { gte: '2025-04-01', lte: '2025-04-30' } },
    select: { userId: true, date: true, status: true },
  });
  const attMap = {};
  attRecords.forEach(a => {
    if (!attMap[a.userId]) attMap[a.userId] = {};
    attMap[a.userId][a.date] = a.status;
  });

  // Load approved leaves
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'approved',
      OR: [
        { startDate: { gte: '2025-04-01', lte: '2025-04-30' } },
        { endDate:   { gte: '2025-04-01', lte: '2025-04-30' } },
      ],
    },
    select: { userId: true, startDate: true, endDate: true },
  });
  const leaveMap = {};
  for (const lr of leaves) {
    const from = new Date(lr.startDate + 'T00:00:00Z');
    const to   = new Date(lr.endDate   + 'T00:00:00Z');
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      if (ds >= '2025-04-01' && ds <= '2025-04-30') {
        if (!leaveMap[lr.userId]) leaveMap[lr.userId] = new Set();
        leaveMap[lr.userId].add(ds);
      }
    }
  }

  console.log('MUSTER=P but EOD=ABSENT or NO RECORD — April 2025');
  console.log('='.repeat(80));

  const toFix = []; // { userId, empId, name, date }

  for (const emp of musterEmps) {
    const dbUser = userByEmpId[emp.empId];
    if (!dbUser) {
      // Check if any day is P in muster
      const pDays = Object.entries(emp.days).filter(([d,v]) => musterIsPresent(v));
      if (pDays.length > 0) console.log(`  NOT IN EOD: ${emp.empId} ${emp.name}`);
      continue;
    }
    if (dbUser.isAttendanceExempt) continue; // exempt — skip

    const userId = dbUser.id;
    const issues = [];

    for (let day = 1; day <= 30; day++) {
      const code = emp.days[day];
      const ds   = `2025-04-${String(day).padStart(2, '0')}`;

      if (!musterIsPresent(code)) continue; // only check days muster marks as present

      const attStatus = attMap[userId]?.[ds] || null;
      const hasLeave  = leaveMap[userId]?.has(ds) || false;

      // If muster says P (or P:XX) and EOD has no attendance record or shows absent
      if (!attStatus || attStatus === 'absent') {
        // If there's an approved leave for that day it's a half-day — not really absent
        if (hasLeave) continue; // half-day leave + present — leave record covers it
        issues.push({ ds, musterCode: code, attStatus: attStatus || '—' });
        toFix.push({ userId, empId: emp.empId, name: emp.name, date: ds });
      }
    }

    if (issues.length > 0) {
      console.log(`\n  ${emp.empId} | ${emp.name}`);
      issues.forEach(i =>
        console.log(`    ${i.ds}  Muster=${i.musterCode.padEnd(8)}  EOD-Att=${i.attStatus}  → needs P`)
      );
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`TOTAL days to fix: ${toFix.length}`);

  if (toFix.length === 0) {
    console.log('Nothing to fix!');
    return;
  }

  // Auto-fix: upsert all missing present records
  console.log('\nFixing...');
  let fixed = 0;
  for (const f of toFix) {
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: f.userId, date: f.date } },
    });
    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: { status: 'present', adminOverride: true, notes: 'Set present per GreytHR muster Apr 2025' },
      });
      console.log(`  UPDATED  ${f.empId} ${f.date} ${existing.status}→present`);
    } else {
      await prisma.attendance.create({
        data: {
          userId: f.userId,
          date: f.date,
          status: 'present',
          adminOverride: true,
          notes: 'Set present per GreytHR muster Apr 2025',
        },
      });
      console.log(`  CREATED  ${f.empId} ${f.date} →present`);
    }
    fixed++;
  }

  console.log(`\nDone. Fixed ${fixed} attendance records.`);
  console.log('All marked with adminOverride=true so biometric sync won\'t overwrite them.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
