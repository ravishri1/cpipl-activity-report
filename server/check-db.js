const { PrismaClient } = require('@prisma/client');

async function check() {
  const prisma = new PrismaClient();
  try {
    const cols = await prisma.$queryRaw`PRAGMA table_info(User)`;
    console.log(JSON.stringify(cols, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
