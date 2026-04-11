/**
 * Weekly Off Helper — resolves per-user weekly off days for a given month
 * Priority: individual WeeklyOffAssignment > department WeeklyOffAssignment > weeklyOffPatternId on user > default [0,6]
 */

const DEFAULT_OFF_DAYS = [0, 6]; // Sunday, Saturday

/**
 * Get weekly off days for multiple users for a specific month.
 * month: "2025-04" (optional — if omitted, falls back to legacy weeklyOffPatternId)
 * Returns Map<userId, number[]>
 */
async function getWeeklyOffMap(userIds, prisma, month) {
  if (!userIds || userIds.length === 0) return new Map();

  const monthStart = month ? `${month}-01` : null;
  const monthEnd = month ? `${month}-31` : null;

  // Fetch users with their pattern and department
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      department: true,
      companyId: true,
      weeklyOffPattern: { select: { days: true } },
    },
  });

  // Fetch date-ranged assignments that overlap this month
  let assignments = [];
  if (month) {
    assignments = await prisma.weeklyOffAssignment.findMany({
      where: {
        effectiveFrom: { lte: monthEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
      },
      include: { pattern: { select: { days: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
    // Filter to only assignments relevant to these users/departments
    const depts = [...new Set(users.map(u => u.department).filter(Boolean))];
    assignments = assignments.filter(a =>
      (a.userId !== null && userIds.includes(a.userId)) ||
      (a.userId === null && a.department && depts.includes(a.department))
    );
  }

  const map = new Map();

  for (const u of users) {
    // 1. Check individual assignment first
    const individualAssignment = assignments.find(a => a.userId === u.id);
    if (individualAssignment) {
      try { map.set(u.id, JSON.parse(individualAssignment.pattern.days)); continue; } catch {}
    }

    // 2. Check department assignment
    if (u.department) {
      const deptAssignment = assignments.find(a => a.userId === null && a.department === u.department);
      if (deptAssignment) {
        try { map.set(u.id, JSON.parse(deptAssignment.pattern.days)); continue; } catch {}
      }
    }

    // 3. Fall back to legacy weeklyOffPatternId on User
    if (u.weeklyOffPattern?.days) {
      try { map.set(u.id, JSON.parse(u.weeklyOffPattern.days)); continue; } catch {}
    }

    // 4. Default
    map.set(u.id, DEFAULT_OFF_DAYS);
  }

  // Fill any missing
  for (const id of userIds) {
    if (!map.has(id)) map.set(id, DEFAULT_OFF_DAYS);
  }

  return map;
}

async function getUserWeeklyOffDays(userId, prisma, month) {
  const map = await getWeeklyOffMap([userId], prisma, month);
  return map.get(userId) || DEFAULT_OFF_DAYS;
}

function isDayOff(dayOfWeek, offDays) {
  return offDays.includes(dayOfWeek);
}

module.exports = { getUserWeeklyOffDays, getWeeklyOffMap, isDayOff, DEFAULT_OFF_DAYS };
