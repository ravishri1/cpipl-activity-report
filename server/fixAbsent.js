// Fix attendance records where muster=P but EOD=A (no biometric punch synced)
// Rajendra Pandharinath Ghuge (COLOR006) — Apr 23 & Apr 25, 2025
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function upsertPresent(userId, date) {
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date } },
  });

  if (existing) {
    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { status: 'present', adminOverride: true, notes: 'Manually set present — confirmed by GreytHR muster Apr 2025' },
    });
    console.log(`UPDATED  ${date}: ${existing.status} → present (id=${updated.id})`);
  } else {
    const created = await prisma.attendance.create({
      data: {
        userId,
        date,
        status: 'present',
        adminOverride: true,
        notes: 'Manually set present — confirmed by GreytHR muster Apr 2025',
      },
    });
    console.log(`CREATED  ${date}: present (id=${created.id})`);
  }
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { employeeId: 'COLOR006' },
    select: { id: true, name: true, employeeId: true },
  });
  if (!user) { console.error('Employee COLOR006 not found'); process.exit(1); }
  console.log(`Fixing attendance for: ${user.name} (${user.employeeId}) — userId=${user.id}`);
  console.log('');

  await upsertPresent(user.id, '2025-04-23');
  await upsertPresent(user.id, '2025-04-25');

  console.log('\nDone. Verify on calendar — should now show P on Apr 23 & Apr 25.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
