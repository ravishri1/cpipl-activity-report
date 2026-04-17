const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const p = new PrismaClient();
async function main() {
  for (const empId of ['COLOR128','COLOR137','COLOR157']) {
    const u = await p.user.findFirst({ where: { employeeId: empId }, select: { id: true, name: true, dateOfJoining: true, isActive: true, employmentStatus: true } });
    if (!u) { console.log(empId + ': NOT IN DB'); continue; }
    const sep = await p.separation.findFirst({ where: { userId: u.id }, select: { lastWorkingDate: true, type: true, initiatedBy: true } });
    console.log(empId, u.name, '| empStatus:', u.employmentStatus, '| sep:', sep ? JSON.stringify(sep) : 'NONE');
    const attJul = await p.attendance.count({ where: { userId: u.id, date: { gte: '2025-07-01', lte: '2025-07-31' }, status: { in: ['present','half_day'] } } });
    const attJun = await p.attendance.count({ where: { userId: u.id, date: { gte: '2025-06-01', lte: '2025-06-30' }, status: { in: ['present','half_day'] } } });
    console.log('  June present:', attJun, '| July present:', attJul);
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); process.exit(1); });
