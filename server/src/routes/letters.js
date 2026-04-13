const path = require('path');
const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
// Note: requireActiveEmployee is applied per-route for write ops only.
// Separated employees (resigned/retired) can still view their own letters (experience, relieving, etc.)

const LETTER_TYPES = ['offer', 'appointment', 'salary_revision', 'experience', 'relieving', 'custom'];
function isAdminRole(user) { return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead'; }

/** Derive salutation from gender field */
function getSalutation(gender) {
  if (!gender) return 'Mr./Ms.';
  const g = gender.toLowerCase();
  if (g === 'female') return 'Ms.';
  return 'Mr.';
}

/** Build placeholder map for a user, optionally enriched with separation data */
function buildPlaceholders(user, separation = null) {
  const dateStr = new Date().toISOString().split('T')[0];
  const salutation = getSalutation(user.gender);
  const lwd = separation ? (separation.adjustedLWD || separation.lastWorkingDate || '') : '';
  return {
    '{{name}}': user.name || '',
    '{{salutation}}': salutation,
    '{{employeeId}}': user.employeeId || '',
    '{{designation}}': user.designation || '',
    '{{department}}': user.department || '',
    '{{dateOfJoining}}': user.dateOfJoining || '',
    '{{joiningDate}}': user.dateOfJoining || '',
    '{{dateOfBirth}}': user.dateOfBirth || '',
    '{{email}}': user.email || '',
    '{{phone}}': user.phone || '',
    '{{address}}': user.address || '',
    '{{fatherName}}': user.fatherName || '',
    '{{spouseName}}': user.spouseName || '',
    '{{bankName}}': user.bankName || '',
    '{{bankAccountNumber}}': user.bankAccountNumber || '',
    '{{bankIfscCode}}': user.bankIfscCode || '',
    '{{panNumber}}': user.panNumber || '',
    '{{aadhaarNumber}}': user.aadhaarNumber || '',
    '{{uanNumber}}': user.uanNumber || '',
    '{{company.name}}': user.company?.name || '',
    '{{company.gst}}': user.company?.gst || '',
    '{{company.address}}': user.company?.address || '',
    '{{company.city}}': user.company?.city || '',
    '{{company.state}}': user.company?.state || '',
    '{{ctcAnnual}}': user.salaryStructure?.ctcAnnual?.toLocaleString('en-IN') || '',
    '{{ctcMonthly}}': user.salaryStructure?.ctcMonthly?.toLocaleString('en-IN') || '',
    '{{basic}}': user.salaryStructure?.basic?.toLocaleString('en-IN') || '',
    '{{hra}}': user.salaryStructure?.hra?.toLocaleString('en-IN') || '',
    '{{lwd}}': lwd,
    '{{lastWorkingDate}}': lwd,
    '{{date}}': dateStr,
  };
}

/** Render content by replacing all placeholders */
function renderContent(templateContent, placeholders) {
  let rendered = templateContent;
  for (const [placeholder, value] of Object.entries(placeholders)) {
    rendered = rendered.split(placeholder).join(value);
  }
  return rendered;
}

// GET /templates — List active letter templates (admin only)
router.get('/templates', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const templates = await req.prisma.letterTemplate.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
}));

// POST /templates — Create letter template (admin only)
router.post('/templates', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'type', 'content');
  const { name, type, content } = req.body;
  requireEnum(type, LETTER_TYPES, 'type');
  const template = await req.prisma.letterTemplate.create({ data: { name, type, content } });
  res.status(201).json(template);
}));

// PUT /templates/:id — Update letter template (admin only)
router.put('/templates/:id', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
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

// POST /seed-separation-templates — Create Experience & Relieving Letter templates if missing (admin only)
router.post('/seed-separation-templates', requireAdmin, asyncHandler(async (req, res) => {
  const companyName = 'Color Papers India Private Limited';

  const templates = [
    {
      name: 'Experience Letter',
      type: 'experience',
      content: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; padding: 40px; max-width: 800px; margin: 0 auto;">
<p style="text-align: right;">Date: {{date}}</p>
<br/>
<p style="font-weight: bold; text-align: center; font-size: 16px; text-decoration: underline;">TO WHOM IT MAY CONCERN</p>
<br/>
<p>This is to certify that <strong>{{salutation}} {{name}}</strong> bearing Employee ID <strong>{{employeeId}}</strong> has served in our organization from <strong>{{joiningDate}}</strong> to <strong>{{lwd}}</strong> as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department.</p>
<br/>
<p>During the period of service, {{salutation}} {{name}} had resigned from the services of our organization.</p>
<br/>
<p>To the best of our knowledge, {{salutation}} {{name}} has been found to be hardworking and sincere during the tenure with us.</p>
<br/>
<p>We wish {{salutation}} {{name}} all success in future endeavours.</p>
<br/><br/>
<p>For <strong>{{company.name}}</strong>,</p>
<br/><br/><br/>
<p>___________________________</p>
<p><strong>Authorized Signatory</strong></p>
</div>`,
    },
    {
      name: 'Relieving Letter',
      type: 'relieving',
      content: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; padding: 40px; max-width: 800px; margin: 0 auto;">
<p style="text-align: right;">Date: {{date}}</p>
<br/>
<p>To,</p>
<p><strong>{{salutation}} {{name}}</strong></p>
<p>{{designation}}</p>
<p>{{company.name}}</p>
<br/>
<p><strong>Subject: Relieving Letter</strong></p>
<br/>
<p>Dear {{salutation}} {{name}},</p>
<br/>
<p>This is to confirm that <strong>{{salutation}} {{name}}</strong> (Employee ID: <strong>{{employeeId}}</strong>) has been relieved from duties at <strong>{{company.name}}</strong> as <strong>{{designation}}</strong> effective from <strong>{{lwd}}</strong>.</p>
<br/>
<p>We formally acknowledge the acceptance of your resignation letter and you are hereby relieved from your duties with effect from the above mentioned date.</p>
<br/>
<p>We take this opportunity to thank you for your contributions during your tenure with us and wish you all the very best in your future endeavours.</p>
<br/><br/>
<p>For <strong>{{company.name}}</strong>,</p>
<br/><br/><br/>
<p>___________________________</p>
<p><strong>Authorized Signatory</strong></p>
</div>`,
    },
  ];

  const results = [];
  for (const tpl of templates) {
    const existing = await req.prisma.letterTemplate.findFirst({ where: { type: tpl.type, name: tpl.name } });
    if (existing) {
      results.push({ name: tpl.name, status: 'already_exists', id: existing.id });
    } else {
      const created = await req.prisma.letterTemplate.create({ data: tpl });
      results.push({ name: tpl.name, status: 'created', id: created.id });
    }
  }
  res.json({ message: 'Separation templates seeded.', templates: results });
}));

// POST /generate — Generate letter for employee (admin only)
router.post('/generate', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'templateId');
  const { userId, templateId, separationId } = req.body;

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
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        },
        take: 1,
        select: { shift: { select: { id: true, name: true, startTime: true, endTime: true, breakDuration: true } } },
      },
    },
  });
  if (!user) throw notFound('Employee');

  // Load separation data if separationId provided (for {{lwd}} etc.)
  let separation = null;
  if (separationId) {
    separation = await req.prisma.separation.findUnique({ where: { id: separationId } });
  } else if (template.type === 'experience' || template.type === 'relieving') {
    // Auto-load latest resignation separation for this user
    separation = await req.prisma.separation.findFirst({
      where: { userId, type: 'resignation' },
      orderBy: { createdAt: 'desc' },
    });
  }

  const placeholders = buildPlaceholders(user, separation);
  const currentShift = user.shiftAssignments?.[0]?.shift;
  placeholders['{{shift.name}}'] = currentShift?.name || '';
  placeholders['{{shift.startTime}}'] = currentShift?.startTime || '';
  placeholders['{{shift.endTime}}'] = currentShift?.endTime || '';
  placeholders['{{shift.breakDuration}}'] = currentShift?.breakDuration?.toString() || '';

  const renderedContent = renderContent(template.content, placeholders);

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

// GET /:id/pdf — Download letter as PDF
router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const letterId = parseId(req.params.id);
  const letter = await req.prisma.generatedLetter.findUnique({
    where: { id: letterId },
    include: { user: { select: { id: true, name: true, employeeId: true } } },
  });
  if (!letter) throw notFound('Letter');
  if (!isAdminRole(req.user) && req.user.id !== letter.userId) throw forbidden('Access denied.');

  const PDFDocument = require('pdfkit');

  // Strip HTML to plain text
  const plainText = letter.content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  const lines = plainText.split('\n').map(l => l.trim());

  const safeName = (letter.user?.name || 'employee').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');

  // Build PDF in memory using pdfkit (uses built-in Helvetica — no font files needed)
  const doc = new PDFDocument({ margin: 60, size: 'A4' });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  await new Promise((resolve) => {
    doc.on('end', resolve);

    for (const line of lines) {
      if (!line) {
        doc.moveDown(0.5);
      } else {
        const isBold = line === 'TO WHOM IT MAY CONCERN' || line.startsWith('Subject:') ||
          line.startsWith('For ') || line === 'Authorized Signatory' || line === '___________________________';
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).text(line, { lineGap: 4 });
      }
    }
    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${letter.letterType}_${safeName}.pdf"`);
  res.send(pdfBuffer);
}));

// GET /:id/docx — Download letter as Word document
router.get('/:id/docx', asyncHandler(async (req, res) => {
  const letterId = parseId(req.params.id);
  const letter = await req.prisma.generatedLetter.findUnique({
    where: { id: letterId },
    include: { user: { select: { id: true, name: true, employeeId: true } } },
  });
  if (!letter) throw notFound('Letter');
  if (!isAdminRole(req.user) && req.user.id !== letter.userId) throw forbidden('Access denied.');

  const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = require('docx');

  // Strip HTML and build paragraphs
  const plainText = letter.content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  const lines = plainText.split('\n').map(l => l.trim());

  const paragraphs = lines.map(line => {
    if (!line) return new Paragraph({ text: '', spacing: { after: 100 } });

    // Detect bold patterns (lines that look like headers/subjects)
    const isBold = line.startsWith('For ') || line === 'TO WHOM IT MAY CONCERN' ||
      line.startsWith('Subject:') || line.startsWith('Authorized Signatory') ||
      line === '___________________________';

    return new Paragraph({
      children: [new TextRun({ text: line, bold: isBold, size: 24 })],
      spacing: { after: 120 },
    });
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: paragraphs,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeName = (letter.user?.name || 'employee').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${letter.letterType}_${safeName}.docx"`);
  res.send(buffer);
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
