// Script: Remove 'General' department - delete DB entry, clear user department fields
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Clear department for any user still set to 'General'
  const updated = await prisma.user.updateMany({
    where: { department: 'General' },
    data: { department: '' },
  });
  console.log(`✅ Cleared 'General' dept from ${updated.count} user(s)`);

  // 2. Delete the 'General' department from Department table
  try {
    const del = await prisma.department.delete({ where: { name: 'General' } });
    console.log(`✅ Deleted Department entry: ${del.name} (id: ${del.id})`);
  } catch (e) {
    if (e.code === 'P2025') {
      console.log('ℹ️  General department not found in DB (already removed)');
    } else {
      throw e;
    }
  }

  console.log('\nDone.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
