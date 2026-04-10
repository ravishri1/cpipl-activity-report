/**
 * Import leave requests from PDF-parsed JSON (FY 2025-26)
 * Run: node server/scripts/importLeaves.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Leave type IDs in DB (verified)
const LEAVE_TYPE_IDS = { PL: 7, LOP: 8, COF: 9, CF: 10 };

// Admin user id for reviewedBy
const ADMIN_ID = 1;

async function main() {
  const dataPath = 'C:/esslSync/leave_deduped.json';
  const records = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${records.length} leave records from JSON`);

  // Build empNo → userId map
  const users = await prisma.user.findMany({
    where: { employeeId: { not: null } },
    select: { id: true, employeeId: true, name: true },
  });
  const empToUser = {};
  for (const u of users) {
    if (u.employeeId) empToUser[u.employeeId] = u;
  }
  console.log(`Loaded ${users.length} users with employee IDs`);

  // Delete existing FY2025-26 leave requests (approved ones) to avoid duplicates
  const deleted = await prisma.leaveRequest.deleteMany({
    where: {
      status: 'approved',
      startDate: { gte: '2025-04-01' },
      endDate: { lte: '2026-03-31' },
    },
  });
  console.log(`Deleted ${deleted.count} existing approved FY2025-26 leave requests`);

  let inserted = 0;
  let skipped = 0;
  const errors = [];
  const reviewedAt = new Date();

  for (const rec of records) {
    const user = empToUser[rec.empNo];
    if (!user) {
      skipped++;
      errors.push(`Unknown employee: ${rec.empNo}`);
      continue;
    }

    const leaveTypeId = LEAVE_TYPE_IDS[rec.leaveType];
    if (!leaveTypeId) {
      skipped++;
      errors.push(`Unknown leave type: ${rec.leaveType} for ${rec.empNo}`);
      continue;
    }

    const session = rec.days <= 0.5 ? 'first_half' : 'full_day';

    try {
      await prisma.leaveRequest.create({
        data: {
          userId: user.id,
          leaveTypeId,
          startDate: rec.fromDate,
          endDate: rec.toDate,
          days: rec.days,
          session,
          reason: rec.reason.substring(0, 500),
          status: 'approved',
          reviewedBy: ADMIN_ID,
          reviewedAt,
          reviewNote: 'Imported from FY2025-26 leave report',
        },
      });
      inserted++;
    } catch (e) {
      errors.push(`Error for ${rec.empNo} ${rec.fromDate}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\nInserted: ${inserted}, Skipped: ${skipped}`);

  if (errors.length > 0) {
    console.log('\nErrors/warnings:');
    // Deduplicate errors
    const uniqueErrors = [...new Set(errors)];
    uniqueErrors.forEach(e => console.log(`  ${e}`));
  }

  // Update LeaveBalance.used counts
  console.log('\nRecalculating leave balances...');
  const allRequests = await prisma.leaveRequest.findMany({
    where: {
      status: 'approved',
      startDate: { gte: '2025-04-01' },
    },
    select: { userId: true, leaveTypeId: true, days: true },
  });

  // Group by userId + leaveTypeId
  const usedMap = {};
  for (const r of allRequests) {
    const key = `${r.userId}:${r.leaveTypeId}`;
    usedMap[key] = (usedMap[key] || 0) + r.days;
  }

  // Update LeaveBalance records
  let balUpdated = 0;
  for (const [key, usedDays] of Object.entries(usedMap)) {
    const [userId, leaveTypeId] = key.split(':').map(Number);
    const updated = await prisma.leaveBalance.updateMany({
      where: { userId, leaveTypeId },
      data: { used: usedDays },
    });
    if (updated.count > 0) balUpdated++;
  }

  // Also reset used=0 for balances with no approved requests this FY
  const allBalances = await prisma.leaveBalance.findMany({
    select: { userId: true, leaveTypeId: true },
  });
  let resetCount = 0;
  for (const bal of allBalances) {
    const key = `${bal.userId}:${bal.leaveTypeId}`;
    if (!usedMap[key]) {
      await prisma.leaveBalance.updateMany({
        where: { userId: bal.userId, leaveTypeId: bal.leaveTypeId },
        data: { used: 0 },
      });
      resetCount++;
    }
  }

  console.log(`Updated ${balUpdated} leave balances, reset ${resetCount} to 0`);
  console.log('\nDone!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
