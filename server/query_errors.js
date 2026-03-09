const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stats = await prisma.errorReport.groupBy({
    by: ['status'],
    _count: { id: true },
    _sum: { occurrenceCount: true },
  });
  console.log('=== STATUS SUMMARY ===');
  console.log(JSON.stringify(stats, null, 2));

  const reports = await prisma.errorReport.findMany({
    orderBy: [{ occurrenceCount: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      status: true,
      errorType: true,
      path: true,
      method: true,
      statusCode: true,
      errorMessage: true,
      stackTrace: true,
      context: true,
      componentStack: true,
      occurrenceCount: true,
      createdAt: true,
      lastOccurredAt: true,
      userEmail: true,
      affectedUsers: true,
    },
  });

  console.log('\n=== ALL ERROR REPORTS ===');
  console.log('Total records:', reports.length);
  reports.forEach((r, i) => {
    console.log(`\n--- Report #${r.id} [${r.status}] occurrences=${r.occurrenceCount} ---`);
    console.log('Type:', r.errorType, '| Path:', r.path, '| Method:', r.method, '| Status:', r.statusCode);
    console.log('Message:', r.errorMessage);
    if (r.stackTrace) console.log('Stack (first 500):', r.stackTrace.slice(0, 500));
    if (r.context) console.log('Context:', r.context.slice(0, 300));
    if (r.componentStack) console.log('ComponentStack (first 300):', r.componentStack.slice(0, 300));
    console.log('User:', r.userEmail, '| Created:', r.createdAt, '| Last:', r.lastOccurredAt);
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
