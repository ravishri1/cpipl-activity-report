/**
 * GreyTHR → EOD Employee Sync Script
 * Adds missing employees, updates existing ones with null employeeId,
 * and creates Separation records for departed employees.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── GreyTHR data (filtered: leaving date blank OR >= 2025-04-01) ──

const GREYTHR_EMPLOYEES = [
  // COLOR006 – COLOR021: Old employees still active/separated after Apr 2025
  { employeeId: 'COLOR006', name: 'Rajendra Pandharinath Ghuge', email: 'rajendra.ghuge@colorpapers.in', phone: '9867399557', doj: '2020-03-11', leavingDate: '2025-08-30' },
  { employeeId: 'COLOR007', name: 'Pradnya Sushil Vaidya',       email: 'pradnya.vaidya@colorpapers.in',   phone: '9820517999', doj: '2017-11-01', leavingDate: '2025-10-31' },
  { employeeId: 'COLOR015', name: 'Rajan Saroj',                  email: 'rajan.saroj@colorpapers.in',      phone: '8983500936', doj: '2018-08-01', leavingDate: '2025-08-08' },
  { employeeId: 'COLOR018', name: 'Anil Kumar Ramdhruv Gautam',   email: 'anil.gautam@colorpapers.in',      phone: '9699693312', doj: '2020-05-10', leavingDate: '2025-10-15' },
  { employeeId: 'COLOR021', name: 'Ajeet Kumar Yadav',            email: 'ajeet.yadav@colorpapers.in',      phone: '7355045132', doj: '2019-01-01', leavingDate: '2026-01-17' },
  { employeeId: 'COLOR051', name: 'Suraj Baban Hate',             email: 'suraj.hate@colorpapers.in',       phone: '9076201958', doj: '2021-12-04', leavingDate: '2025-05-09' },
  { employeeId: 'COLOR055', name: 'Anil Kumar',                   email: 'anil.yadav@colorpapers.in',       phone: '7045781122', doj: '2021-12-29', leavingDate: '2025-10-01' },
  { employeeId: 'COLOR059', name: 'Pankaj Kumar',                 email: 'pankaj.kumar@colorpapers.in',     phone: '7607978787', doj: '2022-02-07', leavingDate: '2025-10-25' },
  { employeeId: 'COLOR070', name: 'Pratik Anil Singh',            email: 'pratik.singh@colorpapers.in',     phone: '8452969848', doj: '2022-05-18', leavingDate: '2025-09-09' },
  { employeeId: 'COLOR071', name: 'Lavita Jane Fernandes',        email: 'lavita.fernandes@colorpapers.in', phone: '7760391395', doj: '2022-06-01', leavingDate: '2025-10-18' },
  { employeeId: 'COLOR077', name: 'Vishal Sonu Gharate',          email: 'vishal.gharate@colorpapers.in',   phone: '8329610952', doj: '2022-07-25', leavingDate: '2025-04-25' },
  { employeeId: 'COLOR085', name: 'Badal Mishra',                 email: 'badal.mishra@colorpapers.in',     phone: '9794382603', doj: '2022-09-17', leavingDate: '2025-07-14' },
  { employeeId: 'COLOR089', name: 'Nishad Sujit',                 email: 'nishad.sujit@colorpapers.in',     phone: '8850812292', doj: '2022-12-05', leavingDate: '2025-08-31' },
  { employeeId: 'COLOR090', name: 'Abhishek Yadav',               email: 'abhishek.yadav@colorpapers.in',   phone: '8354053884', doj: '2022-12-12', leavingDate: '2025-08-08' },
  { employeeId: 'COLOR095', name: 'Prashant Kumar Vishwakarma',   email: 'prashant.vishwakarma@colorpapers.in', phone: '7052303420', doj: '2023-02-01', leavingDate: '2025-08-08' },
  { employeeId: 'COLOR100', name: 'Abhishek Suresh Sawant',       email: 'abhishek.sawant@colorpapers.in',  phone: '7506461975', doj: '2023-02-06', leavingDate: '2026-01-07' },
  { employeeId: 'COLOR101', name: 'Swapnil Mahadev Parab',        email: 'swapnil.parab@colorpapers.in',    phone: '9769557808', doj: '2023-04-20', leavingDate: '2025-12-31' },
  { employeeId: 'COLOR108', name: 'Pritesh Santosh Varose',       email: 'pritesh.varose@colorpapers.in',   phone: '8655373615', doj: '2023-07-03', leavingDate: '2025-07-14' },
  { employeeId: 'COLOR113', name: 'Abhilasha Jaiswal',            email: 'abhilasha.jaiswal@colorpapers.in',phone: '9506553229', doj: '2023-09-20', leavingDate: '2025-12-29' },
  { employeeId: 'COLOR121', name: 'Suraj Gajanan Parab',          email: 'suraj.parab@colorpapers.in',      phone: '9607623060', doj: '2023-12-11', leavingDate: '2025-11-11' },
  { employeeId: 'COLOR128', name: 'Sameer Subhash Bhandvilkar',   email: 'sameer.bhandvilkar@colorpapers.in',phone: '8767557790', doj: '2024-04-01', leavingDate: '2025-06-14' },
  { employeeId: 'COLOR134', name: 'Divyash Chandegra',            email: 'divyash.chandegra@colorpapers.in', phone: '7738002554', doj: '2024-06-24', leavingDate: '2025-07-31' },
  { employeeId: 'COLOR136', name: 'Mansi Harsukhbhai Thummar',    email: 'mansi.thummar@colorpapers.in',    phone: '7715096462', doj: '2024-07-10', leavingDate: '2025-07-31' },
  { employeeId: 'COLOR137', name: 'Shubham Arya',                 email: 'shubham.arya@colorpapers.in',     phone: '7304231821', doj: '2024-08-05', leavingDate: '2025-06-19' },
  { employeeId: 'COLOR139', name: 'Viraj Sawner',                 email: 'viraj.sawner@colorpapers.in',     phone: '8982506170', doj: '2024-09-20', leavingDate: '2025-07-25' },
  { employeeId: 'COLOR143', name: 'Samiksha Pushparaj Dhuri',     email: 'samiksha.dhuri@colorpapers.in',   phone: '9326064578', doj: '2024-10-01', leavingDate: '2025-07-21' },
  { employeeId: 'COLOR145', name: 'Shikha Ankit Shukla',          email: 'shikha.shukla@colorpapers.in',    phone: '8898426554', doj: '2024-09-17', leavingDate: '2025-07-21' },
  { employeeId: 'COLOR147', name: 'Kaustubh Gaikwad',             email: 'kaustubh.gaikwad@colorpapers.in', phone: '9892719608', doj: '2024-10-01', leavingDate: '2025-07-31' },
  { employeeId: 'COLOR153', name: 'Daniel Sunil Das Kuzhivila',   email: 'daniel.kuzhivila@colorpapers.in', phone: '8976648454', doj: '2024-11-25', leavingDate: '2025-07-15' },
  { employeeId: 'COLOR154', name: 'Aashutosh Shailendra Patil',   email: 'aashutosh.patil@colorpapers.in',  phone: '8169826161', doj: '2024-12-05', leavingDate: '2025-07-23' },
  { employeeId: 'COLOR156', name: 'Rupali Ramesh Sharma',         email: 'rupali.sharma@colorpapers.in',    phone: '9326576595', doj: '2024-12-19', leavingDate: '2025-12-11' },
  { employeeId: 'COLOR157', name: 'Yashashree Yadava Kotian',     email: 'yashashree.kotian@colorpapers.in',phone: '8779222743', doj: '2024-12-27', leavingDate: '2025-06-26' },
  { employeeId: 'COLOR158', name: 'Nikhil Shahaji Thorat',        email: 'nikhil.thorat@colorpapers.in',    phone: '9137581335', doj: '2025-01-02', leavingDate: '2025-06-30' },
  { employeeId: 'COLOR163', name: 'Sagar Stavarmath',             email: 'sagar.stavarmath@colorpapers.in', phone: '8128314767', doj: '2025-05-06', leavingDate: '2025-10-10' },
  // Active employees (no leaving date)
  { employeeId: 'COLOR184', name: 'Rahul Yadav',                  email: 'order.lucknow@colorpapers.in',    phone: '9214651751', doj: '2024-12-01', leavingDate: null },
  // Post-Apr 2025 separated
  { employeeId: 'COLOR177', name: 'Sumit Kumar Maurya',           email: 'sm7619837958@gmail.com',          phone: '7619837958', doj: '2025-09-01', leavingDate: '2025-12-06' },
  { employeeId: 'COLOR181', name: 'Shraddha Prakash Shivgan',     email: 'shraddhashivgan29@gmail.com',     phone: '8433552352', doj: '2025-09-16', leavingDate: '2025-12-20' },
  { employeeId: 'COLOR189', name: 'Vikrant Aravind Malavade',     email: 'malavadevikrant@gmail.com',       phone: '8928130800', doj: '2025-10-03', leavingDate: '2025-10-15' },
  // Active
  { employeeId: 'COLOR190', name: 'Manish Jaya Mendon',           email: 'manishmendon33@gmail.com',        phone: '9172618739', doj: '2025-10-03', leavingDate: null },
  { employeeId: 'COLOR193', name: 'Pratiksha Pankaj Manjrekar',   email: 'pratikshapm1612@gmail.com',       phone: '8591250227', doj: '2026-01-27', leavingDate: null, type: 'intern' },
  { employeeId: 'COLOR194', name: 'Shalini Chaurasia',            email: 'shalinichaurasia67@gmail.com',    phone: '8355918178', doj: '2026-01-27', leavingDate: null, type: 'intern' },
  { employeeId: 'COLOR195', name: 'Nishad Sujit',                 email: 'nishadsujit52@gmail.com',         phone: '9324640348', doj: '2026-03-01', leavingDate: null },
  { employeeId: 'COLOR197', name: 'Shelton Rodrigues',            email: 'sheltonrodrigues154@gmail.com',   phone: '9987359876', doj: '2026-03-01', leavingDate: null },
];

// Existing EOD users with null employeeId to update by email match
const EMAIL_UPDATES = [
  { email: 'dilip.gautam@colorpapers.in',    employeeId: 'COLOR185', name: 'Dilip Kumar',             doj: '2024-12-01', phone: '9870979299' },
  { email: 'shubhanshu.prasad@colorpapers.in',employeeId: 'COLOR188', name: 'Shubhanshu Prasad',       doj: '2025-09-22', phone: '6394147117' },
  { email: 'akshat.mehta@colorpapers.in',    employeeId: 'COLOR191', name: 'Akshat Shailesh Mehta',   doj: '2025-10-01', phone: '9833817725' },
  { email: 'ritesh.yadav@colorpapers.in',    employeeId: 'COLOR182', name: 'Yadav Ritesh Vinod',      doj: '2025-09-16', phone: '7718994310' },
  { email: 'pravin.shinde@colorpapers.in',   employeeId: 'COLOR196', name: 'Pravin Hindurao Shinde',  doj: '2026-02-01', phone: '9821919521' },
  { email: 'nishad.sujit@colorpapers.in',    employeeId: 'COLOR089', name: 'Nishad Sujit',            doj: '2022-12-05', phone: '8850812292', leavingDate: '2025-08-31' },
];

// Existing users with employee IDs who have leaving dates needing status update
const STATUS_UPDATES = [
  { employeeId: 'COLOR026', leavingDate: '2026-03-31' },
  { employeeId: 'COLOR167', leavingDate: '2026-03-06' },
  { employeeId: 'COLOR179', leavingDate: '2026-02-28' },
];

async function main() {
  const today = '2026-04-06';
  let created = 0, updated = 0, skipped = 0, errors = 0;

  console.log('=== GreyTHR → EOD Sync ===\n');

  // ── 1. Email-based updates for existing null-employeeId users ──
  console.log('Step 1: Updating existing users by email...');
  for (const u of EMAIL_UPDATES) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (!existing) { console.log(`  SKIP (not found): ${u.email}`); skipped++; continue; }

      const isSeparated = u.leavingDate && u.leavingDate <= today;
      const updateData = {
        employeeId: u.employeeId,
        name: u.name,
        dateOfJoining: u.doj,
        phone: u.phone,
        ...(isSeparated ? { employmentStatus: 'separated', isActive: false } : {}),
      };
      await prisma.user.update({ where: { email: u.email }, data: updateData });

      if (isSeparated) {
        const existingSep = await prisma.separation.findUnique({ where: { userId: existing.id } });
        if (!existingSep) {
          await prisma.separation.create({
            data: {
              userId: existing.id,
              type: 'resignation',
              requestDate: u.leavingDate,
              lastWorkingDate: u.leavingDate,
              status: 'completed',
            },
          });
        }
      }
      console.log(`  UPDATED: ${u.name} (${u.employeeId})`);
      updated++;
    } catch (e) {
      console.error(`  ERROR updating ${u.email}: ${e.message}`);
      errors++;
    }
  }

  // ── 2. Status updates for employees with known leaving dates ──
  console.log('\nStep 2: Status updates for employees with leaving dates...');
  for (const u of STATUS_UPDATES) {
    try {
      const existing = await prisma.user.findUnique({ where: { employeeId: u.employeeId } });
      if (!existing) { console.log(`  SKIP (not found): ${u.employeeId}`); skipped++; continue; }

      const isSeparated = u.leavingDate <= today;
      if (isSeparated) {
        await prisma.user.update({
          where: { employeeId: u.employeeId },
          data: { employmentStatus: 'separated', isActive: false },
        });
        const existingSep = await prisma.separation.findUnique({ where: { userId: existing.id } });
        if (!existingSep) {
          await prisma.separation.create({
            data: {
              userId: existing.id,
              type: 'resignation',
              requestDate: u.leavingDate,
              lastWorkingDate: u.leavingDate,
              status: 'completed',
            },
          });
        }
        console.log(`  UPDATED status → separated: ${existing.name} (${u.employeeId})`);
        updated++;
      }
    } catch (e) {
      console.error(`  ERROR updating status ${u.employeeId}: ${e.message}`);
      errors++;
    }
  }

  // ── 3. Add new employees from GreyTHR ──
  console.log('\nStep 3: Adding new employees...');
  for (const emp of GREYTHR_EMPLOYEES) {
    try {
      // Check by employeeId first
      const byId = await prisma.user.findUnique({ where: { employeeId: emp.employeeId } });
      if (byId) { console.log(`  SKIP (already exists by ID): ${emp.employeeId} – ${emp.name}`); skipped++; continue; }

      // Check by email
      const byEmail = await prisma.user.findUnique({ where: { email: emp.email } });
      if (byEmail) {
        // Update employeeId if missing
        if (!byEmail.employeeId) {
          await prisma.user.update({
            where: { email: emp.email },
            data: {
              employeeId: emp.employeeId,
              dateOfJoining: emp.doj,
              phone: emp.phone,
              ...(emp.leavingDate && emp.leavingDate <= today ? { employmentStatus: 'separated', isActive: false } : {}),
            },
          });
          console.log(`  UPDATED (by email): ${emp.name} (${emp.employeeId})`);
          updated++;
        } else {
          console.log(`  SKIP (email exists, has ID): ${emp.email}`);
          skipped++;
        }
        continue;
      }

      // Create new user
      const isSeparated = emp.leavingDate && emp.leavingDate <= today;
      const newUser = await prisma.user.create({
        data: {
          name: emp.name,
          email: emp.email,
          password: 'CLERK_SSO_ONLY',  // placeholder — Clerk SSO is primary auth
          employeeId: emp.employeeId,
          role: 'member',
          department: 'General',
          dateOfJoining: emp.doj,
          phone: emp.phone,
          employmentType: emp.type === 'intern' ? 'intern' : 'full_time',
          employmentStatus: isSeparated ? 'separated' : 'active',
          isActive: !isSeparated,
          isHibernated: false,
        },
      });

      if (isSeparated) {
        await prisma.separation.create({
          data: {
            userId: newUser.id,
            type: 'resignation',
            requestDate: emp.leavingDate,
            lastWorkingDate: emp.leavingDate,
            status: 'completed',
          },
        });
      }

      console.log(`  CREATED: ${emp.name} (${emp.employeeId}) – ${isSeparated ? 'separated' : 'active'}`);
      created++;
    } catch (e) {
      console.error(`  ERROR creating ${emp.employeeId} – ${emp.name}: ${e.message}`);
      errors++;
    }
  }

  // ── Summary ──
  console.log('\n=== SYNC COMPLETE ===');
  console.log(`  Created : ${created}`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Errors  : ${errors}`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
