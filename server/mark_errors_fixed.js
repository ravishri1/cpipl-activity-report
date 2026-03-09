const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Components fixed in the latest batch
const FIXED_COMPONENTS = [
  'MyPointsDashboard',
  'Leaderboard',
  'MyInsuranceCard',
  'MyOvertime',
  'TrainingManager',
  'CompanyContractsManager',
  'Dashboard',
  'OvertimeManager',
  'MyLoans',
  'InventoryAnalytics',
  'MyCompOff',
];

async function main() {
  console.log('=== BEFORE: Current status counts ===');
  const before = await prisma.errorReport.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log(JSON.stringify(before, null, 2));

  // Build OR conditions to match any of the fixed components
  const conditions = FIXED_COMPONENTS.map(comp => ({
    componentStack: { contains: comp },
  }));
  // Also match by errorMessage / path patterns for backend-style errors
  conditions.push({ path: { contains: '/api/overtime' } });
  conditions.push({ path: { contains: '/api/loans' } });
  conditions.push({ path: { contains: '/api/training' } });
  conditions.push({ path: { contains: '/training/' } });
  conditions.push({ path: { contains: '/api/dashboard' } });
  // Bug #62: recruitment candidates — wrong Prisma relation names fixed
  conditions.push({ path: { contains: '/recruitment/candidates' } });
  // Bug #43: renewals search — mode:insensitive removed (SQLite incompatible)
  conditions.push({ path: { contains: '/renewals' } });
  // Systemic: mode:insensitive removed from assets, insurance, users search
  conditions.push({ path: { contains: '/assets' } });
  conditions.push({ path: { contains: '/insurance' } });
  conditions.push({ path: { contains: '/users' } });

  const result = await prisma.errorReport.updateMany({
    where: {
      status: { not: 'dismissed' }, // don't touch dismissed records
      OR: conditions,
    },
    data: {
      status: 'fixed',
    },
  });

  console.log(`\n✅ Marked ${result.count} error report(s) as fixed.`);

  console.log('\n=== AFTER: Updated status counts ===');
  const after = await prisma.errorReport.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log(JSON.stringify(after, null, 2));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
