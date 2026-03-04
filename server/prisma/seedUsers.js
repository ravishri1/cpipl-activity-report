const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('👥 Seeding test users...\n');

  try {
    // Create a default company first
    let company = await prisma.company.findFirst({
      where: { name: 'CPIPL' }
    });
    
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'CPIPL',
          shortName: 'CPIPL',
          address: 'Pune, India',
          city: 'Pune',
          state: 'Maharashtra'
        }
      });
    }
    console.log('✅ Company created:', company.name);

    // Hash password for all users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create admin user
    const admin = await prisma.user.upsert({
      where: { email: 'admin@cpipl.com' },
      update: {},
      create: {
        name: 'Admin User',
        email: 'admin@cpipl.com',
        password: hashedPassword,
        phone: '9876543210',
        role: 'admin',
        isActive: true,
        department: 'Management',
        designation: 'Administrator',
        dateOfJoining: '2025-01-01',
        employmentStatus: 'full_time',
        gender: 'Other',
        companyId: 1
      }
    });
    console.log('✅ Admin created:', admin.email);

    // Create team lead
    const teamLead = await prisma.user.upsert({
      where: { email: 'teamlead@cpipl.com' },
      update: {},
      create: {
        name: 'Team Lead',
        email: 'teamlead@cpipl.com',
        password: hashedPassword,
        phone: '9876543211',
        role: 'team_lead',
        isActive: true,
        department: 'Engineering',
        designation: 'Team Lead',
        dateOfJoining: '2025-01-05',
        employmentStatus: 'full_time',
        gender: 'Other',
        companyId: 1
      }
    });
    console.log('✅ Team Lead created:', teamLead.email);

    // Create member users
    const memberEmails = [
      'rahul@cpipl.com',
      'priya@cpipl.com',
      'amit@cpipl.com',
      'deepak@cpipl.com',
      'neha@cpipl.com',
      'rohan@cpipl.com',
      'sanjana@cpipl.com',
      'vikram@cpipl.com',
      'ananya@cpipl.com',
      'arjun@cpipl.com'
    ];

    for (let i = 0; i < memberEmails.length; i++) {
      const member = await prisma.user.upsert({
        where: { email: memberEmails[i] },
        update: {},
        create: {
          name: `Member ${i + 1}`,
          email: memberEmails[i],
          password: hashedPassword,
          phone: `987654321${i}`,
          role: 'member',
          isActive: true,
          department: 'Engineering',
          designation: 'Software Engineer',
          dateOfJoining: '2025-01-10',
          employmentStatus: 'full_time',
          gender: 'Other',
          companyId: 1,
          reportingManagerId: teamLead.id
        }
      });
      console.log(`✅ Member created: ${member.email}`);
    }

    console.log('\n✨ User seed complete!');
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
