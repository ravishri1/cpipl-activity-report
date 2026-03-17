const { PrismaClient } = require('@prisma/client');
const { syncAllDevices } = require('./src/services/biometric/biometricSyncService');

const prisma = new PrismaClient();

async function main() {
  console.log('=== Testing Biometric Sync ===\n');
  console.log('Syncing all active devices...\n');

  const result = await syncAllDevices(prisma);

  console.log('\n=== Sync Result ===');
  console.log(`  Total devices: ${result.total}`);
  console.log(`  Synced: ${result.synced}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Failed: ${result.failed}`);

  console.log('\n=== Per-Device Details ===');
  for (const d of result.details) {
    console.log(`\n  ${d.device}:`);
    console.log(`    Status: ${d.status}`);
    if (d.status === 'success') {
      console.log(`    Fetched: ${d.fetched} punches`);
      console.log(`    New: ${d.inserted}`);
      console.log(`    Matched: ${d.matched}`);
      console.log(`    Processed: ${d.processed}`);
    } else if (d.status === 'failed') {
      console.log(`    Error: ${d.error}`);
    } else if (d.status === 'skipped') {
      console.log(`    Reason: ${d.reason}`);
    }
  }
}

main()
  .catch(err => console.error('Test failed:', err))
  .finally(() => prisma.$disconnect());
