const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');

const router = express.Router();
router.use(authenticate);

// GET /saturday-policy?companyId=1 — list all policies for a company
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { companyId } = req.query;
  if (!companyId) throw badRequest('companyId required');
  const policies = await req.prisma.saturdayPolicy.findMany({
    where: { companyId: parseInt(companyId) },
    orderBy: { effectiveFrom: 'desc' },
  });
  res.json(policies);
}));

// POST /saturday-policy — create a new policy
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { companyId, effectiveFrom, effectiveTo, saturdayType, description } = req.body;
  if (!companyId || !effectiveFrom || !saturdayType) throw badRequest('companyId, effectiveFrom and saturdayType are required');
  if (!['all', '2nd_4th', 'none'].includes(saturdayType)) throw badRequest('saturdayType must be all, 2nd_4th, or none');
  const policy = await req.prisma.saturdayPolicy.create({
    data: { companyId: parseInt(companyId), effectiveFrom, effectiveTo: effectiveTo || null, saturdayType, description },
  });
  res.status(201).json(policy);
}));

// PUT /saturday-policy/:id — update a policy
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw badRequest('Invalid id');
  const { effectiveFrom, effectiveTo, saturdayType, description } = req.body;
  if (saturdayType && !['all', '2nd_4th', 'none'].includes(saturdayType)) throw badRequest('saturdayType must be all, 2nd_4th, or none');
  const policy = await req.prisma.saturdayPolicy.update({
    where: { id },
    data: { ...(effectiveFrom && { effectiveFrom }), effectiveTo: effectiveTo || null, ...(saturdayType && { saturdayType }), ...(description !== undefined && { description }) },
  });
  res.json(policy);
}));

// DELETE /saturday-policy/:id
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw badRequest('Invalid id');
  await req.prisma.saturdayPolicy.delete({ where: { id } });
  res.json({ success: true });
}));

module.exports = router;
