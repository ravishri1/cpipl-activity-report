const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { employeeId: 'COLOR137' },
    select: { id: true, name: true },
  });
  console.log('User:', user);

  // Find all leave requests touching Apr 8
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: user.id,
      startDate: { lte: '2025-04-08' },
      endDate:   { gte: '2025-04-08' },
    },
    include: { leaveType: { select: { id: true, code: true, name: true } } },
  });
  console.log('\nLeave records touching Apr 8:');
  leaves.forEach(l => console.log(JSON.stringify({
    id: l.id, status: l.status, start: l.startDate, end: l.endDate,
    days: l.days, type: l.leaveType?.code, name: l.leaveType?.name,
  })));

  // Also get all leave types to find PL id
  const allTypes = await prisma.leaveType.findMany({ select: { id: true, code: true, name: true } });
  console.log('\nAll leave types:', allTypes.map(t => `${t.id}:${t.code}`).join(', '));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
