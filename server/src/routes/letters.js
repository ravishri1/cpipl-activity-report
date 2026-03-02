const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Helper: check if user is admin or team_lead
function isAdmin(user) {
  return user.role === 'admin' || user.role === 'team_lead';
}

// All routes require authentication
router.use(authenticateToken);

// ============================================================
// GET /templates - List all active letter templates (admin only)
// ============================================================
router.get('/templates', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin or team lead role required.' });
    }

    const templates = await req.prisma.letterTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(templates);
  } catch (error) {
    console.error('Error fetching letter templates:', error);
    return res.status(500).json({ error: 'Failed to fetch letter templates' });
  }
});

// ============================================================
// POST /templates - Create a new letter template (admin only)
// ============================================================
router.post('/templates', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin or team lead role required.' });
    }

    const { name, type, content } = req.body;

    if (!name || !type || !content) {
      return res.status(400).json({ error: 'name, type, and content are required.' });
    }

    const validTypes = ['offer', 'appointment', 'salary_revision', 'experience', 'relieving', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid type. Must be one of: ' + validTypes.join(', '),
      });
    }

    const template = await req.prisma.letterTemplate.create({
      data: { name, type, content },
    });

    return res.status(201).json(template);
  } catch (error) {
    console.error('Error creating letter template:', error);
    return res.status(500).json({ error: 'Failed to create letter template' });
  }
});

// ============================================================
// PUT /templates/:id - Update a letter template (admin only)
// ============================================================
router.put('/templates/:id', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin or team lead role required.' });
    }

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID.' });
    }

    const existing = await req.prisma.letterTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Letter template not found.' });
    }

    const { name, type, content, isActive } = req.body;

    const validTypes = ['offer', 'appointment', 'salary_revision', 'experience', 'relieving', 'custom'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid type. Must be one of: ' + validTypes.join(', '),
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (content !== undefined) updateData.content = content;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await req.prisma.letterTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error updating letter template:', error);
    return res.status(500).json({ error: 'Failed to update letter template' });
  }
});

// ============================================================
// POST /generate - Generate a letter for an employee (admin only)
// ============================================================
router.post('/generate', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin or team lead role required.' });
    }

    const { userId, templateId } = req.body;

    if (!userId || !templateId) {
      return res.status(400).json({ error: 'userId and templateId are required.' });
    }

    // Fetch the template
    const template = await req.prisma.letterTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return res.status(404).json({ error: 'Letter template not found.' });
    }

    if (!template.isActive) {
      return res.status(400).json({ error: 'This template is inactive.' });
    }

    // Fetch the employee with all profile fields, company, and salary structure
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        salaryStructure: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Build the placeholder map
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const placeholders = {
      // Employee fields
      '{{name}}': user.name || '',
      '{{employeeId}}': user.employeeId || '',
      '{{designation}}': user.designation || '',
      '{{department}}': user.department || '',
      '{{dateOfJoining}}': user.dateOfJoining || '',
      '{{dateOfBirth}}': user.dateOfBirth || '',
      '{{email}}': user.email || '',
      '{{phone}}': user.phone || '',
      '{{address}}': user.address || '',
      '{{fatherName}}': user.fatherName || '',
      '{{spouseName}}': user.spouseName || '',

      // Bank details
      '{{bankName}}': user.bankName || '',
      '{{bankAccountNumber}}': user.bankAccountNumber || '',
      '{{bankIfscCode}}': user.bankIfscCode || '',

      // Identity documents
      '{{panNumber}}': user.panNumber || '',
      '{{aadhaarNumber}}': user.aadhaarNumber || '',
      '{{uanNumber}}': user.uanNumber || '',

      // Company fields
      '{{company.name}}': user.company?.name || '',
      '{{company.gst}}': user.company?.gst || '',
      '{{company.address}}': user.company?.address || '',
      '{{company.city}}': user.company?.city || '',
      '{{company.state}}': user.company?.state || '',

      // Salary fields
      '{{ctcAnnual}}': user.salaryStructure?.ctcAnnual?.toLocaleString('en-IN') || '',
      '{{ctcMonthly}}': user.salaryStructure?.ctcMonthly?.toLocaleString('en-IN') || '',
      '{{basic}}': user.salaryStructure?.basic?.toLocaleString('en-IN') || '',
      '{{hra}}': user.salaryStructure?.hra?.toLocaleString('en-IN') || '',

      // Date
      '{{date}}': dateStr,
    };

    // Replace all placeholders in the template content
    let renderedContent = template.content;
    for (const [placeholder, value] of Object.entries(placeholders)) {
      renderedContent = renderedContent.split(placeholder).join(value);
    }

    // Save the generated letter
    const generatedLetter = await req.prisma.generatedLetter.create({
      data: {
        userId: userId,
        templateId: templateId,
        letterType: template.type,
        content: renderedContent,
        generatedBy: req.user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true },
        },
        template: {
          select: { id: true, name: true, type: true },
        },
        generatedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return res.status(201).json(generatedLetter);
  } catch (error) {
    console.error('Error generating letter:', error);
    return res.status(500).json({ error: 'Failed to generate letter' });
  }
});

// ============================================================
// GET /employee/:userId - All letters for an employee (admin or self)
// ============================================================
router.get('/employee/:userId', async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    // Allow admin/team_lead or the employee themselves
    if (!isAdmin(req.user) && req.user.id !== targetUserId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const letters = await req.prisma.generatedLetter.findMany({
      where: { userId: targetUserId },
      include: {
        template: {
          select: { id: true, name: true, type: true },
        },
        generatedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { generatedAt: 'desc' },
    });

    return res.json(letters);
  } catch (error) {
    console.error('Error fetching employee letters:', error);
    return res.status(500).json({ error: 'Failed to fetch employee letters' });
  }
});

// ============================================================
// GET /:id - Single letter detail with rendered content (admin or self)
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const letterId = parseInt(req.params.id, 10);
    if (isNaN(letterId)) {
      return res.status(400).json({ error: 'Invalid letter ID.' });
    }

    const letter = await req.prisma.generatedLetter.findUnique({
      where: { id: letterId },
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true, designation: true, department: true },
        },
        template: {
          select: { id: true, name: true, type: true },
        },
        generatedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!letter) {
      return res.status(404).json({ error: 'Letter not found.' });
    }

    // Allow admin/team_lead or the employee themselves
    if (!isAdmin(req.user) && req.user.id !== letter.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    return res.json(letter);
  } catch (error) {
    console.error('Error fetching letter:', error);
    return res.status(500).json({ error: 'Failed to fetch letter' });
  }
});

module.exports = router;
