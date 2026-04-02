/**
 * Recalculate attendance from ALL biometric punches.
 * Run AFTER historical punch data has been synced.
 *
 * Usage: cd server && node scripts/recalculate-attendance.js
 *
 * This rebuilds First In, Last Out, Work Hours, Break Hours from scratch
 * for every user+date combination that has matched punches.
 */
const { PrismaClient } = require('@prisma/client');
const { recalculateAttendanceFromPunches } = require('../src/services/biometric/biometricSyncService');

const prisma = new PrismaClient();

async function main() {
  console.log('Recalculating attendance from all matched biometric punches...\n');

  // Get all unique user+date combos with matched punches
  const combos = await prisma.$queryRaw`
    SELECT DISTINCT "userId", CAST("punchTime" AS DATE)::text AS "date"
    FROM "BiometricPunch"
    WHERE "userId" IS NOT NULL AND "matchStatus" = 'matched'
    ORDER BY "date" ASC
  `;

  console.log(`Found ${combos.length} user+date combinations to recalculate.\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const { userId, date } of combos) {
    try {
      const result = await recalculateAttendanceFromPunches(prisma, userId, date);
      if (result) {
        success++;
        if (success % 50 === 0) {
          console.log(`  ... processed ${success}/${combos.length} (${date})`);
        }
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ userId:${userId} date:${date} — ${err.message}`);
    }
  }

  console.log(`\nDone!`);
  console.log(`  ✓ Recalculated: ${success}`);
  console.log(`  ⏭ Skipped (no punches): ${skipped}`);
  console.log(`  ✗ Failed: ${failed}`);

  // Summary
  const totalAtt = await prisma.attendance.count();
  console.log(`\nTotal attendance records: ${totalAtt}`);
}

main()
  .catch((e) => { console.error('Fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
