const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  // Check if April 2025 payslips exist
  const payslips = await prisma.payslip.findMany({
    where: { month: { startsWith: '2025-04' } },
    select: { id: true, userId: true, month: true, workingDays: true, lopDeduction: true, netPay: true, status: true, user: { select: { name: true, employeeId: true } } },
  });
  console.log('April 2025 payslips already generated:', payslips.length);
  if (payslips.length > 0) {
    console.log('\nExisting payslips:');
    payslips.forEach(p => console.log(
      `  ${p.user?.employeeId} ${(p.user?.name||'').padEnd(30)} workingDays=${p.workingDays} lopDeduction=${p.lopDeduction} netPay=${p.netPay} status=${p.status}`
    ));
  }

  // Now read payroll.js LOP logic — find how it calculates LOP
  // Check how many employees have absent records in April 2025
  const absentRecs = await prisma.attendance.findMany({
    where: { date: { gte: '2025-04-01', lte: '2025-04-30' }, status: 'absent' },
    select: { userId: true, date: true },
  });
  console.log('\nAttendance records with status=absent in April 2025:', absentRecs.length);

  // Count employees with NO attendance records at all in April 2025
  const usersWithAtt = await prisma.attendance.findMany({
    where: { date: { gte: '2025-04-01', lte: '2025-04-30' } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const allActiveUsers = await prisma.user.findMany({
    where: { isActive: true, employmentStatus: { not: 'separated' } },
    select: { id: true, name: true, employeeId: true, isAttendanceExempt: true, salaryStructure: { select: { id: true } } },
  });
  const userIdsWithAtt = new Set(usersWithAtt.map(u => u.userId));
  const noAttUsers = allActiveUsers.filter(u => !userIdsWithAtt.has(u.id) && !u.isAttendanceExempt && u.salaryStructure);
  console.log('\nActive employees with salary but NO attendance records in April 2025:', noAttUsers.length);
  noAttUsers.forEach(u => console.log(`  ${u.employeeId} ${u.name}`));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
