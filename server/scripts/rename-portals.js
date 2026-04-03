// One-time script: Rename all portals to systematic format
// Format: {Entity}-{CityCode}-{ServiceName}
// Run: cd server && node scripts/rename-portals.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Manual mapping: portalId → new clean name
const renames = {
  // CP entity-level portals
  1:  'CP-Gmail',
  2:  'CP-Shiprocket',
  4:  'CP-Meesho',
  5:  'CP-Mystore',
  6:  'CP-Flipkart',
  20: 'CP-Gmail-PLD',
  21: 'CP-Amazon-PLD',
  25: 'CP-Gmail-AutoPrice',
  28: 'CP-Amazon-Purchase',
  29: 'CP-Amazon-Bombino',
  30: 'CP-Microsoft',
  31: 'CP-Bombinoexp',
  32: 'CP-Bombino-USVS',
  33: 'CP-FTP-ChannelMax',

  // CPIPL entity-level portals (no registration)
  7:  'CPIPL-Gmail',
  9:  'CPIPL-Gmail-User1',
  12: 'CPIPL-Amazon-BrandRegistry',
  14: 'CPIPL-Amazon-LKO',
  15: 'CPIPL-Meesho-LKO',
  16: 'CPIPL-Shiprocket-LKO',
  17: 'CPIPL-Flipkart-LKO',
  18: 'CPIPL-ChannelMax',
  19: 'CPIPL-InfiniteMart',

  // CPIPL registration-linked portals
  34: 'CPIPL-LKO-Amazon',
  35: 'CPIPL-THN-Amazon',
};

async function main() {
  let updated = 0;
  for (const [id, newName] of Object.entries(renames)) {
    const portal = await prisma.companyPortal.findUnique({ where: { id: parseInt(id) }, select: { name: true } });
    if (portal) {
      await prisma.companyPortal.update({ where: { id: parseInt(id) }, data: { name: newName } });
      console.log(`  ${id}: "${portal.name}" → "${newName}"`);
      updated++;
    }
  }
  console.log(`\nRenamed ${updated} portals`);

  // Now re-generate all credential displayNames since portal names changed
  console.log('\nRe-generating credential displayNames...');
  await prisma.portalCredential.updateMany({ data: { displayName: null } });

  const all = await prisma.portalCredential.findMany({
    select: { id: true, portalId: true, label: true },
    orderBy: [{ portalId: 'asc' }, { label: 'asc' }, { id: 'asc' }],
  });

  let credUpdated = 0;
  for (const cred of all) {
    const portal = await prisma.companyPortal.findUnique({
      where: { id: cred.portalId },
      include: {
        legalEntity: { select: { shortName: true, legalName: true } },
        companyRegistration: { select: { abbr: true } },
      },
    });
    if (!portal) continue;
    const entity = portal.legalEntity?.shortName || portal.legalEntity?.legalName || '';
    const abbr = portal.companyRegistration?.abbr || '';
    const cityMatch = abbr.match(/^[^-]+-([^/]+)/);
    const cityCode = cityMatch ? cityMatch[1] : '';
    let platform = portal.name;
    platform = platform.replace(/^(CPIPL|CP)[-\s]*/i, '').trim();
    platform = platform.replace(/^(MH|LKO|THN|BLR|HYD|KOL|CCU|BWD|PCL|PNE)[-\s]*/i, '').trim();
    platform = platform.replace(/\s*Server$/i, '').trim();
    platform = platform.replace(/\s*\/\s*Portal$/i, '').trim();
    platform = platform.replace(/\s*\([^)]*\)\s*/g, '').trim();
    platform = platform.replace(/\.(com|in|co\.in)$/i, '').trim();
    const prefix = [entity, cityCode, platform, cred.label].filter(Boolean).join('-');
    const existing = await prisma.portalCredential.findMany({
      where: { portalId: cred.portalId, id: { not: cred.id } },
      select: { displayName: true },
    });
    const samePrefix = existing.filter(c => c.displayName && c.displayName.startsWith(prefix));
    const seq = String(samePrefix.length + 1).padStart(2, '0');
    const displayName = `${prefix}-${seq}`;
    await prisma.portalCredential.update({ where: { id: cred.id }, data: { displayName } });
    credUpdated++;
  }
  console.log(`Re-generated ${credUpdated} credential displayNames`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
