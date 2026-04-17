/**
 * Import attendance from Greythr muster, correctly handling 2-session attendance.
 *
 * Session logic:
 *   P + P         → present
 *   A + A         → absent
 *   OFF + OFF     → skip (weekly off)
 *   H + H         → skip (holiday)
 *   leave + leave → on_leave  (PL/LOP/COF both sessions)
 *   P + leave/A   → half_day  (present first half, leave/absent second half)
 *   leave/A + P   → half_day  (leave/absent first half, present second half)
 *   leave + leave (mixed types) → on_leave
 *
 * Usage: node scripts/importMusterSessions.js
 */

const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const { execSync } = require('child_process');

const prisma = new PrismaClient();
const MUSTER_PATH = 'C:\\Users\\91992\\Downloads\\Attendance Muster Report (3).xlsx';
const COMPANY_ID = 1;

const LEAVE_CODES = new Set(['PL', 'LOP', 'COF', 'CF', 'SL', 'CL', 'ML', 'WO', 'HD']);
const OFF_CODES   = new Set(['OFF', 'WO', 'H', 'HOLIDAY']);

function resolveStatus(s1, s2) {
  const u1 = (s1 || '').toUpperCase().trim();
  const u2 = (s2 || '').toUpperCase().trim();
  if (!u1 || !u2 || u1 === 'NONE' || u2 === 'NONE') return null;

  const isOff1 = OFF_CODES.has(u1);
  const isOff2 = OFF_CODES.has(u2);
  if (isOff1 && isOff2) return { status: 'off', s1: u1, s2: u2 };      // skip

  const isLeave1 = LEAVE_CODES.has(u1);
  const isLeave2 = LEAVE_CODES.has(u2);
  const isP1 = u1 === 'P';
  const isP2 = u2 === 'P';
  const isA1 = u1 === 'A';
  const isA2 = u2 === 'A';

  if (isP1 && isP2)   return { status: 'present',  s1: u1, s2: u2 };
  if (isA1 && isA2)   return { status: 'absent',   s1: u1, s2: u2 };

  // Mixed: one side P, other side leave/absent
  if (isP1 && (isLeave2 || isA2)) return { status: 'half_day', s1: u1, s2: u2 };
  if (isP2 && (isLeave1 || isA1)) return { status: 'half_day', s1: u1, s2: u2 };

  // Both leave (same or different types)
  if ((isLeave1 || isA1) && (isLeave2 || isA2)) return { status: 'on_leave', s1: u1, s2: u2 };

  return { status: 'present', s1: u1, s2: u2 }; // fallback
}

async function main() {
  console.log('Reading muster:', MUSTER_PATH);

  // Parse Excel via Python (openpyxl) — call external .py file to avoid inline multiline issues
  const pyFile = path.join(__dirname, 'parseMuster.py');
  const pyOut = execSync(`C:/Python314/python.exe "${pyFile}"`, {
    timeout: 120000, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024,
  });
  const musterRows = JSON.parse(pyOut.trim().split('\n').filter(l => l.startsWith('['))[0] || pyOut.trim());
  console.log(`Parsed ${musterRows.length} attendance rows from muster`);

  // Build employee ID → DB user map
  const allEmps = [...new Set(musterRows.map(r => r.emp))];
  const users = await prisma.user.findMany({
    where: { employeeId: { in: allEmps }, companyId: COMPANY_ID },
    select: { id: true, employeeId: true },
  });
  const empMap = new Map(users.map(u => [u.employeeId, u.id]));
  console.log(`Found ${users.length} of ${allEmps.length} employees in DB`);

  let updated = 0, created = 0, skipped = 0, errors = 0;
  const changes = [];

  for (const row of musterRows) {
    const userId = empMap.get(row.emp);
    if (!userId) { skipped++; continue; }

    const resolved = resolveStatus(row.s1, row.s2);
    if (!resolved || resolved.status === 'off') { skipped++; continue; }

    try {
      const existing = await prisma.attendance.findFirst({
        where: { userId, date: row.date },
        select: { id: true, status: true, session1: true, session2: true, adminOverride: true },
      });

      const newSession1 = resolved.s1;
      const newSession2 = resolved.s2;
      const newStatus   = resolved.status;

      // Skip if nothing changed
      if (existing &&
          existing.status   === newStatus &&
          existing.session1 === newSession1 &&
          existing.session2 === newSession2) {
        skipped++;
        continue;
      }

      const data = {
        status: newStatus,
        session1: newSession1,
        session2: newSession2,
        adminOverride: true,
        adminRemark: `Muster sync: S1=${newSession1} S2=${newSession2}`,
      };

      if (existing) {
        const old = `${existing.status}(${existing.session1||'-'}/${existing.session2||'-'})`;
        await prisma.attendance.update({ where: { id: existing.id }, data });
        changes.push(`  ${row.emp} ${row.date}: ${old} → ${newStatus}(${newSession1}/${newSession2})`);
        updated++;
      } else {
        await prisma.attendance.create({ data: { userId, date: row.date, ...data } });
        changes.push(`  ${row.emp} ${row.date}: NEW → ${newStatus}(${newSession1}/${newSession2})`);
        created++;
      }
    } catch (e) {
      console.error(`  ERROR ${row.emp} ${row.date}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${created} created, ${skipped} skipped, ${errors} errors`);

  if (changes.length > 0) {
    console.log(`\nChanges made (${changes.length}):`);
    for (const c of changes) console.log(c);
  } else {
    console.log('\nNo changes needed — attendance already matches muster.');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
