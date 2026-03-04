const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testMigration() {
  try {
    console.log('Testing database migration...');
    
    // Check if TrainingModule table exists by counting records
    const moduleCount = await prisma.trainingModule.count();
    console.log(`✅ TrainingModule table exists. Count: ${moduleCount}`);
    
    // Check TrainingAssignment table
    const assignmentCount = await prisma.trainingAssignment.count();
    console.log(`✅ TrainingAssignment table exists. Count: ${assignmentCount}`);
    
    // Check TrainingContribution table
    const contributionCount = await prisma.trainingContribution.count();
    console.log(`✅ TrainingContribution table exists. Count: ${contributionCount}`);
    
    console.log('\n🎉 Database migration successful! All training system tables are created.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration test failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testMigration();
