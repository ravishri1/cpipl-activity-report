const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ── Auth gate ──
router.use(authenticateToken);

// ── Helper: admin / team_lead check ──
function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

// ============================================================
//  ONBOARDING
// ============================================================

// Default onboarding template tasks
const ONBOARDING_TEMPLATE = [
  // Documents
  { task: 'Submit Aadhaar copy', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit PAN card', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit bank passbook', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit educational certificates', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit passport photos', category: 'documents', assignedTo: 'HR' },
  // IT Setup
  { task: 'Laptop assignment', category: 'it_setup', assignedTo: 'IT' },
  { task: 'Email account setup', category: 'it_setup', assignedTo: 'IT' },
  { task: 'Software access setup', category: 'it_setup', assignedTo: 'IT' },
  // HR Formalities
  { task: 'Sign offer letter', category: 'hr_formalities', assignedTo: 'HR' },
  { task: 'Sign NDA', category: 'hr_formalities', assignedTo: 'HR' },
  { task: 'Fill emergency contact form', category: 'hr_formalities', assignedTo: 'HR' },
  { task: 'Add bank details', category: 'hr_formalities', assignedTo: 'HR' },
  // Training
  { task: 'Company orientation', category: 'training', assignedTo: 'Manager' },
  { task: 'Department introduction', category: 'training', assignedTo: 'Manager' },
  { task: 'Tool training', category: 'training', assignedTo: 'Manager' },
];

// 1. GET /onboarding/:userId — Get onboarding checklist for a user (admin or self)
router.get('/onboarding/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    // Allow admin/team_lead or the user themselves
    if (!isAdmin(req) && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const user = await req.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, department: true, dateOfJoining: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const checklist = await req.prisma.onboardingChecklist.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });

    res.json({ user, checklist });
  } catch (err) {
    console.error('Get onboarding checklist error:', err);
    res.status(500).json({ error: 'Failed to fetch onboarding checklist.' });
  }
});

// 2. POST /onboarding/:userId — Create checklist items in bulk (admin only)
router.post('/onboarding/:userId', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = await req.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'tasks array is required and must not be empty.' });
    }

    const validCategories = ['documents', 'it_setup', 'hr_formalities', 'training'];

    const data = tasks.map((t) => {
      if (!t.task) throw new Error('Each task must have a "task" field.');
      const category = t.category || 'hr_formalities';
      if (!validCategories.includes(category)) {
        throw new Error(`Invalid category "${category}". Must be one of: ${validCategories.join(', ')}`);
      }
      return {
        userId,
        task: t.task,
        category,
        dueDate: t.dueDate || null,
        assignedTo: t.assignedTo || null,
      };
    });

    const created = await req.prisma.onboardingChecklist.createMany({ data });

    res.status(201).json({ message: `${created.count} checklist items created.`, count: created.count });
  } catch (err) {
    console.error('Create onboarding tasks error:', err);
    if (err.message && err.message.includes('Invalid category')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes('must have a "task"')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create onboarding tasks.' });
  }
});

// 3. POST /onboarding/:userId/from-template — Create default checklist from template (admin only)
router.post('/onboarding/:userId/from-template', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = await req.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if checklist already exists
    const existing = await req.prisma.onboardingChecklist.count({ where: { userId } });
    if (existing > 0) {
      return res.status(409).json({
        error: 'Onboarding checklist already exists for this user. Delete existing items first or add tasks individually.',
      });
    }

    const data = ONBOARDING_TEMPLATE.map((t) => ({
      userId,
      task: t.task,
      category: t.category,
      assignedTo: t.assignedTo,
    }));

    const created = await req.prisma.onboardingChecklist.createMany({ data });

    res.status(201).json({
      message: `${created.count} template tasks created for ${user.name}.`,
      count: created.count,
    });
  } catch (err) {
    console.error('Create onboarding from template error:', err);
    res.status(500).json({ error: 'Failed to create onboarding template.' });
  }
});

// 4. PUT /onboarding/task/:id — Toggle task complete/incomplete (admin or self)
router.put('/onboarding/task/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    const task = await req.prisma.onboardingChecklist.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Allow admin/team_lead or the user themselves
    if (!isAdmin(req) && req.user.id !== task.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const updated = await req.prisma.onboardingChecklist.update({
      where: { id: taskId },
      data: {
        isCompleted: !task.isCompleted,
        completedAt: !task.isCompleted ? new Date() : null,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('Toggle onboarding task error:', err);
    res.status(500).json({ error: 'Failed to update onboarding task.' });
  }
});

// ============================================================
//  SEPARATION
// ============================================================

// 5. POST /separation — Initiate separation (admin only)
router.post('/separation', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const { userId, type, requestDate, lastWorkingDate, reason, noticePeriodDays } = req.body;

    if (!userId || !type || !requestDate) {
      return res.status(400).json({ error: 'userId, type, and requestDate are required.' });
    }

    const validTypes = ['resignation', 'termination', 'absconding', 'retirement'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const user = await req.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check for existing active separation
    const existing = await req.prisma.separation.findUnique({ where: { userId } });
    if (existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
      return res.status(409).json({ error: 'An active separation already exists for this user.' });
    }

    // If a completed/cancelled one exists, delete it first (userId is @unique)
    if (existing) {
      await req.prisma.separation.delete({ where: { userId } });
    }

    const separation = await req.prisma.separation.create({
      data: {
        userId,
        type,
        requestDate,
        lastWorkingDate: lastWorkingDate || null,
        reason: reason || null,
        noticePeriodDays: noticePeriodDays || 30,
        processedBy: req.user.id,
      },
    });

    res.status(201).json(separation);
  } catch (err) {
    console.error('Initiate separation error:', err);
    res.status(500).json({ error: 'Failed to initiate separation.' });
  }
});

// 6. GET /separations — List all active separations (admin only)
router.get('/separations', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const separations = await req.prisma.separation.findMany({
      where: {
        status: { notIn: ['completed', 'cancelled'] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
            employeeId: true,
            dateOfJoining: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(separations);
  } catch (err) {
    console.error('List separations error:', err);
    res.status(500).json({ error: 'Failed to fetch separations.' });
  }
});

// 7. GET /separation/:id — Single separation detail (admin only)
router.get('/separation/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid separation ID.' });
    }

    const separation = await req.prisma.separation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
            employeeId: true,
            dateOfJoining: true,
            phone: true,
            personalEmail: true,
            profilePhotoUrl: true,
          },
        },
        processor: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!separation) {
      return res.status(404).json({ error: 'Separation record not found.' });
    }

    res.json(separation);
  } catch (err) {
    console.error('Get separation detail error:', err);
    res.status(500).json({ error: 'Failed to fetch separation details.' });
  }
});

// 8. PUT /separation/:id — Update separation (admin only)
router.put('/separation/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid separation ID.' });
    }

    const existing = await req.prisma.separation.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Separation record not found.' });
    }

    const { status, lastWorkingDate, exitInterviewDone, exitInterviewNotes, fnfAmount, fnfPaidOn } = req.body;

    // Validate status if provided
    const validStatuses = ['initiated', 'notice_period', 'fnf_pending', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (lastWorkingDate !== undefined) updateData.lastWorkingDate = lastWorkingDate;
    if (exitInterviewDone !== undefined) updateData.exitInterviewDone = exitInterviewDone;
    if (exitInterviewNotes !== undefined) updateData.exitInterviewNotes = exitInterviewNotes;
    if (fnfAmount !== undefined) updateData.fnfAmount = fnfAmount;
    if (fnfPaidOn !== undefined) updateData.fnfPaidOn = fnfPaidOn;

    const updated = await req.prisma.separation.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (err) {
    console.error('Update separation error:', err);
    res.status(500).json({ error: 'Failed to update separation.' });
  }
});

// ============================================================
//  ANALYTICS
// ============================================================

// 9. GET /confirmations-due — Employees pending confirmation (admin only)
router.get('/confirmations-due', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const cutoffDate = thirtyDaysFromNow.toISOString().split('T')[0]; // "YYYY-MM-DD"

    const users = await req.prisma.user.findMany({
      where: {
        isActive: true,
        confirmationDate: null,
        probationEndDate: { not: null, lte: cutoffDate },
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        department: true,
        designation: true,
        dateOfJoining: true,
        probationEndDate: true,
        confirmationDate: true,
      },
      orderBy: { probationEndDate: 'asc' },
    });

    res.json(users);
  } catch (err) {
    console.error('Confirmations due error:', err);
    res.status(500).json({ error: 'Failed to fetch confirmations due.' });
  }
});

// 10. GET /new-joinees — Employees who joined in last 30 days (admin only)
router.get('/new-joinees', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin or Team Lead access required.' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0]; // "YYYY-MM-DD"

    const users = await req.prisma.user.findMany({
      where: {
        isActive: true,
        dateOfJoining: { not: null, gte: cutoffDate },
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        department: true,
        designation: true,
        dateOfJoining: true,
        employmentType: true,
      },
      orderBy: { dateOfJoining: 'desc' },
    });

    // Fetch onboarding progress for each new joinee
    const usersWithProgress = await Promise.all(
      users.map(async (user) => {
        const totalTasks = await req.prisma.onboardingChecklist.count({
          where: { userId: user.id },
        });
        const completedTasks = await req.prisma.onboardingChecklist.count({
          where: { userId: user.id, isCompleted: true },
        });
        return {
          ...user,
          onboardingProgress: {
            completed: completedTasks,
            total: totalTasks,
          },
        };
      })
    );

    res.json(usersWithProgress);
  } catch (err) {
    console.error('New joinees error:', err);
    res.status(500).json({ error: 'Failed to fetch new joinees.' });
  }
});

module.exports = router;
