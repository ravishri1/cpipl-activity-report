const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.biometricDevice.findMany({
    select: {
      id: true, name: true, serialNumber: true, isActive: true,
      esslUrl: true, apiUser: true, apiPassword: true, apiKey: true, companyCode: true,
      lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true, syncIntervalMin: true
    }
  });

  console.log('=== Registered Biometric Devices ===\n');
  if (devices.length === 0) {
    console.log('  No devices registered! You need to add a device first via POST /api/biometric/devices');
    return;
  }

  for (const d of devices) {
    console.log(`  Device: ${d.name} (${d.serialNumber})`);
    console.log(`  Active: ${d.isActive}`);
    console.log(`  eSSL URL: ${d.esslUrl || '** NOT SET — scheduler cannot fetch **'}`);
    console.log(`  API User: ${d.apiUser || '** NOT SET **'}`);
    console.log(`  API Password: ${d.apiPassword ? '****' : '** NOT SET **'}`);
    console.log(`  API Key: ${d.apiKey || '** NOT SET **'}`);
    console.log(`  Company Code: ${d.companyCode || '** NOT SET **'}`);
    console.log(`  Sync Interval: ${d.syncIntervalMin || 5} min`);
    console.log(`  Last Sync: ${d.lastSyncAt ? d.lastSyncAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'NEVER'}`);
    console.log(`  Last Status: ${d.lastSyncStatus || 'N/A'}`);
    console.log(`  Last Message: ${d.lastSyncMessage || 'N/A'}`);
    console.log('');
  }

  // Check today's punches
  const today = new Date().toISOString().slice(0, 10);
  const todayPunches = await prisma.biometricPunch.count({ where: { punchDate: today } });
  const todayMatched = await prisma.biometricPunch.count({ where: { punchDate: today, matchStatus: 'matched' } });
  const todayProcessed = await prisma.biometricPunch.count({ where: { punchDate: today, processStatus: 'processed' } });

  console.log(`=== Today's Punches (${today}) ===`);
  console.log(`  Total: ${todayPunches}`);
  console.log(`  Matched: ${todayMatched}`);
  console.log(`  Processed: ${todayProcessed}`);

  // Check if esslUrl is configured — this is the KEY requirement
  const missingUrl = devices.filter(d => d.isActive && !d.esslUrl);
  if (missingUrl.length > 0) {
    console.log('\n*** WARNING: The following active devices have NO esslUrl configured ***');
    console.log('*** The scheduler CANNOT fetch data without esslUrl ***');
    for (const d of missingUrl) {
      console.log(`  - ${d.name} (${d.serialNumber})`);
    }
    console.log('\nFix: Update the device with the eSSL server URL, e.g.:');
    console.log('  PUT /api/biometric/devices/:id  { "esslUrl": "http://192.168.2.222:85" }');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
