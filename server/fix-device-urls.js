const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Fix esslUrl: remove page paths, keep just base URL
  const devices = await prisma.biometricDevice.findMany({ where: { isActive: true } });

  for (const d of devices) {
    if (d.esslUrl && (d.esslUrl.includes('/Main.aspx') || d.esslUrl.includes('/Default.aspx'))) {
      const fixedUrl = d.esslUrl.replace(/\/(Main|Default)\.aspx.*$/, '');
      console.log(`Fixing ${d.name}: "${d.esslUrl}" -> "${fixedUrl}"`);
      await prisma.biometricDevice.update({
        where: { id: d.id },
        data: { esslUrl: fixedUrl },
      });
    } else if (!d.esslUrl) {
      console.log(`${d.name}: No esslUrl set — skipping`);
    } else {
      console.log(`${d.name}: URL OK (${d.esslUrl})`);
    }
  }

  console.log('\nDone! Now run: node test-sync.js');
}

main().catch(console.error).finally(() => prisma.$disconnect());
