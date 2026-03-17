// Run: cd server && node fix-device-setup.js
// Updates device names, locations, and ensures they're active for multi-device sync

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check current devices
  const devices = await prisma.biometricDevice.findMany({ orderBy: { id: 'asc' } });
  console.log('\n=== Current Devices ===');
  devices.forEach(d => {
    console.log(`  ID ${d.id}: "${d.name}" | Serial: ${d.serialNumber} | Active: ${d.isActive} | Location: ${d.location || '-'} | ForceDir: ${d.forceDirection || 'auto'}`);
  });

  // Update CP IN (Mumbai) — serial CEXJ230260263
  const cpIn = await prisma.biometricDevice.findUnique({ where: { serialNumber: 'CEXJ230260263' } });
  if (cpIn) {
    await prisma.biometricDevice.update({
      where: { id: cpIn.id },
      data: { name: 'CP IN (Mumbai)', location: 'Mumbai HO', isActive: true, forceDirection: 'in', ipAddress: '192.168.2.201' },
    });
    console.log('\n✅ Updated CP IN (Mumbai) — CEXJ230260263 — forceDirection: in');
  } else {
    console.log('\n⚠️ CP IN device not found. Creating...');
    await prisma.biometricDevice.create({
      data: { name: 'CP IN (Mumbai)', serialNumber: 'CEXJ230260263', location: 'Mumbai HO', isActive: true, forceDirection: 'in', ipAddress: '192.168.2.201' },
    });
    console.log('✅ Created CP IN (Mumbai)');
  }

  // Update CP OUT (Mumbai) — serial CEXJ230260034
  const cpOut = await prisma.biometricDevice.findUnique({ where: { serialNumber: 'CEXJ230260034' } });
  if (cpOut) {
    await prisma.biometricDevice.update({
      where: { id: cpOut.id },
      data: { name: 'CP OUT (Mumbai)', location: 'Mumbai HO', isActive: true, forceDirection: 'out', ipAddress: '192.168.2.205' },
    });
    console.log('✅ Updated CP OUT (Mumbai) — CEXJ230260034 — forceDirection: out');
  } else {
    console.log('\n⚠️ CP OUT device not found. Creating...');
    await prisma.biometricDevice.create({
      data: { name: 'CP OUT (Mumbai)', serialNumber: 'CEXJ230260034', location: 'Mumbai HO', isActive: true, forceDirection: 'out', ipAddress: '192.168.2.205' },
    });
    console.log('✅ Created CP OUT (Mumbai)');
  }

  // Update Lucknow — serial EUF7241301750
  const lkw = await prisma.biometricDevice.findUnique({ where: { serialNumber: 'EUF7241301750' } });
  if (lkw) {
    await prisma.biometricDevice.update({
      where: { id: lkw.id },
      data: { name: 'Lucknow eSSL', location: 'Lucknow', isActive: true, ipAddress: '192.168.0.203' },
    });
    console.log('✅ Updated Lucknow eSSL — EUF7241301750');
  } else {
    console.log('\n⚠️ Lucknow device not found. Creating...');
    await prisma.biometricDevice.create({
      data: { name: 'Lucknow eSSL', serialNumber: 'EUF7241301750', location: 'Lucknow', isActive: true, ipAddress: '192.168.0.203' },
    });
    console.log('✅ Created Lucknow eSSL');
  }

  // Verify
  const updated = await prisma.biometricDevice.findMany({ orderBy: { id: 'asc' } });
  console.log('\n=== Updated Devices ===');
  updated.forEach(d => {
    console.log(`  ID ${d.id}: "${d.name}" | Serial: ${d.serialNumber} | Active: ${d.isActive} | Location: ${d.location || '-'} | ForceDir: ${d.forceDirection || 'auto'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
