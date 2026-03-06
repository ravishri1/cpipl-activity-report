const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Count total punches
  const punchCount = await p.biometricPunch.count();
  console.log('=== TOTAL BIOMETRIC PUNCHES IN DB ===', punchCount);

  // Recent punches (correct relation name: employee)
  const punches = await p.biometricPunch.findMany({
    orderBy: { punchTime: 'desc' },
    take: 10,
    include: { employee: { select: { name: true, employeeId: true } } }
  });
  console.log('\n=== RECENT PUNCHES ===');
  punches.forEach(punch => {
    console.log(`${punch.punchTime} | ${punch.enrollNumber} | dir: ${punch.direction} | emp: ${punch.employee?.name || 'unmatched'}`);
  });

  // Check this week for all users
  const weekAtt = await p.attendance.findMany({
    where: { date: { gte: '2026-03-01', lte: '2026-03-07' } },
    include: { user: { select: { name: true, employeeId: true } } },
    orderBy: [{ date: 'asc' }, { userId: 'asc' }]
  });
  console.log('\n=== THIS WEEK ATTENDANCE SUMMARY (all employees) ===');
  const byDate = {};
  weekAtt.forEach(a => {
    if (!byDate[a.date]) byDate[a.date] = { present: 0, absent: 0, leave: 0, holiday: 0, off: 0, total: 0 };
    byDate[a.date][a.status] = (byDate[a.date][a.status] || 0) + 1;
    byDate[a.date].total++;
  });
  Object.entries(byDate).forEach(([date, stats]) => {
    console.log(`${date}: present=${stats.present||0} absent=${stats.absent||0} leave=${stats.leave||0} holiday=${stats.holiday||0} off=${stats.off||0}`);
  });

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
