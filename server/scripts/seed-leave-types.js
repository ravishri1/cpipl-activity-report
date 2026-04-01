/**
 * Seed missing leave types: Privilege Leave, Loss of Pay, Comp Off
 *
 * Run: cd server && node scripts/seed-leave-types.js
 *
 * This script is idempotent — it only creates types that don't already exist.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LEAVE_TYPES = [
  {
    name: 'Casual Leave',
    code: 'CL',
    defaultBalance: 12,
    accrualType: 'monthly',
    accrualAmount: 1,
    carryForward: false,
    maxCarryForward: 0,
  },
  {
    name: 'Earned Leave',
    code: 'EL',
    defaultBalance: 12,
    accrualType: 'monthly',
    accrualAmount: 1,
    carryForward: true,
    maxCarryForward: 30,
  },
  {
    name: 'Sick Leave',
    code: 'SL',
    defaultBalance: 12,
    accrualType: 'monthly',
    accrualAmount: 1,
    carryForward: false,
    maxCarryForward: 0,
  },
  {
    name: 'Privilege Leave',
    code: 'PL',
    defaultBalance: 12,
    accrualType: 'monthly',
    accrualAmount: 1,
    carryForward: true,
    maxCarryForward: 30,
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
      console.log(`  ✓ ${lt.name} (${lt.code}) — already exists (id: ${existing.id})`);
    } else {
      const created = await prisma.leaveType.create({ data: lt });
      console.log(`  ★ ${lt.name} (${lt.code}) — CREATED (id: ${created.id})`);
    }
  }

  console.log('\nDone! Leave types are ready.');
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
