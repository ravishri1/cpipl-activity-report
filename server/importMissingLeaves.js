const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

const LT_IDS = { PL: 7, LOP: 8, COF: 9, CF: 10 };
const ADMIN_ID = 1;
const YEAR = 2025;

// Already imported employees (from XLS + Jyoti)
const ALREADY_IMPORTED = new Set([
  'COLOR034','COLOR026','COLOR064','COLOR120','COLOR146','COLOR057',
  'COLOR013','COLOR022','COLOR170','COLOR171','COLOR176','COLOR191',
  'COLOR117','COLOR188','COLOR190','COLOR184','COLOR167','COLOR182',
  'COLOR185','COLOR194','COLOR193','COLOR115','COLOR195','COLOR047'
]);

async function main() {
  // Load PDF-parsed records, filter to only missing employees
  const all = JSON.parse(fs.readFileSync('C:/esslSync/leave_deduped.json', 'utf-8'));
  const records = all.filter(r => !ALREADY_IMPORTED.has(r.empNo));

  const users = await p.user.findMany({ select: { id: true, employeeId: true, name: true } });
  const empMap = {};
  for (const u of users) if (u.employeeId) empMap[u.employeeId] = u;

  // Group by emp
  const byEmp = {};
  for (const r of records) {
    if (!byEmp[r.empNo]) byEmp[r.empNo] = [];
    byEmp[r.empNo].push(r);
  }

  const reviewedAt = new Date();
  let inserted = 0, notFound = 0;

  for (const [empNo, empRecs] of Object.entries(byEmp)) {
    const user = empMap[empNo];
    if (!user) { console.log(`  NOT FOUND: ${empNo}`); notFound++; continue; }

    await Promise.all(empRecs.map(rec =>
      p.leaveRequest.create({
        data: {
          userId:      user.id,
          leaveTypeId: LT_IDS[rec.leaveType],
          startDate:   rec.fromDate,
          endDate:     rec.toDate,
          days:        rec.days,
          session:     rec.days <= 0.5 ? 'first_half' : 'full_day',
          reason:      (rec.reason || '-').substring(0, 500),
          status:      'approved',
          reviewedBy:  ADMIN_ID,
          reviewedAt,
          reviewNote:  'Imported from Day Wise Leave Transaction Report FY2025-26',
        }
      })
    ));
    inserted += empRecs.length;
    console.log(`  ✓ ${empNo} ${user.name.substring(0,30).padEnd(30)} ${empRecs.length} records`);
  }

  console.log(`\nInserted: ${inserted}, Not found: ${notFound}`);

  // Now update used balances from the Leave Summary Report for ALL missing employees
  // (covers employees in summary but not in PDF)
  const allUsed = JSON.parse(fs.readFileSync('./all_used.json', 'utf-8'));

  console.log('\nUpdating used balances from Leave Summary Report...');
  const updates = [];
  for (const r of allUsed) {
    if (ALREADY_IMPORTED.has(r.empNo)) continue;
    const user = empMap[r.empNo];
    if (!user) continue;

    const usedMap = [
      { ltId: LT_IDS.PL,  used: r.plUsed  },
      { ltId: LT_IDS.COF, used: r.cofUsed },
      { ltId: LT_IDS.LOP, used: r.lopUsed },
    ];
    for (const { ltId, used } of usedMap) {
      if (used <= 0) continue;
      updates.push({ userId: user.id, ltId, used });
    }
  }

  // Batch update
  await Promise.all(updates.map(u =>
    p.leaveBalance.updateMany({
      where: { userId: u.userId, leaveTypeId: u.ltId, year: YEAR },
      data: { used: u.used }
    })
  ));
  console.log(`Updated ${updates.length} balance used fields`);
  console.log('Done.');
}

main().catch(console.error).finally(() => p.$disconnect());
