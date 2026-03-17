const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.biometricDevice.findMany({
  select: { name: true, serialNumber: true, esslUrl: true, lastSyncStatus: true, lastSyncMessage: true }
}).then(devices => {
  for (const d of devices) {
    console.log(`${d.name} (${d.serialNumber})`);
    console.log(`  esslUrl: ${d.esslUrl || '(cleared)'}`);
    console.log(`  status:  ${d.lastSyncStatus}`);
    console.log(`  message: ${d.lastSyncMessage}`);
    console.log('');
  }
  p.$disconnect();
});
