const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking database status...\n');

    // Check if users exist
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    });

    console.log(`✅ User table exists. Found ${users.length} users:\n`);
    if (users.length > 0) {
      users.forEach(u => console.log(`   - ${u.email} (${u.role})`));
    } else {
      console.log('   (No users found - database may be empty)');
    }

    // Try to find admin user specifically
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@cpipl.com' }
    });

    console.log(`\n✅ Admin lookup result: ${admin ? 'FOUND' : 'NOT FOUND'}`);
    if (admin) {
      console.log(`   Name: ${admin.name}`);
      console.log(`   Role: ${admin.role}`);
    }

    // Check Procurement models
    try {
      const vendors = await prisma.vendor.findMany({
        select: { id: true, vendorName: true }
      });
      console.log(`\n✅ Vendor table exists. Found ${vendors.length} vendors.`);
    } catch (e) {
      console.log('\n❌ Vendor table does not exist or error:', e.message.substring(0, 100));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
