const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// GET /api/departments — list all active departments
router.get('/', asyncHandler(async (req, res) => {
  const departments = await req.prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(departments);
}));

// GET /api/departments/all — list all including inactive (admin)
router.get('/all', requireAdmin, asyncHandler(async (req, res) => {
  const departments = await req.prisma.department.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(departments);
}));

// POST /api/departments
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name');
  const dept = await req.prisma.department.create({
    data: {
      name: req.body.name.trim(),
      description: req.body.description || null,
    },
  });
  res.status(201).json(dept);
}));

// PUT /api/departments/:id
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw badRequest('Invalid ID');
  const dept = await req.prisma.department.update({
    where: { id },
    data: {
      ...(req.body.name !== undefined && { name: req.body.name.trim() }),
      ...(req.body.description !== undefined && { description: req.body.description || null }),
      ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
    },
  });
  res.json(dept);
}));

// DELETE /api/departments/:id
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw badRequest('Invalid ID');
  await req.prisma.department.delete({ where: { id } });
  res.json({ deleted: true });
}));

module.exports = router;
