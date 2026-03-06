const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check registered biometric devices
  const devices = await p.biometricDevice.findMany();
  console.log('=== BIOMETRIC DEVICES ===');
  console.log(JSON.stringify(devices, null, 2));

  // Check employees with bioDeviceId mapped
  const mapped = await p.user.findMany({
    where: { bioDeviceId: { not: null } },
    select: { id: true, name: true, employeeId: true, bioDeviceId: true }
  });
  console.log('\n=== EMPLOYEES WITH BIOMETRIC MAPPING ===');
  console.log(JSON.stringify(mapped, null, 2));

  // Check Ravi's attendance this week
  const ravi = await p.user.findFirst({
    where: { name: { contains: 'Ravi' } },
    select: { id: true, name: true, employeeId: true, bioDeviceId: true }
  });
  console.log('\n=== RAVI USER ===');
  console.log(JSON.stringify(ravi, null, 2));

  if (ravi) {
    const att = await p.attendance.findMany({
      where: {
        userId: ravi.id,
        date: { gte: '2026-03-01', lte: '2026-03-07' }
      },
      orderBy: { date: 'asc' }
    });
    console.log('\n=== RAVI WEEK ATTENDANCE ===');
    att.forEach(a => {
      console.log(`${a.date} | ${a.status} | in: ${a.clockIn || '-'} | out: ${a.clockOut || '-'} | source: ${a.source || 'manual'}`);
    });
  }

  // Check recent biometric punches
  const punches = await p.biometricPunch.findMany({
    orderBy: { punchTime: 'desc' },
    take: 10,
    include: { user: { select: { name: true, employeeId: true } } }
  });
  console.log('\n=== RECENT BIOMETRIC PUNCHES (last 10) ===');
  console.log(JSON.stringify(punches, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
