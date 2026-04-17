/**
 * Fix May 2025 attendance corrections based on muster verification:
 * 1. COLOR128 Sameer: May 14 was marked absent, but muster shows present → fix to present
 * 2. COLOR090 Abhishek: Check biometric punches for May 19-31 to see which days had no punches
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const COMPANY_ID = 1;
const MONTH = '2025-05';

async function main() {
  // ─── COLOR128: Fix May 14 absent → present ───────────────────────────────
  const u128 = await prisma.user.findFirst({
    where: { employeeId: 'COLOR128', companyId: COMPANY_ID },
    select: { id: true, name: true, employeeId: true },
  });
  console.log(`\nCOLOR128 ${u128.name} (id: ${u128.id})`);

  const att128_14 = await prisma.attendance.findFirst({
    where: { userId: u128.id, date: '2025-05-14' },
  });
  console.log(`  May 14 current: ${att128_14?.status || 'NO RECORD'} (override: ${att128_14?.adminOverride})`);

  if (att128_14) {
    await prisma.attendance.update({
      where: { id: att128_14.id },
      data: { status: 'present', adminOverride: true, adminRemark: 'Corrected: muster shows present on May 14' },
    });
    console.log('  May 14 → updated to PRESENT');
  } else {
    await prisma.attendance.create({
      data: {
        userId: u128.id,
        date: '2025-05-14',
        status: 'present',
        adminOverride: true,
        adminRemark: 'Corrected: muster shows present on May 14',
        companyId: COMPANY_ID,
      },
    });
    console.log('  May 14 → created as PRESENT');
  }

  // ─── COLOR090: Show biometric punches for May 19-31 ─────────────────────
  const u090 = await prisma.user.findFirst({
    where: { employeeId: 'COLOR090', companyId: COMPANY_ID },
    select: { id: true, name: true, employeeId: true },
  });
  console.log(`\nCOLOR090 ${u090.name} (id: ${u090.id})`);
  console.log('  Checking biometric punches for May 19-31...');

  // Check BiometricPunch model
  let punches = [];
  try {
    punches = await prisma.biometricPunch.findMany({
      where: {
        userId: u090.id,
        date: { gte: '2025-05-19', lte: '2025-05-31' },
      },
      select: { date: true, punchIn: true, punchOut: true },
      orderBy: { date: 'asc' },
    });
    console.log(`  Found ${punches.length} biometric punch records:`);
    for (const p of punches) {
      console.log(`    ${p.date}: in=${p.punchIn} out=${p.punchOut}`);
    }
  } catch (e) {
    console.log(`  BiometricPunch model query failed: ${e.message}`);

    // Try RawAttendance or similar
    try {
      const rawAtts = await prisma.rawAttendanceLog.findMany({
        where: {
          userId: u090.id,
          date: { gte: '2025-05-19', lte: '2025-05-31' },
        },
        select: { date: true, punchIn: true, punchOut: true, source: true },
        orderBy: { date: 'asc' },
      });
      console.log(`  RawAttendanceLog: ${rawAtts.length} records`);
      for (const r of rawAtts) {
        console.log(`    ${r.date}: in=${r.punchIn} out=${r.punchOut} src=${r.source}`);
      }
    } catch (e2) {
      console.log(`  RawAttendanceLog also failed: ${e2.message}`);
    }
  }

  // Show attendance records for May 19-31
  const atts090 = await prisma.attendance.findMany({
    where: { userId: u090.id, date: { gte: '2025-05-19', lte: '2025-05-31' } },
    orderBy: { date: 'asc' },
  });
  console.log(`\n  Attendance records (May 19-31): ${atts090.length}`);
  for (const a of atts090) {
    console.log(`    ${a.date}: ${a.status} (override: ${a.adminOverride}, remark: ${a.adminRemark || '-'})`);
  }

  console.log('\n  NOTE: Excel shows LOP=17, EOD=14. Need to verify which 3 days in May 19-31');
  console.log('  are absent per muster. Once confirmed, run fixColor090.js with those dates.');

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
