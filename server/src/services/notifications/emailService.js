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

module.exports = { sendEmail, sendReminderEmail, sendEscalationEmail, sendSummaryToLead, sendOverdueRepairAlert, sendWarrantyExpiryAlert };
