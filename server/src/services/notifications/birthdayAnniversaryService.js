/**
 * Birthday & Work Anniversary Notification Service
 * Runs daily at 8:00 AM Mon-Sat.
 * Finds active employees whose birthday or work anniversary falls on today,
 * then emails all active admins / team leads with a celebratory digest.
 */
const { sendBirthdayAnniversaryAlert, sendEmail } = require('./emailService');

/**
 * Returns today's "MM-DD" suffix used to match stored "YYYY-MM-DD" strings.
 * @param {string} today  "YYYY-MM-DD"
 */
function getMonthDay(today) {
  return today.slice(5); // e.g. "03-05"
}

/**
 * Calculate age or years-of-service from a YYYY-MM-DD date string and a reference year.
 * @param {string} dateStr   "YYYY-MM-DD"
 * @param {number} refYear   e.g. 2026
 * @returns {number}
 */
function yearsFrom(dateStr, refYear) {
  return refYear - parseInt(dateStr.split('-')[0], 10);
}

/**
 * Main entry point — called by the cron scheduler.
 * @param {PrismaClient} prisma
 * @returns {number}  total count of birthday + anniversary employees found
 */
async function runBirthdayAnniversaryCheck(prisma) {
  const today    = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const monthDay = getMonthDay(today);                     // "MM-DD"
  const thisYear = parseInt(today.split('-')[0], 10);

  console.log(`[BIRTHDAY_ALERT] Running birthday/anniversary check for ${today} (MM-DD: ${monthDay})`);

  // ── Birthdays ──────────────────────────────────────────────────────────────
  const birthdayUsers = await prisma.user.findMany({
    where: {
      isActive:    true,
      dateOfBirth: { endsWith: monthDay },
    },
    select: {
      id:          true,
      name:        true,
      email:       true,
      department:  true,
      designation: true,
      dateOfBirth: true,
      profilePhotoUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  // Annotate with age (omit if age would be unrealistic — bad data guard)
  const birthdays = birthdayUsers
    .map((u) => ({
      ...u,
      age: yearsFrom(u.dateOfBirth, thisYear),
    }))
    .filter((u) => u.age > 0 && u.age < 100);

  // ── Work Anniversaries ─────────────────────────────────────────────────────
  const anniversaryUsers = await prisma.user.findMany({
    where: {
      isActive:      true,
      dateOfJoining: { endsWith: monthDay },
    },
    select: {
      id:            true,
      name:          true,
      email:         true,
      department:    true,
      designation:   true,
      dateOfJoining: true,
    },
    orderBy: { name: 'asc' },
  });

  // Only count anniversaries >= 1 year (exclude people joining for the first time today)
  const anniversaries = anniversaryUsers
    .map((u) => ({
      ...u,
      years: yearsFrom(u.dateOfJoining, thisYear),
    }))
    .filter((u) => u.years >= 1);

  if (birthdays.length === 0 && anniversaries.length === 0) {
    console.log('[BIRTHDAY_ALERT] No birthdays or anniversaries today.');
    return 0;
  }

  console.log(
    `[BIRTHDAY_ALERT] Found ${birthdays.length} birthday(s) and ${anniversaries.length} anniversary(-ies) today.`
  );

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendBirthdayAnniversaryAlert(admin.email, admin.name, birthdays, anniversaries);
  }

  // ── Personal emails to each birthday / anniversary employee ───────────────
  for (const u of birthdays) {
    if (!u.email) continue;
    const html = `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:28px;background:#fffbeb;border-radius:12px;border:1px solid #fde68a">
      <div style="font-size:48px;text-align:center;margin-bottom:12px">🎂</div>
      <h2 style="color:#92400e;text-align:center;margin:0 0 8px">Happy Birthday, ${u.name}!</h2>
      <p style="color:#78350f;text-align:center;font-size:15px;margin:0 0 20px">
        Wishing you a wonderful birthday filled with joy and happiness.<br/>
        The entire team at Color Papers is thinking of you today!
      </p>
      <p style="color:#a16207;text-align:center;font-size:13px;margin:0">— CPIPL HR Team</p>
    </div>`;
    await sendEmail(u.email, `Happy Birthday, ${u.name}! 🎂`, html);
  }

  for (const u of anniversaries) {
    if (!u.email) continue;
    const yrs = u.years;
    const html = `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:28px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe">
      <div style="font-size:48px;text-align:center;margin-bottom:12px">🏆</div>
      <h2 style="color:#1e40af;text-align:center;margin:0 0 8px">Happy Work Anniversary, ${u.name}!</h2>
      <p style="color:#1e3a8a;text-align:center;font-size:15px;margin:0 0 12px">
        Congratulations on completing <strong>${yrs} year${yrs > 1 ? 's' : ''}</strong> with Color Papers!<br/>
        Your dedication and hard work are truly valued. Thank you for being such an important part of our team.
      </p>
      <p style="color:#2563eb;text-align:center;font-size:13px;margin:0">— CPIPL HR Team</p>
    </div>`;
    await sendEmail(u.email, `Happy Work Anniversary, ${u.name}! 🏆 ${yrs} Year${yrs > 1 ? 's' : ''}`, html);
  }

  console.log(`[BIRTHDAY_ALERT] Alerted ${admins.length} admin(s) + ${birthdays.length} birthday + ${anniversaries.length} anniversary personal emails.`);
  return birthdays.length + anniversaries.length;
}

module.exports = { runBirthdayAnniversaryCheck };
