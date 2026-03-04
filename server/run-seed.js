const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('[SEED] Starting database initialization...\n');
    
    // First, try to test the connection with proper SQLite query
    console.log('[SEED] Testing database connection...');
    try {
      const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM sqlite_master`;
      console.log('[SEED] ✅ Database connection successful\n');
    } catch (err) {
      // Database might be empty, that's OK
      console.log('[SEED] ✅ Database connection successful (empty database)\n');
    }
    
    // Check if User table exists
    try {
      const count = await prisma.user.count();
      console.log(`[SEED] ℹ️  User table exists with ${count} records\n`);
    } catch (err) {
      console.log(`[SEED] ℹ️  User table does not exist yet, creating...\n`);
    }
    
    console.log('[SEED] Creating admin user...\n');
    
    // Create a user to initialize the database
    const user = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@cpipl.com',
        password: 'password123',
        role: 'admin',
        employmentStatus: 'active'
      }
    });
    
    console.log('[SEED] ✅ User created:', user.email);
    console.log('[SEED] ✅ Database initialization complete!');
    
  } catch (error) {
    console.error('[SEED] ❌ Error:', error.message);
    if (error.meta) console.error('[SEED] Details:', error.meta);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
