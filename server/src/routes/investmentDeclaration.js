const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// GET /my — employee's own declarations
router.get('/my', asyncHandler(async (req, res) => {
  const declarations = await req.prisma.investmentDeclaration.findMany({
    where: { userId: req.user.id },
    orderBy: { financialYear: 'desc' }
  });
  res.json(declarations);
}));

// GET / — admin: all declarations
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status, financialYear } = req.query;
  const where = {};
  if (status) where.status = status;
  if (financialYear) where.financialYear = financialYear;
  const declarations = await req.prisma.investmentDeclaration.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, designation: true } },
      approver: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(declarations);
}));

// GET /:id — detail
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const declaration = await req.prisma.investmentDeclaration.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, employeeId: true } },
      approver: { select: { id: true, name: true } }
    }
  });
  if (!declaration) throw notFound('Declaration');
  if (req.user.role !== 'admin' && req.user.role !== 'team_lead' && req.user.id !== declaration.userId) {
    throw forbidden();
  }
  res.json(declaration);
}));

// POST / — create or update draft for a financial year
router.post('/', asyncHandler(async (req, res) => {
  const { financialYear, ...fields } = req.body;
  requireFields(req.body, 'financialYear');
  const total80C = (fields.ppf || 0) + (fields.elss || 0) + (fields.lifeInsurance || 0) +
    (fields.homeLoanPrincipal || 0) + (fields.nsc || 0) + (fields.tuitionFees || 0) + (fields.other80C || 0);
  const totalDeclared = total80C + (fields.healthInsuranceSelf || 0) + (fields.healthInsuranceParents || 0) +
    (fields.educationLoanInterest || 0) + (fields.rentPaid || 0) + (fields.homeLoanInterest || 0) + (fields.npsContribution || 0);
  const data = { ...fields, financialYear, total80C, totalDeclared, status: 'draft' };
  const declaration = await req.prisma.investmentDeclaration.upsert({
    where: { userId_financialYear: { userId: req.user.id, financialYear } },
    create: { userId: req.user.id, ...data },
    update: data
  });
  res.status(201).json(declaration);
}));

// PUT /:id/submit — employee submits for approval
router.put('/:id/submit', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const declaration = await req.prisma.investmentDeclaration.findUnique({ where: { id } });
  if (!declaration) throw notFound('Declaration');
  if (declaration.userId !== req.user.id) throw forbidden();
  if (declaration.status !== 'draft') throw badRequest('Only draft declarations can be submitted');
  const updated = await req.prisma.investmentDeclaration.update({
    where: { id },
    data: { status: 'submitted', submittedAt: new Date() }
  });
  res.json(updated);
}));

// PUT /:id/approve — admin approves
router.put('/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { notes } = req.body;
  const declaration = await req.prisma.investmentDeclaration.findUnique({ where: { id } });
  if (!declaration) throw notFound('Declaration');
  if (declaration.status !== 'submitted') throw badRequest('Only submitted declarations can be approved');
  const updated = await req.prisma.investmentDeclaration.update({
    where: { id },
    data: { status: 'approved', approvedBy: req.user.id, approvedAt: new Date(), notes }
  });
  res.json(updated);
}));

// PUT /:id/reject — admin rejects
router.put('/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireFields(req.body, 'notes');
  const declaration = await req.prisma.investmentDeclaration.findUnique({ where: { id } });
  if (!declaration) throw notFound('Declaration');
  const updated = await req.prisma.investmentDeclaration.update({
    where: { id },
    data: { status: 'draft', notes: req.body.notes, approvedBy: null, approvedAt: null, submittedAt: null }
  });
  res.json(updated);
}));

// DELETE /:id — delete draft
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const declaration = await req.prisma.investmentDeclaration.findUnique({ where: { id } });
  if (!declaration) throw notFound('Declaration');
  if (declaration.userId !== req.user.id && req.user.role !== 'admin') throw forbidden();
  if (declaration.status === 'approved') throw badRequest('Cannot delete approved declaration');
  await req.prisma.investmentDeclaration.delete({ where: { id } });
  res.json({ message: 'Declaration deleted' });
}));

module.exports = router;
