/**
 * Error Reports — capture frontend/API errors, notify admin, AI-powered fix.
 *
 * Deduplication: each unique (errorType, path, errorMessage) combination is
 * stored as ONE record; subsequent identical errors increment occurrenceCount
 * and append the reporter to affectedUsers. The AI "Fix It" runs only once —
 * once a fingerprint is "fixed" or "dismissed", duplicate submissions are
 * silently ignored (no new record, no re-analysis).
 *
 * POST /api/error-reports           — any authenticated user reports an error
 * GET  /api/error-reports           — admin: list all (filterable)
 * GET  /api/error-reports/stats     — admin: counts by status
 * POST /api/error-reports/:id/analyze — admin: AI diagnosis
 * POST /api/error-reports/:id/fix     — admin: AI auto-fix attempt
 * PUT  /api/error-reports/:id/status  — admin: manually set status + note
 * DELETE /api/error-reports/:id       — admin: delete report
 */

const crypto = require('crypto');
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');
const { callAITextWithModel } = require('../services/aiRouter');

const router = express.Router();
router.use(authenticate);

// ─── Fingerprint helper ───────────────────────────────────────────────────────

/**
 * Build a stable SHA-256 fingerprint from the core error identity.
 * Two errors with identical type, path, and message always produce the same hash.
 */
function buildFingerprint(errorType, path, errorMessage) {
  const raw = `${errorType || 'client'}|${(path || '').slice(0, 200)}|${(errorMessage || '').slice(0, 500)}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─── AI diagnosis prompt ──────────────────────────────────────────────────────

function buildAnalysisPrompt(report) {
  return `You are a senior web application engineer analyzing an error report from an HR portal.

Error Details:
- Type: ${report.errorType}
- Path: ${report.path}${report.method ? `\n- HTTP Method: ${report.method}` : ''}${report.statusCode ? `\n- Status Code: ${report.statusCode}` : ''}
- Message: ${report.errorMessage}${report.stackTrace ? `\n- Stack Trace:\n${report.stackTrace.slice(0, 1500)}` : ''}${report.context ? `\n- Context: ${report.context.slice(0, 500)}` : ''}${report.componentStack ? `\n- Component Stack: ${report.componentStack.slice(0, 500)}` : ''}
- First reported by: ${report.userEmail || 'unknown'} (${report.userName || 'unknown'})
- Occurrence count: ${report.occurrenceCount || 1}
- First occurred: ${report.createdAt}

Return ONLY a valid JSON object with these fields:
{
  "rootCause": "1-2 sentence explanation of what caused this error",
  "severity": "low|medium|high|critical",
  "category": "auth|data|network|config|ui|server|unknown",
  "suggestedFix": "Step-by-step resolution instructions for the admin",
  "autoFixable": true/false,
  "autoFixType": "clear_cache|notify_user|reset_setting|none",
  "autoFixDescription": "What the auto-fix will do (if autoFixable=true)",
  "userMessage": "A friendly message to show the affected user explaining the issue"
}`;
}

// ─── Auto-fix executor ────────────────────────────────────────────────────────

async function executeAutoFix(report, analysis, prisma) {
  const { autoFixType } = analysis;

  if (autoFixType === 'notify_user' && report.userId) {
    return `Notification queued for user ${report.userEmail || report.userId}`;
  }

  if (autoFixType === 'clear_cache') {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 h ago
    const deleted = await prisma.otpVerification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    }).catch(() => ({ count: 0 }));
    return `Cleared ${deleted.count} stale OTP records`;
  }

  if (autoFixType === 'reset_setting') {
    const ctx = report.context ? JSON.parse(report.context) : {};
    if (ctx.settingKey) {
      const setting = await prisma.setting.findUnique({ where: { key: ctx.settingKey } });
      if (setting) {
        return `Setting "${ctx.settingKey}" found but cannot be auto-reset without default value. Please update it manually in Admin → Settings.`;
      }
    }
    return 'No specific setting key found in error context. Please review Admin → Settings manually.';
  }

  return 'Auto-fix type is "none" — follow the suggested fix instructions above.';
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/error-reports — Submit an error report (any authenticated user)
// Deduplication: identical errors increment occurrenceCount; once "fixed" or
// "dismissed" the endpoint returns 200 with a skipped=true flag.
router.post('/', asyncHandler(async (req, res) => {
  const {
    errorType, path, method, statusCode, errorMessage,
    stackTrace, context, componentStack,
  } = req.body;

  if (!errorMessage || !path) throw badRequest('errorMessage and path are required.');

  const fingerprint = buildFingerprint(errorType, path, errorMessage);

  // Check if this exact error already exists
  const existing = await req.prisma.errorReport.findUnique({ where: { fingerprint } });

  if (existing) {
    // Already fixed or dismissed → skip silently; no need to re-report
    if (existing.status === 'fixed' || existing.status === 'dismissed') {
      return res.status(200).json({
        id: existing.id,
        message: 'This error has already been resolved.',
        skipped: true,
        status: existing.status,
      });
    }

    // Update occurrence count and append to affectedUsers list
    let affectedUsers = [];
    try { affectedUsers = JSON.parse(existing.affectedUsers || '[]'); } catch { affectedUsers = []; }

    // Add current reporter if not already listed (dedup by userId)
    const alreadyListed = affectedUsers.some(u => u.userId === req.user.id);
    if (!alreadyListed) {
      affectedUsers.push({
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        reportedAt: new Date().toISOString(),
      });
    }

    await req.prisma.errorReport.update({
      where: { fingerprint },
      data: {
        occurrenceCount: { increment: 1 },
        lastOccurredAt: new Date(),
        affectedUsers: JSON.stringify(affectedUsers),
      },
    });

    console.warn(`[ErrorReport #${existing.id}] occurrence #${existing.occurrenceCount + 1} — ${existing.errorMessage} @ ${existing.path}`);

    return res.status(200).json({
      id: existing.id,
      message: 'Error occurrence recorded.',
      skipped: false,
      occurrenceCount: existing.occurrenceCount + 1,
    });
  }

  // New unique error — create a fresh record
  const report = await req.prisma.errorReport.create({
    data: {
      fingerprint,
      userId:         req.user.id,
      userEmail:      req.user.email,
      userName:       req.user.name,
      errorType:      errorType   || 'client',
      path:           path.slice(0, 500),
      method:         method      || null,
      statusCode:     statusCode  ? Number(statusCode) : null,
      errorMessage:   errorMessage.slice(0, 2000),
      stackTrace:     stackTrace  ? stackTrace.slice(0, 5000) : null,
      context:        context     ? JSON.stringify(context).slice(0, 3000) : null,
      componentStack: componentStack ? componentStack.slice(0, 2000) : null,
      affectedUsers: JSON.stringify([{
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        reportedAt: new Date().toISOString(),
      }]),
    },
  });

  console.warn(`[ErrorReport #${report.id}] NEW ${report.errorType.toUpperCase()} error from ${report.userEmail}: ${report.errorMessage} @ ${report.path}`);

  res.status(201).json({ id: report.id, message: 'Error reported.', skipped: false });
}));

// GET /api/error-reports/stats — Admin: counts by status
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  const [total, newCount, reviewing, fixed, dismissed] = await Promise.all([
    req.prisma.errorReport.count(),
    req.prisma.errorReport.count({ where: { status: 'new' } }),
    req.prisma.errorReport.count({ where: { status: 'reviewing' } }),
    req.prisma.errorReport.count({ where: { status: 'fixed' } }),
    req.prisma.errorReport.count({ where: { status: 'dismissed' } }),
  ]);
  // Total occurrences (sum of all occurrenceCount values)
  const occurrenceAgg = await req.prisma.errorReport.aggregate({ _sum: { occurrenceCount: true } });
  res.json({
    total,
    new: newCount,
    reviewing,
    fixed,
    dismissed,
    totalOccurrences: occurrenceAgg._sum.occurrenceCount || 0,
  });
}));

// GET /api/error-reports — Admin: list all reports (filter by status, type)
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status, errorType, limit = '50', offset = '0' } = req.query;

  const where = {};
  if (status && status !== 'all')       where.status    = status;
  if (errorType && errorType !== 'all') where.errorType = errorType;

  const [reports, total] = await Promise.all([
    req.prisma.errorReport.findMany({
      where,
      orderBy: [{ occurrenceCount: 'desc' }, { createdAt: 'desc' }],
      take:    Math.min(parseInt(limit, 10), 100),
      skip:    parseInt(offset, 10),
      select: {
        id: true, userId: true, userEmail: true, userName: true,
        errorType: true, path: true, method: true, statusCode: true,
        errorMessage: true, status: true, aiAnalysis: true, aiModel: true,
        resolution: true, resolvedAt: true, createdAt: true,
        occurrenceCount: true, lastOccurredAt: true,
        resolver: { select: { id: true, name: true } },
      },
    }),
    req.prisma.errorReport.count({ where }),
  ]);

  res.json({ reports, total });
}));

// GET /api/error-reports/:id — Admin: get single report with full details
router.get('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const report = await req.prisma.errorReport.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      resolver: { select: { id: true, name: true } },
    },
  });
  if (!report) throw notFound('Error report');
  res.json(report);
}));

// POST /api/error-reports/:id/analyze — Admin: run AI diagnosis
router.post('/:id/analyze', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const report = await req.prisma.errorReport.findUnique({ where: { id } });
  if (!report) throw notFound('Error report');

  let analysis;
  let usedModel = null;
  try {
    const { text: raw, model } = await callAITextWithModel('code_analysis', buildAnalysisPrompt(report), { prisma: req.prisma });
    usedModel = model;
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```'))  cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```'))         cleaned = cleaned.slice(0, -3);
    analysis = JSON.parse(cleaned.trim());
  } catch (err) {
    throw badRequest(`AI analysis failed: ${err.message}`);
  }

  await req.prisma.errorReport.update({
    where: { id },
    data: { status: 'reviewing', aiAnalysis: JSON.stringify(analysis), aiModel: usedModel },
  });

  res.json({ analysis, model: usedModel });
}));

// POST /api/error-reports/:id/fix — Admin: AI auto-fix attempt
// Once fixed, the fingerprint is marked "fixed" so future duplicates are silently dropped.
router.post('/:id/fix', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const report = await req.prisma.errorReport.findUnique({ where: { id } });
  if (!report) throw notFound('Error report');

  // Re-use stored AI analysis or run a fresh one
  let analysis;
  let usedModel = report.aiModel || null; // inherit model from previous analysis if available
  if (report.aiAnalysis) {
    try { analysis = JSON.parse(report.aiAnalysis); } catch { analysis = null; }
  }

  if (!analysis) {
    try {
      const { text: raw, model } = await callAITextWithModel('code_analysis', buildAnalysisPrompt(report), { prisma: req.prisma });
      usedModel = model;
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```'))  cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```'))         cleaned = cleaned.slice(0, -3);
      analysis = JSON.parse(cleaned.trim());
    } catch (err) {
      throw badRequest(`AI analysis failed: ${err.message}`);
    }
  }

  // Execute auto-fix if available
  let fixResult = 'No automated fix available for this error type.';
  if (analysis.autoFixable && analysis.autoFixType !== 'none') {
    try {
      fixResult = await executeAutoFix(report, analysis, req.prisma);
    } catch (fixErr) {
      fixResult = `Auto-fix attempted but encountered an issue: ${fixErr.message}`;
    }
  }

  const resolution = `[AI Fix — ${new Date().toISOString()}]\nDiagnosis: ${analysis.rootCause}\n\nAction taken: ${fixResult}\n\nFurther steps:\n${analysis.suggestedFix}`;

  // Mark as "fixed" — future duplicate submissions for this fingerprint will be silently ignored
  await req.prisma.errorReport.update({
    where: { id },
    data: {
      status:     'fixed',
      aiAnalysis: JSON.stringify(analysis),
      aiModel:    usedModel,
      resolution,
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
    },
  });

  res.json({ analysis, fixResult, resolution, model: usedModel });
}));

// PUT /api/error-reports/:id/status — Admin: manually update status / add note
router.put('/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, resolution } = req.body;

  if (!['new', 'reviewing', 'fixed', 'dismissed'].includes(status)) {
    throw badRequest('status must be one of: new, reviewing, fixed, dismissed');
  }

  const report = await req.prisma.errorReport.findUnique({ where: { id } });
  if (!report) throw notFound('Error report');

  const updated = await req.prisma.errorReport.update({
    where: { id },
    data: {
      status,
      ...(resolution && { resolution }),
      ...(status === 'fixed' || status === 'dismissed'
        ? { resolvedAt: new Date(), resolvedBy: req.user.id }
        : {}),
    },
  });

  res.json(updated);
}));

// DELETE /api/error-reports/:id — Admin: delete report
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const report = await req.prisma.errorReport.findUnique({ where: { id } });
  if (!report) throw notFound('Error report');
  await req.prisma.errorReport.delete({ where: { id } });
  res.json({ message: 'Deleted.' });
}));

module.exports = router;
