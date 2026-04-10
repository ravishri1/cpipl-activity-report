/**
 * Delete employees who left before 2025-04-01 and all their connected data.
 * Run: node deleteOldEmployees.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const EMP_IDS = [
  'COLOR063', 'COLOR068', 'COLOR087', 'COLOR088', 'COLOR091',
  'COLOR093', 'COLOR098', 'COLOR104', 'COLOR106', 'COLOR107',
  'COLOR110', 'COLOR112', 'COLOR122', 'COLOR123', 'COLOR126',
  'COLOR129', 'COLOR131', 'COLOR132', 'COLOR133', 'COLOR138',
  'COLOR159', 'COLOR160'
];

// Safe wrapper — fn() is called inside try/catch so even synchronous
// errors from undefined model accessors are caught gracefully
async function tryDel(label, fn) {
  try {
    const r = await fn();
    const count = r?.count ?? (Array.isArray(r) ? r.length : 1);
    if (count > 0) console.log(`  ✓ ${label}: ${count}`);
  } catch (e) {
    const msg = (e.message || '').split('\n')[0];
    if (msg && !msg.includes('undefined') && !msg.includes('is not a function')) {
      console.log(`  ⚠ ${label}: ${msg}`);
    }
    // silently skip if model doesn't exist
  }
}

async function main() {
  // ── Step 1: Identify users ──────────────────────────────────────
  const users = await p.user.findMany({
    where: { employeeId: { in: EMP_IDS } },
    select: { id: true, employeeId: true, name: true },
  });

  console.log(`\nFound ${users.length} users in DB:`);
  users.forEach(u => console.log(`  ${u.employeeId}  ${u.name}  (id: ${u.id})`));

  const notFound = EMP_IDS.filter(e => !users.find(u => u.employeeId === e));
  if (notFound.length) console.log(`Not in DB (already removed): ${notFound.join(', ')}`);
  if (users.length === 0) { console.log('\nNothing to delete.'); return; }

  const uids = users.map(u => u.id);
  const W = { userId: { in: uids } };

  console.log(`\nDeleting connected data for ${uids.length} users...`);

  // ── Step 2: Nullify nullable reviewer/assignee references ────────
  console.log('\n[Nullify references to these employees in other records]');
  await tryDel('LeaveRequest.reviewedBy',        () => p.leaveRequest.updateMany({ where: { reviewedBy: { in: uids } },             data: { reviewedBy: null } }));
  await tryDel('ExpenseClaim.reviewedBy',         () => p.expenseClaim.updateMany({ where: { reviewedBy: { in: uids } },             data: { reviewedBy: null } }));
  await tryDel('CompOffRequest.reviewedBy',       () => p.compOffRequest.updateMany({ where: { reviewedBy: { in: uids } },           data: { reviewedBy: null } }));
  await tryDel('WFHRequest.reviewedBy',           () => p.wFHRequest.updateMany({ where: { reviewedBy: { in: uids } },               data: { reviewedBy: null } }));
  await tryDel('Ticket.assignedTo',               () => p.ticket.updateMany({ where: { assignedTo: { in: uids } },                   data: { assignedTo: null } }));
  await tryDel('PortalCredential.assignedTo',     () => p.portalCredential.updateMany({ where: { assignedTo: { in: uids } },         data: { assignedTo: null } }));
  await tryDel('Separation.processedBy',          () => p.separation.updateMany({ where: { processedBy: { in: uids } },              data: { processedBy: null } }));
  await tryDel('ConfirmationExtension.extendedBy',() => p.confirmationExtension.updateMany({ where: { extendedBy: { in: uids } },    data: { extendedBy: null } }));
  await tryDel('FundRequest.reviewedBy',          () => p.fundRequest.updateMany({ where: { reviewedBy: { in: uids } },              data: { reviewedBy: null } }));
  await tryDel('AssetHandover.toUserId',          () => p.assetHandover.updateMany({ where: { toUserId: { in: uids } },              data: { toUserId: null, receivedBy: null } }));
  await tryDel('AssetHandover.receivedBy',        () => p.assetHandover.updateMany({ where: { receivedBy: { in: uids } },            data: { receivedBy: null } }));
  await tryDel('GeneratedLetter.generatedBy',     () => p.generatedLetter.updateMany({ where: { generatedBy: { in: uids } },         data: { generatedBy: null } }));
  await tryDel('Goal.managerId',                  () => p.goal.updateMany({ where: { managerId: { in: uids } },                      data: { managerId: null } }));
  await tryDel('CandidateInterview.conductedBy',  () => p.candidateInterview.updateMany({ where: { conductedBy: { in: uids } },      data: { conductedBy: null } }));
  await tryDel('Candidate.referredBy',            () => p.candidate.updateMany({ where: { referredBy: { in: uids } },                data: { referredBy: null } }));
  await tryDel('EmailScan.reviewedBy',            () => p.emailScan.updateMany({ where: { reviewedBy: { in: uids } },                data: { reviewedBy: null } }));
  await tryDel('PortalCredentialHistory.changedBy',() => p.portalCredentialHistory.updateMany({ where: { changedBy: { in: uids } },  data: { changedBy: null } }));
  await tryDel('RenewalHistory.performedBy',      () => p.renewalHistory.updateMany({ where: { performedBy: { in: uids } },          data: { performedBy: null } }));
  await tryDel('PointLog.givenBy',                () => p.pointLog.updateMany({ where: { givenBy: { in: uids } },                    data: { givenBy: null } }));
  await tryDel('Appraisal.reviewerId',            () => p.appraisal.updateMany({ where: { reviewerId: { in: uids } },                data: { reviewerId: null } }));
  await tryDel('OfferLetter.generatedBy',         () => p.offerLetter.updateMany({ where: { generatedBy: { in: uids } },             data: { generatedBy: null } }));

  // ── Step 3: Delete ticket comments by these employees on other tickets ──
  console.log('\n[Delete ticket comments by these employees]');
  await tryDel('TicketComment (by employee)', () => p.ticketComment.deleteMany({ where: W }));

  // ── Step 4: Delete all employee-owned records ────────────────────
  console.log('\n[Delete employee-owned data]');

  // Reports
  const reportIds = await p.dailyReport.findMany({ where: W, select: { id: true } }).then(r => r.map(x => x.id));
  if (reportIds.length) {
    await tryDel('ReportTask',   () => p.reportTask.deleteMany({ where: { reportId: { in: reportIds } } }));
    await tryDel('DailyReport',  () => p.dailyReport.deleteMany({ where: { id: { in: reportIds } } }));
  }

  // Attendance & Leave
  await tryDel('Attendance',         () => p.attendance.deleteMany({ where: W }));
  await tryDel('LeaveRequest',       () => p.leaveRequest.deleteMany({ where: W }));
  await tryDel('LeaveBalance',       () => p.leaveBalance.deleteMany({ where: W }));
  await tryDel('LeaveGranter',       () => p.leaveGranter.deleteMany({ where: W }));
  await tryDel('CompOffRequest',     () => p.compOffRequest.deleteMany({ where: W }));
  await tryDel('WFHRequest',         () => p.wFHRequest.deleteMany({ where: W }));
  await tryDel('OvertimeRequest',    () => p.overtimeRequest.deleteMany({ where: W }));
  await tryDel('PunchRecord',        () => p.punchRecord.deleteMany({ where: W }));

  // HR Profile
  await tryDel('Education',          () => p.education.deleteMany({ where: W }));
  await tryDel('FamilyMember',       () => p.familyMember.deleteMany({ where: W }));
  await tryDel('PreviousEmployment', () => p.previousEmployment.deleteMany({ where: W }));
  await tryDel('EmployeeDocument',   () => p.employeeDocument.deleteMany({ where: W }));
  await tryDel('ProfileChangeLog',   () => p.profileChangeLog.deleteMany({ where: W }));
  await tryDel('InsuranceCard',      () => p.insuranceCard.deleteMany({ where: W }));
  await tryDel('ConfirmationExtension', () => p.confirmationExtension.deleteMany({ where: W }));
  await tryDel('ExitInterview',      () => p.exitInterview.deleteMany({ where: W }));

  // Payroll & Finance
  await tryDel('SalaryStructure',    () => p.salaryStructure.deleteMany({ where: W }));
  await tryDel('Payslip',            () => p.payslip.deleteMany({ where: W }));
  await tryDel('SalaryRevision',     () => p.salaryRevision.deleteMany({ where: W }));
  await tryDel('PayrollArrear',      () => p.payrollArrear.deleteMany({ where: W }));
  await tryDel('EmployeeFundBalance',() => p.employeeFundBalance.deleteMany({ where: W }));
  await tryDel('FundRequest',        () => p.fundRequest.deleteMany({ where: { requestedBy: { in: uids } } }));

  // Expenses
  const expIds = await p.expenseClaim.findMany({ where: W, select: { id: true } }).then(r => r.map(x => x.id));
  if (expIds.length) {
    await tryDel('ExpenseApprovalLog', () => p.expenseApprovalLog.deleteMany({ where: { expenseClaimId: { in: expIds } } }));
    await tryDel('ExpenseClaim',       () => p.expenseClaim.deleteMany({ where: { id: { in: expIds } } }));
  }

  // Assets
  await tryDel('AssetAssignment',    () => p.assetAssignment.deleteMany({ where: W }));
  await tryDel('AssetHandover (from)', () => p.assetHandover.deleteMany({ where: { fromUserId: { in: uids } } }));

  // Letters & Files
  await tryDel('GeneratedLetter',    () => p.generatedLetter.deleteMany({ where: W }));
  await tryDel('DriveFile',          () => p.driveFile.deleteMany({ where: W }));

  // Lifecycle
  await tryDel('OnboardingChecklist',() => p.onboardingChecklist.deleteMany({ where: W }));
  await tryDel('Separation',         () => p.separation.deleteMany({ where: W }));

  // Google & Communication
  await tryDel('GoogleToken',        () => p.googleToken.deleteMany({ where: W }));
  await tryDel('EmailActivity',      () => p.emailActivity.deleteMany({ where: W }));
  await tryDel('ChatActivity',       () => p.chatActivity.deleteMany({ where: W }));
  await tryDel('EmailHandledThread', () => p.emailHandledThread.deleteMany({ where: W }));
  await tryDel('Reminder',           () => p.reminder.deleteMany({ where: W }));

  // Engagement
  await tryDel('PointLog',           () => p.pointLog.deleteMany({ where: W }));
  await tryDel('ThumbsUp (given)',   () => p.thumbsUp.deleteMany({ where: { givenByUserId: { in: uids } } }));
  await tryDel('ThumbsUp (received)',() => p.thumbsUp.deleteMany({ where: { receiverUserId: { in: uids } } }));
  await tryDel('Appreciation (given)',    () => p.appreciation.deleteMany({ where: { giverId: { in: uids } } }));
  await tryDel('Appreciation (received)',() => p.appreciation.deleteMany({ where: { receiverId: { in: uids } } }));
  await tryDel('AppreciationBudget', () => p.appreciationBudget.deleteMany({ where: W }));
  await tryDel('SurveyResponse',     () => p.surveyResponse.deleteMany({ where: W }));
  await tryDel('PolicyAcceptance',   () => p.policyAcceptance.deleteMany({ where: W }));
  await tryDel('OtpVerification',    () => p.otpVerification.deleteMany({ where: W }));
  await tryDel('Suggestion',         () => p.suggestion.deleteMany({ where: W }));

  // Tickets owned by employee
  const ticketIds = await p.ticket.findMany({ where: W, select: { id: true } }).then(r => r.map(x => x.id));
  if (ticketIds.length) {
    await tryDel('TicketComment (on employee tickets)', () => p.ticketComment.deleteMany({ where: { ticketId: { in: ticketIds } } }));
    await tryDel('Ticket',           () => p.ticket.deleteMany({ where: { id: { in: ticketIds } } }));
  }

  // Appraisal & Goals
  await tryDel('GoalCheckIn',        () => p.goalCheckIn.deleteMany({ where: W }));
  await tryDel('Goal',               () => p.goal.deleteMany({ where: W }));
  await tryDel('Appraisal',          () => p.appraisal.deleteMany({ where: { employeeId: { in: uids } } }));

  // Grievance
  await tryDel('GrievanceComment',   () => p.grievanceComment.deleteMany({ where: { userId: { in: uids } } }));
  await tryDel('Grievance',          () => p.grievance.deleteMany({ where: { userId: { in: uids } } }));

  // ── Step 5: Delete the User records ─────────────────────────────
  console.log('\n[Delete User records]');
  const deleted = await p.user.deleteMany({ where: { id: { in: uids } } });
  console.log(`  ✓ Users deleted: ${deleted.count}`);

  console.log('\n✅ Done. All data for pre-FY2025 leavers removed.');
}

main()
  .catch(e => console.error('\n❌ Fatal error:', e.message))
  .finally(() => p.$disconnect());
