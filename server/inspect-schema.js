const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function inspectSchema() {
  try {
    console.log('🔍 Inspecting SQLite User table schema...\n');
    
    // Get actual columns in User table
    const result = await prisma.$queryRaw`PRAGMA table_info(User)`;
    
    console.log('📊 ACTUAL USER TABLE COLUMNS IN DATABASE:');
    console.log('============================================');
    if (result && result.length > 0) {
      console.log(`Total columns: ${result.length}\n`);
      result.forEach(col => {
        console.log(`  ${col.name.padEnd(25)} | Type: ${col.type.padEnd(10)} | PK: ${col.pk} | NotNull: ${col.notnull} | Default: ${col.dflt_value || 'NULL'}`);
      });
    } else {
      console.log('  ⚠️  User table not found or is empty');
    }
    
    console.log('\n📋 EXPECTED COLUMNS FROM SCHEMA.PRISMA (first 30):');
    console.log('============================================');
    const expectedColumns = [
      'id', 'name', 'email', 'password', 'phone', 'role', 'isActive', 
      'department', 'designation', 'dateOfJoining', 'employmentStatus',
      'gender', 'dateOfBirth', 'bloodGroup', 'profilePhotoUrl',
      'companyId', 'managerId', 'reportingManager', 'teamLeadId',
      'onboardingDate', 'offboardingDate', 'resignationDate', 
      'reasonForLeaving', 'noticePeriod', 'finalSettlementDate',
      'googleId', 'googleEmail', 'createdAt', 'updatedAt'
    ];
    expectedColumns.forEach((col, idx) => {
      console.log(`  ${idx + 1}. ${col}`);
    });
    
    console.log('\n🔎 COMPARISON:');
    console.log('============================================');
    const actualColumnNames = result.map(col => col.name);
    
    const missing = expectedColumns.filter(col => !actualColumnNames.includes(col));
    const extra = actualColumnNames.filter(col => !expectedColumns.includes(col));
    
    if (missing.length > 0) {
      console.log(`❌ MISSING COLUMNS (${missing.length}):`);
      missing.forEach(col => console.log(`   - ${col}`));
    }
    
    if (extra.length > 0) {
      console.log(`\n⚠️  EXTRA COLUMNS (${extra.length}):`);
      extra.forEach(col => console.log(`   - ${col}`));
    }
    
    if (missing.length === 0 && extra.length === 0) {
      console.log('✅ Schema appears to match for first 30 columns!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2021') {
      console.error('   User table does not exist in database');
    }
  } finally {
    await prisma.$disconnect();
  }
}

inspectSchema();
