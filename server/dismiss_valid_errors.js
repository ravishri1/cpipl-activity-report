const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// These are the IDs of "new" error reports that are expected/valid errors, not real bugs:
// - 409: Holiday duplicate entries (valid conflict)
// - 400: Insufficient leave balance, no working days (valid validation)
// - 400: Cannot review already-approved expense (valid business rule)
// - 400: Date required (valid input validation)
// - 404: Salary structure not found (valid not-found)
// - 503: Render cold-start timeouts (infrastructure, not code bugs)
const IDS_TO_DISMISS = [27, 28, 29, 30, 31, 32, 38, 39, 49, 50, 52, 53, 54, 55, 56, 57, 58];

async function main() {
  console.log('=== BEFORE: Current status counts ===');
  const before = await prisma.errorReport.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log(JSON.stringify(before, null, 2));

  const result = await prisma.errorReport.updateMany({
    where: {
      id: { in: IDS_TO_DISMISS },
      status: 'new', // only dismiss if still "new"
    },
    data: { status: 'dismissed' },
  });

  console.log(`\n✅ Dismissed ${result.count} error report(s).`);

  console.log('\n=== AFTER: Updated status counts ===');
  const after = await prisma.errorReport.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log(JSON.stringify(after, null, 2));

  // Confirm no "new" remain
  const remaining = await prisma.errorReport.count({ where: { status: 'new' } });
  if (remaining === 0) {
    console.log('\n🎉 All error reports resolved — zero "new" remaining!');
  } else {
    console.log(`\n⚠️  ${remaining} "new" error report(s) still remain.`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
