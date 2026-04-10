const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'rahul@cpipl.com' }, select: { id: true, name: true, email: true, role: true, isActive: true, employmentStatus: true, department: true } });
  console.log(u ? JSON.stringify(u, null, 2) : 'NOT FOUND in DB');
}
main().catch(console.error).finally(() => prisma.$disconnect());
