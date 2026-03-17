const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // The 3 devices with SOAP URLs that don't work — clear their esslUrl
  // so the cron skips them. SQL sync via "Lucknow eSSL (SQL Sync)" handles all data.
  const soapDevices = await prisma.biometricDevice.findMany({
    where: {
      esslUrl: { not: null },
      serialNumber: { in: ['CEXJ230260034', 'EUF7241301750', 'CEXJ230260263'] },
    },
  });

  for (const d of soapDevices) {
    console.log(`Clearing esslUrl for "${d.name}" (${d.serialNumber}) — SOAP API not available`);
    await prisma.biometricDevice.update({
      where: { id: d.id },
      data: {
        esslUrl: null,
        lastSyncStatus: 'skipped',
        lastSyncMessage: 'SOAP API not available on this eSSL version. Data syncs via SQL (Lucknow eSSL device).',
      },
    });
  }

  console.log(`\nDone! ${soapDevices.length} devices updated.`);
  console.log('Only "Lucknow eSSL (SQL Sync)" will sync via CPSERVER SQL script.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
