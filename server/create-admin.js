const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'create-admin.log');
const log = (msg) => {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
};

fs.writeFileSync(logFile, '');
log('[ADMIN] Creating admin user...\n');

const prisma = new PrismaClient();

(async () => {
  try {
    log('[ADMIN] Testing database connection...');
    const count = await prisma.user.count();
    log(`[ADMIN] ✅ Database connection successful. Current users: ${count}\n`);
    
    log('[ADMIN] Creating admin user...');
    const user = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@cpipl.com',
        password: 'password123',
        role: 'admin'
      }
    });
    
    log(`[ADMIN] ✅ Admin user created!`);
    log(`[ADMIN]    ID: ${user.id}`);
    log(`[ADMIN]    Email: ${user.email}`);
    log(`[ADMIN]    Role: ${user.role}\n`);
    
    // Verify user exists
    const foundUser = await prisma.user.findUnique({
      where: { email: 'admin@cpipl.com' }
    });
    
    if (foundUser) {
      log('[ADMIN] ✅ User verified in database');
      log('[ADMIN] ✅ Admin setup complete!\n');
    }
    
    process.exit(0);
  } catch (error) {
    log(`[ADMIN] ❌ Error: ${error.message}\n`);
    if (error.code === 'P2002') {
      log('[ADMIN] ℹ️  Admin user already exists');
      process.exit(0);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
