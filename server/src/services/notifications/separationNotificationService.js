/**
 * Separation Notification Service
 * Sends emails at every stage of the separation pipeline.
 */

const { sendEmail } = require('../emailService');
const PORTAL = process.env.APP_URL || 'https://eod.colorpapers.in';

async function sendSeparationNotification(event, data) {
  try {
    switch (event) {
      case 'employee_resigned':      return await onEmployeeResigned(data);
      case 'separation_initiated':   return await onSeparationInitiated(data);
      case 'manager_approved':       return await onManagerApproved(data);
      case 'manager_rejected':       return await onManagerRejected(data);
      case 'manager_proposed_lwd':   return await onManagerProposedLWD(data);
      case 'hr_confirmed':           return await onHRConfirmed(data);
      case 'lwd_extended':           return await onLWDExtended(data);
      case 'fnf_approved':           return await onFnFApproved(data);
      case 'salary_released':        return await onSalaryReleased(data);
      case 'documents_generated':    return await onDocumentsGenerated(data);
      case 'separation_completed':   return await onSeparationCompleted(data);
      case 'salary_hold_reminder':   return await onSalaryHoldReminder(data);
    }
  } catch (e) {
    console.error(`[SeparationNotification] ${event} error:`, e.message);
  }
}

// ─── Stage 1: Employee submits resignation ───────────────────────────────────
async function onEmployeeResigned({ separation, user }) {
  // Email to employee: confirmation
  await sendEmail({
    to: user.email,
    subject: 'Resignation Submitted — Awaiting Manager Approval',
    html: `
      <p>Dear ${user.name},</p>
      <p>Your resignation has been submitted and is <strong>awaiting your manager's approval</strong>.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Submitted On</td><td style="padding:6px 12px">${separation.requestDate}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Notice Period</td><td style="padding:6px 12px">${separation.noticePeriodDays} days</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Expected Last Working Day</td><td style="padding:6px 12px">${separation.expectedLWD}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Preferred Last Working Day</td><td style="padding:6px 12px">${separation.preferredLWD || '—'}</td></tr>
      </table>
      <p style="margin-top:16px">
        ℹ️ <strong>Important:</strong> All leaves taken during the notice period will be treated as <strong>Loss of Pay (LOP)</strong> and will extend your last working day accordingly.
      </p>
      <p>You can track your resignation status at: <a href="${PORTAL}/my-resignation">${PORTAL}/my-resignation</a></p>
    `,
  });

  // Email to manager
  if (user.reportingManager) {
    await sendEmail({
      to: user.reportingManager.email,
      subject: `Action Required: ${user.name} has submitted resignation`,
      html: `
        <p>Dear ${user.reportingManager.name},</p>
        <p><strong>${user.name}</strong> (${user.designation || ''}, ${user.department || ''}) has submitted their resignation.</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Notice Period</td><td style="padding:6px 12px">${separation.noticePeriodDays} days</td></tr>
          <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Expected LWD</td><td style="padding:6px 12px">${separation.expectedLWD}</td></tr>
          <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Preferred LWD</td><td style="padding:6px 12px">${separation.preferredLWD || '—'}</td></tr>
          <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Reason</td><td style="padding:6px 12px">${separation.reason || 'Not provided'}</td></tr>
        </table>
        <p style="margin-top:16px">Please log in to approve, reject, or propose a different Last Working Day.</p>
        <p><a href="${PORTAL}/admin/separations" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Review Resignation</a></p>
      `,
    });
  }
}

// ─── Stage 2: HR initiates separation ───────────────────────────────────────
async function onSeparationInitiated({ separation, user, initiatorName }) {
  await sendEmail({
    to: user.email,
    subject: `Separation Process Initiated — ${separation.type}`,
    html: `
      <p>Dear ${user.name},</p>
      <p>A separation process of type <strong>${separation.type}</strong> has been initiated for you by HR.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Type</td><td style="padding:6px 12px">${separation.type}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Initiated By</td><td style="padding:6px 12px">${initiatorName}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600">Effective Date</td><td style="padding:6px 12px">${separation.requestDate}</td></tr>
      </table>
      <p>Please contact HR if you have any questions.</p>
    `,
  });
}

// ─── Stage 3a: Manager approved ─────────────────────────────────────────────
async function onManagerApproved({ sep, managerName }) {
  await sendEmail({
    to: sep.user.email,
    subject: 'Resignation Approved by Manager — Pending HR Confirmation',
    html: `
      <p>Dear ${sep.user.name},</p>
      <p>Your resignation has been <strong>approved by ${managerName}</strong>. It is now pending final confirmation by HR.</p>
      <p>HR will review and set your official Last Working Day.</p>
      <p>Track status: <a href="${PORTAL}/my-resignation">${PORTAL}/my-resignation</a></p>
    `,
  });
}

// ─── Stage 3b: Manager rejected ─────────────────────────────────────────────
async function onManagerRejected({ sep, managerName }) {
  await sendEmail({
    to: sep.user.email,
    subject: 'Resignation Request Rejected',
    html: `
      <p>Dear ${sep.user.name},</p>
      <p>Your resignation has been <strong>rejected by ${managerName}</strong>.</p>
      <p>Reason: ${sep.rejectionReason || 'Not provided'}</p>
      <p>Please contact your manager or HR if you have questions.</p>
    `,
  });
}

// ─── Stage 3c: Manager proposed new LWD ────────────────────────────────────
async function onManagerProposedLWD({ sep, managerName, proposedLWD }) {
  await sendEmail({
    to: sep.user.email,
    subject: `Manager Proposed New Last Working Day: ${proposedLWD}`,
    html: `
      <p>Dear ${sep.user.name},</p>
      <p>${managerName} has proposed a revised Last Working Day of <strong>${proposedLWD}</strong>.</p>
      <p>This has been forwarded to HR for final confirmation.</p>
      <p>Manager's note: ${sep.managerNote || '—'}</p>
      <p>Track status: <a href="${PORTAL}/my-resignation">${PORTAL}/my-resignation</a></p>
    `,
  });
}

// ─── Stage 4: HR confirms ───────────────────────────────────────────────────
async function onHRConfirmed({ sep, hrName, salaryHoldUntil }) {
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  await sendEmail({
    to: sep.user.email,
    subject: `Official Last Working Day Confirmed: ${lwd}`,
    html: `
      <p>Dear ${sep.user.name},</p>
      <p>HR has <strong>confirmed your Last Working Day as ${lwd}</strong>.</p>

      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Last Working Day</td><td style="padding:8px 12px"><strong>${lwd}</strong></td></tr>
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Notice Period</td><td style="padding:8px 12px">${sep.noticePeriodDays} days</td></tr>
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Separation Type</td><td style="padding:8px 12px">${sep.type}</td></tr>
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Salary Hold Until</td><td style="padding:8px 12px">${salaryHoldUntil} (45 days after LWD)</td></tr>
      </table>

      <div style="background:#fff3cd;border:1px solid #ffc107;padding:12px 16px;border-radius:6px;margin-top:16px">
        <strong>⚠️ Important Rules:</strong>
        <ul style="margin:8px 0 0 0">
          <li>All leaves during notice period will be treated as <strong>LOP</strong></li>
          <li>Leave days will <strong>extend your LWD</strong> — you must complete the full notice period</li>
          <li>New leave requests are <strong>blocked</strong> from today</li>
          <li>Last 30 days salary will be <strong>held</strong> and processed after ${salaryHoldUntil}</li>
        </ul>
      </div>

      <p style="margin-top:16px">Track your exit progress: <a href="${PORTAL}/my-resignation">${PORTAL}/my-resignation</a></p>
    `,
  });
}

// ─── LWD Extended due to leave ──────────────────────────────────────────────
async function onLWDExtended({ sep, leaveDays, originalLWD, newLWD }) {
  const { prisma } = require('../../app'); // lazy-loaded
  const user = await prisma?.user?.findUnique({ where: { id: sep.userId }, select: { email: true, name: true } }).catch(() => null);
  if (!user) return;
  await sendEmail({
    to: user.email,
    subject: `Last Working Day Extended to ${newLWD} (${leaveDays} day(s) leave taken)`,
    html: `
      <p>Dear ${user.name},</p>
      <p>Your Last Working Day has been <strong>extended from ${originalLWD} to ${newLWD}</strong> because you took <strong>${leaveDays} day(s) of leave</strong> during your notice period.</p>
      <p>As per company policy, leave during the notice period is treated as LOP and does not count toward completing your notice period.</p>
      <p>You must be present until <strong>${newLWD}</strong> to complete your notice period.</p>
      <p>Track status: <a href="${PORTAL}/my-resignation">${PORTAL}/my-resignation</a></p>
    `,
  });
}

// ─── FnF Approved ───────────────────────────────────────────────────────────
async function onFnFApproved({ sep, hrName }) {
  const user = sep.user;
  await sendEmail({
    to: user.email,
    subject: 'Full & Final Settlement Approved',
    html: `
      <p>Dear ${user.name},</p>
      <p>Your Full & Final Settlement has been <strong>approved by HR</strong>.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">FnF Amount</td><td style="padding:8px 12px">₹${(sep.fnfNetAmount || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Salary Hold Release Date</td><td style="padding:8px 12px">${sep.salaryHoldUntil}</td></tr>
      </table>
      <p>Your held salary will be released on or after <strong>${sep.salaryHoldUntil}</strong> (45 days from your Last Working Day).</p>
      <p>Track status: <a href="${PORTAL}/my-resignation">${PORTAL}/my-resignation</a></p>
    `,
  });
}

// ─── Salary Released ────────────────────────────────────────────────────────
async function onSalaryReleased({ sep, hrName, releasedOn }) {
  const user = sep.user;
  const total = sep.salaryHolds?.reduce((s, h) => s + h.heldAmount, 0) || 0;
  await sendEmail({
    to: user.email,
    subject: '✅ Held Salary Has Been Released',
    html: `
      <p>Dear ${user.name},</p>
      <p>Your held salary of <strong>₹${total.toFixed(2)}</strong> has been <strong>released on ${releasedOn}</strong>.</p>
      <p>This amount will be transferred to your registered bank account.</p>
      <p>If you have any queries, contact HR.</p>
    `,
  });
}

// ─── Documents Generated ────────────────────────────────────────────────────
async function onDocumentsGenerated({ sep, user }) {
  await sendEmail({
    to: user.email,
    subject: 'Relieving Letter & Experience Letter Ready',
    html: `
      <p>Dear ${user.name},</p>
      <p>Your <strong>Relieving Letter</strong> and <strong>Experience Letter</strong> have been generated and are available in your Alumni Portal.</p>
      <p><a href="${PORTAL}/alumni/letters" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Download Letters</a></p>
    `,
  });
}

// ─── Separation Completed ───────────────────────────────────────────────────
async function onSeparationCompleted({ sep, completedBy }) {
  const user = sep.user;
  await sendEmail({
    to: user.email,
    subject: 'Exit Process Completed — Thank You for Your Service',
    html: `
      <p>Dear ${user.name},</p>
      <p>Your exit process has been <strong>completed</strong>. We thank you for your contributions to ColorPapers.</p>
      <p>You can continue to access your payslips, letters, and documents via the <strong>Alumni Portal</strong>.</p>
      <p><a href="${PORTAL}/alumni" style="background:#10b981;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Access Alumni Portal</a></p>
      <p style="color:#888;font-size:13px">Best wishes for your future endeavors.</p>
    `,
  });
}

// ─── 45-Day Hold Release Reminder (cron trigger) ────────────────────────────
async function onSalaryHoldReminder({ employeeName, employeeEmail, holdUntil, heldAmount, separationId }) {
  // To HR
  const { sendEmail: se } = require('../emailService');
  await se({
    to: process.env.HR_EMAIL || 'me@colorpapers.in',
    subject: `⏰ FnF Salary Release Due: ${employeeName}`,
    html: `
      <p>The 45-day salary hold period for <strong>${employeeName}</strong> has ended.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Employee</td><td style="padding:8px 12px">${employeeName}</td></tr>
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Hold Release Date</td><td style="padding:8px 12px">${holdUntil}</td></tr>
        <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Amount to Release</td><td style="padding:8px 12px">₹${heldAmount.toFixed(2)}</td></tr>
      </table>
      <p style="margin-top:16px"><a href="${PORTAL}/admin/separations/${separationId}" style="background:#f59e0b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Release Salary Now</a></p>
    `,
  });

  // To employee
  if (employeeEmail) {
    await se({
      to: employeeEmail,
      subject: 'Your Held Salary is Ready for Release',
      html: `
        <p>Dear ${employeeName},</p>
        <p>The 45-day hold period has ended. Your held salary of <strong>₹${heldAmount.toFixed(2)}</strong> is ready for processing by HR.</p>
        <p>Track status: <a href="${PORTAL}/my-resignation">${PORTAL}/my-resignation</a></p>
      `,
    });
  }
}

module.exports = { sendSeparationNotification };
