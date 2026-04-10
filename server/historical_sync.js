/**
 * Historical biometric sync — Apr 2025 to today
 * Fetches month-by-month from eSSL SOAP API for all active devices
 * Then rematches all unmatched punches for newly mapped employees
 * Run: node historical_sync.js
 */

require('dotenv').config({ path: './.env' });
const { PrismaClient } = require('@prisma/client');
const {
  fetchFromDevice,
  processAndStorePunches,
  matchEmployee,
  processPunch,
} = require('./src/services/biometric/biometricSyncService');

const prisma = new PrismaClient();

function getMonthlyRanges(fromDate, toDate) {
  const ranges = [];
  let current = new Date(fromDate);
  current.setDate(1);
  while (current <= toDate) {
    const monthStr = current.toISOString().slice(0, 7); // "2025-04"
    const daysBack = Math.ceil((toDate - current) / (1000 * 60 * 60 * 24)) + 1;
    ranges.push({ monthStr, daysBack });
    current.setMonth(current.getMonth() + 1);
  }
  return ranges;
}

async function run() {
  const devices = await prisma.biometricDevice.findMany({ where: { isActive: true } });
  console.log(`\nDevices: ${devices.map(d => `${d.name} (${d.serialNumber})`).join(', ')}`);

  const fromDate = new Date('2025-04-01');
  const toDate = new Date();
  const ranges = getMonthlyRanges(fromDate, toDate);
  console.log(`Syncing ${ranges.length} months: Apr 2025 → ${toDate.toISOString().slice(0, 10)}\n`);

  let grandInserted = 0, grandMatched = 0, grandErrors = 0;

  for (const { monthStr, daysBack } of ranges) {
    for (const device of devices) {
      process.stdout.write(`  [${monthStr}] ${device.name} (${daysBack}d lookback)... `);
      try {
        const rawPunches = await fetchFromDevice(device, daysBack);
        // Filter only punches in this month
        const filtered = rawPunches.filter(p => p.punchTime && p.punchTime.slice(0, 7) === monthStr);
        if (filtered.length === 0) {
          console.log('0 punches');
          continue;
        }
        const result = await processAndStorePunches(prisma, device, filtered);
        grandInserted += result.inserted || 0;
        grandMatched += result.matched || 0;
        console.log(`${filtered.length} raw → inserted: ${result.inserted}, matched: ${result.matched}`);
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        grandErrors++;
      }
    }
  }

  console.log(`\n--- Sync complete: ${grandInserted} inserted, ${grandMatched} matched, ${grandErrors} errors ---\n`);

  // Step 2: Rematch all existing unmatched punches (for newly mapped employees)
  console.log('Rematching unmatched punches...');
  const unmatched = await prisma.biometricPunch.findMany({
    where: { matchStatus: 'unmatched' },
    select: { id: true, enrollNumber: true },
  });
  console.log(`Found ${unmatched.length} unmatched punches`);

  let rematchCount = 0;
  for (const punch of unmatched) {
    const employee = await matchEmployee(punch.enrollNumber, prisma);
    if (employee) {
      await prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { userId: employee.id, matchStatus: 'matched', matchNote: null, processStatus: 'pending' },
      });
      const fresh = await prisma.biometricPunch.findUnique({ where: { id: punch.id } });
      await processPunch(fresh, prisma);
      rematchCount++;
    }
  }
  console.log(`Rematched ${rematchCount} punches\n`);

  // Summary
  console.log('=== ALL DONE ===');
  console.log(`New punches inserted: ${grandInserted}`);
  console.log(`Punches rematched:    ${rematchCount}`);
  console.log(`Errors:               ${grandErrors}`);
  console.log('\nNext step: run recalculate-all for each month from Admin → Biometric page');

  await prisma.$disconnect();
}

run().catch(e => { console.error('Fatal:', e.message); prisma.$disconnect(); process.exit(1); });
