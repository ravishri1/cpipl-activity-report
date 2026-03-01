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

module.exports = { sendEmail, sendReminderEmail, sendEscalationEmail, sendSummaryToLead };
