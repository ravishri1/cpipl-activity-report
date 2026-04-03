// One-time script: Backfill displayName for all credentials
// Run: cd server && node scripts/backfill-display-names.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateDisplayName(portalId, label, excludeCredId) {
  const portal = await prisma.companyPortal.findUnique({
    where: { id: portalId },
    include: {
      legalEntity: { select: { shortName: true, legalName: true } },
      companyRegistration: { select: { abbr: true } },
    },
  });
  if (!portal) return null;
  const entity = portal.legalEntity?.shortName || portal.legalEntity?.legalName || '';
  const abbr = portal.companyRegistration?.abbr || '';
  const cityMatch = abbr.match(/^[^-]+-([^/]+)/);
  const cityCode = cityMatch ? cityMatch[1] : '';
  let platform = portal.name;
  platform = platform.replace(/^(CPIPL|CP)\s*(MH|LKO|THN|BLR|HYD|KOL|CCU)?\s*/i, '').trim();
  platform = platform.replace(/\s*Server$/i, '').trim();
  platform = platform.replace(/\s*\/\s*Portal$/i, '').trim();
  platform = platform.replace(/\s*\([^)]*\)\s*/g, '').trim();
  platform = platform.replace(/\.(com|in|co\.in)$/i, '').trim();
  const prefix = [entity, cityCode, platform, label].filter(Boolean).join('-');
  const existing = await prisma.portalCredential.findMany({
    where: { portalId, ...(excludeCredId ? { id: { not: excludeCredId } } : {}) },
    select: { displayName: true },
  });
  const samePrefix = existing.filter(c => c.displayName && c.displayName.startsWith(prefix));
  const seq = String(samePrefix.length + 1).padStart(2, '0');
  return `${prefix}-${seq}`;
}

async function main() {
  console.log('Clearing all displayNames...');
  await prisma.portalCredential.updateMany({ data: { displayName: null } });

  const all = await prisma.portalCredential.findMany({
    select: { id: true, portalId: true, label: true },
    orderBy: [{ portalId: 'asc' }, { label: 'asc' }, { id: 'asc' }],
  });
  console.log(`Processing ${all.length} credentials...`);

  let updated = 0;
  for (const cred of all) {
    const dn = await generateDisplayName(cred.portalId, cred.label, cred.id);
    if (dn) {
      await prisma.portalCredential.update({ where: { id: cred.id }, data: { displayName: dn } });
      console.log(`  ${cred.id}: ${dn}`);
      updated++;
    }
  }
  console.log(`\nDone! Backfilled ${updated}/${all.length} credentials`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
