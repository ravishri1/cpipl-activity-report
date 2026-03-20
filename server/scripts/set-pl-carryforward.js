/**
 * One-time script: Enable carry forward for Privilege Leave (PL)
 * Sets carryForward = true and maxCarryForward = 6
 *
 * Usage: cd server && node scripts/set-pl-carryforward.js
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    const pl = await prisma.leaveType.findFirst({ where: { code: 'PL' } });
    if (!pl) {
      console.error('LeaveType with code "PL" not found.');
      process.exit(1);
    }

    console.log('Before:', { id: pl.id, name: pl.name, code: pl.code, carryForward: pl.carryForward, maxCarryForward: pl.maxCarryForward });

    const updated = await prisma.leaveType.update({
      where: { id: pl.id },
      data: { carryForward: true, maxCarryForward: 6 },
    });

    console.log('After:', { id: updated.id, name: updated.name, code: updated.code, carryForward: updated.carryForward, maxCarryForward: updated.maxCarryForward });
    console.log('Done — PL carry forward enabled (max 6 days).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
