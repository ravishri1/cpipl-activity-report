/**
 * Bulk Separation Import — Historical Records
 * Run: node scripts/bulkSeparation.js  (from server/ directory)
 */
const { PrismaClient } = require('../server/node_modules/@prisma/client');
const prisma = new PrismaClient();

function buildSalaryHoldBreakdown(lwdStr, dailyRate, holdDays = 30) {
  const lwd = new Date(lwdStr);
  const holds = [];
  let remaining = holdDays;
  let current = new Date(lwd);
  while (remaining > 0) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const dayInMonth = current.getDate();
    const daysInThisMonth = Math.min(dayInMonth, remaining);
    const startDay = dayInMonth - daysInThisMonth + 1;
    const startDateStr = `${monthStr}-${String(startDay).padStart(2, '0')}`;
    const endDateStr = current.toISOString().slice(0, 10);
    holds.unshift({
      month: monthStr,
      heldDays: daysInThisMonth,
      heldAmount: Math.round(dailyRate * daysInThisMonth * 100) / 100,
      description: `${monthStr} (${startDateStr} to ${endDateStr})`,
    });
    remaining -= daysInThisMonth;
    current = new Date(current.getFullYear(), current.getMonth(), 0);
  }
  return holds;
}

const DEFAULT_CHECKLIST = [
  { department: 'IT',      task: 'Revoke system and email access',           sortOrder: 1 },
  { department: 'IT',      task: 'Collect laptop / phone / hardware',         sortOrder: 2 },
  { department: 'Admin',   task: 'Collect ID card and access card',           sortOrder: 3 },
  { department: 'Admin',   task: 'Collect office keys / locker keys',         sortOrder: 4 },
  { department: 'Finance', task: 'Verify all expense claims are settled',      sortOrder: 5 },
  { department: 'Finance', task: 'Verify no pending salary advances',         sortOrder: 6 },
  { department: 'Manager', task: 'Knowledge transfer completed',              sortOrder: 7 },
  { department: 'Manager', task: 'Handover note / documentation received',    sortOrder: 8 },
  { department: 'HR',      task: 'Exit interview conducted',                  sortOrder: 9 },
  { department: 'HR',      task: 'NOC obtained from all departments',         sortOrder: 10 },
];

// userId → { type, requestDate, lastWorkingDate, salaryHoldUntil }
// requestDate = resignation submitted on; lastWorkingDate = separation date; salaryHoldUntil = settlement date
const SEPARATIONS = [
  { userId: 67, type: 'resignation',  requestDate: '2025-07-01', lastWorkingDate: '2025-07-31', salaryHoldUntil: '2025-08-31', name: 'Divyash Chandegra' },
  { userId: 52, type: 'resignation',  requestDate: '2025-04-10', lastWorkingDate: '2025-05-09', salaryHoldUntil: '2025-06-30', name: 'Suraj Hate' },
  { userId: 66, type: 'resignation',  requestDate: '2025-05-01', lastWorkingDate: '2025-06-14', salaryHoldUntil: '2025-08-07', name: 'Sameer Bhandvilkar' },
  { userId: 77, type: 'resignation',  requestDate: '2025-05-20', lastWorkingDate: '2025-06-26', salaryHoldUntil: '2025-08-31', name: 'Yashshree Kotian' },
  { userId: 69, type: 'resignation',  requestDate: '2025-06-06', lastWorkingDate: '2025-06-19', salaryHoldUntil: '2025-08-07', name: 'Shubham Arya' },
  { userId: 50, type: 'resignation',  requestDate: '2025-07-31', lastWorkingDate: '2025-07-31', salaryHoldUntil: '2025-07-31', name: 'Anil Gautam' },
  { userId: 16, type: 'resignation',  requestDate: '2025-07-31', lastWorkingDate: '2025-07-31', salaryHoldUntil: '2025-07-31', name: 'Rahul Dixit' },
  { userId: 53, type: 'resignation',  requestDate: '2025-07-31', lastWorkingDate: '2025-07-31', salaryHoldUntil: '2025-07-31', name: 'Anil Kumar' },
  { userId: 54, type: 'resignation',  requestDate: '2025-07-28', lastWorkingDate: '2025-10-25', salaryHoldUntil: '2025-12-11', name: 'Pankaj Kumar' },
  { userId: 58, type: 'resignation',  requestDate: '2025-05-16', lastWorkingDate: '2025-07-14', salaryHoldUntil: '2025-08-31', name: 'Badal Mishra' },
  { userId: 63, type: 'resignation',  requestDate: '2025-06-16', lastWorkingDate: '2025-07-14', salaryHoldUntil: '2025-07-31', name: 'Pritesh Varose' },
  { userId: 68, type: 'resignation',  requestDate: '2025-07-18', lastWorkingDate: '2025-07-31', salaryHoldUntil: '2025-08-11', name: 'Mansi Thummar' },
  { userId: 70, type: 'resignation',  requestDate: '2025-06-24', lastWorkingDate: '2025-07-25', salaryHoldUntil: '2025-08-11', name: 'Viraj Savner' },
  { userId: 71, type: 'resignation',  requestDate: '2025-06-21', lastWorkingDate: '2025-07-21', salaryHoldUntil: '2025-08-11', name: 'Samiksha Dhuri' },
  { userId: 72, type: 'resignation',  requestDate: '2025-06-23', lastWorkingDate: '2025-07-21', salaryHoldUntil: '2025-08-11', name: 'Shikha Shukla' },
  { userId: 73, type: 'resignation',  requestDate: '2025-07-03', lastWorkingDate: '2025-07-31', salaryHoldUntil: '2025-08-11', name: 'Kaustubh Gaikwad' },
  { userId: 74, type: 'resignation',  requestDate: '2025-07-09', lastWorkingDate: '2025-07-15', salaryHoldUntil: '2025-08-11', name: 'Daniel Sunil Das Kuzhivila' },
  { userId: 75, type: 'resignation',  requestDate: '2025-06-23', lastWorkingDate: '2025-07-23', salaryHoldUntil: '2025-08-11', name: 'Aashutosh Shailendra Patil' },
  { userId: 78, type: 'resignation',  requestDate: '2025-05-05', lastWorkingDate: '2025-06-30', salaryHoldUntil: '2025-08-31', name: 'Nikhil Thorat' },
  { userId: 47, type: 'resignation',  requestDate: '2025-08-14', lastWorkingDate: '2025-08-30', salaryHoldUntil: null,          name: 'Rajendra Ghuge' },
  { userId: 49, type: 'resignation',  requestDate: '2025-07-08', lastWorkingDate: '2025-08-08', salaryHoldUntil: '2025-10-31', name: 'Rajan Saroj' },
  { userId: 59, type: 'resignation',  requestDate: '2025-07-08', lastWorkingDate: '2025-08-08', salaryHoldUntil: '2025-09-10', name: 'Abhishek Yadav' },
  { userId: 60, type: 'resignation',  requestDate: '2025-07-10', lastWorkingDate: '2025-08-08', salaryHoldUntil: '2025-09-10', name: 'Prashant Kumar Vishwakarma' },
  { userId: 55, type: 'resignation',  requestDate: '2025-08-22', lastWorkingDate: '2025-09-09', salaryHoldUntil: '2025-11-08', name: 'Pratik Singh' },
  { userId: 48, type: 'resignation',  requestDate: '2025-09-08', lastWorkingDate: '2025-10-31', salaryHoldUntil: null,          name: 'Pradnya Vaidya' },
  { userId: 56, type: 'resignation',  requestDate: '2025-10-14', lastWorkingDate: '2025-10-18', salaryHoldUntil: null,          name: 'Lavita Fernandes' },
  { userId: 79, type: 'resignation',  requestDate: '2025-09-08', lastWorkingDate: '2025-10-10', salaryHoldUntil: '2025-11-28', name: 'Sagar Stavarmath' },
  { userId: 65, type: 'resignation',  requestDate: '2025-09-11', lastWorkingDate: '2025-11-11', salaryHoldUntil: '2025-12-29', name: 'Suraj Parab' },
  { userId: 62, type: 'resignation',  requestDate: '2025-11-18', lastWorkingDate: '2025-12-31', salaryHoldUntil: '2026-02-19', name: 'Swapnil Parab' },
  { userId: 64, type: 'resignation',  requestDate: '2025-10-29', lastWorkingDate: '2025-12-29', salaryHoldUntil: '2026-02-13', name: 'Abhilasha Jaiswal' },
  { userId: 76, type: 'absconding',   requestDate: '2025-12-11', lastWorkingDate: '2025-12-11', salaryHoldUntil: null,          name: 'Rupali Sharma' },
  { userId: 61, type: 'resignation',  requestDate: '2025-10-04', lastWorkingDate: '2026-01-07', salaryHoldUntil: '2026-02-24', name: 'Abhishek Sawant' },
  { userId: 51, type: 'termination',  requestDate: '2026-01-17', lastWorkingDate: '2026-01-17', salaryHoldUntil: null,          name: 'Ajeet Yadav' },
  { userId: 17, type: 'resignation',  requestDate: '2026-01-10', lastWorkingDate: '2026-03-31', salaryHoldUntil: null,          name: 'Shailesh Naik' },
];

async function main() {
  let created = 0, skipped = 0, errors = 0;

  for (const sep of SEPARATIONS) {
    try {
      // Skip if already exists
      const existing = await prisma.separation.findUnique({ where: { userId: sep.userId } });
      if (existing) {
        console.log(`  SKIP  ${sep.name} — separation already exists (id ${existing.id})`);
        skipped++;
        continue;
      }

      // Get salary structure for daily rate calculation
      const ss = await prisma.salaryStructure.findUnique({ where: { userId: sep.userId } });
      let grossMonthly = 0;
      if (ss) {
        const fieldSum = (ss.basic||0)+(ss.hra||0)+(ss.da||0)+(ss.specialAllowance||0)+(ss.medicalAllowance||0)+(ss.conveyanceAllowance||0)+(ss.otherAllowance||0);
        const componentSum = Array.isArray(ss.components)
          ? ss.components.filter(c => c.type === 'earning').reduce((s, c) => s + (c.amount||0), 0)
          : 0;
        grossMonthly = ss.grossEarnings || Math.max(fieldSum, componentSum) || 0;
      }
      const dailyRate = grossMonthly > 0 ? grossMonthly / 30 : 0;

      // Create separation record (status: fnf_pending — clearance done, FnF ready to calculate)
      const today = new Date().toISOString().slice(0, 10);
      const record = await prisma.separation.create({
        data: {
          userId:           sep.userId,
          type:             sep.type,
          requestDate:      sep.requestDate,
          expectedLWD:      sep.lastWorkingDate,  // historical: expected = actual
          lastWorkingDate:  sep.lastWorkingDate,
          salaryHoldUntil:  sep.salaryHoldUntil,
          salaryHoldDays:   30,
          status:           'fnf_pending',
          initiatedBy:      'hr',
          reason:           'Historical separation record',
          leavesBlocked:    true,
          leavesBlockedAt:  new Date(),
          hrConfirmedAt:    sep.lastWorkingDate,
          hrConfirmedBy:    1,  // admin
          managerApprovedAt: sep.requestDate,
          managerApprovedBy: 1,
        },
      });

      // Create checklist — all marked done (historical, clearance assumed complete)
      await prisma.separationChecklist.createMany({
        data: DEFAULT_CHECKLIST.map(t => ({
          separationId: record.id,
          department:   t.department,
          task:         t.task,
          sortOrder:    t.sortOrder,
          status:       'done',
          completedAt:  sep.lastWorkingDate,
        })),
      });

      // Create salary hold breakdown if gross is known
      if (dailyRate > 0 && sep.lastWorkingDate) {
        const holds = buildSalaryHoldBreakdown(sep.lastWorkingDate, dailyRate, 30);
        await prisma.separationSalaryHold.createMany({
          data: holds.map(h => ({ separationId: record.id, ...h })),
        });
      }

      console.log(`  OK    ${sep.name} (id ${record.id}) — LWD: ${sep.lastWorkingDate}, hold until: ${sep.salaryHoldUntil || 'TBD'}, gross: ₹${grossMonthly}`);
      created++;
    } catch (err) {
      console.error(`  ERROR ${sep.name}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors} errors`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
