const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function sendEmail(to, subject, html) {
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"Color Papers EOD System" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`Email failed to ${to}:`, err.message);
    return false;
  }
}

async function sendReminderEmail(memberName, memberEmail) {
  const subject = 'Reminder: EOD Report Pending';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
        <h2>EOD Report Reminder</h2>
      </div>
      <div style="padding: 20px; background: #f8f9fa;">
        <p>Dear <strong>${memberName}</strong>,</p>
        <p>This is a reminder that you have <strong>not yet submitted</strong> your EOD report for today.</p>
        <p>Please submit your report as soon as possible.</p>
        <br/>
        <p style="color: #666;">— Color Papers EOD System</p>
      </div>
    </div>
  `;
  return sendEmail(memberEmail, subject, html);
}

async function sendEscalationEmail(memberName, memberEmail) {
  const subject = 'URGENT: EOD Report Still Pending After Reminder';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ff6600; color: white; padding: 20px; text-align: center;">
        <h2>EOD Report Escalation Notice</h2>
      </div>
      <div style="padding: 20px; background: #fff3cd;">
        <p>Dear <strong>${memberName}</strong>,</p>
        <p>You were sent a reminder yesterday but have <strong>still not submitted</strong> your EOD report.</p>
        <p>This has been escalated to the team lead. Please submit your report immediately.</p>
        <br/>
        <p style="color: #666;">— Color Papers EOD System</p>
      </div>
    </div>
  `;
  return sendEmail(memberEmail, subject, html);
}

async function sendSummaryToLead(leadEmail, date, summary) {
  const { reported, notReported, ignoredReminder } = summary;
  const subject = `EOD Report Summary — ${date}`;

  const reportedList = reported.length
    ? reported.map((m) => `<li style="color:green;">✅ ${m.name} (${new Date(m.submittedAt).toLocaleTimeString('en-IN')})</li>`).join('')
    : '<li>No reports submitted</li>';

  const notReportedList = notReported.length
    ? notReported.map((m) => `<li style="color:red;">❌ ${m.name}${m.reminded ? ' (reminded)' : ''}</li>`).join('')
    : '<li>Everyone reported!</li>';

  const ignoredList = ignoredReminder.length
    ? ignoredReminder.map((m) => `<li style="color:orange;">⚠️ ${m.name}</li>`).join('')
    : '<li>None</li>';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0d6efd; color: white; padding: 20px; text-align: center;">
        <h2>EOD Report Summary</h2>
        <p>${date}</p>
      </div>
      <div style="padding: 20px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 10px; background: #d4edda; text-align: center; border-radius: 8px;">
              <strong style="font-size: 24px;">${summary.totalReported}</strong><br/>Reported
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 10px; background: #f8d7da; text-align: center; border-radius: 8px;">
              <strong style="font-size: 24px;">${summary.totalNotReported}</strong><br/>Not Reported
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 10px; background: #fff3cd; text-align: center; border-radius: 8px;">
              <strong style="font-size: 24px;">${summary.totalIgnored}</strong><br/>Ignored
            </td>
          </tr>
        </table>

        <h3 style="color: green;">Reported</h3>
        <ul>${reportedList}</ul>

        <h3 style="color: red;">Not Reported</h3>
        <ul>${notReportedList}</ul>

        <h3 style="color: orange;">Ignored Reminder</h3>
        <ul>${ignoredList}</ul>
      </div>
      <div style="padding: 10px; background: #e9ecef; text-align: center; color: #666;">
        Color Papers EOD System
      </div>
    </div>
  `;
  return sendEmail(leadEmail, subject, html);
}

async function sendOverdueRepairAlert(adminEmail, adminName, overdueRepairs) {
  const count   = overdueRepairs.length;
  const subject = `⚠️ ${count} Overdue Asset Repair${count !== 1 ? 's' : ''} Require Attention`;

  // Sort worst-overdue first
  const sorted = [...overdueRepairs].sort((a, b) => b.daysOverdue - a.daysOverdue);

  const repairRows = sorted.map((r) => {
    const urgentColor = r.daysOverdue >= 7 ? '#dc3545' : '#fd7e14';
    return `
      <tr style="border-bottom:1px solid #e9ecef;">
        <td style="padding:10px;font-weight:600;">${r.asset.name}</td>
        <td style="padding:10px;color:#666;">${r.asset.assetTag || '—'}</td>
        <td style="padding:10px;color:#666;text-transform:capitalize;">${r.repairType}</td>
        <td style="padding:10px;color:#666;">${r.vendor || 'Unknown'}</td>
        <td style="padding:10px;color:#666;">${r.expectedReturnDate}</td>
        <td style="padding:10px;font-weight:bold;color:${urgentColor};">
          ${r.daysOverdue} day${r.daysOverdue !== 1 ? 's' : ''}
        </td>
      </tr>`;
  }).join('');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#fd7e14;color:white;padding:20px;text-align:center;">
        <h2 style="margin:0;">⚠️ Overdue Asset Repairs</h2>
        <p style="margin:6px 0 0;">${count} asset${count !== 1 ? 's' : ''} not yet returned by expected date</p>
      </div>
      <div style="padding:20px;">
        <p>Dear <strong>${adminName}</strong>,</p>
        <p>The following assets sent for repair or maintenance have <strong>not been returned</strong> by their expected return date:</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <thead>
            <tr style="background:#f8f9fa;text-align:left;">
              <th style="padding:10px;">Asset</th>
              <th style="padding:10px;">Tag</th>
              <th style="padding:10px;">Repair Type</th>
              <th style="padding:10px;">Vendor</th>
              <th style="padding:10px;">Expected Return</th>
              <th style="padding:10px;">Overdue By</th>
            </tr>
          </thead>
          <tbody>${repairRows}</tbody>
        </table>

        <p>Please follow up with the respective vendors and update the repair status in the system.</p>

        <a href="${appUrl}/admin/assets"
           style="display:inline-block;padding:10px 22px;background:#fd7e14;color:white;
                  text-decoration:none;border-radius:6px;font-weight:600;margin-top:8px;">
          View Asset Repairs
        </a>
      </div>
      <div style="padding:10px;background:#e9ecef;text-align:center;color:#666;font-size:12px;">
        Color Papers HR System &middot; Asset Management
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendWarrantyExpiryAlert(adminEmail, adminName, expiringAssets) {
  const count = expiringAssets.length;
  const subject = `🔔 ${count} Asset Warrant${count !== 1 ? 'ies' : 'y'} Expiring Soon`;

  // Urgency tiers
  const critical  = expiringAssets.filter((a) => a.daysUntilExpiry <= 7);
  const warning   = expiringAssets.filter((a) => a.daysUntilExpiry > 7 && a.daysUntilExpiry <= 14);
  const upcoming  = expiringAssets.filter((a) => a.daysUntilExpiry > 14);

  function buildRows(assets, color) {
    return assets.map((a) => {
      const holder = a.currentHolder ? a.currentHolder.name : 'Unassigned';
      const badge  = a.daysUntilExpiry === 1
        ? '1 day'
        : `${a.daysUntilExpiry} days`;
      return `
        <tr style="border-bottom:1px solid #e9ecef;">
          <td style="padding:10px;font-weight:600;">${a.name}</td>
          <td style="padding:10px;color:#666;">${a.assetTag || '—'}</td>
          <td style="padding:10px;color:#666;text-transform:capitalize;">${a.type}</td>
          <td style="padding:10px;color:#666;">${a.warrantyVendor || '—'}</td>
          <td style="padding:10px;color:#666;">${a.warrantyExpiry}</td>
          <td style="padding:10px;color:#666;">${holder}</td>
          <td style="padding:10px;font-weight:bold;color:${color};">${badge}</td>
        </tr>`;
    }).join('');
  }

  function buildSection(title, assets, headerBg, color) {
    if (!assets.length) return '';
    return `
      <h3 style="color:${color};margin:20px 0 8px;">${title} (${assets.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <thead>
          <tr style="background:#f8f9fa;text-align:left;">
            <th style="padding:10px;">Asset</th>
            <th style="padding:10px;">Tag</th>
            <th style="padding:10px;">Type</th>
            <th style="padding:10px;">Warranty Vendor</th>
            <th style="padding:10px;">Expiry Date</th>
            <th style="padding:10px;">Assigned To</th>
            <th style="padding:10px;">Expires In</th>
          </tr>
        </thead>
        <tbody>${buildRows(assets, color)}</tbody>
      </table>`;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:750px;margin:0 auto;">
      <div style="background:#0d6efd;color:white;padding:20px;text-align:center;">
        <h2 style="margin:0;">🔔 Warranty Expiry Alert</h2>
        <p style="margin:6px 0 0;">${count} asset warrant${count !== 1 ? 'ies' : 'y'} requiring action</p>
      </div>
      <div style="padding:20px;">
        <p>Dear <strong>${adminName}</strong>,</p>
        <p>The following assets have warranties expiring soon. Please arrange renewals or replacement plans as needed.</p>

        ${buildSection('🔴 Critical — Expires in ≤ 7 days',  critical, '#fde8e8', '#dc3545')}
        ${buildSection('🟠 Warning — Expires in 8–14 days', warning,  '#fff3e0', '#fd7e14')}
        ${buildSection('🟡 Upcoming — Expires in 15–30 days', upcoming, '#fffde7', '#d97706')}

        <p style="margin-top:16px;">Renew warranties before expiry to avoid gaps in coverage.</p>

        <a href="${appUrl}/admin/assets"
           style="display:inline-block;padding:10px 22px;background:#0d6efd;color:white;
                  text-decoration:none;border-radius:6px;font-weight:600;margin-top:8px;">
          View Assets
        </a>
      </div>
      <div style="padding:10px;background:#e9ecef;text-align:center;color:#666;font-size:12px;">
        Color Papers HR System &middot; Asset Management
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendBirthdayAnniversaryAlert(adminEmail, adminName, birthdays, anniversaries) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const totalCount = birthdays.length + anniversaries.length;
  const subject = `🎉 ${totalCount} Celebration${totalCount !== 1 ? 's' : ''} Today — ${today}`;

  function milestoneBadge(years) {
    const map = { 1: '🥇', 5: '⭐', 10: '🏆', 15: '💎', 20: '👑', 25: '🌟' };
    return map[years] || '';
  }

  const birthdayRows = birthdays.map((u) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #f0f4f8;">
        <div style="font-weight:700;color:#1e293b;">${u.name}</div>
        <div style="font-size:12px;color:#64748b;">${u.designation || u.department || ''}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #f0f4f8;color:#475569;font-size:14px;">${u.department || '—'}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #f0f4f8;text-align:center;">
        <span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:999px;font-size:13px;font-weight:600;">
          🎂 Turning ${u.age}
        </span>
      </td>
    </tr>`).join('');

  const anniversaryRows = anniversaries.map((u) => {
    const badge  = milestoneBadge(u.years);
    const isMile = badge !== '';
    return `
    <tr style="background:${isMile ? '#f0fdf4' : '#fff'};">
      <td style="padding:12px 10px;border-bottom:1px solid #f0f4f8;">
        <div style="font-weight:700;color:#1e293b;">${u.name}</div>
        <div style="font-size:12px;color:#64748b;">${u.designation || u.department || ''}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #f0f4f8;color:#475569;font-size:14px;">${u.department || '—'}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #f0f4f8;text-align:center;">
        <span style="background:${isMile ? '#dcfce7' : '#ede9fe'};color:${isMile ? '#166534' : '#5b21b6'};
                     padding:3px 10px;border-radius:999px;font-size:13px;font-weight:700;">
          🏅 ${badge} ${u.years} Year${u.years !== 1 ? 's' : ''}
        </span>
      </td>
    </tr>`;
  }).join('');

  const tableHeader = `
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Employee</th>
        <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Department</th>
        <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Milestone</th>
      </tr>
    </thead>`;

  const birthdaySection = birthdays.length === 0 ? '' : `
    <h3 style="color:#92400e;font-size:15px;margin:20px 0 8px;">🎂 Birthdays (${birthdays.length})</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:4px;">
      ${tableHeader}<tbody>${birthdayRows}</tbody>
    </table>`;

  const anniversarySection = anniversaries.length === 0 ? '' : `
    <h3 style="color:#5b21b6;font-size:15px;margin:20px 0 8px;">🏅 Work Anniversaries (${anniversaries.length})</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:4px;">
      ${tableHeader}<tbody>${anniversaryRows}</tbody>
    </table>`;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#6366f1 0%,#ec4899 100%);color:white;
                  padding:28px 24px;text-align:center;border-radius:0 0 20px 20px;">
        <div style="font-size:38px;margin-bottom:6px;">🎉</div>
        <h1 style="margin:0;font-size:22px;font-weight:800;">Celebrations Today!</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">${today}</p>
      </div>

      <div style="padding:24px;">
        <p style="color:#475569;font-size:14px;margin:0 0 4px;">
          Dear <strong>${adminName}</strong>, here are today's team celebrations:
        </p>

        ${birthdaySection}
        ${anniversarySection}

        <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;">
          A personal message goes a long way. Don't forget to congratulate them! 🌟
        </p>
        <a href="${appUrl}/admin/team"
           style="display:inline-block;margin-top:14px;padding:10px 22px;background:#6366f1;color:white;
                  text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
          View Team Directory
        </a>
      </div>

      <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">
        Color Papers HR System &middot; People &amp; Culture
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendPayrollReminderAlert(adminEmail, adminName, summary) {
  const { label, totalEligible, processed, missing, missingEmployees } = summary;
  const pct     = Math.round((processed / totalEligible) * 100);
  const subject = `💰 Payroll Reminder: ${missing} Payslip${missing !== 1 ? 's' : ''} Pending — ${label}`;

  // Progress bar fill
  const barFill = Math.max(4, pct); // min 4% so bar is visible
  const barColor = pct === 100 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc3545';

  // Group missing employees by department
  const byDept = missingEmployees.reduce((acc, e) => {
    const dept = e.department || 'General';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(e);
    return acc;
  }, {});

  const deptSections = Object.entries(byDept).map(([dept, emps]) => {
    const rows = emps.map((e) => `
      <tr style="border-bottom:1px solid #f0f4f8;">
        <td style="padding:9px 12px;font-weight:600;color:#1e293b;">${e.name}</td>
        <td style="padding:9px 12px;color:#64748b;font-size:13px;">${e.employeeId || '—'}</td>
        <td style="padding:9px 12px;color:#64748b;font-size:13px;">${e.designation || '—'}</td>
      </tr>`).join('');
    return `
      <tr><td colspan="3" style="padding:8px 12px;background:#f8fafc;font-size:12px;font-weight:700;
              color:#475569;text-transform:uppercase;letter-spacing:.5px;">${dept}</td></tr>
      ${rows}`;
  }).join('');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1d4ed8 0%,#0ea5e9 100%);color:white;
                  padding:24px;text-align:center;border-radius:0 0 20px 20px;">
        <div style="font-size:36px;margin-bottom:6px;">💰</div>
        <h1 style="margin:0;font-size:20px;font-weight:800;">Payroll Processing Reminder</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">${label}</p>
      </div>

      <div style="padding:24px;">
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">
          Dear <strong>${adminName}</strong>, ${missing} employee${missing !== 1 ? 's' : ''} still
          ${missing !== 1 ? "don't" : "doesn't"} have a payslip generated for <strong>${label}</strong>.
        </p>

        <!-- Progress summary -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:#64748b;">Payroll completion</span>
            <span style="font-size:13px;font-weight:700;color:${barColor};">${processed} / ${totalEligible} (${pct}%)</span>
          </div>
          <div style="background:#e2e8f0;border-radius:999px;height:10px;overflow:hidden;">
            <div style="background:${barColor};width:${barFill}%;height:100%;border-radius:999px;"></div>
          </div>
          <div style="display:flex;gap:20px;margin-top:12px;font-size:12px;">
            <span style="color:#16a34a;">✅ Generated: <strong>${processed}</strong></span>
            <span style="color:#dc3545;">⏳ Pending: <strong>${missing}</strong></span>
          </div>
        </div>

        <!-- Missing employees table -->
        <h3 style="color:#1e293b;font-size:14px;margin:0 0 8px;">⏳ Pending Payslips</h3>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;
                      border-radius:8px;font-size:14px;margin-bottom:16px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Employee</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">ID</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Designation</th>
            </tr>
          </thead>
          <tbody>${deptSections}</tbody>
        </table>

        <p style="color:#94a3b8;font-size:12px;margin:0 0 14px;">
          Please generate and publish all payslips before month-end to ensure timely disbursement.
        </p>
        <a href="${appUrl}/admin/payroll"
           style="display:inline-block;padding:10px 22px;background:#1d4ed8;color:white;
                  text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
          Open Payroll Dashboard
        </a>
      </div>

      <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">
        Color Papers HR System &middot; Payroll &amp; Finance
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendPendingApprovalsAlert(adminEmail, adminName, leaves, expenses) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const total = leaves.length + expenses.length;
  const subject = `📋 ${total} Pending Approval${total !== 1 ? 's' : ''} Awaiting Action — ${today}`;

  // ── Leave urgency config ────────────────────────────────────────────────
  function leaveUrgency(daysUntilStart) {
    if (daysUntilStart <= 3) return { emoji: '🔴', label: 'Urgent',  color: '#dc3545', bg: '#fde8e8' };
    if (daysUntilStart <= 7) return { emoji: '🟠', label: 'Soon',    color: '#fd7e14', bg: '#fff3e0' };
    return                          { emoji: '🟡', label: 'Normal',  color: '#d97706', bg: '#fffde7' };
  }

  // ── Expense age config ──────────────────────────────────────────────────
  function expenseAge(daysPending) {
    if (daysPending >= 7) return { emoji: '🔴', label: 'Overdue', color: '#dc3545', bg: '#fde8e8' };
    if (daysPending >= 4) return { emoji: '🟠', label: 'Aging',   color: '#fd7e14', bg: '#fff3e0' };
    return                       { emoji: '🟡', label: 'Recent',  color: '#d97706', bg: '#fffde7' };
  }

  // ── Leave rows ──────────────────────────────────────────────────────────
  const leaveRows = leaves.map((lr) => {
    const { emoji, label, color, bg } = leaveUrgency(lr.daysUntilStart);
    return `
      <tr style="border-bottom:1px solid #f0f4f8;">
        <td style="padding:10px 12px;font-weight:600;color:#1e293b;">${lr.user.name}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${lr.user.department || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${lr.leaveType.name}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${lr.startDate} → ${lr.endDate}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${lr.days} day${lr.days !== 1 ? 's' : ''}</td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="background:${bg};color:${color};padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;">
            ${emoji} ${label}
          </span>
        </td>
      </tr>`;
  }).join('');

  // ── Expense rows ────────────────────────────────────────────────────────
  const expenseRows = expenses.map((ec) => {
    const { emoji, label, color, bg } = expenseAge(ec.daysPending);
    const amt = `₹${Number(ec.amount).toLocaleString('en-IN')}`;
    return `
      <tr style="border-bottom:1px solid #f0f4f8;">
        <td style="padding:10px 12px;font-weight:600;color:#1e293b;">${ec.user.name}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${ec.user.department || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${ec.title}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;text-transform:capitalize;">${ec.category}</td>
        <td style="padding:10px 12px;font-weight:700;color:#1e293b;font-size:13px;">${amt}</td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="background:${bg};color:${color};padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;">
            ${emoji} ${ec.daysPending}d old
          </span>
        </td>
      </tr>`;
  }).join('');

  const tableHead6 = (cols) => `
    <thead>
      <tr style="background:#f8fafc;">
        ${cols.map((c) => `<th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;
           font-weight:600;text-transform:uppercase;white-space:nowrap;">${c}</th>`).join('')}
      </tr>
    </thead>`;

  const leaveSection = leaves.length === 0 ? '' : `
    <h3 style="color:#1e293b;font-size:14px;margin:20px 0 8px;">🌴 Pending Leave Requests (${leaves.length})</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;
                  border-radius:8px;font-size:14px;margin-bottom:4px;">
      ${tableHead6(['Employee', 'Department', 'Leave Type', 'Duration', 'Days', 'Urgency'])}
      <tbody>${leaveRows}</tbody>
    </table>`;

  const expenseSection = expenses.length === 0 ? '' : `
    <h3 style="color:#1e293b;font-size:14px;margin:20px 0 8px;">💸 Pending Expense Claims (${expenses.length})</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;
                  border-radius:8px;font-size:14px;margin-bottom:4px;">
      ${tableHead6(['Employee', 'Department', 'Title', 'Category', 'Amount', 'Age'])}
      <tbody>${expenseRows}</tbody>
    </table>`;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:white;
                  padding:22px 24px;text-align:center;border-radius:0 0 20px 20px;">
        <div style="font-size:32px;margin-bottom:6px;">📋</div>
        <h1 style="margin:0;font-size:20px;font-weight:800;">Pending Approvals Digest</h1>
        <p style="margin:6px 0 0;opacity:0.8;font-size:13px;">${today} &middot; ${total} item${total !== 1 ? 's' : ''} awaiting action</p>
      </div>

      <div style="padding:20px;">
        <p style="color:#475569;font-size:14px;margin:0 0 4px;">
          Dear <strong>${adminName}</strong>, the following requests need your review:
        </p>

        ${leaveSection}
        ${expenseSection}

        <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
          <a href="${appUrl}/admin/leave"
             style="display:inline-block;padding:9px 18px;background:#10b981;color:white;
                    text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Review Leaves
          </a>
          <a href="${appUrl}/admin/expenses"
             style="display:inline-block;padding:9px 18px;background:#6366f1;color:white;
                    text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Review Expenses
          </a>
        </div>
      </div>

      <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">
        Color Papers HR System &middot; Leave &amp; Expense Management
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendProbationEndAlert(adminEmail, adminName, employees) {
  const count   = employees.length;
  const subject = `⏰ ${count} Employee Probation Period${count !== 1 ? 's' : ''} Ending Soon`;

  function tier(daysUntilEnd) {
    if (daysUntilEnd <= 7)  return { emoji: '🔴', label: 'Final Review',  color: '#dc3545', bg: '#fde8e8' };
    return                          { emoji: '🟠', label: 'Prepare Eval', color: '#fd7e14', bg: '#fff3e0' };
  }

  const rows = employees.map((emp) => {
    const { emoji, label, color, bg } = tier(emp.daysUntilEnd);
    return `
      <tr style="border-bottom:1px solid #f0f4f8;">
        <td style="padding:10px 12px;font-weight:700;color:#1e293b;">${emp.name}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.department || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.designation || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.employeeId || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.dateOfJoining || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.probationEndDate}</td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="background:${bg};color:${color};padding:2px 10px;border-radius:999px;
                       font-size:12px;font-weight:700;white-space:nowrap;">
            ${emoji} ${emp.daysUntilEnd} day${emp.daysUntilEnd !== 1 ? 's' : ''} — ${label}
          </span>
        </td>
      </tr>`;
  }).join('');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);color:white;
                  padding:24px;text-align:center;border-radius:0 0 20px 20px;">
        <div style="font-size:36px;margin-bottom:6px;">⏰</div>
        <h1 style="margin:0;font-size:20px;font-weight:800;">Probation Period Ending Soon</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">
          ${count} employee${count !== 1 ? 's' : ''} approaching end of probation
        </p>
      </div>

      <div style="padding:24px;">
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">
          Dear <strong>${adminName}</strong>, the following employees have their probation period
          ending within the next 14 days. Please schedule evaluations and decide on
          <strong>confirmation, extension, or termination</strong> before the end date.
        </p>

        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;
                      border-radius:8px;font-size:14px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Employee</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Department</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Designation</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Emp ID</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Joined</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Probation Ends</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="margin-top:16px;padding:12px 16px;background:#fef3c7;border:1px solid #fde68a;
                    border-radius:8px;font-size:13px;color:#92400e;">
          <strong>Action Required:</strong> Notify the employee of the decision at least 2–3 days
          before probation end to allow for proper documentation and onboarding/offboarding if needed.
        </div>

        <a href="${appUrl}/admin/team"
           style="display:inline-block;margin-top:18px;padding:10px 22px;background:#7c3aed;color:white;
                  text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
          View Employee Profiles
        </a>
      </div>

      <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">
        Color Papers HR System &middot; People &amp; Culture
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendPassportExpiryAlert(adminEmail, adminName, employees) {
  const count   = employees.length;
  const subject = `🛂 ${count} Employee Passport${count !== 1 ? 's' : ''} Expiring Soon`;

  // Urgency tiers
  const critical = employees.filter((e) => e.daysUntilExpiry <= 14);
  const warning  = employees.filter((e) => e.daysUntilExpiry > 14 && e.daysUntilExpiry <= 30);
  const upcoming = employees.filter((e) => e.daysUntilExpiry > 30);

  function buildRows(emps, color) {
    return emps.map((emp) => `
      <tr style="border-bottom:1px solid #f0f4f8;">
        <td style="padding:10px 12px;font-weight:700;color:#1e293b;">${emp.name}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.department || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.designation || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.employeeId || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;font-family:monospace;">${emp.passportNumber || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.nationality || '—'}</td>
        <td style="padding:10px 12px;color:#475569;font-size:13px;">${emp.passportExpiry}</td>
        <td style="padding:10px 12px;font-weight:bold;color:${color};font-size:13px;">
          ${emp.daysUntilExpiry} day${emp.daysUntilExpiry !== 1 ? 's' : ''}
        </td>
      </tr>`).join('');
  }

  function buildSection(title, emps, color) {
    if (!emps.length) return '';
    const theadCols = ['Employee', 'Department', 'Designation', 'Emp ID', 'Passport No', 'Nationality', 'Expiry Date', 'Expires In'];
    const thead = `<thead><tr style="background:#f8fafc;">${
      theadCols.map((c) => `<th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;white-space:nowrap;">${c}</th>`).join('')
    }</tr></thead>`;
    return `
      <h3 style="color:${color};font-size:14px;margin:20px 0 8px;">${title} (${emps.length})</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;
                    border-radius:8px;font-size:14px;margin-bottom:4px;">
        ${thead}<tbody>${buildRows(emps, color)}</tbody>
      </table>`;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:860px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#0f766e 0%,#0891b2 100%);color:white;
                  padding:24px;text-align:center;border-radius:0 0 20px 20px;">
        <div style="font-size:36px;margin-bottom:6px;">🛂</div>
        <h1 style="margin:0;font-size:20px;font-weight:800;">Passport Expiry Alert</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">
          ${count} employee passport${count !== 1 ? 's' : ''} expiring within the next 90 days
        </p>
      </div>

      <div style="padding:24px;">
        <p style="color:#475569;font-size:14px;margin:0 0 4px;">
          Dear <strong>${adminName}</strong>, the following active employees have passports
          expiring soon. Please coordinate passport renewal to avoid travel disruptions.
        </p>

        ${buildSection('🔴 Critical — Expires in ≤ 14 days',   critical, '#dc3545')}
        ${buildSection('🟠 Warning — Expires in 15–30 days',   warning,  '#fd7e14')}
        ${buildSection('🟡 Upcoming — Expires in 31–90 days',  upcoming, '#d97706')}

        <div style="margin-top:16px;padding:12px 16px;background:#f0fdfa;border:1px solid #99f6e4;
                    border-radius:8px;font-size:13px;color:#0f766e;">
          <strong>Reminder:</strong> Passport renewal typically takes 2–4 weeks.
          Employees travelling internationally should renew at least 6 months before expiry.
        </div>

        <a href="${appUrl}/admin/team"
           style="display:inline-block;margin-top:18px;padding:10px 22px;background:#0f766e;color:white;
                  text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
          View Employee Profiles
        </a>
      </div>

      <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">
        Color Papers HR System &middot; Compliance &amp; Documentation
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendInsuranceExpiryAlert(adminEmail, adminName, cards) {
  const count   = cards.length;
  const subject = `🏥 ${count} Employee Insurance Card${count !== 1 ? 's' : ''} Expiring Soon`;

  // Urgency tiers
  const critical = cards.filter((c) => c.daysUntilExpiry <= 14);
  const warning  = cards.filter((c) => c.daysUntilExpiry > 14 && c.daysUntilExpiry <= 30);
  const upcoming = cards.filter((c) => c.daysUntilExpiry > 30);

  function cardTypeLabel(t) {
    const map = { health: 'Health', life: 'Life', accidental: 'Accidental', other: 'Other' };
    return map[t] || t || '—';
  }

  function buildRows(items, color) {
    return items.map((c) => {
      const amt = c.coverageAmount
        ? `₹${Number(c.coverageAmount).toLocaleString('en-IN')}`
        : '—';
      return `
        <tr style="border-bottom:1px solid #f0f4f8;">
          <td style="padding:10px 12px;font-weight:700;color:#1e293b;">${c.user.name}</td>
          <td style="padding:10px 12px;color:#475569;font-size:13px;">${c.user.department || '—'}</td>
          <td style="padding:10px 12px;color:#475569;font-size:13px;">${c.user.employeeId || '—'}</td>
          <td style="padding:10px 12px;color:#475569;font-size:13px;">${cardTypeLabel(c.cardType)}</td>
          <td style="padding:10px 12px;color:#475569;font-size:13px;">${c.providerName || '—'}</td>
          <td style="padding:10px 12px;color:#475569;font-size:13px;font-family:monospace;">${c.policyNumber || '—'}</td>
          <td style="padding:10px 12px;color:#475569;font-size:13px;">${amt}</td>
          <td style="padding:10px 12px;color:#475569;font-size:13px;">${c.effectiveTo}</td>
          <td style="padding:10px 12px;font-weight:bold;color:${color};font-size:13px;">
            ${c.daysUntilExpiry} day${c.daysUntilExpiry !== 1 ? 's' : ''}
          </td>
        </tr>`;
    }).join('');
  }

  function buildSection(title, items, color) {
    if (!items.length) return '';
    const cols = ['Employee', 'Department', 'Emp ID', 'Type', 'Provider', 'Policy No', 'Coverage', 'Expiry Date', 'Expires In'];
    const thead = `<thead><tr style="background:#f8fafc;">${
      cols.map((c) => `<th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;white-space:nowrap;">${c}</th>`).join('')
    }</tr></thead>`;
    return `
      <h3 style="color:${color};font-size:14px;margin:20px 0 8px;">${title} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;
                    border-radius:8px;font-size:14px;margin-bottom:4px;overflow-x:auto;">
        ${thead}<tbody>${buildRows(items, color)}</tbody>
      </table>`;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#be185d 0%,#9d174d 100%);color:white;
                  padding:24px;text-align:center;border-radius:0 0 20px 20px;">
        <div style="font-size:36px;margin-bottom:6px;">🏥</div>
        <h1 style="margin:0;font-size:20px;font-weight:800;">Insurance Card Expiry Alert</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">
          ${count} employee insurance card${count !== 1 ? 's' : ''} expiring within the next 60 days
        </p>
      </div>

      <div style="padding:24px;">
        <p style="color:#475569;font-size:14px;margin:0 0 4px;">
          Dear <strong>${adminName}</strong>, the following active employees have insurance cards
          approaching expiry. Please initiate renewal or re-issuance to ensure uninterrupted coverage.
        </p>

        ${buildSection('🔴 Critical — Expires in ≤ 14 days',   critical, '#dc3545')}
        ${buildSection('🟠 Warning — Expires in 15–30 days',   warning,  '#fd7e14')}
        ${buildSection('🟡 Upcoming — Expires in 31–60 days',  upcoming, '#d97706')}

        <div style="margin-top:16px;padding:12px 16px;background:#fdf2f8;border:1px solid #f9a8d4;
                    border-radius:8px;font-size:13px;color:#9d174d;">
          <strong>Action Required:</strong> Contact the insurance provider to renew or re-issue cards
          before expiry. Upload the new card to the employee's profile once received.
        </div>

        <a href="${appUrl}/admin/team"
           style="display:inline-block;margin-top:18px;padding:10px 22px;background:#be185d;color:white;
                  text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
          View Employee Profiles
        </a>
      </div>

      <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">
        Color Papers HR System &middot; Insurance &amp; Benefits
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

async function sendOnboardingOverdueAlert(adminEmail, adminName, employeeGroups, totalTasks) {
  const empCount = employeeGroups.length;
  const subject  = `📋 ${totalTasks} Overdue Onboarding Task${totalTasks !== 1 ? 's' : ''} — ${empCount} Employee${empCount !== 1 ? 's' : ''}`;

  function overdueStyle(days) {
    if (days > 7) return { emoji: '🔴', color: '#dc3545', bg: '#fde8e8', label: 'Critical' };
    if (days >= 4) return { emoji: '🟠', color: '#fd7e14', bg: '#fff3e0', label: 'Warning' };
    return              { emoji: '🟡', color: '#d97706', bg: '#fffde7', label: 'Recent' };
  }

  function categoryLabel(cat) {
    const map = {
      documents:      'Documents',
      it_setup:       'IT Setup',
      hr_formalities: 'HR Formalities',
      training:       'Training',
    };
    return map[cat] || cat || '—';
  }

  const employeeSections = employeeGroups.map(({ user, tasks }) => {
    const maxOverdue = Math.max(...tasks.map((t) => t.daysOverdue));
    const { emoji, color } = overdueStyle(maxOverdue);

    const taskRows = tasks.map((t) => {
      const { emoji: te, color: tc, bg, label } = overdueStyle(t.daysOverdue);
      return `
        <tr style="border-bottom:1px solid #f8f8f8;">
          <td style="padding:8px 12px;color:#1e293b;font-size:13px;">${t.task}</td>
          <td style="padding:8px 12px;color:#475569;font-size:12px;">${categoryLabel(t.category)}</td>
          <td style="padding:8px 12px;color:#475569;font-size:12px;">${t.assignedTo || '—'}</td>
          <td style="padding:8px 12px;color:#475569;font-size:12px;">${t.dueDate}</td>
          <td style="padding:8px 12px;text-align:center;">
            <span style="background:${bg};color:${tc};padding:2px 8px;border-radius:999px;
                         font-size:11px;font-weight:700;white-space:nowrap;">
              ${te} ${t.daysOverdue}d late
            </span>
          </td>
        </tr>`;
    }).join('');

    return `
      <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e2e8f0;
                    display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-weight:700;color:#1e293b;font-size:14px;">${emoji} ${user.name}</span>
            <span style="color:#64748b;font-size:12px;margin-left:10px;">
              ${user.department || '—'} &middot; ${user.employeeId || '—'}
            </span>
          </div>
          <span style="font-size:12px;color:${color};font-weight:700;">
            ${tasks.length} task${tasks.length !== 1 ? 's' : ''} overdue
          </span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#fafafa;">
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Task</th>
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Category</th>
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Assigned To</th>
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Due Date</th>
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>${taskRows}</tbody>
        </table>
      </div>`;
  }).join('');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;
                  padding:24px;text-align:center;border-radius:0 0 20px 20px;">
        <div style="font-size:36px;margin-bottom:6px;">📋</div>
        <h1 style="margin:0;font-size:20px;font-weight:800;">Overdue Onboarding Tasks</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">
          ${totalTasks} task${totalTasks !== 1 ? 's' : ''} past due across ${empCount} employee${empCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div style="padding:24px;">
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">
          Dear <strong>${adminName}</strong>, the following onboarding checklist items are past their
          due dates and have not been completed. Please follow up with the respective employees or
          assignees to close out these items.
        </p>

        ${employeeSections}

        <div style="margin-top:4px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;
                    border-radius:8px;font-size:13px;color:#1e40af;">
          <strong>Tip:</strong> Navigate to an employee's profile &rarr; Onboarding tab to mark
          tasks complete or adjust due dates as needed.
        </div>

        <a href="${appUrl}/admin/team"
           style="display:inline-block;margin-top:18px;padding:10px 22px;background:#1e40af;color:white;
                  text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
          View Employee Profiles
        </a>
      </div>

      <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">
        Color Papers HR System &middot; Onboarding &amp; Lifecycle
      </div>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}

module.exports = {
  sendEmail,
  sendReminderEmail,
  sendEscalationEmail,
  sendSummaryToLead,
  sendOverdueRepairAlert,
  sendWarrantyExpiryAlert,
  sendBirthdayAnniversaryAlert,
  sendPayrollReminderAlert,
  sendPendingApprovalsAlert,
  sendProbationEndAlert,
  sendPassportExpiryAlert,
  sendInsuranceExpiryAlert,
  sendOnboardingOverdueAlert,
};
