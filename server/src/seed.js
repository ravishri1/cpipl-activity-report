require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin
  await prisma.user.upsert({
    where: { email: 'admin@cpipl.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@cpipl.com',
      password: hashedPassword,
      role: 'admin',
      department: 'Management',
    },
  });

  // Create team lead
  await prisma.user.upsert({
    where: { email: 'teamlead@cpipl.com' },
    update: {},
    create: {
      name: 'Team Lead',
      email: 'teamlead@cpipl.com',
      password: hashedPassword,
      role: 'team_lead',
      department: 'Management',
    },
  });

  // Create sample members
  const members = [
    { name: 'Rahul Sharma', email: 'rahul@cpipl.com', department: 'Engineering' },
    { name: 'Priya Patel', email: 'priya@cpipl.com', department: 'Engineering' },
    { name: 'Amit Kumar', email: 'amit@cpipl.com', department: 'Sales' },
    { name: 'Sneha Gupta', email: 'sneha@cpipl.com', department: 'Marketing' },
    { name: 'Vikram Singh', email: 'vikram@cpipl.com', department: 'Operations' },
    { name: 'Neha Joshi', email: 'neha@cpipl.com', department: 'HR' },
    { name: 'Ravi Verma', email: 'ravi@cpipl.com', department: 'Engineering' },
    { name: 'Pooja Reddy', email: 'pooja@cpipl.com', department: 'Sales' },
    { name: 'Arjun Nair', email: 'arjun@cpipl.com', department: 'Marketing' },
    { name: 'Kavita Das', email: 'kavita@cpipl.com', department: 'Operations' },
  ];

  for (const member of members) {
    await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: {
        ...member,
        password: hashedPassword,
        role: 'member',
      },
    });
  }

  // Create default settings
  const settings = [
    { key: 'reminder_time', value: '21:00' },
    { key: 'escalation_time', value: '11:00' },
    { key: 'team_lead_email', value: 'teamlead@cpipl.com' },
    { key: 'company_name', value: 'Color Papers' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('Seeding complete!');
  console.log('Admin login: admin@cpipl.com / password123');
  console.log('Team Lead login: teamlead@cpipl.com / password123');
  console.log('Member login: rahul@cpipl.com / password123 (or any member email)');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
