const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const fixes = [
    { employeeId: 'COLOR034', oldName: 'Pranali Nandu Patel', newName: 'Pranali Nandu Patil' },
    { employeeId: 'COLOR134', oldName: 'Divyash Chandegra',   newName: 'Divyash Nanji Bhai Chandegra' },
  ];

  for (const fix of fixes) {
    const user = await prisma.user.findFirst({
      where: { employeeId: fix.employeeId },
      select: { id: true, name: true, email: true },
    });
    if (!user) { console.log(`NOT FOUND: ${fix.employeeId}`); continue; }

    await prisma.user.update({
      where: { id: user.id },
      data: { name: fix.newName },
    });
    console.log(`✅ ${fix.employeeId} | "${fix.oldName}" → "${fix.newName}"`);
    console.log(`   Email: ${user.email} | userId: ${user.id}`);
    console.log(`   All portal references use userId — name update reflects everywhere automatically.\n`);
  }

  console.log('Done. Names corrected across the entire portal.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
