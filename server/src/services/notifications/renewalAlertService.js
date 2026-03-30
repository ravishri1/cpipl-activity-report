const { sendEmail } = require('./emailService');

/**
 * Run daily renewal alerts.
 * For each active renewal, if today falls within its alertDaysBefore window,
 * send an email to the alertRecipients (comma-separated role names or email list).
 * Returns count of alerts sent.
 */
async function runRenewalAlerts(prisma) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renewals = await prisma.renewal.findMany({
    where: { status: 'active' },
    include: {
      category:       { select: { name: true } },
      paymentAccount: { select: { accountCode: true, name: true } },
    },
  });

  let alertCount = 0;

  for (const renewal of renewals) {
    if (!renewal.renewalDate) continue;

    const dueDate = new Date(renewal.renewalDate);
    const daysLeft = Math.ceil((dueDate - today) / 86400000);
    const threshold = renewal.alertDaysBefore || 15;

    // Only alert if within window and not already past
    if (daysLeft < 0 || daysLeft > threshold) continue;

    // Determine recipients — fetch admin emails
    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'team_lead'] }, isActive: true },
      select: { email: true, name: true },
    });

    const recipientEmails = admins.map(a => a.email);

    if (recipientEmails.length === 0) continue;

    const subject = daysLeft === 0
      ? `🔴 RENEWAL DUE TODAY: ${renewal.itemName}`
      : daysLeft <= 7
        ? `🔴 URGENT: ${renewal.itemName} renews in ${daysLeft} day(s)`
        : `🟡 Renewal Reminder: ${renewal.itemName} due in ${daysLeft} day(s)`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1e293b;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0">Renewal Alert — CPIPL</h2>
        </div>
        <div style="padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;color:#64748b;width:140px">Item</td>
                <td style="padding:8px;font-weight:600">${renewal.itemName}</td></tr>
            <tr style="background:#f8fafc">
                <td style="padding:8px;color:#64748b">Category</td>
                <td style="padding:8px">${renewal.category?.name || '—'}</td></tr>
            <tr><td style="padding:8px;color:#64748b">Vendor</td>
                <td style="padding:8px">${renewal.vendorName || '—'}</td></tr>
            <tr style="background:#f8fafc">
                <td style="padding:8px;color:#64748b">Renewal Date</td>
                <td style="padding:8px;font-weight:600;color:${daysLeft <= 7 ? '#dc2626' : '#d97706'}">${renewal.renewalDate}</td></tr>
            <tr><td style="padding:8px;color:#64748b">Days Left</td>
                <td style="padding:8px;font-weight:700;color:${daysLeft <= 7 ? '#dc2626' : '#d97706'}">${daysLeft} day(s)</td></tr>
            <tr style="background:#f8fafc">
                <td style="padding:8px;color:#64748b">Amount</td>
                <td style="padding:8px">₹${renewal.amount?.toLocaleString('en-IN') || '—'}</td></tr>
            <tr><td style="padding:8px;color:#64748b">Payment Account</td>
                <td style="padding:8px">${renewal.paymentAccount ? `${renewal.paymentAccount.accountCode} – ${renewal.paymentAccount.name}` : '—'}</td></tr>
          </table>
          <p style="margin-top:20px;color:#64748b;font-size:13px">
            Please log in to the CPIPL HR portal → Renewals to take action.
          </p>
        </div>
      </div>
    `;

    try {
      for (const email of recipientEmails) {
        await sendEmail({ to: email, subject, html });
      }
      alertCount++;
    } catch (err) {
      console.error(`[RenewalAlert] Failed to send alert for ${renewal.itemName}:`, err.message);
    }
  }

  return alertCount;
}

module.exports = { runRenewalAlerts };
