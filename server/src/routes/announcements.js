const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { notifyAllExcept } = require('../utils/notify');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

const PRIORITY_ORDER = { urgent: 0, important: 1, normal: 2 };
const VALID_CATEGORIES = ['general', 'policy', 'event', 'birthday', 'anniversary'];
const VALID_PRIORITIES = ['normal', 'important', 'urgent'];

// GET /celebrations — Upcoming birthdays & work anniversaries (must be before /:id)
router.get('/celebrations', asyncHandler(async (req, res) => {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = now.getFullYear();

  const employees = await req.prisma.user.findMany({
    where: { isActive: true, companyId: req.user.companyId },
    select: { id: true, name: true, email: true, dateOfBirth: true, dateOfJoining: true, department: true },
  });

  const birthdays = [];
  const anniversaries = [];

  for (const emp of employees) {
    if (emp.dateOfBirth) {
      const parts = emp.dateOfBirth.split('-');
      if (parts.length === 3 && parts[1] === currentMonth) {
        birthdays.push({ id: emp.id, name: emp.name, date: emp.dateOfBirth, day: parseInt(parts[2], 10), department: emp.department || null });
      }
    }
    if (emp.dateOfJoining) {
      const parts = emp.dateOfJoining.split('-');
      if (parts.length === 3) {
        const years = currentYear - parseInt(parts[0], 10);
        if (parts[1] === currentMonth && years >= 1) {
          anniversaries.push({ id: emp.id, name: emp.name, date: emp.dateOfJoining, day: parseInt(parts[2], 10), department: emp.department || null, years });
        }
      }
    }
  }

  birthdays.sort((a, b) => a.day - b.day);
  anniversaries.sort((a, b) => a.day - b.day);

  res.json({
    birthdays: birthdays.map(({ day, ...rest }) => rest),
    anniversaries: anniversaries.map(({ day, ...rest }) => rest),
  });
}));

// GET / — List active announcements for the authenticated user
router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  const announcements = await req.prisma.announcement.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ companyId: null }, { companyId: req.user.companyId }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  announcements.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 2;
    const pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 2;
    const priorityDiff = pa - pb;
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  res.json(announcements);
}));

// POST / — Create a new announcement (admin/team_lead only)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'content');
  const { title, content, category, priority, companyId, expiresAt } = req.body;
  if (category) requireEnum(category, VALID_CATEGORIES, 'category');
  if (priority) requireEnum(priority, VALID_PRIORITIES, 'priority');

  const announcement = await req.prisma.announcement.create({
    data: {
      title, content,
      category: category || 'general',
      priority: priority || 'normal',
      companyId: companyId !== undefined ? companyId : null,
      postedBy: req.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
  });

  // Notify all employees about new announcement
  notifyAllExcept(req.prisma, req.user.id, {
    type: 'announcement',
    title: `New Announcement: ${title}`,
    message: priority === 'urgent' ? '🚨 Urgent announcement posted' : `A new ${category || 'general'} announcement was posted`,
    link: '/announcements',
  });

  res.status(201).json(announcement);
}));

// PUT /:id — Update an announcement (admin/team_lead only)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const announcementId = parseId(req.params.id);
  const existing = await req.prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!existing) throw notFound('Announcement');

  const { title, content, category, priority, companyId, expiresAt, isActive } = req.body;
  if (category) requireEnum(category, VALID_CATEGORIES, 'category');
  if (priority) requireEnum(priority, VALID_PRIORITIES, 'priority');

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (category !== undefined) updateData.category = category;
  if (priority !== undefined) updateData.priority = priority;
  if (companyId !== undefined) updateData.companyId = companyId;
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (isActive !== undefined) updateData.isActive = isActive;

  const updated = await req.prisma.announcement.update({
    where: { id: announcementId },
    data: updateData,
    include: {
      author: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
  });

  res.json(updated);
}));

// DELETE /:id — Soft deactivate an announcement (admin/team_lead only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const announcementId = parseId(req.params.id);
  const existing = await req.prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!existing) throw notFound('Announcement');

  await req.prisma.announcement.update({ where: { id: announcementId }, data: { isActive: false } });
  res.json({ message: 'Announcement deactivated successfully.' });
}));

module.exports = router;
