const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

const LT_IDS = { PL: 7, LOP: 8, COF: 9, CF: 10 };
const SKIP_EMP = 'COLOR047'; // Jyoti already imported
const ADMIN_ID = 1;
const YEAR = 2025;

async function main() {
  const records = JSON.parse(fs.readFileSync('./all_leaves.json', 'utf-8'))
    .filter(r => r.empNo !== SKIP_EMP);

  // Bulk fetch users
  const users = await p.user.findMany({ select: { id: true, employeeId: true, name: true } });
  const empMap = {};
  for (const u of users) if (u.employeeId) empMap[u.employeeId] = u;

  // Delete existing non-Jyoti FY2025 leaves first (clean slate for re-import)
  const jyoti = empMap[SKIP_EMP];
  const deleted = await p.leaveRequest.deleteMany({
    where: {
      NOT: { userId: jyoti?.id },
      startDate: { gte: '2025-04-01' },
      endDate:   { lte: '2026-03-31' },
    }
  });
  console.log(`Deleted ${deleted.count} existing leave requests (non-Jyoti FY2025)`);

  const reviewedAt = new Date();
  let inserted = 0, skipped = 0;

  // Group by empNo for logging
  const byEmp = {};
  for (const r of records) {
    if (!byEmp[r.empNo]) byEmp[r.empNo] = [];
    byEmp[r.empNo].push(r);
  }

  for (const [empNo, empRecords] of Object.entries(byEmp)) {
    const user = empMap[empNo];
    if (!user) { console.log(`  NOT FOUND: ${empNo}`); skipped += empRecords.length; continue; }

    // Insert all records for this employee in parallel
    await Promise.all(empRecords.map(rec =>
      p.leaveRequest.create({
        data: {
          userId:      user.id,
          leaveTypeId: LT_IDS[rec.leaveType],
          startDate:   rec.fromDate,
          endDate:     rec.toDate,
          days:        rec.days,
          session:     rec.days <= 0.5 ? 'first_half' : 'full_day',
          reason:      rec.reason.substring(0, 500) || '-',
          status:      'approved',
          reviewedBy:  ADMIN_ID,
          reviewedAt,
          reviewNote:  'Imported from Day Wise Leave Transaction Report FY2025-26',
        }
      })
    ));

    inserted += empRecords.length;
    console.log(`  ✓ ${empNo} ${user.name.substring(0,30).padEnd(30)} ${empRecords.length} records`);
  }

  console.log(`\nInserted: ${inserted}, Skipped: ${skipped}`);

  // Recalculate used for all affected users from actual requests
  console.log('\nRecalculating used balances...');
  const affectedUserIds = [...new Set(
    Object.keys(byEmp).map(e => empMap[e]?.id).filter(Boolean)
  )];

  for (const uid of affectedUserIds) {
    for (const [code, ltId] of Object.entries(LT_IDS)) {
      const agg = await p.leaveRequest.aggregate({
        where: { userId: uid, leaveTypeId: ltId, status: 'approved', startDate: { gte: '2025-04-01' }, endDate: { lte: '2026-03-31' } },
        _sum: { days: true }
      });
      const used = agg._sum.days || 0;
      if (used > 0) {
        await p.leaveBalance.updateMany({
          where: { userId: uid, leaveTypeId: ltId, year: YEAR },
          data: { used }
        });
      }
    }
  }
  console.log('Done.');
}

main().catch(console.error).finally(() => p.$disconnect());
