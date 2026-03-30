const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// ── Get skills for a user ─────────────────────────────────────────────────────
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== userId) throw forbidden();

  const skills = await req.prisma.employeeSkill.findMany({
    where: { userId },
    include: { addedByUser: { select: { id: true, name: true } } },
    orderBy: [{ category: 'asc' }, { skill: 'asc' }],
  });
  res.json(skills);
}));

// ── My own skills ─────────────────────────────────────────────────────────────
router.get('/my', asyncHandler(async (req, res) => {
  const skills = await req.prisma.employeeSkill.findMany({
    where: { userId: req.user.id },
    include: { addedByUser: { select: { id: true, name: true } } },
    orderBy: [{ category: 'asc' }, { skill: 'asc' }],
  });
  res.json(skills);
}));

// ── Add skill ─────────────────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { userId, skill, category, level, certifiedBy, certDate, expiryDate, notes } = req.body;
  requireFields(req.body, 'skill');
  const targetId = userId ? parseInt(userId) : req.user.id;
  if (!isAdminRole(req.user) && targetId !== req.user.id) throw forbidden('Only admins can add skills to other employees.');

  const s = await req.prisma.employeeSkill.create({
    data: {
      userId:      targetId,
      skill:       skill.trim(),
      category:    category || 'technical',
      level:       level    || 'intermediate',
      certifiedBy: certifiedBy?.trim() || null,
      certDate:    certDate    || null,
      expiryDate:  expiryDate  || null,
      notes:       notes?.trim() || null,
      addedBy:     req.user.id,
    },
    include: { addedByUser: { select: { id: true, name: true } } },
  });
  res.status(201).json(s);
}));

// ── Update skill ──────────────────────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const s = await req.prisma.employeeSkill.findUnique({ where: { id } });
  if (!s) throw notFound('Skill not found.');
  if (!isAdminRole(req.user) && s.userId !== req.user.id) throw forbidden();

  const { skill, category, level, certifiedBy, certDate, expiryDate, notes } = req.body;
  const updated = await req.prisma.employeeSkill.update({
    where: { id },
    data: {
      ...(skill       && { skill:       skill.trim() }),
      ...(category    && { category }),
      ...(level       && { level }),
      ...(certifiedBy !== undefined && { certifiedBy: certifiedBy?.trim() || null }),
      ...(certDate    !== undefined && { certDate:    certDate    || null }),
      ...(expiryDate  !== undefined && { expiryDate:  expiryDate  || null }),
      ...(notes       !== undefined && { notes:       notes?.trim() || null }),
    },
  });
  res.json(updated);
}));

// ── Delete skill ──────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const s = await req.prisma.employeeSkill.findUnique({ where: { id } });
  if (!s) throw notFound('Skill not found.');
  if (!isAdminRole(req.user) && s.userId !== req.user.id) throw forbidden();
  await req.prisma.employeeSkill.delete({ where: { id } });
  res.json({ message: 'Skill deleted.' });
}));

// ── Skills matrix (admin) — all employees grouped ────────────────────────────
router.get('/matrix', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const { category, skill } = req.query;
  const where = {};
  if (category) where.category = category;
  if (skill)    where.skill    = { contains: skill, mode: 'insensitive' };

  const skills = await req.prisma.employeeSkill.findMany({
    where,
    include: { user: { select: { id: true, name: true, employeeId: true, department: true } } },
    orderBy: [{ skill: 'asc' }, { level: 'asc' }],
  });

  // Group by skill name
  const grouped = {};
  skills.forEach(s => {
    if (!grouped[s.skill]) grouped[s.skill] = { skill: s.skill, category: s.category, employees: [] };
    grouped[s.skill].employees.push({ ...s.user, level: s.level, certifiedBy: s.certifiedBy });
  });

  res.json(Object.values(grouped).sort((a, b) => a.skill.localeCompare(b.skill)));
}));

module.exports = router;
