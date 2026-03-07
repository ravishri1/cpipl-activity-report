const cron = require('node-cron');
const { runFirstReminder, runEscalation } = require('./notifications/reminderService');
const { fetchAndStoreEmailActivity } = require('./google/googleWorkspace');
const { fetchAndStoreChatActivity } = require('./google/googleChat');
const { runHibernationCheck } = require('./hibernation');
const { runOverdueRepairCheck } = require('./notifications/repairAlertService');
const { runWarrantyExpiryCheck } = require('./notifications/warrantyAlertService');
const { runBirthdayAnniversaryCheck } = require('./notifications/birthdayAnniversaryService');
const { runPayrollReminderCheck } = require('./notifications/payrollReminderService');
const { runPendingApprovalsCheck } = require('./notifications/pendingApprovalsService');
const { runProbationEndCheck }     = require('./notifications/probationAlertService');
const { runPassportExpiryCheck }   = require('./notifications/passportAlertService');
const { runInsuranceExpiryCheck }  = require('./notifications/insuranceAlertService');
const { runOnboardingOverdueCheck } = require('./notifications/onboardingOverdueService');
const { runTrainingDeadlineCheck }  = require('./notifications/trainingDeadlineService');
const { runSeparationAlert }        = require('./notifications/separationAlertService');
const { runConfirmationAlerts }     = require('./notifications/confirmationAlertService');
const { runComplianceAlerts }       = require('./notifications/complianceAlertService');
const { runRenewalAlerts }          = require('./notifications/renewalAlertService');
const { scanInboxForRenewals }      = require('./gmailRenewalScanner');

function initCronJobs(prisma) {
  const reminderHour = process.env.REMINDER_TIME_HOUR || 21;
  const reminderMinute = process.env.REMINDER_TIME_MINUTE || 0;
  const escalationHour = process.env.ESCALATION_TIME_HOUR || 11;
  const escalationMinute = process.env.ESCALATION_TIME_MINUTE || 0;

  // First reminder: 9:00 PM daily (Mon-Sat)
  const reminderCron = `${reminderMinute} ${reminderHour} * * 1-6`;
  cron.schedule(reminderCron, async () => {
    console.log(`[CRON] First reminder triggered at ${new Date().toLocaleString()}`);
    try {
      await runFirstReminder(prisma);
    } catch (err) {
      console.error('[CRON] First reminder failed:', err);
    }
  });
  console.log(`  -> First reminder scheduled: ${reminderCron} (${reminderHour}:${String(reminderMinute).padStart(2, '0')} Mon-Sat)`);

  // Escalation: 11:00 AM next morning (Mon-Sat)
  const escalationCron = `${escalationMinute} ${escalationHour} * * 1-6`;
  cron.schedule(escalationCron, async () => {
    console.log(`[CRON] Escalation triggered at ${new Date().toLocaleString()}`);
    try {
      await runEscalation(prisma);
    } catch (err) {
      console.error('[CRON] Escalation failed:', err);
    }
  });
  console.log(`  -> Escalation scheduled: ${escalationCron} (${escalationHour}:${String(escalationMinute).padStart(2, '0')} Mon-Sat)`);

  // Email activity fetch: 6:00 AM daily (Mon-Sat)
  // Reports API has 2-day delay, so we fetch for date = today - 2
  cron.schedule('0 6 * * 1-6', async () => {
    console.log(`[CRON] Email activity fetch triggered at ${new Date().toLocaleString()}`);
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const date = twoDaysAgo.toISOString().split('T')[0];
      await fetchAndStoreEmailActivity(prisma, date);
    } catch (err) {
      console.error('[CRON] Email activity fetch failed:', err);
    }
  });
  console.log('  -> Email activity fetch scheduled: 0 6 * * 1-6 (06:00 Mon-Sat)');

  // Chat activity fetch: 6:05 AM daily (Mon-Sat)
  // Reports API has 2-day delay, same as email
  cron.schedule('5 6 * * 1-6', async () => {
    console.log(`[CRON] Chat activity fetch triggered at ${new Date().toLocaleString()}`);
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const date = twoDaysAgo.toISOString().split('T')[0];
      await fetchAndStoreChatActivity(prisma, date);
    } catch (err) {
      console.error('[CRON] Chat activity fetch failed:', err);
    }
  });
  console.log('  -> Chat activity fetch scheduled: 5 6 * * 1-6 (06:05 Mon-Sat)');

  // Auto-hibernation check: 2:00 AM daily
  // Hibernates accounts with 3+ consecutive inactive days (excluding leave/holidays)
  cron.schedule('0 2 * * *', async () => {
    console.log(`[CRON] Hibernation check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runHibernationCheck(prisma);
      console.log(`[CRON] Hibernation check complete: ${count} user(s) hibernated.`);
    } catch (err) {
      console.error('[CRON] Hibernation check failed:', err);
    }
  });
  console.log('  -> Hibernation check scheduled: 0 2 * * * (02:00 daily)');

  // Overdue repair check: 9:00 AM daily (Mon-Sat)
  // Finds active AssetRepairs past their expectedReturnDate, updates daysOverdue, emails admins
  cron.schedule('0 9 * * 1-6', async () => {
    console.log(`[CRON] Overdue repair check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runOverdueRepairCheck(prisma);
      console.log(`[CRON] Overdue repair check complete: ${count} overdue repair(s) found.`);
    } catch (err) {
      console.error('[CRON] Overdue repair check failed:', err);
    }
  });
  console.log('  -> Overdue repair check scheduled: 0 9 * * 1-6 (09:00 Mon-Sat)');

  // Warranty expiry check: 8:30 AM daily (Mon-Sat)
  // Alerts at 30, 14, 7, 1 day(s) before each asset's warrantyExpiry date
  cron.schedule('30 8 * * 1-6', async () => {
    console.log(`[CRON] Warranty expiry check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runWarrantyExpiryCheck(prisma);
      console.log(`[CRON] Warranty expiry check complete: ${count} asset(s) at expiry milestone today.`);
    } catch (err) {
      console.error('[CRON] Warranty expiry check failed:', err);
    }
  });
  console.log('  -> Warranty expiry check scheduled: 30 8 * * 1-6 (08:30 Mon-Sat)');

  // Birthday & work anniversary check: 8:00 AM daily (Mon-Sat)
  // Finds active employees whose birthday or work-joining anniversary is today
  cron.schedule('0 8 * * 1-6', async () => {
    console.log(`[CRON] Birthday/anniversary check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runBirthdayAnniversaryCheck(prisma);
      console.log(`[CRON] Birthday/anniversary check complete: ${count} celebration(s) found today.`);
    } catch (err) {
      console.error('[CRON] Birthday/anniversary check failed:', err);
    }
  });
  console.log('  -> Birthday/anniversary check scheduled: 0 8 * * 1-6 (08:00 Mon-Sat)');

  // Payroll processing reminder: 8:00 AM on the 25th of every month
  // Checks if all active/notice-period employees have payslips generated for the current month
  cron.schedule('0 8 25 * *', async () => {
    console.log(`[CRON] Payroll reminder check triggered at ${new Date().toLocaleString()}`);
    try {
      const missing = await runPayrollReminderCheck(prisma);
      console.log(`[CRON] Payroll reminder check complete: ${missing} payslip(s) still pending.`);
    } catch (err) {
      console.error('[CRON] Payroll reminder check failed:', err);
    }
  });
  console.log('  -> Payroll reminder scheduled: 0 8 25 * * (25th of each month at 08:00)');

  // Pending approvals digest: 9:15 AM daily (Mon-Sat)
  // Sends consolidated action-digest of all pending LeaveRequests + ExpenseClaims to admins
  cron.schedule('15 9 * * 1-6', async () => {
    console.log(`[CRON] Pending approvals check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runPendingApprovalsCheck(prisma);
      console.log(`[CRON] Pending approvals check complete: ${count} pending item(s) found.`);
    } catch (err) {
      console.error('[CRON] Pending approvals check failed:', err);
    }
  });
  console.log('  -> Pending approvals check scheduled: 15 9 * * 1-6 (09:15 Mon-Sat)');

  // Probation end date check: 8:45 AM daily (Mon-Sat)
  // Alerts at 14 and 7 days before an active employee's probationEndDate
  cron.schedule('45 8 * * 1-6', async () => {
    console.log(`[CRON] Probation end check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runProbationEndCheck(prisma);
      console.log(`[CRON] Probation end check complete: ${count} probation milestone(s) found.`);
    } catch (err) {
      console.error('[CRON] Probation end check failed:', err);
    }
  });
  console.log('  -> Probation end check scheduled: 45 8 * * 1-6 (08:45 Mon-Sat)');

  // Passport expiry check: 9:30 AM daily (Mon-Sat)
  // Alerts at 90, 60, 30, and 14 days before an active employee's passport expires
  cron.schedule('30 9 * * 1-6', async () => {
    console.log(`[CRON] Passport expiry check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runPassportExpiryCheck(prisma);
      console.log(`[CRON] Passport expiry check complete: ${count} passport milestone(s) found.`);
    } catch (err) {
      console.error('[CRON] Passport expiry check failed:', err);
    }
  });
  console.log('  -> Passport expiry check scheduled: 30 9 * * 1-6 (09:30 Mon-Sat)');

  // Insurance card expiry check: 9:45 AM daily (Mon-Sat)
  // Alerts at 60, 30, 14, and 7 days before an active insurance card's effectiveTo date
  cron.schedule('45 9 * * 1-6', async () => {
    console.log(`[CRON] Insurance expiry check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runInsuranceExpiryCheck(prisma);
      console.log(`[CRON] Insurance expiry check complete: ${count} insurance expiry milestone(s) found.`);
    } catch (err) {
      console.error('[CRON] Insurance expiry check failed:', err);
    }
  });
  console.log('  -> Insurance expiry check scheduled: 45 9 * * 1-6 (09:45 Mon-Sat)');

  // Onboarding overdue check: 10:00 AM daily (Mon-Sat)
  // Finds incomplete onboarding tasks past their dueDate for active employees
  cron.schedule('0 10 * * 1-6', async () => {
    console.log(`[CRON] Onboarding overdue check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runOnboardingOverdueCheck(prisma);
      console.log(`[CRON] Onboarding overdue check complete: ${count} overdue task(s) found.`);
    } catch (err) {
      console.error('[CRON] Onboarding overdue check failed:', err);
    }
  });
  console.log('  -> Onboarding overdue check scheduled: 0 10 * * 1-6 (10:00 Mon-Sat)');

  // Training assignment deadline check: 10:15 AM daily (Mon-Sat)
  // Finds incomplete assignments past their dueDate for active employees
  cron.schedule('15 10 * * 1-6', async () => {
    console.log(`[CRON] Training deadline check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runTrainingDeadlineCheck(prisma);
      console.log(`[CRON] Training deadline check complete: ${count} overdue assignment(s) found.`);
    } catch (err) {
      console.error('[CRON] Training deadline check failed:', err);
    }
  });
  console.log('  -> Training deadline check scheduled: 15 10 * * 1-6 (10:15 Mon-Sat)');

  // Separation last-working-day alert: 10:30 AM daily (Mon-Sat)
  // Alerts at 7, 3, and 1 day before an employee's lastWorkingDate
  cron.schedule('30 10 * * 1-6', async () => {
    console.log(`[CRON] Separation alert triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runSeparationAlert(prisma);
      console.log(`[CRON] Separation alert complete: ${count} last-working-day milestone(s) found.`);
    } catch (err) {
      console.error('[CRON] Separation alert failed:', err);
    }
  });
  console.log('  -> Separation last-day alert scheduled: 30 10 * * 1-6 (10:30 Mon-Sat)');

  // Confirmation due alerts: 10:45 AM daily (Mon-Sat)
  // Alerts employee + reporting manager when 6-month confirmation is due today
  cron.schedule('45 10 * * 1-6', async () => {
    console.log(`[CRON] Confirmation alerts triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runConfirmationAlerts(prisma);
      console.log(`[CRON] Confirmation alerts complete: ${count} alert(s) sent.`);
    } catch (err) {
      console.error('[CRON] Confirmation alerts failed:', err);
    }
  });
  console.log('  -> Confirmation due alert scheduled: 45 10 * * 1-6 (10:45 Mon-Sat)');

  // Compliance certificate renewal alerts: 10:00 AM daily (Mon-Sat)
  // Alerts admins about overdue certs and certs within each cert's reminderDays window
  cron.schedule('0 10 * * 1-6', async () => {
    console.log(`[CRON] Compliance alert triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runComplianceAlerts(prisma);
      console.log(`[CRON] Compliance alert complete: ${count} certificate(s) need attention.`);
    } catch (err) {
      console.error('[CRON] Compliance alert failed:', err);
    }
  });
  console.log('  -> Compliance certificate alert scheduled: 0 10 * * 1-6 (10:00 Mon-Sat)');

  // Renewal & subscription alerts: 9:00 AM IST daily (Mon-Sat)
  // Sends alerts for renewals due within their alertDaysBefore window
  cron.schedule('0 9 * * 1-6', async () => {
    console.log(`[CRON] Renewal alert triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runRenewalAlerts(prisma);
      console.log(`[CRON] Renewal alert complete: ${count} renewal(s) need attention.`);
    } catch (err) {
      console.error('[CRON] Renewal alert failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Renewal alert scheduled: 0 9 * * 1-6 (9:00 AM IST Mon-Sat)');

  // Gmail inbox scan for renewal emails: 8:30 AM every Monday
  cron.schedule('30 8 * * 1', async () => {
    console.log(`[CRON] Gmail renewal scan triggered at ${new Date().toLocaleString()}`);
    try {
      // Find an admin user with a Google token
      const adminToken = await prisma.googleToken.findFirst({
        include: { user: { select: { role: true, id: true } } },
      });
      if (!adminToken || !['admin', 'team_lead'].includes(adminToken.user.role)) {
        console.log('[CRON] Gmail scan skipped: no admin with Google token found.');
        return;
      }
      const result = await scanInboxForRenewals(prisma, adminToken.userId);
      console.log(`[CRON] Gmail renewal scan complete: ${result.newFound} new renewal email(s) found.`);
    } catch (err) {
      console.error('[CRON] Gmail renewal scan failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Gmail renewal scan scheduled: 30 8 * * 1 (8:30 AM IST every Monday)');
}

module.exports = { initCronJobs };
