/**
 * Birthday & Work Anniversary Notification Service
 * Runs daily at 8:00 AM Mon-Sat.
 * Finds active employees whose birthday or work anniversary falls on today,
 * then emails all active admins / team leads with a celebratory digest.
 */
const { sendBirthdayAnniversaryAlert } = require('./emailService');

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

  console.log(`[BIRTHDAY_ALERT] Alerted ${admins.length} admin(s).`);
  return birthdays.length + anniversaries.length;
}

module.exports = { runBirthdayAnniversaryCheck };
