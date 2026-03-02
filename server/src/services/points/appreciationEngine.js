/**
 * Appreciation Engine — peer-to-peer appreciation with anti-gaming protection.
 *
 * Anti-gaming pipeline:
 * 1. Self-check — cannot appreciate yourself
 * 2. Budget check — weekly limit (default 30 pts)
 * 3. Same-person frequency — flag if >3 to same person in 30 days
 * 4. Reason quality — min 20 chars, duplicate detection via Dice coefficient
 * 5. Penalty escalation — after 2+ warnings, deduct points from giver
 */

const { recalcTotalPoints } = require('./pointsEngine');

// ── Defaults (overridable via Settings table) ──

const DEFAULTS = {
  appreciation: 5,
  weekly_budget: 30,
  same_person_limit: 3,
  penalty: 5,
  min_reason_len: 20,
};

async function getAppreciationSettings(prisma) {
  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: 'appreciation_' } },
  });
  const vals = { ...DEFAULTS };
  for (const s of settings) {
    const k = s.key.replace('appreciation_', '');
    if (k === 'points') vals.appreciation = parseInt(s.value) || vals.appreciation;
    else if (k in vals) vals[k] = parseInt(s.value) || vals[k];
  }
  // Also check points_appreciation key
  const ptsSetting = await prisma.setting.findUnique({ where: { key: 'points_appreciation' } });
  if (ptsSetting) vals.appreciation = parseInt(ptsSetting.value) || vals.appreciation;
  return vals;
}

// ── Helpers ──

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Dice coefficient — bigram similarity between two strings (0–1).
 * Used to detect duplicate/repetitive reasons.
 */
function diceSimilarity(a, b) {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set();
  for (let i = 0; i < s1.length - 1; i++) bigrams1.add(s1.slice(i, i + 2));
  const bigrams2 = new Set();
  for (let i = 0; i < s2.length - 1; i++) bigrams2.add(s2.slice(i, i + 2));

  let intersection = 0;
  for (const b of bigrams1) {
    if (bigrams2.has(b)) intersection++;
  }
  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

// ── Core: Give Appreciation ──

async function giveAppreciation(giverId, receiverId, reason, prisma) {
  const cfg = await getAppreciationSettings(prisma);
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();

  // 1. Self-check
  if (giverId === receiverId) {
    return { success: false, error: 'You cannot appreciate yourself.' };
  }

  // Verify receiver exists
  const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, name: true } });
  if (!receiver) return { success: false, error: 'User not found.' };

  // 2. Budget check
  let budget = await prisma.appreciationBudget.findUnique({
    where: { userId_weekStart: { userId: giverId, weekStart } },
  });
  if (!budget) {
    budget = await prisma.appreciationBudget.create({
      data: { userId: giverId, weekStart, totalGiven: 0, warningCount: 0, penaltyCount: 0 },
    });
  }

  const remaining = cfg.weekly_budget - budget.totalGiven;
  if (remaining < cfg.appreciation) {
    return {
      success: false,
      error: `Weekly budget exhausted. You have ${remaining} of ${cfg.weekly_budget} points remaining. Budget resets every Monday.`,
    };
  }

  // 3. Reason quality — length
  if (!reason || reason.trim().length < cfg.min_reason_len) {
    return {
      success: false,
      error: `Reason must be at least ${cfg.min_reason_len} characters. Please explain how this person helped.`,
    };
  }

  // 4. Anti-gaming checks
  let status = 'normal';
  let flagReason = null;
  let warning = null;

  // 4a. Same-person frequency (30-day window)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const samePersonCount = await prisma.appreciation.count({
    where: {
      giverId,
      receiverId,
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  if (samePersonCount >= cfg.same_person_limit) {
    status = 'warned';
    flagReason = `Sent ${samePersonCount + 1} appreciations to the same person in 30 days (limit: ${cfg.same_person_limit})`;
    warning = `You are sending too many points to this person. You've appreciated them ${samePersonCount} times in the last 30 days. Please diversify your appreciations across the team.`;
  }

  // 4b. Reason quality — duplicate detection
  if (status === 'normal') {
    const recentReasons = await prisma.appreciation.findMany({
      where: { giverId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { reason: true },
    });

    for (const prev of recentReasons) {
      const sim = diceSimilarity(reason.trim(), prev.reason);
      if (sim > 0.7) {
        status = 'warned';
        flagReason = `Reason is too similar to a previous appreciation (${Math.round(sim * 100)}% match)`;
        warning = 'Your reason is very similar to a previous one. Please provide a unique, specific reason explaining how this person contributed.';
        break;
      }
    }
  }

  // 5. Penalty escalation — if 2+ warnings this week and another flag
  let penalty = null;
  if (status !== 'normal' && budget.warningCount >= 2) {
    status = 'penalized';
    penalty = {
      amount: cfg.penalty,
      message: `You have been penalized ${cfg.penalty} points for repeated flagged appreciations this week. Please give thoughtful, diverse appreciations with solid reasons.`,
    };
  }

  // ── Execute in transaction ──
  const result = await prisma.$transaction(async (tx) => {
    // Create appreciation record
    const appreciation = await tx.appreciation.create({
      data: {
        giverId,
        receiverId,
        points: cfg.appreciation,
        reason: reason.trim(),
        status,
        flagReason,
      },
    });

    // Award points to receiver
    await tx.pointLog.create({
      data: {
        userId: receiverId,
        date: today,
        source: 'appreciation',
        points: cfg.appreciation,
        description: `Appreciated by peer: ${reason.trim().substring(0, 80)}`,
        givenBy: giverId,
      },
    });

    // Update budget
    const budgetUpdate = {
      totalGiven: { increment: cfg.appreciation },
    };
    if (status === 'warned') budgetUpdate.warningCount = { increment: 1 };
    if (status === 'penalized') budgetUpdate.penaltyCount = { increment: 1 };

    await tx.appreciationBudget.update({
      where: { userId_weekStart: { userId: giverId, weekStart } },
      data: budgetUpdate,
    });

    // Apply penalty to giver if penalized
    if (status === 'penalized') {
      await tx.pointLog.create({
        data: {
          userId: giverId,
          date: today,
          source: 'appreciation_penalty',
          points: -cfg.penalty,
          description: `Penalty: repeated flagged appreciations`,
        },
      });
    }

    return appreciation;
  });

  // Recalc cached totals
  await recalcTotalPoints(receiverId, prisma);
  if (status === 'penalized') {
    await recalcTotalPoints(giverId, prisma);
  }

  const updatedBudget = await prisma.appreciationBudget.findUnique({
    where: { userId_weekStart: { userId: giverId, weekStart } },
  });

  return {
    success: true,
    appreciation: result,
    warning,
    penalty,
    budgetRemaining: cfg.weekly_budget - (updatedBudget?.totalGiven || 0),
  };
}

// ── Budget Query ──

async function getAppreciationBudget(userId, prisma) {
  const cfg = await getAppreciationSettings(prisma);
  const weekStart = getWeekStart();

  const budget = await prisma.appreciationBudget.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });

  return {
    total: cfg.weekly_budget,
    used: budget?.totalGiven || 0,
    remaining: cfg.weekly_budget - (budget?.totalGiven || 0),
    warnings: budget?.warningCount || 0,
    penalties: budget?.penaltyCount || 0,
    weekStart,
    pointsPerAppreciation: cfg.appreciation,
  };
}

// ── History ──

async function getAppreciationHistory(userId, type, page, prisma) {
  const take = 15;
  const skip = (page - 1) * take;

  const where = type === 'given' ? { giverId: userId } : { receiverId: userId };

  const [items, total] = await Promise.all([
    prisma.appreciation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        giver: { select: { id: true, name: true, department: true } },
        receiver: { select: { id: true, name: true, department: true } },
      },
    }),
    prisma.appreciation.count({ where }),
  ]);

  return { items, total, page, totalPages: Math.ceil(total / take) };
}

// ── Team Feed ──

async function getAppreciationFeed(limit, prisma) {
  return prisma.appreciation.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      points: true,
      reason: true,
      createdAt: true,
      receiver: { select: { id: true, name: true, department: true } },
      // Giver is intentionally excluded — appreciations are anonymous
    },
  });
}

module.exports = {
  giveAppreciation,
  getAppreciationBudget,
  getAppreciationHistory,
  getAppreciationFeed,
  getWeekStart,
  diceSimilarity,
};
