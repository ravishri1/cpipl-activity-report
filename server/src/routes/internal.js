const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const INTERNAL_KEY = 'cpdesk-eod-sync-2026';

// ─── Cron auth helper ──────────────────────────────────────────────────────
// Vercel Cron sends:  Authorization: Bearer <CRON_SECRET>
// Local dev can use:  x-internal-key: <INTERNAL_KEY>  OR the same CRON_SECRET
function isCronAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  // Vercel Cron header
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  // Legacy internal key (local dev / CPDesk)
  if (req.headers['x-internal-key'] === INTERNAL_KEY) return true;
  return false;
}

// "2026-03-31" → "31/03/2026"
function toIndianDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// GET /internal/staff/active — CPDesk integration
router.get('/staff/active', asyncHandler(async (req, res) => {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const users = await req.prisma.user.findMany({
    where: { isActive: true },
    select: {
      email: true,
      name: true,
      employeeId: true,
      separation: { select: { lastWorkingDate: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    users: users.map(u => ({
      email_for_work: u.email,
      name: u.name,
      employee_code: u.employeeId,
      last_date_of_working: toIndianDate(u.separation?.lastWorkingDate),
    })),
  });
}));

// GET /internal/companies/active — CPDesk company master data (LegalEntity + Registrations)
router.get('/companies/active', asyncHandler(async (req, res) => {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const entities = await req.prisma.legalEntity.findMany({
    orderBy: { legalName: 'asc' },
    select: {
      id: true,
      legalName: true,
      shortName: true,
      pan: true,
      tan: true,
      lei: true,
      registrations: {
        where: { isActive: true },
        orderBy: { officeCity: 'asc' },
        select: {
          id: true,
          abbr: true,
          gstin: true,
          officeCity: true,
          state: true,
          district: true,
          stateCode: true,
          placeType: true,
          address: true,
          fssai: true,
          udyam: true,
          iec: true,
        },
      },
    },
  });

  res.json({
    legal_entities: entities.map(e => ({
      id: e.id,
      legal_name: e.legalName,
      short_name: e.shortName,
      pan: e.pan,
      tan: e.tan,
      lei: e.lei,
      registrations: e.registrations.map(r => ({
        id: r.id,
        abbr: r.abbr,
        gstin: r.gstin,
        office_city: r.officeCity,
        state: r.state,
        district: r.district,
        state_code: r.stateCode,
        place_type: r.placeType,
        address: r.address,
        fssai: r.fssai,
        udyam: r.udyam,
        iec: r.iec,
      })),
    })),
  });
}));

/**
 * GET /api/internal/cron?job=<name>
 *
 * Vercel Cron trigger endpoint — replaces node-cron for production.
 *
 * Architecture pattern: Scheduled Function via HTTP.
 * node-cron does NOT run on Vercel serverless (functions are stateless and
 * ephemeral). Instead, Vercel Cron makes a GET request to this endpoint on
 * the configured UTC schedule. Each invocation is a fresh function call.
 *
 * Self-healing: If a job fails, the next scheduled invocation tries again
 * automatically. Individual job errors are caught per-step so one failing
 * alert doesn't skip the rest. The Vercel Cron dashboard logs every
 * invocation result for post-mortem analysis.
 *
 * Auth: Vercel sends  Authorization: Bearer <CRON_SECRET>
 * Set CRON_SECRET in Vercel Environment Variables → Production.
 *
 * Available jobs:
 *   reminders       — 9 PM IST Mon-Sat   → schedule: "30 15 * * 1-6"
 *   escalation      — 11 AM IST Mon-Sat  → schedule: "30 5 * * 1-6"
 *   morning-alerts  — 8-10 AM IST Mon-Sat → schedule: "30 2 * * 1-6"  (UTC)
 *   maintenance     — midnight IST daily  → schedule: "30 18 * * *"
 *   email-activity  — 6 AM IST Mon-Sat   → schedule: "30 0 * * 1-6"
 *   weekly          — Mon 8:30 AM IST    → schedule: "0 3 * * 1"
 *   automation      — Sun 11 PM IST      → schedule: "30 17 * * 0"
 *   fy-rollover     — Mar 31 11:55 PM IST → schedule: "25 18 31 3 *"
 *   auto-payroll    — 9th of month 9 AM IST → schedule: "30 3 9 * *"
 */
// Vercel Cron uses clean path routing (/cron/:job) — query strings not allowed in vercel.json
// Legacy/local dev still supports ?job= query param via the same handler
router.get(['/cron', '/cron/:job'], asyncHandler(async (req, res) => {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const job = req.params.job || req.query.job;
  if (!job) return res.status(400).json({ error: 'job query param required' });

  const prisma = req.prisma;
  const started = Date.now();
  const results = [];

  function log(msg) { results.push(msg); console.log(`[CRON:${job}] ${msg}`); }
  function warn(msg) { results.push(`WARN: ${msg}`); console.warn(`[CRON:${job}] ${msg}`); }

  try {
    // ── 9 PM IST reminder ────────────────────────────────────────────────
    if (job === 'reminders') {
      const { runFirstReminder } = require('../services/notifications/reminderService');
      const count = await runFirstReminder(prisma);
      log(`First reminder sent to ${count ?? 'N/A'} user(s).`);
    }

    // ── 11 AM IST escalation ─────────────────────────────────────────────
    else if (job === 'escalation') {
      const { runEscalation } = require('../services/notifications/reminderService');
      const count = await runEscalation(prisma);
      log(`Escalation sent to ${count ?? 'N/A'} user(s).`);
    }

    // ── Morning alert batch (8-10 AM IST, run as one job to reduce Vercel invocations)
    else if (job === 'morning-alerts') {
      const { runOverdueRepairCheck } = require('../services/notifications/repairAlertService');
      const { runWarrantyExpiryCheck } = require('../services/notifications/warrantyAlertService');
      const { runBirthdayAnniversaryCheck } = require('../services/notifications/birthdayAnniversaryService');
      const { runPayrollReminderCheck } = require('../services/notifications/payrollReminderService');
      const { runPendingApprovalsCheck } = require('../services/notifications/pendingApprovalsService');
      const { runProbationEndCheck } = require('../services/notifications/probationAlertService');
      const { runPassportExpiryCheck } = require('../services/notifications/passportAlertService');
      const { runInsuranceExpiryCheck } = require('../services/notifications/insuranceAlertService');
      const { runOnboardingOverdueCheck } = require('../services/notifications/onboardingOverdueService');
      const { runSeparationAlert } = require('../services/notifications/separationAlertService');
      const { runConfirmationAlerts } = require('../services/notifications/confirmationAlertService');
      const { runComplianceAlerts } = require('../services/notifications/complianceAlertService');
      const { runRenewalAlerts } = require('../services/notifications/renewalAlertService');

      // Run each alert independently — one failure doesn't stop the rest
      const steps = [
        ['overdue-repair', () => runOverdueRepairCheck(prisma)],
        ['warranty-expiry', () => runWarrantyExpiryCheck(prisma)],
        ['birthday-anniversary', () => runBirthdayAnniversaryCheck(prisma)],
        ['payroll-reminder', () => runPayrollReminderCheck(prisma)],
        ['pending-approvals', () => runPendingApprovalsCheck(prisma)],
        ['probation-end', () => runProbationEndCheck(prisma)],
        ['passport-expiry', () => runPassportExpiryCheck(prisma)],
        ['insurance-expiry', () => runInsuranceExpiryCheck(prisma)],
        ['onboarding-overdue', () => runOnboardingOverdueCheck(prisma)],
        ['separation-alert', () => runSeparationAlert(prisma)],
        ['confirmation-alerts', () => runConfirmationAlerts(prisma)],
        ['compliance-alerts', () => runComplianceAlerts(prisma)],
        ['renewal-alerts', () => runRenewalAlerts(prisma)],
      ];

      for (const [name, fn] of steps) {
        try {
          const count = await fn();
          log(`${name}: ${count ?? 0} item(s)`);
        } catch (err) {
          warn(`${name} failed: ${err.message}`);
        }
      }
    }

    // ── Nightly maintenance ────────────────────────────────────────────────
    else if (job === 'maintenance') {
      const { runHibernationCheck } = require('../services/hibernation');

      // Hibernation check
      try {
        const count = await runHibernationCheck(prisma);
        log(`Hibernation: ${count} user(s) hibernated.`);
      } catch (err) { warn(`hibernation: ${err.message}`); }

      // EmailHandledThread cleanup (older than 3 days)
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 3);
        const cutoffDate = cutoff.toISOString().split('T')[0];
        const { count } = await prisma.emailHandledThread.deleteMany({
          where: { date: { lt: cutoffDate } },
        });
        log(`EmailHandledThread cleanup: ${count} record(s) removed.`);
      } catch (err) { warn(`email-thread-cleanup: ${err.message}`); }

      // BiometricPunch cleanup (older than 7 days — data safe in cpserver SQL)
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffDate = cutoff.toISOString().slice(0, 10);
        const { count } = await prisma.biometricPunch.deleteMany({
          where: { punchDate: { lt: cutoffDate } },
        });
        log(`BiometricPunch cleanup: ${count} record(s) removed.`);
      } catch (err) { warn(`biometric-cleanup: ${err.message}`); }

      // Contract signing token expiry
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { count } = await prisma.companyContract.updateMany({
          where: { signingStatus: 'sent', signingTokenExpiresAt: { lt: today } },
          data: { signingStatus: 'expired' },
        });
        log(`Contract token expiry: ${count} contract(s) expired.`);
      } catch (err) { warn(`contract-expiry: ${err.message}`); }
    }

    // ── Email + Chat activity fetch ────────────────────────────────────────
    else if (job === 'email-activity') {
      const { fetchAndStoreEmailActivity } = require('../services/google/googleWorkspace');
      const { fetchAndStoreChatActivity } = require('../services/google/googleChat');

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const date = twoDaysAgo.toISOString().split('T')[0];

      try {
        await fetchAndStoreEmailActivity(prisma, date);
        log(`Email activity fetched for ${date}.`);
      } catch (err) { warn(`email-activity: ${err.message}`); }

      try {
        await fetchAndStoreChatActivity(prisma, date);
        log(`Chat activity fetched for ${date}.`);
      } catch (err) { warn(`chat-activity: ${err.message}`); }
    }

    // ── Weekly jobs (Monday) ───────────────────────────────────────────────
    else if (job === 'weekly') {
      const { scanAllMailForRenewals } = require('../services/gmailRenewalScanner');

      // Gmail renewal scan
      try {
        const adminToken = await prisma.googleToken.findFirst({
          include: { user: { select: { role: true, id: true } } },
        });
        if (!adminToken || !['admin', 'team_lead'].includes(adminToken.user.role)) {
          warn('Gmail scan skipped: no admin with Google token found.');
        } else {
          const result = await scanAllMailForRenewals(prisma, adminToken.userId);
          log(`Gmail renewal scan: ${result.newFound} new renewal email(s) found.`);
        }
      } catch (err) { warn(`gmail-scan: ${err.message}`); }
    }

    // ── Automation analysis (Sunday night) ────────────────────────────────
    else if (job === 'automation') {
      const { runAutomationAnalysis } = require('../services/automationAnalyzer');
      const result = await runAutomationAnalysis(prisma, { triggeredBy: 'vercel-cron', periodDays: 30 });
      log(`Automation analysis: ${result.insightsCreated} insights from ${result.totalTasks} tasks (${result.durationMs}ms).`);
    }

    // ── Auto Payroll (9th of each month, 9 AM IST) ────────────────────────
    else if (job === 'auto-payroll') {
      // Generate payslips for the PREVIOUS month for all active employees
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

      const salaries = await prisma.salaryStructure.findMany({
        include: { user: { select: { id: true, name: true, isActive: true, branchId: true, company: { select: { name: true } } } } },
      });
      const activeSalaries = salaries.filter(s => s.user.isActive && !s.stopSalaryProcessing);

      if (activeSalaries.length === 0) {
        log(`auto-payroll: No active employees with salary structures — skipping ${month}.`);
      } else {
        const year = parseInt(month.split('-')[0]);
        const monthNum = parseInt(month.split('-')[1]);
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        const holidays = await prisma.holiday.findMany({ where: { date: { startsWith: month } } });
        const globalHolidayDates = new Set(holidays.map(h => h.date));

        const branchHolidayCache = {};
        const uniqueBranchIds = [...new Set(activeSalaries.map(s => s.user.branchId).filter(Boolean))];
        for (const branchId of uniqueBranchIds) {
          const bh = await prisma.branchHoliday.findMany({ where: { branchId, date: { startsWith: month } } });
          branchHolidayCache[branchId] = new Set(bh.map(h => h.date));
        }

        const calcWorkingDays = (holidaySet) => {
          let count = 0;
          for (let d = 1; d <= daysInMonth; d++) {
            const date = `${month}-${String(d).padStart(2, '0')}`;
            if (new Date(year, monthNum - 1, d).getDay() !== 0 && !holidaySet.has(date)) count++;
          }
          return count;
        };

        let generated = 0, skipped = 0;
        for (const sal of activeSalaries) {
          try {
            const existing = await prisma.payslip.findUnique({ where: { userId_month: { userId: sal.userId, month } } });
            if (existing) { skipped++; continue; }

            const mergedHolidays = new Set(globalHolidayDates);
            if (sal.user.branchId && branchHolidayCache[sal.user.branchId]) {
              branchHolidayCache[sal.user.branchId].forEach(d => mergedHolidays.add(d));
            }
            const workingDays = calcWorkingDays(mergedHolidays);

            const attendances = await prisma.attendance.findMany({ where: { userId: sal.userId, date: { startsWith: month } } });
            let presentDays = 0, lopDays = 0;
            for (const att of attendances) {
              if (att.status === 'present') presentDays++;
              else if (att.status === 'half_day') presentDays += 0.5;
              else if (att.status === 'absent') lopDays++;
            }
            if (attendances.length === 0) { presentDays = workingDays; lopDays = 0; }

            const perDaySalary = workingDays > 0 ? sal.ctcMonthly / workingDays : 0;
            const lopDeduction = Math.round(perDaySalary * lopDays);
            const grossEarnings = sal.basic + sal.hra + sal.da + sal.specialAllowance +
              sal.medicalAllowance + sal.conveyanceAllowance + sal.otherAllowance;
            const totalDeductions = sal.employeePf + sal.employeeEsi + sal.professionalTax + sal.tds;
            const netPay = Math.round(grossEarnings - totalDeductions - lopDeduction);

            await prisma.payslip.create({
              data: {
                userId: sal.userId, month, year,
                basic: sal.basic, hra: sal.hra, da: sal.da,
                specialAllowance: sal.specialAllowance, medicalAllowance: sal.medicalAllowance,
                conveyanceAllowance: sal.conveyanceAllowance, otherAllowance: sal.otherAllowance,
                otherAllowanceLabel: sal.otherAllowanceLabel, grossEarnings,
                employerPf: sal.employerPf, employerEsi: sal.employerEsi,
                employeePf: sal.employeePf, employeeEsi: sal.employeeEsi,
                professionalTax: sal.professionalTax, tds: sal.tds,
                otherDeductions: 0, totalDeductions: totalDeductions + lopDeduction,
                netPay, workingDays, presentDays, lopDays, lopDeduction,
                companyName: sal.user.company?.name || null,
                status: 'generated', generatedAt: new Date(),
              },
            });
            generated++;
          } catch (err) {
            warn(`auto-payroll: failed for userId ${sal.userId}: ${err.message}`);
          }
        }
        log(`auto-payroll (${month}): ${generated} payslip(s) generated, ${skipped} skipped (already existed).`);
      }
    }

    // ── FY Rollover (March 31) ─────────────────────────────────────────────
    else if (job === 'fy-rollover') {
      const { executeFYRollover, getFinancialYear } = require('../services/leave/leaveService');
      const currentFY = getFinancialYear();
      const summary = await executeFYRollover(currentFY, prisma);
      const totalCarry = summary.reduce((s, r) => s + r.carryForward, 0);
      const totalLapsed = summary.reduce((s, r) => s + r.lapsed, 0);
      log(`FY rollover (FY ${currentFY}): ${summary.length} entries, ${totalCarry}d carried, ${totalLapsed}d lapsed.`);
    }

    else {
      return res.status(400).json({ error: `Unknown job: ${job}` });
    }

    res.json({
      job,
      durationMs: Date.now() - started,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error(`[CRON:${job}] Fatal error:`, err);
    res.status(500).json({ job, error: err.message, results });
  }
}));

module.exports = router;
