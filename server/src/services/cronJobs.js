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
const { runSeparationAlert }        = require('./notifications/separationAlertService');
const { runConfirmationAlerts }     = require('./notifications/confirmationAlertService');
const { runComplianceAlerts }       = require('./notifications/complianceAlertService');
const { runRenewalAlerts }          = require('./notifications/renewalAlertService');
const { scanAllMailForRenewals }    = require('./gmailRenewalScanner');

const { syncAllDevices } = require('./biometric/biometricSyncService');
const { executeFYRollover, getFinancialYear } = require('./leave/leaveService');

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
      const result = await scanAllMailForRenewals(prisma, adminToken.userId);
      console.log(`[CRON] Gmail renewal scan complete: ${result.newFound} new renewal email(s) found.`);
    } catch (err) {
      console.error('[CRON] Gmail renewal scan failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Gmail renewal scan scheduled: 30 8 * * 1 (8:30 AM IST every Monday)');

  // ─── EmailHandledThread Cleanup: midnight daily — delete records older than 3 days ───
  cron.schedule('0 0 * * *', async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 3);
      const cutoffDate = cutoff.toISOString().split('T')[0];
      const { count } = await prisma.emailHandledThread.deleteMany({
        where: { date: { lt: cutoffDate } },
      });
      if (count > 0) console.log(`[CRON] Cleaned up ${count} old EmailHandledThread records (before ${cutoffDate})`);
    } catch (err) {
      console.error('[CRON] EmailHandledThread cleanup failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> EmailHandledThread cleanup scheduled: 0 0 * * * (midnight IST daily)');

  // ─── Biometric Sync: every 5 minutes during work hours (7 AM - 10 PM, Mon-Sat IST) ───
  // Fetches punch data from eSSL devices using credentials stored in BiometricDevice DB model.
  // Only works when server can reach the device (local dev server on same LAN, or device on VPN/public IP).
  // On Vercel (can't reach LAN device), each device sync fails gracefully and continues to next.
  cron.schedule('*/5 7-22 * * 1-6', async () => {
    try {
      const result = await syncAllDevices(prisma);
      if (result.synced > 0 || result.failed > 0) {
        console.log(`[CRON] Biometric sync: ${result.synced} synced, ${result.skipped} skipped, ${result.failed} failed`);
      }
    } catch (err) {
      console.error('[CRON] Biometric sync failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Biometric sync scheduled: */5 7-22 * * 1-6 (every 5 min, 7 AM-10 PM IST, Mon-Sat)');

  // ─── BiometricPunch Cleanup: 2 AM daily — delete punches older than 7 days from Neon ───
  // Data is safe forever in cpserver SQL Server. Only Neon copies are removed to save space.
  cron.schedule('0 2 * * *', async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffDate = cutoff.toISOString().slice(0, 10);
      const { count } = await prisma.biometricPunch.deleteMany({
        where: { punchDate: { lt: cutoffDate } },
      });
      if (count > 0) console.log(`[CRON] BiometricPunch cleanup: deleted ${count} records older than ${cutoffDate} from Neon (data safe in cpserver SQL)`);
    } catch (err) {
      console.error('[CRON] BiometricPunch cleanup failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> BiometricPunch cleanup scheduled: 0 2 * * * (2 AM IST daily, keeps last 7 days)');

  // ─── Automation Analysis: Sunday 11:00 PM IST — weekly analysis of recurring tasks ───
  const { runAutomationAnalysis } = require('./automationAnalyzer');
  cron.schedule('0 23 * * 0', async () => {
    try {
      console.log('[CRON] Starting weekly automation analysis...');
      const result = await runAutomationAnalysis(prisma, { triggeredBy: 'cron', periodDays: 30 });
      console.log(`[CRON] Automation analysis complete: ${result.insightsCreated} insights from ${result.totalTasks} tasks (${result.durationMs}ms)`);
    } catch (err) {
      console.error('[CRON] Automation analysis failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Automation analysis scheduled: 0 23 * * 0 (Sunday 11:00 PM IST)');

  // ─── FY Rollover: March 31, 11:55 PM IST — carry forward unused leaves ───
  cron.schedule('55 23 31 3 *', async () => {
    try {
      const currentFY = getFinancialYear();
      console.log(`[CRON] Starting FY rollover for FY ${currentFY}...`);
      const summary = await executeFYRollover(currentFY, prisma);
      const totalCarry = summary.reduce((s, r) => s + r.carryForward, 0);
      const totalLapsed = summary.reduce((s, r) => s + r.lapsed, 0);
      console.log(`[CRON] FY rollover complete: ${summary.length} entries, ${totalCarry} days carried, ${totalLapsed} days lapsed`);
    } catch (err) {
      console.error('[CRON] FY rollover failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> FY rollover scheduled: 55 23 31 3 * (March 31 at 11:55 PM IST)');

  // ── Monthly Ledger Auto-Generation: 12:01 AM on 1st of every month IST ─────
  // Calculates previous month string and generates MonthlyLedger for all active users with activity
  cron.schedule('1 0 1 * *', async () => {
    try {
      const now = new Date();
      // Previous month: subtract 1 from current month
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      const fromDate = `${month}-01`;
      const lastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
      const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;

      const expenseUserIds = await prisma.expenseClaim.findMany({
        where: { date: { gte: fromDate, lte: toDate } }, select: { userId: true }, distinct: ['userId'],
      });
      const fundUserIds = await prisma.fundRequest.findMany({
        where: { OR: [{ disbursedOn: { gte: fromDate, lte: toDate } }, { date: { gte: fromDate, lte: toDate } }] },
        select: { requestedBy: true }, distinct: ['requestedBy'],
      });
      const allUserIds = [...new Set([...expenseUserIds.map(e => e.userId), ...fundUserIds.map(f => f.requestedBy)])];

      let generated = 0;
      for (const uid of allUserIds) {
        const [yearNum, monNum] = month.split('-').map(Number);
        const prevMonthDate = new Date(yearNum, monNum - 1, 0);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const prevLedger = await prisma.monthlyLedger.findUnique({ where: { userId_month: { userId: uid, month: prevMonthStr } } });
        let openingBalance = 0;
        if (prevLedger) {
          openingBalance = prevLedger.closingBalance;
        } else {
          const fundBalance = await prisma.employeeFundBalance.findUnique({ where: { userId: uid } });
          openingBalance = fundBalance?.openingBalance || 0;
        }

        const advances = await prisma.fundRequest.findMany({
          where: { requestedBy: uid, type: 'advance', status: { in: ['disbursed', 'acknowledged', 'settled'] }, disbursedOn: { gte: fromDate, lte: toDate } },
          orderBy: { disbursedOn: 'asc' },
        });
        const expenses = await prisma.expenseClaim.findMany({
          where: { userId: uid, status: { in: ['approved', 'paid', 'pending'] }, date: { gte: fromDate, lte: toDate } },
          orderBy: { date: 'asc' },
        });
        const reimbursements = await prisma.fundRequest.findMany({
          where: { requestedBy: uid, type: 'reimbursement', status: { in: ['approved', 'disbursed', 'settled'] }, date: { gte: fromDate, lte: toDate } },
          orderBy: { date: 'asc' },
        });
        const incomeEntries = await prisma.fundRequest.findMany({
          where: { requestedBy: uid, type: 'income', status: 'acknowledged', date: { gte: fromDate, lte: toDate } },
          orderBy: { date: 'asc' },
        });
        const adjustments = await prisma.ledgerAdjustment.findMany({ where: { userId: uid, month }, orderBy: { date: 'asc' } });

        const entries = [];
        entries.push({ date: fromDate, entryType: 'opening', description: 'Opening Balance', moneyIn: openingBalance > 0 ? openingBalance : 0, moneyOut: openingBalance < 0 ? Math.abs(openingBalance) : 0, amount: openingBalance, ref: 'OPENING' });
        advances.forEach(fr => entries.push({ date: fr.disbursedOn || fr.date, entryType: 'advance', description: `Advance: ${fr.title}`, moneyIn: fr.disbursedAmount || 0, moneyOut: 0, amount: fr.disbursedAmount || 0, ref: `FR-${fr.id}` }));
        reimbursements.forEach(fr => entries.push({ date: fr.disbursedOn || fr.date, entryType: 'reimbursement', description: `Reimbursement: ${fr.title}`, moneyIn: fr.disbursedAmount || fr.amount || 0, moneyOut: 0, amount: fr.disbursedAmount || fr.amount || 0, ref: `FR-${fr.id}` }));
        incomeEntries.forEach(fr => entries.push({ date: fr.date, entryType: 'income', description: `Income: ${fr.title}`, moneyIn: fr.amount, moneyOut: 0, amount: fr.amount, ref: `FR-${fr.id}` }));
        expenses.forEach(e => entries.push({ date: e.date, entryType: 'expense', description: `Expense: ${e.title} (${e.category})`, moneyIn: 0, moneyOut: e.amount, amount: -e.amount, ref: `EXP-${e.id}` }));
        adjustments.forEach(adj => entries.push({ date: adj.date, entryType: adj.amount >= 0 ? 'adjustment_in' : 'adjustment_out', description: `Adjustment: ${adj.description}`, moneyIn: adj.amount > 0 ? adj.amount : 0, moneyOut: adj.amount < 0 ? Math.abs(adj.amount) : 0, amount: adj.amount, ref: `ADJ-${adj.id}` }));

        entries.sort((a, b) => {
          if (a.entryType === 'opening') return -1;
          if (b.entryType === 'opening') return 1;
          const cmp = a.date.localeCompare(b.date);
          if (cmp !== 0) return cmp;
          if (a.moneyIn > 0 && b.moneyOut > 0) return -1;
          if (a.moneyOut > 0 && b.moneyIn > 0) return 1;
          return 0;
        });

        let bal = 0;
        entries.forEach(e => { bal += e.amount; e.balance = Math.round(bal * 100) / 100; });
        const totalIn = Math.round(entries.reduce((s, e) => s + e.moneyIn, 0) * 100) / 100;
        const totalOut = Math.round(entries.reduce((s, e) => s + e.moneyOut, 0) * 100) / 100;
        const closingBalance = Math.round(bal * 100) / 100;

        await prisma.monthlyLedger.upsert({
          where: { userId_month: { userId: uid, month } },
          create: { userId: uid, month, openingBalance, closingBalance, totalIn, totalOut, entries: JSON.stringify(entries) },
          update: { openingBalance, closingBalance, totalIn, totalOut, entries: JSON.stringify(entries), generatedAt: new Date() },
        });
        generated++;
      }
      console.log(`[CRON] Monthly ledger auto-generation complete: ${generated} ledger(s) generated for ${month}`);
    } catch (err) {
      console.error('[CRON] Monthly ledger auto-generation failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Monthly ledger auto-generation scheduled: 1 0 1 * * (1st of every month 12:01 AM IST)');

  // ── Contract signing token expiry — daily midnight IST ─────────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const expired = await prisma.companyContract.updateMany({
        where: { signingStatus: 'sent', signingTokenExpiresAt: { lt: today } },
        data: { signingStatus: 'expired' },
      });
      if (expired.count > 0) {
        console.log(`[CRON] Expired ${expired.count} contract signing token(s)`);
      }
    } catch (err) {
      console.error('[CRON] Contract token expiry check failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Contract signing token expiry: 0 0 * * * (daily midnight IST)');

  // ── Contract signing reminder — daily 10 AM IST ────────────────────────────
  cron.schedule('0 10 * * 1-6', async () => {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 16).replace('T', ' ');
      const pendingContracts = await prisma.companyContract.findMany({
        where: { signingStatus: 'sent', sentAt: { lt: threeDaysAgo } },
      });

      for (const contract of pendingContracts) {
        // Check if reminder already sent
        const existing = await prisma.contractSigningEvent.findFirst({
          where: { contractId: contract.id, eventType: 'reminder_sent' },
        });
        if (existing) continue;

        if (contract.externalSignerEmail && contract.signingToken) {
          const signingUrl = `https://eod.colorpapers.in/sign/${contract.signingToken}`;
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #d97706; color: white; padding: 20px; text-align: center;">
                <h2 style="margin: 0;">Reminder: Contract Pending Signature</h2>
              </div>
              <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
                <p>Dear <strong>${contract.externalSignerName}</strong>,</p>
                <p>This is a friendly reminder that the contract <strong>"${contract.name}"</strong> is still awaiting your signature.</p>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${signingUrl}" style="background: #1e40af; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Review & Sign Contract
                  </a>
                </div>
                <p style="color: #64748b; font-size: 13px;">This link expires on ${contract.signingTokenExpiresAt}.</p>
              </div>
            </div>
          `;
          try {
            const { sendEmail } = require('./notifications/emailService');
            await sendEmail(contract.externalSignerEmail, `Reminder: Pending Contract — ${contract.name}`, html);
            await prisma.contractSigningEvent.create({
              data: { contractId: contract.id, eventType: 'reminder_sent', performedBy: 'System (cron)' },
            });
          } catch (e) {
            console.error(`[CRON] Failed to send contract reminder for ${contract.name}:`, e.message);
          }
        }
      }
    } catch (err) {
      console.error('[CRON] Contract signing reminder failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('  -> Contract signing reminder: 0 10 * * 1-6 (Mon-Sat 10 AM IST)');
}

module.exports = { initCronJobs };
