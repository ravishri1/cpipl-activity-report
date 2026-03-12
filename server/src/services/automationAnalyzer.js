/**
 * Automation Analyzer — detects repetitive tasks from EOD reports and suggests automations.
 *
 * Two-phase engine:
 *   Phase 1: Rule-based frequency grouping (normalize → group → count)
 *   Phase 2: AI semantic clustering + automation suggestions via aiRouter
 *
 * Usage:
 *   const { runAutomationAnalysis } = require('./automationAnalyzer');
 *   const result = await runAutomationAnalysis(prisma, { triggeredBy: 'manual', userId: 1, periodDays: 30 });
 */

const { callAIText } = require('./aiRouter');

// ─── Normalization helpers ─────────────────────────────────────────────────────

const FILLER_PREFIXES = [
  'worked on', 'working on', 'completed', 'did', 'doing', 'finished',
  'started', 'continued', 'handled', 'performed', 'attended to',
  'took care of', 'followed up on', 'follow up on', 'updated',
];

const DATE_PATTERNS = [
  /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,    // DD/MM/YYYY, MM-DD-YY, etc.
  /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,        // YYYY-MM-DD
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?\b/gi,
  /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?\b/gi,
];

const TICKET_PATTERNS = [
  /\b#\d{3,}\b/g,                  // #12345
  /\b[A-Z]{2,}-\d{2,}\b/g,         // JIRA-123, TICKET-456
  /\bticket\s*#?\s*\d+\b/gi,       // ticket #123, ticket 123
  /\border\s*#?\s*\d+\b/gi,        // order #789
  /\binvoice\s*#?\s*\d+\b/gi,      // invoice #101
];

/**
 * Normalize a task description for frequency grouping.
 * Lowercases, strips dates/numbers/ticket IDs, removes filler prefixes, collapses whitespace.
 */
function normalizeTaskDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';

  let normalized = desc.toLowerCase().trim();

  // Strip dates
  for (const pattern of DATE_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }

  // Strip ticket/order/invoice numbers
  for (const pattern of TICKET_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }

  // Strip standalone numbers (3+ digits)
  normalized = normalized.replace(/\b\d{3,}\b/g, '');

  // Remove filler prefixes
  for (const prefix of FILLER_PREFIXES) {
    if (normalized.startsWith(prefix + ' ')) {
      normalized = normalized.slice(prefix.length).trim();
    }
    if (normalized.startsWith(prefix + ':')) {
      normalized = normalized.slice(prefix.length + 1).trim();
    }
  }

  // Remove common punctuation (keep letters, spaces, basic connectors)
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// ─── Phase 1: Rule-based frequency grouping ────────────────────────────────────

/**
 * Fetch all ReportTasks in date range, normalize descriptions, group by normalized key.
 * Returns clusters with metadata: frequency, users, hours, sample descriptions.
 */
async function collectAndGroupTasks(prisma, periodDays = 30) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - periodDays);

  const startStr = startDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const endStr = today.toISOString().split('T')[0];

  // Fetch all tasks with user info in the date range
  const tasks = await prisma.reportTask.findMany({
    where: {
      report: {
        reportDate: { gte: startStr, lte: endStr },
      },
    },
    select: {
      description: true,
      hours: true,
      report: {
        select: {
          reportDate: true,
          userId: true,
          user: {
            select: { id: true, name: true, department: true },
          },
        },
      },
    },
  });

  if (tasks.length === 0) return { clusters: [], totalTasks: 0, totalReports: 0, totalUsers: 0 };

  // Count unique reports and users
  const reportIds = new Set();
  const userIds = new Set();
  tasks.forEach(t => {
    reportIds.add(`${t.report.userId}-${t.report.reportDate}`);
    userIds.add(t.report.userId);
  });

  // Group by normalized description
  const groups = new Map();

  for (const task of tasks) {
    const normalized = normalizeTaskDescription(task.description);
    if (!normalized || normalized.length < 3) continue; // Skip empty/tiny

    if (!groups.has(normalized)) {
      groups.set(normalized, {
        normalizedKey: normalized,
        frequency: 0,
        totalHours: 0,
        users: new Map(),     // userId → { id, name, department, occurrences, totalHours }
        dates: new Set(),
        sampleDescriptions: [],
      });
    }

    const group = groups.get(normalized);
    group.frequency += 1;
    group.totalHours += task.hours || 0;

    const userId = task.report.user.id;
    if (!group.users.has(userId)) {
      group.users.set(userId, {
        id: userId,
        name: task.report.user.name,
        department: task.report.user.department || 'N/A',
        occurrences: 0,
        totalHours: 0,
      });
    }
    const userEntry = group.users.get(userId);
    userEntry.occurrences += 1;
    userEntry.totalHours += task.hours || 0;

    group.dates.add(task.report.reportDate);

    // Keep up to 5 unique sample descriptions
    if (group.sampleDescriptions.length < 5 && !group.sampleDescriptions.includes(task.description)) {
      group.sampleDescriptions.push(task.description);
    }
  }

  // Filter: only groups with frequency >= 3
  const weeks = periodDays / 7;
  const clusters = Array.from(groups.values())
    .filter(g => g.frequency >= 3)
    .map(g => ({
      normalizedKey: g.normalizedKey,
      frequency: g.frequency,
      frequencyPerWeek: Math.round((g.frequency / weeks) * 10) / 10,
      totalHours: Math.round(g.totalHours * 10) / 10,
      hoursPerWeek: Math.round((g.totalHours / weeks) * 10) / 10,
      uniqueDays: g.dates.size,
      affectedUsers: Array.from(g.users.values()).map(u => ({
        ...u,
        totalHours: Math.round(u.totalHours * 10) / 10,
        hoursPerWeek: Math.round((u.totalHours / weeks) * 10) / 10,
      })),
      affectedUserCount: g.users.size,
      sampleDescriptions: g.sampleDescriptions,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  return {
    clusters,
    totalTasks: tasks.length,
    totalReports: reportIds.size,
    totalUsers: userIds.size,
  };
}

// ─── Phase 2: AI semantic clustering ───────────────────────────────────────────

/**
 * Build prompt for AI to merge similar clusters, categorize, and suggest automations.
 */
function buildAnalysisPrompt(clusters) {
  const top50 = clusters.slice(0, 50);

  const clusterLines = top50.map((c, i) =>
    `${i + 1}. "${c.normalizedKey}" — freq: ${c.frequency} (${c.frequencyPerWeek}/wk), hours: ${c.totalHours}h (${c.hoursPerWeek}h/wk), users: ${c.affectedUserCount}, samples: ${JSON.stringify(c.sampleDescriptions.slice(0, 3))}`
  ).join('\n');

  return `You are an automation consultant for a small Indian business (Color Papers India Pvt Ltd, ~34 employees).

Analyze these recurring task clusters found in employee daily activity reports over the past 30 days:

${clusterLines}

INSTRUCTIONS:
1. Merge semantically similar clusters (e.g., "email vendor followup" and "followup vendor email" should be ONE pattern)
2. For each merged pattern, provide:
   - patternName: Short, clear name (e.g., "Vendor Email Follow-ups")
   - patternDescription: 1-2 sentence description of what this recurring work involves
   - category: One of: data_entry, communication, reporting, scheduling, procurement, approval, general
   - automationSuggestion: Specific, actionable automation recommendation (2-3 sentences)
   - suggestedTools: Array of tools/platforms (prefer free/cheap: Google Apps Script, Google Sheets formulas, Zapier free tier, Tally forms, WhatsApp Business API, custom Node.js scripts, cron jobs)
   - priority: "high" if frequency > 20/month AND hours > 5h/week, "medium" if frequency > 10/month, "low" otherwise
   - estimatedSavingsPercent: What % of time could be saved (0-100)
   - mergedClusterIndexes: Which input cluster numbers (1-based) were merged into this

IMPORTANT:
- Return ONLY valid JSON array, no markdown fences or explanation
- Maximum 20 insights, sorted by estimated hours saveable (highest first)
- Be specific about HOW to automate (not just "automate this")
- Consider Indian SMB context (budget-conscious, Google Workspace users)

Response format:
[
  {
    "patternName": "...",
    "patternDescription": "...",
    "category": "...",
    "automationSuggestion": "...",
    "suggestedTools": ["..."],
    "priority": "high|medium|low",
    "estimatedSavingsPercent": 50,
    "mergedClusterIndexes": [1, 3, 7]
  }
]`;
}

/**
 * Call AI to analyze clusters and return structured insights.
 */
async function analyzeWithAI(clusters, prisma) {
  if (clusters.length === 0) return { insights: [], aiModel: null };

  const prompt = buildAnalysisPrompt(clusters);
  let rawResponse;
  let aiModel = 'unknown';

  try {
    rawResponse = await callAIText('classification', prompt, { prisma });
  } catch (err) {
    console.error('[AutomationAnalyzer] AI call failed:', err.message);
    // Return rule-based insights without AI merging as fallback
    return {
      insights: clusters.slice(0, 20).map(c => ({
        patternName: capitalize(c.normalizedKey),
        patternDescription: `Recurring task found ${c.frequency} times across ${c.affectedUserCount} users.`,
        category: 'general',
        automationSuggestion: 'Review this recurring pattern for potential automation.',
        suggestedTools: [],
        priority: c.frequency > 20 && c.hoursPerWeek > 5 ? 'high' : c.frequency > 10 ? 'medium' : 'low',
        estimatedSavingsPercent: 30,
        mergedClusterIndexes: [],
      })),
      aiModel: 'fallback_rule_based',
    };
  }

  // Parse JSON from AI response
  try {
    // Strip markdown fences if present
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const insights = JSON.parse(cleaned);
    if (!Array.isArray(insights)) throw new Error('Response is not an array');
    return { insights: insights.slice(0, 20), aiModel };
  } catch (parseErr) {
    console.error('[AutomationAnalyzer] Failed to parse AI response:', parseErr.message);
    console.error('[AutomationAnalyzer] Raw response:', rawResponse?.slice(0, 500));
    // Fall back to rule-based
    return {
      insights: clusters.slice(0, 20).map(c => ({
        patternName: capitalize(c.normalizedKey),
        patternDescription: `Recurring task: ${c.frequency} occurrences, ${c.affectedUserCount} users.`,
        category: 'general',
        automationSuggestion: 'Review this recurring pattern for potential automation.',
        suggestedTools: [],
        priority: c.frequency > 20 && c.hoursPerWeek > 5 ? 'high' : c.frequency > 10 ? 'medium' : 'low',
        estimatedSavingsPercent: 30,
        mergedClusterIndexes: [],
      })),
      aiModel: 'fallback_parse_error',
    };
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['data_entry', 'communication', 'reporting', 'scheduling', 'procurement', 'approval', 'general'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

/**
 * Run full automation analysis pipeline.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ triggeredBy: 'manual'|'cron', userId?: number, periodDays?: number }} opts
 */
async function runAutomationAnalysis(prisma, { triggeredBy = 'manual', userId = null, periodDays = 30 } = {}) {
  const analysisDate = new Date().toISOString().split('T')[0];
  const startTime = Date.now();

  // Check if already running
  const running = await prisma.automationAnalysisLog.findFirst({
    where: { status: 'running' },
    orderBy: { createdAt: 'desc' },
  });
  if (running) {
    const runningMinutes = (Date.now() - new Date(running.createdAt).getTime()) / 60000;
    if (runningMinutes < 10) {
      throw new Error('Analysis already running. Please wait for it to complete.');
    }
    // Stale "running" record (>10 min) — mark it failed
    await prisma.automationAnalysisLog.update({
      where: { id: running.id },
      data: { status: 'failed', error: 'Timed out after 10 minutes' },
    });
  }

  // Create log entry
  const log = await prisma.automationAnalysisLog.create({
    data: {
      analysisDate,
      periodDays,
      triggeredBy,
      triggeredByUserId: userId,
      status: 'running',
    },
  });

  try {
    // Phase 1: Rule-based grouping
    const { clusters, totalTasks, totalReports, totalUsers } = await collectAndGroupTasks(prisma, periodDays);

    // Phase 2: AI analysis
    const { insights, aiModel } = await analyzeWithAI(clusters, prisma);

    // Soft-delete old insights for same analysis date
    await prisma.automationInsight.updateMany({
      where: { analysisDate, isActive: true },
      data: { isActive: false },
    });

    // Create new insights
    const weeks = periodDays / 7;
    let insightsCreated = 0;

    for (const insight of insights) {
      // Resolve affected users from merged clusters
      const mergedIndexes = insight.mergedClusterIndexes || [];
      const relevantClusters = mergedIndexes.length > 0
        ? mergedIndexes.map(i => clusters[i - 1]).filter(Boolean)
        : [];

      // Merge user data from relevant clusters
      const userMap = new Map();
      const sampleTasks = [];

      if (relevantClusters.length > 0) {
        for (const cluster of relevantClusters) {
          for (const user of cluster.affectedUsers) {
            if (!userMap.has(user.id)) {
              userMap.set(user.id, { ...user });
            } else {
              const existing = userMap.get(user.id);
              existing.occurrences += user.occurrences;
              existing.totalHours += user.totalHours;
              existing.hoursPerWeek = Math.round((existing.totalHours / weeks) * 10) / 10;
            }
          }
          sampleTasks.push(...cluster.sampleDescriptions);
        }
      }

      // Calculate totals
      const affectedUsers = Array.from(userMap.values());
      const totalFrequency = relevantClusters.reduce((s, c) => s + c.frequency, 0) || insight.estimatedSavingsPercent || 0;
      const totalHoursAll = relevantClusters.reduce((s, c) => s + c.totalHours, 0);
      const hoursPerWeek = Math.round((totalHoursAll / weeks) * 10) / 10;
      const savingsPercent = insight.estimatedSavingsPercent || 30;
      const estimatedSavingsPerWeek = Math.round((hoursPerWeek * savingsPercent / 100) * 10) / 10;

      const category = VALID_CATEGORIES.includes(insight.category) ? insight.category : 'general';
      const priority = VALID_PRIORITIES.includes(insight.priority) ? insight.priority : 'medium';

      await prisma.automationInsight.create({
        data: {
          patternName: insight.patternName || 'Unnamed Pattern',
          patternDescription: insight.patternDescription || null,
          category,
          frequency: totalFrequency,
          frequencyPerWeek: Math.round((totalFrequency / weeks) * 10) / 10,
          totalHoursPerWeek: hoursPerWeek,
          estimatedSavingsPerWeek,
          affectedUsers: affectedUsers.length > 0 ? affectedUsers : null,
          affectedUserCount: affectedUsers.length,
          sampleTasks: sampleTasks.length > 0 ? [...new Set(sampleTasks)].slice(0, 10) : null,
          automationSuggestion: insight.automationSuggestion || null,
          suggestedTools: insight.suggestedTools || null,
          priority,
          status: 'new',
          analysisDate,
          analysisPeriodDays: periodDays,
          isActive: true,
        },
      });
      insightsCreated++;
    }

    // Update log
    const durationMs = Date.now() - startTime;
    await prisma.automationAnalysisLog.update({
      where: { id: log.id },
      data: {
        totalReports,
        totalTasks,
        totalUsers,
        clustersFound: clusters.length,
        insightsCreated,
        aiModel,
        durationMs,
        status: 'completed',
      },
    });

    return { insightsCreated, clustersFound: clusters.length, totalTasks, totalUsers, durationMs, aiModel };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await prisma.automationAnalysisLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: err.message, durationMs },
    }).catch(() => {}); // Don't throw on log update failure

    throw err;
  }
}

module.exports = { runAutomationAnalysis, normalizeTaskDescription, collectAndGroupTasks };
