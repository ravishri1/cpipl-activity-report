const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function createSchema() {
  console.log('[INIT] Creating database schema...\n');
  
  try {
    // Create User table with all required fields from schema.prisma
    const sql = `
    CREATE TABLE IF NOT EXISTS User (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      dateOfJoining TEXT,
      dateOfLeaving TEXT,
      profilePhotoUrl TEXT,
      phoneNumber TEXT,
      alternatePhone TEXT,
      gender TEXT,
      bloodGroup TEXT,
      dateOfBirth TEXT,
      maritalStatus TEXT,
      employmentStatus TEXT NOT NULL DEFAULT 'active',
      pfNumber TEXT,
      uanNumber TEXT,
      totalExperience TEXT,
      currentDesignation TEXT,
      currentDepartment TEXT,
      reportingTo TEXT,
      companyId INTEGER,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastLogin TEXT,
      lastReportSubmittedAt TEXT,
      lastPasswordChange TEXT,
      passwordChangeRequired BOOLEAN DEFAULT false,
      accountLocked BOOLEAN DEFAULT false,
      accountLockedReason TEXT,
      accountLockedUntil TEXT,
      driveFolderId TEXT,
      driveProfilePhotoUrl TEXT,
      FOREIGN KEY(companyId) REFERENCES Company(id)
    );
    `;
    
    await prisma.$executeRawUnsafe(sql);
    console.log('[INIT] ✅ User table created');
    
    // Create Company table
    const companySql = `
    CREATE TABLE IF NOT EXISTS Company (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gstin TEXT,
      companyRegistrationNumber TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    `;
    
    await prisma.$executeRawUnsafe(companySql);
    console.log('[INIT] ✅ Company table created');
    
    // Now insert a default user
    console.log('[INIT] \nCreating admin user...');
    
    const user = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@cpipl.com',
        password: 'password123',
        role: 'admin',
        employmentStatus: 'active'
      }
    });
    
    console.log('[INIT] ✅ Admin user created:', user.email);
    console.log('[INIT] ✅ Database schema initialization complete!');
    
    return true;
    
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('[INIT] ℹ️  Tables already exist, skipping creation');
      return true;
    }
    console.error('[INIT] ❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createSchema().then(() => {
  console.log('\n[INIT] ✅ Schema initialization successful');
  process.exit(0);
}).catch((error) => {
  console.error('\n[INIT] ❌ Schema initialization failed');
  process.exit(1);
});
