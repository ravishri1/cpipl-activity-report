/**
 * Weekly Off Helper — resolves per-user weekly off days
 * Default: [0, 6] (Sunday + Saturday)
 */

const DEFAULT_OFF_DAYS = [0, 6]; // Sunday, Saturday

/**
 * Get weekly off days for a single user
 * Returns array of day numbers (0=Sun, 1=Mon, ..., 6=Sat)
 */
async function getUserWeeklyOffDays(userId, prisma) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      weeklyOffPattern: { select: { days: true } },
    },
  });

  if (user?.weeklyOffPattern?.days) {
    try {
      return JSON.parse(user.weeklyOffPattern.days);
    } catch {
      return DEFAULT_OFF_DAYS;
    }
  }
  return DEFAULT_OFF_DAYS;
}

/**
 * Get weekly off days for multiple users (batch)
 * Returns Map<userId, number[]>
 */
async function getWeeklyOffMap(userIds, prisma) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      weeklyOffPattern: { select: { days: true } },
    },
  });

  const map = new Map();
  for (const u of users) {
    if (u.weeklyOffPattern?.days) {
      try {
        map.set(u.id, JSON.parse(u.weeklyOffPattern.days));
      } catch {
        map.set(u.id, DEFAULT_OFF_DAYS);
      }
    } else {
      map.set(u.id, DEFAULT_OFF_DAYS);
    }
  }

  // Fill missing with default
  for (const id of userIds) {
    if (!map.has(id)) map.set(id, DEFAULT_OFF_DAYS);
  }

  return map;
}

/**
 * Check if a day-of-week is a weekly off for a user
 */
function isDayOff(dayOfWeek, offDays) {
  return offDays.includes(dayOfWeek);
}

module.exports = { getUserWeeklyOffDays, getWeeklyOffMap, isDayOff, DEFAULT_OFF_DAYS };
