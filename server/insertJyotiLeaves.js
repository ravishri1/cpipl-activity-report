const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

const LEAVE_TYPE_IDS = { PL: 7, LOP: 8, COF: 9, CF: 10 };
const ADMIN_ID = 1;
const USER_ID = 1; // Jyoti Vasant Naik

async function main() {
  const records = JSON.parse(fs.readFileSync('./jyoti_leaves.json', 'utf-8'));
  console.log(`Importing ${records.length} leave records for Jyoti Vasant Naik`);

  const reviewedAt = new Date();
  let inserted = 0;

  for (const rec of records) {
    const leaveTypeId = LEAVE_TYPE_IDS[rec.leaveType];
    const session = rec.days <= 0.5 ? 'first_half' : 'full_day';

    await p.leaveRequest.create({
      data: {
        userId: USER_ID,
        leaveTypeId,
        startDate: rec.fromDate,
        endDate: rec.toDate,
        days: rec.days,
        session,
        reason: rec.reason.substring(0, 500) || '-',
        status: 'approved',
        reviewedBy: ADMIN_ID,
        reviewedAt,
        reviewNote: 'Imported from Day Wise Leave Transaction Report',
      },
    });
    inserted++;
    console.log(`  [${inserted}] ${rec.leaveType} | ${rec.fromDate} to ${rec.toDate} | ${rec.days}d`);
  }

  console.log(`\nInserted: ${inserted} records`);

  // Recalculate used for each leave type from actual requests
  console.log('\nRecalculating used balances...');
  for (const [code, ltId] of Object.entries(LEAVE_TYPE_IDS)) {
    const result = await p.leaveRequest.aggregate({
      where: { userId: USER_ID, leaveTypeId: ltId, status: 'approved', startDate: { gte: '2025-04-01' }, endDate: { lte: '2026-03-31' } },
      _sum: { days: true },
    });
    const used = result._sum.days || 0;
    await p.leaveBalance.updateMany({
      where: { userId: USER_ID, leaveTypeId: ltId, year: 2025 },
      data: { used },
    });
    console.log(`  ${code}: used=${used}`);
  }

  // Verify final balances
  const bals = await p.leaveBalance.findMany({
    where: { userId: USER_ID, year: 2025 },
    include: { leaveType: { select: { code: true } } },
    orderBy: { leaveTypeId: 'asc' },
  });
  console.log('\nFinal FY2025 balances:');
  for (const b of bals) {
    const available = (b.opening || 0) + (b.total || 0) - (b.used || 0);
    console.log(`  ${b.leaveType.code}: opening=${b.opening} total=${b.total} used=${b.used} available=${available}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
