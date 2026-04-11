const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  // Create the 3 missing companies
  const toCreate = [
    { name: 'Color Papers', shortName: 'CP', isActive: true },
    { name: 'Bluenotes', shortName: 'BN', isActive: true },
    { name: 'Gimmick Enterprise', shortName: 'GE', isActive: true },
  ];

  console.log('=== CREATING MISSING COMPANIES ===');
  const companyMap = {};

  // Get existing
  const existing = await prisma.company.findMany({ select: { id: true, name: true, shortName: true } });
  existing.forEach(c => { companyMap[c.name] = c.id; console.log(`  EXISTS: ${c.name} (id=${c.id})`); });

  for (const c of toCreate) {
    if (companyMap[c.name]) { console.log(`  SKIP: ${c.name} already exists`); continue; }
    const created = await prisma.company.create({ data: c });
    companyMap[c.name] = created.id;
    console.log(`  CREATED: ${created.name} (id=${created.id})`);
  }

  console.log('\n=== COMPANY MAP ===');
  Object.entries(companyMap).forEach(([name, id]) => console.log(`  id=${id} | ${name}`));

  // Move 4 Color Papers employees to correct company
  const colorPapersId = companyMap['Color Papers'];
  const cpEmployees = ['Aman Saini', 'Lahiri Noopur', 'Shashi Pai', 'Dilip Kumar'];

  console.log(`\n=== MOVING EMPLOYEES TO Color Papers (id=${colorPapersId}) ===`);
  for (const name of cpEmployees) {
    const u = await prisma.user.findFirst({ where: { name }, select: { id: true, name: true, employeeId: true, companyId: true } });
    if (!u) { console.log(`  NOT FOUND: ${name}`); continue; }
    await prisma.user.update({ where: { id: u.id }, data: { companyId: colorPapersId } });
    console.log(`  MOVED: ${u.employeeId} ${u.name} → companyId=${colorPapersId}`);
  }

  // Handle Rahul Yadav (companyId=null) — also Color Papers?
  const rahul = await prisma.user.findFirst({ where: { name: 'Rahul Yadav' }, select: { id: true, name: true, employeeId: true, companyId: true } });
  if (rahul) {
    await prisma.user.update({ where: { id: rahul.id }, data: { companyId: colorPapersId } });
    console.log(`  MOVED: ${rahul.employeeId} Rahul Yadav → companyId=${colorPapersId}`);
  }

  // Verify CPIPL employee count
  const cpiplId = companyMap['Color Papers India Private Limited'];
  const cpiplCount = await prisma.user.count({
    where: { isActive: true, companyId: cpiplId, dateOfJoining: { lte: '2025-04-30' } },
  });
  console.log(`\n=== CPIPL EMPLOYEE COUNT (joined <= Apr 2025) ===`);
  console.log(`  ${cpiplCount} employees`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
