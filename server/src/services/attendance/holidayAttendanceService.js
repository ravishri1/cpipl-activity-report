/**
 * holidayAttendanceService.js
 * Automatically marks attendance as 'holiday' for all active employees
 * on holiday dates, respecting per-user location (Mumbai / Lucknow / All).
 *
 * Called by:
 *  - cronJobs.js  (local dev, daily 12:15 AM IST)
 *  - internal.js  (Vercel production, via 'maintenance' job)
 */

/**
 * Mark today's attendance as 'holiday' for eligible employees.
 * Only employees who have NOT already checked in are marked — if someone
 * clocks in on a holiday (OT / emergency), their status stays 'present'.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} [dateOverride]  - Optional "YYYY-MM-DD" for back-filling
 * @returns {{ date: string, holidaysFound: number, marked: number, skipped: number }}
 */
async function runHolidayAttendanceMark(prisma, dateOverride) {
  // Use IST (UTC+5:30) for today's date
  const today = dateOverride
    || new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

  // Check if today has any holidays
  const todayHolidays = await prisma.holiday.findMany({
    where: { date: today },
    select: { id: true, name: true, location: true },
  });

  if (todayHolidays.length === 0) {
    console.log(`[HolidayAttendance] ${today}: No holidays — skipping.`);
    return { date: today, holidaysFound: 0, marked: 0, skipped: 0 };
  }

  console.log(`[HolidayAttendance] ${today}: ${todayHolidays.length} holiday record(s) found.`);

  // Collect locations that have a holiday today
  const holidayLocations = new Set(todayHolidays.map(h => h.location)); // e.g. {'All', 'Mumbai'}

  // Fetch all active, non-exempt employees
  const users = await prisma.user.findMany({
    where: { isActive: true, isAttendanceExempt: { not: true } },
    select: { id: true, name: true, location: true },
  });

  // Determine which users get the holiday
  const eligibleUserIds = [];
  for (const user of users) {
    const userLoc = user.location || 'All';
    // Employee gets the holiday if:
    //   - There's an 'All' holiday (applies everywhere), OR
    //   - There's a holiday specifically for their location
    if (holidayLocations.has('All') || holidayLocations.has(userLoc)) {
      eligibleUserIds.push(user.id);
    }
  }

  if (eligibleUserIds.length === 0) {
    console.log(`[HolidayAttendance] ${today}: No eligible employees.`);
    return { date: today, holidaysFound: todayHolidays.length, marked: 0, skipped: 0 };
  }

  // Fetch existing attendance records for today (to avoid overriding check-ins)
  const existing = await prisma.attendance.findMany({
    where: { userId: { in: eligibleUserIds }, date: today },
    select: { userId: true, checkIn: true, adminOverride: true },
  });
  const checkedInIds = new Set(
    existing.filter(a => a.checkIn || a.adminOverride).map(a => a.userId)
  );

  let marked = 0, skipped = 0;
  const ops = [];

  for (const userId of eligibleUserIds) {
    if (checkedInIds.has(userId)) {
      skipped++; // already checked in or admin-overridden — don't touch
      continue;
    }
    ops.push(
      prisma.attendance.upsert({
        where: { userId_date: { userId, date: today } },
        create: { userId, date: today, status: 'holiday' },
        update: { status: 'holiday' },
      })
    );
    marked++;
  }

  if (ops.length > 0) await Promise.all(ops);

  const holidayNames = [...new Set(todayHolidays.map(h => h.name))].join(', ');
  console.log(
    `[HolidayAttendance] ${today}: "${holidayNames}" — marked ${marked}, skipped ${skipped} (checked-in/overridden)`
  );
  return { date: today, holidaysFound: todayHolidays.length, marked, skipped };
}

module.exports = { runHolidayAttendanceMark };
