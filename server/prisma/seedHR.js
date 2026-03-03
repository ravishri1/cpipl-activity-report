const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedHR() {
  console.log('🌱 Seeding HR core data...\n');

  // ── 1. Leave Types ──
  console.log('📋 Creating leave types...');
  const leaveTypes = [
    { name: 'Casual Leave', code: 'CL', defaultBalance: 12, carryForward: false, maxCarryForward: 0 },
    { name: 'Sick Leave', code: 'SL', defaultBalance: 6, carryForward: false, maxCarryForward: 0 },
    { name: 'Earned Leave', code: 'EL', defaultBalance: 15, carryForward: true, maxCarryForward: 30 },
  ];

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: { name: lt.name, defaultBalance: lt.defaultBalance, carryForward: lt.carryForward, maxCarryForward: lt.maxCarryForward },
      create: lt,
    });
  }
  console.log(`   ✅ ${leaveTypes.length} leave types created/updated`);

  // ── 2. Indian Holidays for 2026 ──
  console.log('🎉 Creating 2026 holidays...');
  const holidays2026 = [
    { name: 'Republic Day', date: '2026-01-26', year: 2026 },
    { name: 'Maha Shivaratri', date: '2026-02-15', year: 2026 },
    { name: 'Holi', date: '2026-03-10', year: 2026 },
    { name: 'Good Friday', date: '2026-04-03', year: 2026 },
    { name: 'Ram Navami', date: '2026-04-06', year: 2026 },
    { name: 'Eid ul-Fitr', date: '2026-03-21', year: 2026 },
    { name: 'Buddha Purnima', date: '2026-05-12', year: 2026 },
    { name: 'Eid ul-Adha', date: '2026-05-28', year: 2026 },
    { name: 'Independence Day', date: '2026-08-15', year: 2026 },
    { name: 'Janmashtami', date: '2026-08-25', year: 2026 },
    { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02', year: 2026 },
    { name: 'Dussehra', date: '2026-10-12', year: 2026 },
    { name: 'Diwali', date: '2026-10-31', year: 2026 },
    { name: 'Guru Nanak Jayanti', date: '2026-11-18', year: 2026 },
    { name: 'Christmas', date: '2026-12-25', year: 2026 },
  ];

  for (const h of holidays2026) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: { name: h.name, year: h.year },
      create: h,
    });
  }
  console.log(`   ✅ ${holidays2026.length} holidays created/updated`);

  // ── Indian Holidays for 2027 ──
  console.log('🎉 Creating 2027 holidays...');
  const holidays2027 = [
    { name: 'Republic Day', date: '2027-01-26', year: 2027 },
    { name: 'Maha Shivaratri', date: '2027-03-07', year: 2027 },
    { name: 'Holi', date: '2027-02-28', year: 2027 },
    { name: 'Good Friday', date: '2027-04-02', year: 2027 },
    { name: 'Ram Navami', date: '2027-03-29', year: 2027 },
    { name: 'Eid ul-Fitr', date: '2027-03-11', year: 2027 },
    { name: 'Buddha Purnima', date: '2027-05-13', year: 2027 },
    { name: 'Eid ul-Adha', date: '2027-05-18', year: 2027 },
    { name: 'Independence Day', date: '2027-08-15', year: 2027 },
    { name: 'Janmashtami', date: '2027-08-15', year: 2027 },
    { name: 'Mahatma Gandhi Jayanti', date: '2027-10-02', year: 2027 },
    { name: 'Dussehra', date: '2027-10-02', year: 2027 },
    { name: 'Diwali', date: '2027-11-10', year: 2027 },
    { name: 'Guru Nanak Jayanti', date: '2027-11-30', year: 2027 },
    { name: 'Christmas', date: '2027-12-25', year: 2027 },
  ];

  for (const h of holidays2027) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: { name: h.name, year: h.year },
      create: h,
    });
  }
  console.log(`   ✅ ${holidays2027.length} holidays created/updated`);

  // ── Indian Holidays for 2028 ──
  console.log('🎉 Creating 2028 holidays...');
  const holidays2028 = [
    { name: 'Republic Day', date: '2028-01-26', year: 2028 },
    { name: 'Maha Shivaratri', date: '2028-02-24', year: 2028 },
    { name: 'Holi', date: '2028-03-17', year: 2028 },
    { name: 'Good Friday', date: '2028-04-07', year: 2028 },
    { name: 'Ram Navami', date: '2028-04-17', year: 2028 },
    { name: 'Eid ul-Fitr', date: '2028-02-28', year: 2028 },
    { name: 'Buddha Purnima', date: '2028-05-31', year: 2028 },
    { name: 'Eid ul-Adha', date: '2028-05-08', year: 2028 },
    { name: 'Independence Day', date: '2028-08-15', year: 2028 },
    { name: 'Janmashtami', date: '2028-09-03', year: 2028 },
    { name: 'Mahatma Gandhi Jayanti', date: '2028-10-02', year: 2028 },
    { name: 'Dussehra', date: '2028-10-21', year: 2028 },
    { name: 'Diwali', date: '2028-10-30', year: 2028 },
    { name: 'Guru Nanak Jayanti', date: '2028-11-19', year: 2028 },
    { name: 'Christmas', date: '2028-12-25', year: 2028 },
  ];

  for (const h of holidays2028) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: { name: h.name, year: h.year },
      create: h,
    });
  }
  console.log(`   ✅ ${holidays2028.length} holidays created/updated`);

  // ── 3. Generate Employee IDs for existing users ──
  console.log('🆔 Assigning employee IDs...');
  const users = await prisma.user.findMany({
    where: { employeeId: null },
    orderBy: { id: 'asc' },
  });

  // Find the highest existing employee ID number
  const maxExisting = await prisma.user.findFirst({
    where: { employeeId: { not: null } },
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  });

  let nextNum = 1;
  if (maxExisting?.employeeId) {
    const match = maxExisting.employeeId.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  for (const user of users) {
    const empId = `CPIPL-${String(nextNum).padStart(3, '0')}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { employeeId: empId },
    });
    console.log(`   ${empId} → ${user.name} (${user.email})`);
    nextNum++;
  }
  console.log(`   ✅ ${users.length} employee IDs assigned`);

  // ── 4. Create Leave Balances for current year ──
  console.log('📊 Creating leave balances for 2026...');
  const currentYear = 2026;
  const allActiveUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const allLeaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  let balancesCreated = 0;
  for (const user of allActiveUsers) {
    for (const lt of allLeaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year: currentYear },
        },
        update: {},
        create: {
          userId: user.id,
          leaveTypeId: lt.id,
          year: currentYear,
          total: lt.defaultBalance,
          used: 0,
          balance: lt.defaultBalance,
        },
      });
      balancesCreated++;
    }
  }
  console.log(`   ✅ ${balancesCreated} leave balance records created/verified`);

  console.log('\n✨ HR seed complete!');
}

seedHR()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
