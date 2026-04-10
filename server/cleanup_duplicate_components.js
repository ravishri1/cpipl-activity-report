/**
 * Removes duplicate salary components created by seed_salary_components.js
 * that overlap with DEFAULT_COMPONENTS in payroll.js routes.
 *
 * Rules:
 *  - Only delete if the code has NO references in any salary structure's components JSON
 *  - Prefer the DEFAULT_COMPONENTS versions (SPECIAL_ALLOWANCE > SPECIAL, EMP_PF > PF_EMP, etc.)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Seed-created codes that duplicate DEFAULT_COMPONENTS (keep the second column, delete the first)
const DUPLICATES = [
  { deleteCode: 'TA',       keepCode: 'CONVEYANCE_ALLOWANCE', reason: 'Transport Allowance = Conveyance Allowance' },
  { deleteCode: 'SPECIAL',  keepCode: 'SPECIAL_ALLOWANCE',    reason: 'Same component, different code' },
  { deleteCode: 'MEDICAL',  keepCode: 'MEDICAL_ALLOWANCE',    reason: 'Same component, different code' },
  { deleteCode: 'PF_EMP',   keepCode: 'EMP_PF',              reason: 'Employee PF 12% - duplicate' },
  { deleteCode: 'ESI_EMP',  keepCode: 'EMP_ESI',             reason: 'Employee ESI 0.75% - duplicate' },
  { deleteCode: 'PF_ER',    keepCode: 'EMPLOYER_PF',         reason: 'Employer PF 12% - duplicate' },
  { deleteCode: 'ESI_ER',   keepCode: 'EMPLOYER_ESI',        reason: 'Employer ESI 3.25% - duplicate' },
  { deleteCode: 'GRATUITY', keepCode: 'EMPLOYER_GRATUITY',   reason: 'Employer Gratuity 4.81% - duplicate' },
];

async function main() {
  // Build set of codes referenced in salary structures
  const structs = await prisma.salaryStructure.findMany({ select: { userId: true, components: true } });
  const usedCodes = new Set();
  structs.forEach(s => {
    if (s.components && Array.isArray(s.components)) {
      s.components.forEach(c => { if (c.code) usedCodes.add(c.code); });
    }
  });
  console.log('Codes used in salary structures:', [...usedCodes].sort().join(', ') || '(none)');
  console.log('');

  let deleted = 0, skipped = 0;

  for (const { deleteCode, keepCode, reason } of DUPLICATES) {
    const comp = await prisma.salaryComponent.findUnique({ where: { code: deleteCode } });
    if (!comp) {
      console.log(`  SKIP  ${deleteCode} — not in DB`);
      continue;
    }

    if (usedCodes.has(deleteCode)) {
      console.log(`  SKIP  ${deleteCode} — referenced in ${[...structs].filter(s => Array.isArray(s.components) && s.components.some(c => c.code === deleteCode)).length} salary structure(s). Keeping.`);
      skipped++;
      continue;
    }

    // Safe to delete — hard delete since no connections
    await prisma.salaryComponent.delete({ where: { code: deleteCode } });
    console.log(`  DELETE id:${comp.id} ${deleteCode} → keep ${keepCode} (${reason})`);
    deleted++;
  }

  console.log(`\nDone. Deleted: ${deleted}, Skipped (connected): ${skipped}`);

  // Final count
  const remaining = await prisma.salaryComponent.count();
  console.log(`Remaining components in DB: ${remaining}`);
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
