const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields } = require('../utils/validate');
const { throwIfHasDependencies } = require('../utils/dependencyCheck');

const router = express.Router();
router.use(authenticate);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target - today) / 86400000);
}

function getTrafficLight(daysLeft) {
  if (daysLeft === null) return 'grey';
  if (daysLeft < 0) return 'grey';        // expired / past
  if (daysLeft <= 7) return 'red';         // critical
  if (daysLeft <= 30) return 'yellow';     // warning
  return 'green';                           // ok
}

function advanceByBillingCycle(dateStr, cycle) {
  if (!dateStr || cycle === 'one_time') return dateStr;
  const d = new Date(dateStr);
  switch (cycle) {
    case 'monthly':     d.setMonth(d.getMonth() + 1); break;
    case 'quarterly':   d.setMonth(d.getMonth() + 3); break;
    case 'half_yearly': d.setMonth(d.getMonth() + 6); break;
    case 'yearly':      d.setFullYear(d.getFullYear() + 1); break;
    default:            d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function enrichRenewal(r) {
  const daysLeft = getDaysUntil(r.renewalDate);
  return {
    ...r,
    daysLeft,
    trafficLight: getTrafficLight(daysLeft),
    // Map Prisma field names to frontend field names
    referenceNo: r.referenceNumber || '',
    documentUrl: r.documentPath || '',
  };
}

// ─── RENEWAL CATEGORIES ─────────────────────────────────────────────────────

// GET /api/renewals/categories
router.get('/categories', asyncHandler(async (req, res) => {
  const cats = await req.prisma.renewalCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { renewals: true } } },
  });
  res.json(cats);
}));

// POST /api/renewals/categories
router.post('/categories', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name');
  const cat = await req.prisma.renewalCategory.create({ data: req.body });
  res.status(201).json(cat);
}));

// PUT /api/renewals/categories/:id
router.put('/categories/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const cat = await req.prisma.renewalCategory.update({ where: { id }, data: req.body });
  res.json(cat);
}));

// DELETE /api/renewals/categories/:id
router.delete('/categories/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await throwIfHasDependencies(req.prisma, 'RenewalCategory', id);
  await req.prisma.renewalCategory.delete({ where: { id } });
  res.json({ success: true });
}));

// ─── PAYMENT ACCOUNTS ───────────────────────────────────────────────────────

// GET /api/renewals/accounts
router.get('/accounts', asyncHandler(async (req, res) => {
  const accounts = await req.prisma.paymentAccount.findMany({
    orderBy: { accountCode: 'asc' },
    include: { _count: { select: { renewals: true, statements: true } } },
  });
  res.json(accounts);
}));

// POST /api/renewals/accounts
router.post('/accounts', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'accountCode', 'type', 'name');
  const account = await req.prisma.paymentAccount.create({ data: req.body });
  res.status(201).json(account);
}));

// PUT /api/renewals/accounts/:id
router.put('/accounts/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const account = await req.prisma.paymentAccount.update({ where: { id }, data: req.body });
  res.json(account);
}));

// DELETE /api/renewals/accounts/:id
router.delete('/accounts/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await throwIfHasDependencies(req.prisma, 'PaymentAccount', id);
  await req.prisma.paymentAccount.delete({ where: { id } });
  res.json({ success: true });
}));

// ─── MONTHLY STATEMENTS ─────────────────────────────────────────────────────

// GET /api/renewals/statements?accountId=&month=
router.get('/statements', requireAdmin, asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.accountId) where.paymentAccountId = parseInt(req.query.accountId);
  if (req.query.month)     where.month = req.query.month;
  const statements = await req.prisma.monthlyStatement.findMany({
    where,
    include: { paymentAccount: true, uploader: { select: { name: true } } },
    orderBy: { month: 'desc' },
  });
  res.json(statements);
}));

// POST /api/renewals/statements
router.post('/statements', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'month', 'paymentAccountId');
  const stmt = await req.prisma.monthlyStatement.create({
    data: { ...req.body, uploadedBy: req.user.id },
    include: { paymentAccount: true },
  });
  res.status(201).json(stmt);
}));

// PUT /api/renewals/statements/:id
router.put('/statements/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const stmt = await req.prisma.monthlyStatement.update({ where: { id }, data: req.body });
  res.json(stmt);
}));

// DELETE /api/renewals/statements/:id
router.delete('/statements/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await req.prisma.monthlyStatement.delete({ where: { id } });
  res.json({ success: true });
}));

// ─── RENEWALS ────────────────────────────────────────────────────────────────

// GET /api/renewals  ?categoryId=&status=&trafficLight=&search=
router.get('/', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.categoryId) where.categoryId = parseInt(req.query.categoryId);
  if (req.query.status)     where.status = req.query.status;
  if (req.query.search) {
    where.OR = [
      { itemName:   { contains: req.query.search } },
      { vendorName: { contains: req.query.search } },
    ];
  }

  const renewals = await req.prisma.renewal.findMany({
    where,
    include: {
      category:       { select: { id: true, name: true, icon: true } },
      paymentAccount: { select: { id: true, accountCode: true, name: true, type: true } },
    },
    orderBy: { renewalDate: 'asc' },
  });

  let enriched = renewals.map(enrichRenewal);

  // filter by traffic light after enrichment
  if (req.query.trafficLight) {
    enriched = enriched.filter(r => r.trafficLight === req.query.trafficLight);
  }

  res.json(enriched);
}));

// GET /api/renewals/summary  — dashboard counts
router.get('/summary', asyncHandler(async (req, res) => {
  const all = await req.prisma.renewal.findMany({
    select: { renewalDate: true, status: true, amount: true, currency: true },
  });

  let totalMonthly = 0, red = 0, yellow = 0, green = 0, grey = 0;
  all.forEach(r => {
    const d = getDaysUntil(r.renewalDate);
    const tl = getTrafficLight(d);
    if (tl === 'red')    red++;
    if (tl === 'yellow') yellow++;
    if (tl === 'green')  green++;
    if (tl === 'grey')   grey++;
    // rough monthly cost estimate
    if (r.amount && r.status === 'active') {
      if (r.currency === 'INR') {
        totalMonthly += r.amount; // stored as annual by default; divide below
      }
    }
  });

  const categoryCounts = await req.prisma.renewalCategory.findMany({
    include: { _count: { select: { renewals: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({
    total: all.length,
    red, yellow, green, grey,
    categoryCounts: categoryCounts.map(c => ({
      id: c.id, name: c.name, icon: c.icon, count: c._count.renewals,
    })),
  });
}));

// GET /api/renewals/due-soon?days=15
router.get('/due-soon', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 15;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = new Date(today);
  future.setDate(future.getDate() + days);

  const todayStr  = today.toISOString().slice(0, 10);
  const futureStr = future.toISOString().slice(0, 10);

  const renewals = await req.prisma.renewal.findMany({
    where: {
      status: 'active',
      renewalDate: { gte: todayStr, lte: futureStr },
    },
    include: {
      category:       { select: { name: true, icon: true } },
      paymentAccount: { select: { accountCode: true, name: true } },
    },
    orderBy: { renewalDate: 'asc' },
  });

  res.json(renewals.map(enrichRenewal));
}));

// GET /api/renewals/:id  (numeric only — keeps /email-scans from being shadowed)
router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const renewal = await req.prisma.renewal.findUnique({
    where: { id },
    include: {
      category:       true,
      paymentAccount: true,
      history: {
        include: { performer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });
  if (!renewal) throw notFound('Renewal');
  res.json(enrichRenewal(renewal));
}));

// POST /api/renewals
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'itemName');
  const { history, category, paymentAccount, daysLeft, trafficLight, id, createdAt, updatedAt,
    referenceNo, documentUrl, ...data } = req.body;

  // Map frontend field names to Prisma schema field names
  if (referenceNo !== undefined) data.referenceNumber = referenceNo;
  if (documentUrl !== undefined) data.documentPath = documentUrl;

  const renewal = await req.prisma.renewal.create({
    data,
    include: {
      category:       { select: { name: true, icon: true } },
      paymentAccount: { select: { accountCode: true, name: true } },
    },
  });

  // audit log
  await req.prisma.renewalHistory.create({
    data: {
      renewalId:   renewal.id,
      action:      'created',
      newValue:    renewal.itemName,
      performedBy: req.user.id,
    },
  });

  res.status(201).json(enrichRenewal(renewal));
}));

// PUT /api/renewals/:id
router.put('/:id(\\d+)', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { history, category, paymentAccount, daysLeft, trafficLight, id: _id, createdAt, updatedAt,
    referenceNo, documentUrl, ...data } = req.body;

  // Map frontend field names to Prisma schema field names
  if (referenceNo !== undefined) data.referenceNumber = referenceNo;
  if (documentUrl !== undefined) data.documentPath = documentUrl;

  const renewal = await req.prisma.renewal.update({
    where: { id },
    data,
    include: {
      category:       { select: { name: true, icon: true } },
      paymentAccount: { select: { accountCode: true, name: true } },
    },
  });

  await req.prisma.renewalHistory.create({
    data: {
      renewalId:   id,
      action:      'updated',
      performedBy: req.user.id,
    },
  });

  res.json(enrichRenewal(renewal));
}));

// DELETE /api/renewals/:id
router.delete('/:id(\\d+)', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await throwIfHasDependencies(req.prisma, 'Renewal', id);
  await req.prisma.renewal.delete({ where: { id } });
  res.json({ success: true });
}));

// POST /api/renewals/:id/mark-paid  — advance renewalDate by billing cycle
router.post('/:id(\\d+)/mark-paid', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const existing = await req.prisma.renewal.findUnique({ where: { id } });
  if (!existing) throw notFound('Renewal');

  const today = new Date().toISOString().slice(0, 10);
  const nextDate = advanceByBillingCycle(existing.renewalDate, existing.billingCycle);
  const paidAmount = req.body.amount !== undefined ? parseFloat(req.body.amount) : existing.amount;

  const updated = await req.prisma.renewal.update({
    where: { id },
    data: {
      renewalDate:    nextDate,
      lastRenewedDate: today,
      lastPaidAmount: paidAmount,
      status:         'active',
      reconciled:     'pending',  // reset for next cycle
    },
    include: {
      category:       { select: { name: true, icon: true } },
      paymentAccount: { select: { accountCode: true, name: true } },
    },
  });

  await req.prisma.renewalHistory.create({
    data: {
      renewalId:   id,
      action:      'paid',
      oldValue:    existing.renewalDate,
      newValue:    nextDate,
      performedBy: req.user.id,
    },
  });

  res.json(enrichRenewal(updated));
}));

// POST /api/renewals/:id/reconcile
router.post('/:id(\\d+)/reconcile', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const today = new Date().toISOString().slice(0, 10);

  const updated = await req.prisma.renewal.update({
    where: { id },
    data: { reconciled: 'done', reconciledDate: today },
  });

  await req.prisma.renewalHistory.create({
    data: {
      renewalId:   id,
      action:      'reconciled',
      newValue:    today,
      performedBy: req.user.id,
    },
  });

  res.json(updated);
}));

// GET /api/renewals/:id/history
router.get('/:id(\\d+)/history', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const history = await req.prisma.renewalHistory.findMany({
    where: { renewalId: id },
    include: { performer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(history);
}));

// ─── EMAIL RENEWAL SCANS ─────────────────────────────────────────────────────

// POST /api/renewals/scan-email — trigger Gmail all-mail scan for renewal emails
router.post('/scan-email', requireAdmin, asyncHandler(async (req, res) => {
  const { scanAllMailForRenewals } = require('../services/gmailRenewalScanner');
  // Use the requesting admin's token, or fall back to any admin with a token
  let adminUserId = req.user.id;
  const token = await req.prisma.googleToken.findUnique({ where: { userId: adminUserId } });
  if (!token) {
    // Try any admin with a Gmail token
    const anyAdmin = await req.prisma.googleToken.findFirst({
      include: { user: { select: { role: true } } },
    });
    if (!anyAdmin || !['admin', 'team_lead'].includes(anyAdmin.user.role)) {
      throw badRequest('No Gmail token found. Please connect Google account via Settings → Google Integration.');
    }
    adminUserId = anyAdmin.userId;
  }
  const result = await scanAllMailForRenewals(req.prisma, adminUserId);
  res.json(result);
}));

// GET /api/renewals/email-scans — list email scan results
router.get('/email-scans', requireAdmin, asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const scans = await req.prisma.emailRenewalScan.findMany({
    where,
    include: {
      renewal:  { select: { id: true, itemName: true, vendorName: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: { receivedAt: 'desc' },
    take: 200,
  });
  res.json(scans);
}));

// POST /api/renewals/email-scans/:id/dismiss — dismiss a scan (not a renewal)
router.post('/email-scans/:id/dismiss', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const scan = await req.prisma.emailRenewalScan.update({
    where: { id },
    data: {
      status:     'dismissed',
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
    },
  });
  res.json(scan);
}));

module.exports = router;
