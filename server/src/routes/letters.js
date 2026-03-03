const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

const LETTER_TYPES = ['offer', 'appointment', 'salary_revision', 'experience', 'relieving', 'custom'];
function isAdminRole(user) { return user.role === 'admin' || user.role === 'team_lead'; }

// GET /templates — List active letter templates (admin only)
router.get('/templates', requireAdmin, asyncHandler(async (req, res) => {
  const templates = await req.prisma.letterTemplate.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
}));

// POST /templates — Create letter template (admin only)
router.post('/templates', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'type', 'content');
  const { name, type, content } = req.body;
  requireEnum(type, LETTER_TYPES, 'type');
  const template = await req.prisma.letterTemplate.create({ data: { name, type, content } });
  res.status(201).json(template);
}));

// PUT /templates/:id — Update letter template (admin only)
router.put('/templates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const templateId = parseId(req.params.id);
  const existing = await req.prisma.letterTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw notFound('Letter template');

  const { name, type, content, isActive } = req.body;
  if (type) requireEnum(type, LETTER_TYPES, 'type');

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (content !== undefined) updateData.content = content;
  if (isActive !== undefined) updateData.isActive = isActive;

  const updated = await req.prisma.letterTemplate.update({ where: { id: templateId }, data: updateData });
  res.json(updated);
}));

// POST /generate — Generate letter for employee (admin only)
router.post('/generate', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'templateId');
  const { userId, templateId } = req.body;

  const template = await req.prisma.letterTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw notFound('Letter template');
  if (!template.isActive) throw badRequest('This template is inactive.');

  const user = await req.prisma.user.findUnique({
    where: { id: userId },
    include: { 
      company: true, 
      salaryStructure: true,
      shiftAssignments: {
        where: {
          status: 'active',
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } }
          ]
        },
        take: 1,
        select: {
          shift: {
            select: {
              id: true,
              name: true,
              startTime: true,
              endTime: true,
              breakDuration: true,
            }
          }
        }
      }
    },
  });
  if (!user) throw notFound('Employee');

  const dateStr = new Date().toISOString().split('T')[0];
  const currentShift = user.shiftAssignments?.[0]?.shift;
  const placeholders = {
    '{{name}}': user.name || '', '{{employeeId}}': user.employeeId || '',
    '{{designation}}': user.designation || '', '{{department}}': user.department || '',
    '{{dateOfJoining}}': user.dateOfJoining || '', '{{dateOfBirth}}': user.dateOfBirth || '',
    '{{email}}': user.email || '', '{{phone}}': user.phone || '',
    '{{address}}': user.address || '', '{{fatherName}}': user.fatherName || '',
    '{{spouseName}}': user.spouseName || '',
    '{{bankName}}': user.bankName || '', '{{bankAccountNumber}}': user.bankAccountNumber || '',
    '{{bankIfscCode}}': user.bankIfscCode || '',
    '{{panNumber}}': user.panNumber || '', '{{aadhaarNumber}}': user.aadhaarNumber || '',
    '{{uanNumber}}': user.uanNumber || '',
    '{{company.name}}': user.company?.name || '', '{{company.gst}}': user.company?.gst || '',
    '{{company.address}}': user.company?.address || '', '{{company.city}}': user.company?.city || '',
    '{{company.state}}': user.company?.state || '',
    '{{ctcAnnual}}': user.salaryStructure?.ctcAnnual?.toLocaleString('en-IN') || '',
    '{{ctcMonthly}}': user.salaryStructure?.ctcMonthly?.toLocaleString('en-IN') || '',
    '{{basic}}': user.salaryStructure?.basic?.toLocaleString('en-IN') || '',
    '{{hra}}': user.salaryStructure?.hra?.toLocaleString('en-IN') || '',
    '{{shift.name}}': currentShift?.name || '', 
    '{{shift.startTime}}': currentShift?.startTime || '', 
    '{{shift.endTime}}': currentShift?.endTime || '',
    '{{shift.breakDuration}}': currentShift?.breakDuration?.toString() || '',
    '{{date}}': dateStr,
  };

  let renderedContent = template.content;
  for (const [placeholder, value] of Object.entries(placeholders)) {
    renderedContent = renderedContent.split(placeholder).join(value);
  }

  const generatedLetter = await req.prisma.generatedLetter.create({
    data: { userId, templateId, letterType: template.type, content: renderedContent, generatedBy: req.user.id },
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true } },
      template: { select: { id: true, name: true, type: true } },
      generatedByUser: { select: { id: true, name: true, email: true } },
    },
  });
  res.status(201).json(generatedLetter);
}));

// GET /employee/:userId — All letters for an employee (admin or self)
router.get('/employee/:userId', asyncHandler(async (req, res) => {
  const targetUserId = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== targetUserId) throw forbidden('Access denied.');

  const letters = await req.prisma.generatedLetter.findMany({
    where: { userId: targetUserId },
    include: {
      template: { select: { id: true, name: true, type: true } },
      generatedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { generatedAt: 'desc' },
  });
  res.json(letters);
}));

// GET /:id — Single letter detail (admin or self)
router.get('/:id', asyncHandler(async (req, res) => {
  const letterId = parseId(req.params.id);
  const letter = await req.prisma.generatedLetter.findUnique({
    where: { id: letterId },
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true, designation: true, department: true } },
      template: { select: { id: true, name: true, type: true } },
      generatedByUser: { select: { id: true, name: true, email: true } },
    },
  });
  if (!letter) throw notFound('Letter');
  if (!isAdminRole(req.user) && req.user.id !== letter.userId) throw forbidden('Access denied.');
  res.json(letter);
}));

module.exports = router;
