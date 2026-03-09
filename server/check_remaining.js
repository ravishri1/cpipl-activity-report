const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.errorReport.findMany({
    where: { status: 'new' },
    select: { id: true, errorType: true, path: true, errorMessage: true, componentStack: true, occurrenceCount: true },
    orderBy: { occurrenceCount: 'desc' }
  });
  console.log('Still "new":', records.length);
  records.forEach(e => {
    const comp = (e.componentStack || '').split('\n').find(l => l.includes('at ')) || '';
    console.log(`  #${e.id} [${e.occurrenceCount}x] path=${e.path || 'n/a'}`);
    console.log(`    msg: ${(e.errorMessage || '').slice(0, 80)}`);
    console.log(`    stack: ${comp.trim().slice(0, 80)}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
