/**
 * Compliance Certificate Alert Service
 * Runs daily at 10:00 AM and sends email alerts to all active admins/team leads
 * for certificates that are:
 *   - Overdue (expiryDate < today, non-LIFETIME)
 *   - Due soon (expiryDate within reminderDays, non-LIFETIME)
 *
 * Uses the `reminderDays` field on each cert so each cert controls its own alert window.
 */
const { sendComplianceReminderEmail } = require('./emailService');

/**
 * Compute status + daysLeft for a certificate (same logic as API route).
 * @param {object} cert  ComplianceCertificate record
 * @returns {{ status: string, daysLeft: number|null }}
 */
function enrichCert(cert) {
  if (!cert.expiryDate || cert.renewalFrequency === 'LIFETIME') {
    return { ...cert, status: 'LIFETIME', daysLeft: null };
  }
  const today  = new Date();
  const expiry = new Date(cert.expiryDate);
  const daysLeft = Math.ceil((expiry - today) / 86400000);
  const status = daysLeft < 0 ? 'OVERDUE' : daysLeft <= 30 ? 'DUE_SOON' : 'VALID';
  return { ...cert, status, daysLeft };
}

/**
 * Main entry point — called by cron at 10:00 AM daily.
 * @param {PrismaClient} prisma
 * @returns {number} total alert count (overdue + due-soon)
 */
async function runComplianceAlerts(prisma) {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[COMPLIANCE_ALERT] Running compliance certificate check for ${today}`);

  // Fetch all non-LIFETIME certs for active registrations
  const allCerts = await prisma.complianceCertificate.findMany({
    where: {
      renewalFrequency: { not: 'LIFETIME' },
      expiryDate:       { not: null },
      companyRegistration: { isActive: true },
    },
    include: {
      companyRegistration: {
        include: { legalEntity: { select: { id: true, legalName: true } } },
      },
    },
    orderBy: { expiryDate: 'asc' },
  });

  if (allCerts.length === 0) {
    console.log('[COMPLIANCE_ALERT] No active certificates with expiry dates found.');
    return 0;
  }

  // Enrich certs with status + daysLeft
  const enriched = allCerts.map(enrichCert);

  // Separate overdue and due-soon (respect each cert's reminderDays window)
  const overdueCerts = enriched.filter(c => c.status === 'OVERDUE');
  const dueSoonCerts = enriched.filter(c => {
    if (c.status !== 'DUE_SOON' && c.status !== 'VALID') return false;
    // Only include if within this cert's reminder window
    return c.daysLeft !== null && c.daysLeft <= (c.reminderDays || 30);
  });

  if (overdueCerts.length === 0 && dueSoonCerts.length === 0) {
    console.log('[COMPLIANCE_ALERT] No certificates overdue or within reminder window today.');
    return 0;
  }

  console.log(
    `[COMPLIANCE_ALERT] Found ${overdueCerts.length} overdue, ` +
    `${dueSoonCerts.length} due-soon certificate(s).`
  );

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  if (admins.length === 0) {
    console.log('[COMPLIANCE_ALERT] No admins/team leads to notify.');
    return overdueCerts.length + dueSoonCerts.length;
  }

  for (const admin of admins) {
    await sendComplianceReminderEmail(
      admin.email,
      admin.name,
      dueSoonCerts,
      overdueCerts
    );
  }

  console.log(
    `[COMPLIANCE_ALERT] Alerted ${admins.length} admin(s). ` +
    `Overdue: ${overdueCerts.length}, Due soon: ${dueSoonCerts.length}.`
  );
  return overdueCerts.length + dueSoonCerts.length;
}

module.exports = { runComplianceAlerts };
