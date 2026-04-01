/**
 * Seed leave types: Privilege Leave, Loss of Pay, Comp Off
 *
 * Run: cd server && node scripts/seed-leave-types.js
 *
 * This script is idempotent — it only creates types that don't already exist.
 * Active types: PL (12/year monthly), LOP (unlimited/none), COF (earned via comp-off)
 * Inactive types: CL, SL, EL (legacy — kept for historical balance records)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LEAVE_TYPES = [
  {
    name: 'Privilege Leave',
    code: 'PL',
    defaultBalance: 12,
    accrualType: 'monthly',
    accrualAmount: 1,
    carryForward: true,
    maxCarryForward: 6,
  },
  {
    name: 'Loss of Pay',
    code: 'LOP',
    defaultBalance: 0,
    accrualType: 'none',
    accrualAmount: 0,
    carryForward: false,
    maxCarryForward: 0,
  },
  {
    name: 'Comp Off',
    code: 'COF',
    defaultBalance: 0,
    accrualType: 'none',
    accrualAmount: 0,
    carryForward: false,
    maxCarryForward: 0,
  },
];

async function main() {
  console.log('Seeding leave types...\n');

  for (const lt of LEAVE_TYPES) {
    const existing = await prisma.leaveType.findFirst({
      where: { OR: [{ code: lt.code }, { name: lt.name }] },
    });

    if (existing) {
      // Ensure it's active and config matches
      await prisma.leaveType.update({
        where: { id: existing.id },
        data: { ...lt, isActive: true },
      });
      console.log(`  ✓ ${lt.name} (${lt.code}) — exists, synced config (id: ${existing.id})`);
    } else {
      const created = await prisma.leaveType.create({ data: lt });
      console.log(`  ★ ${lt.name} (${lt.code}) — CREATED (id: ${created.id})`);
    }
  }

  // Deactivate legacy types (CL, SL, EL) — keep for historical data
  const legacy = await prisma.leaveType.updateMany({
    where: { code: { in: ['CL', 'SL', 'EL'] }, isActive: true },
    data: { isActive: false },
  });
  if (legacy.count > 0) {
    console.log(`\n  ⚠ Deactivated ${legacy.count} legacy types (CL/SL/EL)`);
  }

  console.log('\nDone! Active types: PL, LOP, COF');
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
