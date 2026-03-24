const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { throwIfHasDependencies } = require('../utils/dependencyCheck');

const router = express.Router();
router.use(authenticate);

const VALID_CATEGORIES = ['software', 'service', 'compliance', 'ip', 'misc'];
const VALID_STATUSES   = ['active', 'expired', 'pending', 'cancelled', 'renewed'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Days until a date string; negative = already past */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86_400_000);
}

function enrichContract(c) {
  const days = daysUntil(c.expiryDate);
  return {
    ...c,
    daysToExpiry: days,
    expiryAlert: days !== null && days <= 30 && days >= 0 ? 'warning' :
                 days !== null && days < 0             ? 'expired'  : null,
  };
}

// ── GET /api/company-contracts ── list all (admin) or filtered ───────────────
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { category, status, companyId, expiringSoon } = req.query;

  const where = {};
  if (category)  where.category  = category;
  if (status)    where.status    = status;
  if (companyId) where.companyId = parseId(companyId);

  // expiringSoon=30  →  expiring within N days
  if (expiringSoon) {
    const days = parseInt(expiringSoon, 10) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const today = new Date().toISOString().slice(0, 10);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    where.expiryDate = { gte: today, lte: cutoffStr };
    where.status = { in: ['active', 'pending'] };
  }

  const contracts = await req.prisma.companyContract.findMany({
    where,
    include: { company: { select: { id: true, name: true, shortName: true } } },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
  });

  res.json(contracts.map(enrichContract));
}));

// ── GET /api/company-contracts/summary ── expiry dashboard counts ─────────────
router.get('/summary', requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const in7  = new Date(Date.now() +  7 * 86_400_000).toISOString().slice(0, 10);

  const [total, expired, expiring7, expiring30, byCategory] = await Promise.all([
    req.prisma.companyContract.count(),
    req.prisma.companyContract.count({ where: { expiryDate: { lt: today }, status: { not: 'cancelled' } } }),
    req.prisma.companyContract.count({ where: { expiryDate: { gte: today, lte: in7  }, status: { in: ['active','pending'] } } }),
    req.prisma.companyContract.count({ where: { expiryDate: { gte: today, lte: in30 }, status: { in: ['active','pending'] } } }),
    req.prisma.companyContract.groupBy({ by: ['category'], _count: { id: true } }),
  ]);

  res.json({
    total,
    expired,
    expiring7,
    expiring30,
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count.id])),
  });
}));

// ── GET /api/company-contracts/:id ───────────────────────────────────────────
router.get('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const contract = await req.prisma.companyContract.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!contract) throw notFound('Contract');
  res.json(enrichContract(contract));
}));

// ── POST /api/company-contracts ── create ─────────────────────────────────────
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { category, name } = req.body;
  requireFields(req.body, 'category', 'name');
  requireEnum(category, VALID_CATEGORIES, 'category');
  if (req.body.status) requireEnum(req.body.status, VALID_STATUSES, 'status');

  const {
    companyId, subCategory, description, status,
    vendorName, vendorContact, vendorPAN, vendorGST,
    vendorBankName, vendorBankAccount, vendorIfsc,
    amount, paymentMode, paymentDate, paymentUTR,
    invoiceNumber, invoiceDate, invoiceFileUrl,
    startDate, expiryDate, renewalDate, lastServiceDate,
    licenseKey, seats,
    registrationNumber, ipClass, ipJurisdiction,
    notes,
  } = req.body;

  const contract = await req.prisma.companyContract.create({
    data: {
      category, name,
      companyId:  companyId  ? parseInt(companyId, 10)  : null,
      subCategory, description,
      status:     status     || 'active',
      vendorName, vendorContact, vendorPAN, vendorGST,
      vendorBankName, vendorBankAccount, vendorIfsc,
      amount:     amount     ? parseFloat(amount)        : null,
      paymentMode, paymentDate, paymentUTR,
      invoiceNumber, invoiceDate, invoiceFileUrl,
      startDate, expiryDate, renewalDate, lastServiceDate,
      licenseKey,
      seats:      seats      ? parseInt(seats, 10)       : null,
      registrationNumber, ipClass, ipJurisdiction,
      notes,
      createdBy: req.user.id,
    },
  });

  res.status(201).json(enrichContract(contract));
}));

// ── PUT /api/company-contracts/:id ── update ──────────────────────────────────
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (req.body.category) requireEnum(req.body.category, VALID_CATEGORIES, 'category');
  if (req.body.status)   requireEnum(req.body.status,   VALID_STATUSES,   'status');

  const {
    category, name, companyId, subCategory, description, status,
    vendorName, vendorContact, vendorPAN, vendorGST,
    vendorBankName, vendorBankAccount, vendorIfsc,
    amount, paymentMode, paymentDate, paymentUTR,
    invoiceNumber, invoiceDate, invoiceFileUrl,
    startDate, expiryDate, renewalDate, lastServiceDate,
    licenseKey, seats,
    registrationNumber, ipClass, ipJurisdiction,
    notes,
  } = req.body;

  const data = {
    ...(category    !== undefined && { category }),
    ...(name        !== undefined && { name }),
    ...(companyId   !== undefined && { companyId: companyId ? parseInt(companyId, 10) : null }),
    ...(subCategory !== undefined && { subCategory }),
    ...(description !== undefined && { description }),
    ...(status      !== undefined && { status }),
    ...(vendorName  !== undefined && { vendorName }),
    ...(vendorContact !== undefined && { vendorContact }),
    ...(vendorPAN   !== undefined && { vendorPAN }),
    ...(vendorGST   !== undefined && { vendorGST }),
    ...(vendorBankName !== undefined && { vendorBankName }),
    ...(vendorBankAccount !== undefined && { vendorBankAccount }),
    ...(vendorIfsc  !== undefined && { vendorIfsc }),
    ...(amount      !== undefined && { amount: amount ? parseFloat(amount) : null }),
    ...(paymentMode !== undefined && { paymentMode }),
    ...(paymentDate !== undefined && { paymentDate }),
    ...(paymentUTR  !== undefined && { paymentUTR }),
    ...(invoiceNumber !== undefined && { invoiceNumber }),
    ...(invoiceDate !== undefined && { invoiceDate }),
    ...(invoiceFileUrl !== undefined && { invoiceFileUrl }),
    ...(startDate   !== undefined && { startDate }),
    ...(expiryDate  !== undefined && { expiryDate }),
    ...(renewalDate !== undefined && { renewalDate }),
    ...(lastServiceDate !== undefined && { lastServiceDate }),
    ...(licenseKey  !== undefined && { licenseKey }),
    ...(seats       !== undefined && { seats: seats ? parseInt(seats, 10) : null }),
    ...(registrationNumber !== undefined && { registrationNumber }),
    ...(ipClass     !== undefined && { ipClass }),
    ...(ipJurisdiction !== undefined && { ipJurisdiction }),
    ...(notes       !== undefined && { notes }),
  };

  const contract = await req.prisma.companyContract.update({ where: { id }, data });
  res.json(enrichContract(contract));
}));

// ── DELETE /api/company-contracts/:id ─────────────────────────────────────────
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await throwIfHasDependencies(req.prisma, 'CompanyContract', id);
  await req.prisma.companyContract.delete({ where: { id } });
  res.json({ message: 'Contract deleted' });
}));

module.exports = router;
