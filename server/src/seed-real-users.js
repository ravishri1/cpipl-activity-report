require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding real Color Papers employees...\n');

  // Step 1: Clean up old demo data
  console.log('🗑️  Removing old demo data...');
  await prisma.emailActivity.deleteMany({});
  await prisma.googleToken.deleteMany({});
  await prisma.reminder.deleteMany({});
  await prisma.dailyReport.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.setting.deleteMany({});
  console.log('   Done.\n');

  // Step 2: Default password for all users
  const defaultPassword = await bcrypt.hash('Colorpapers@123', 10);

  // Step 3: Real employees from CSV
  const employees = [
    // ---- ADMIN ----
    { name: 'Ravi Shrivastav',       email: 'me@colorpapers.in',                     role: 'admin',     department: 'Management' },

    // ---- TEAM LEADS (have direct reports) ----
    { name: 'Himanshu Srivastava',   email: 'himanshu.srivastava@colorpapers.in',     role: 'team_lead', department: 'Management' },
    { name: 'Dayanand Halde',        email: 'dayanand.halde@colorpapers.in',          role: 'team_lead', department: 'Management' },
    { name: 'Shailesh Naik',         email: 'shailesh.naik@colorpapers.in',           role: 'team_lead', department: 'PLD' },
    { name: 'Pranali Patil',         email: 'pranali.patil@colorpapers.in',           role: 'team_lead', department: 'Support' },
    { name: 'Rajat Shrivastava',     email: 'rajat.shrivastava@colorpapers.in',       role: 'team_lead', department: 'Purchase' },
    { name: 'Jyoti Naik',            email: 'jyoti.naik@colorpapers.in',              role: 'team_lead', department: 'HR_Admin_IT' },
    { name: 'Nandan Maurya',         email: 'nandan.maurya@colorpapers.in',           role: 'team_lead', department: 'PLD' },

    // ---- MEMBERS ----
    { name: 'Rahul Dixit',           email: 'rahul.dixit@colorpapers.in',             role: 'member',    department: 'Logistic' },
    { name: 'Anuj Arya',             email: 'anuj.arya@colorpapers.in',               role: 'member',    department: 'Purchase' },
    { name: 'Dilip Yadav',           email: 'dilip.yadav@colorpapers.in',             role: 'member',    department: 'Purchase' },
    { name: 'Aman Saini',            email: 'aman.saini@colorpapers.in',              role: 'member',    department: 'Logistic' },
    { name: 'Noopur Lahiri',         email: 'noopur.lahiri@colorpapers.in',           role: 'member',    department: 'Logistic' },
    { name: 'Ashish Tavasalkar',     email: 'ashish.tavasalkar@colorpapers.in',       role: 'member',    department: 'HR_Admin_IT' },
    { name: 'Mehul Rikame',          email: 'mehul.rikame@colorpapers.in',            role: 'member',    department: 'PLD' },
    { name: 'Sameer Patil',          email: 'sameer.patil@colorpapers.in',            role: 'member',    department: 'Logistic' },
    { name: 'Shaunak Kadam',         email: 'shaunak.kadam@colorpapers.in',           role: 'member',    department: 'Accounts_Finance' },
    { name: 'Avinash Kadam',         email: 'avinash.kadam@colorpapers.in',           role: 'member',    department: 'Accounts_Finance' },
    { name: 'Ankit Singh',           email: 'ankit.singh@colorpapers.in',             role: 'member',    department: 'PLD' },
    { name: 'Ritesh Yadav',          email: 'ritesh.yadav@colorpapers.in',            role: 'member',    department: 'PLD' },
    { name: 'Dilip Gautam',          email: 'dilip.gautam@colorpapers.in',            role: 'member',    department: 'Logistic' },
    { name: 'Akshat Mehta',          email: 'akshat.mehta@colorpapers.in',            role: 'member',    department: 'Data Analyst' },
    { name: 'Shubhanshu Prasad',     email: 'shubhanshu.prasad@colorpapers.in',      role: 'member',    department: 'Support' },
  ];

  // Step 4: Insert all employees
  console.log(`👥 Adding ${employees.length} employees...\n`);

  for (const emp of employees) {
    const user = await prisma.user.create({
      data: {
        name: emp.name,
        email: emp.email,
        password: defaultPassword,
        role: emp.role,
        department: emp.department,
        isActive: true,
      },
    });
    const roleIcon = emp.role === 'admin' ? '👑' : emp.role === 'team_lead' ? '⭐' : '  ';
    console.log(`   ${roleIcon} ${user.name.padEnd(25)} ${user.email.padEnd(45)} ${user.role.padEnd(12)} ${user.department}`);
  }

  // Step 5: Update company settings
  console.log('\n⚙️  Setting up company config...');
  const settings = [
    { key: 'reminder_time',    value: '21:00' },
    { key: 'escalation_time',  value: '11:00' },
    { key: 'team_lead_email',  value: 'me@colorpapers.in' },
    { key: 'company_name',     value: 'Color Papers' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
    console.log(`   ${setting.key}: ${setting.value}`);
  }

  console.log('\n✅ Seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Total users: ${employees.length}`);
  console.log(`   Admin:       ${employees.filter(e => e.role === 'admin').length}`);
  console.log(`   Team Leads:  ${employees.filter(e => e.role === 'team_lead').length}`);
  console.log(`   Members:     ${employees.filter(e => e.role === 'member').length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Default password: Colorpapers@123');
  console.log('   Admin login: me@colorpapers.in / Colorpapers@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
