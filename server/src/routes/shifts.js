const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate); // All routes require authentication

// ═══════════════════════════════════════════════
// ADMIN: Shift CRUD Operations
// ═══════════════════════════════════════════════

// GET /api/shifts - List all shifts (admin only or user's company)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { companyId } = req.query;

    // Non-admins can only see shifts for their company
    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && companyId && parseInt(companyId) !== req.user.companyId) {
      throw forbidden();
    }

    const where = companyId
      ? { companyId: parseInt(companyId), isActive: true }
      : { isActive: true };

    const shifts = await req.prisma.shift.findMany({
      where,
      include: {
        _count: { select: { shiftAssignments: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json(shifts);
  })
);

// POST /api/shifts - Create new shift (admin only)
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    requireFields(req.body, 'name', 'startTime', 'endTime');

    const { name, startTime, endTime, breakDuration = 60, flexibility = 0, description, companyId } = req.body;

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      throw badRequest('Time must be in HH:MM format (24-hour)');
    }

    // Check if shift name already exists for this company
    const existing = await req.prisma.shift.findFirst({
      where: {
        name: name.trim(),
        companyId: companyId ? parseInt(companyId) : null
      }
    });

    if (existing) {
      throw conflict(`Shift "${name}" already exists`);
    }

    const shift = await req.prisma.shift.create({
      data: {
        name: name.trim(),
        startTime,
        endTime,
        breakDuration: parseInt(breakDuration),
        flexibility: parseInt(flexibility),
        description: description || null,
        companyId: companyId ? parseInt(companyId) : null,
        isActive: true
      }
    });

    res.status(201).json(shift);
  })
);

// GET /api/shifts/my - Get current user's shift info
router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    // Get current active shift
    const assignment = await req.prisma.shiftAssignment.findFirst({
      where: {
        userId: req.user.id,
        status: 'active',
        effectiveFrom: { lte: today },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: today } }
        ]
      },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, breakDuration: true, flexibility: true } }
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    res.json({
      current: assignment,
      userShift: req.user.shift // Fallback to default shift
    });
  })
);

// ═══════════════════════════════════════════════
// SHIFT ROSTER (Calendar Grid View)
// — Must be BEFORE /:id to prevent Express param matching
// ═══════════════════════════════════════════════

// GET /api/shifts/roster?month=2026-03 — Get all employees with their shift assignments for a month
router.get(
  '/roster',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const month = req.query.month || new Date().toISOString().substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be in YYYY-MM format.');

    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Get all active employees
    const employees = await req.prisma.user.findMany({
      where: { status: { not: 'inactive' } },
      select: {
        id: true,
        name: true,
        employeeId: true,
        shift: true,
        department: true,
        branch: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get all shift assignments that overlap this month for all users
    const assignments = await req.prisma.shiftAssignment.findMany({
      where: {
        status: { in: ['active', 'pending'] },
        effectiveFrom: { lte: endDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: startDate } },
        ],
      },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Get all shifts for legend / dropdown
    const shifts = await req.prisma.shift.findMany({
      where: { isActive: true },
      select: { id: true, name: true, startTime: true, endTime: true },
      orderBy: { name: 'asc' },
    });

    // Build assignment lookup: userId -> array of assignments
    const assignmentsByUser = {};
    for (const a of assignments) {
      if (!assignmentsByUser[a.userId]) assignmentsByUser[a.userId] = [];
      assignmentsByUser[a.userId].push(a);
    }

    // Build roster data
    const roster = employees.map(emp => {
      const userAssignments = assignmentsByUser[emp.id] || [];

      // For each day of the month, find the applicable shift
      const days = {};
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;

        // Find the most recent assignment that covers this date
        const applicable = userAssignments.find(a => {
          if (a.effectiveFrom > dateStr) return false;
          if (a.effectiveTo && a.effectiveTo < dateStr) return false;
          return true;
        });

        if (applicable) {
          days[dateStr] = {
            shiftId: applicable.shift.id,
            shiftName: applicable.shift.name,
            assignmentId: applicable.id,
          };
        } else {
          // Use default shift name from user profile
          days[dateStr] = {
            shiftId: null,
            shiftName: emp.shift || null,
            assignmentId: null,
          };
        }
      }

      return {
        userId: emp.id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department,
        branch: emp.branch,
        defaultShift: emp.shift,
        days,
      };
    });

    res.json({
      month,
      year,
      lastDay,
      shifts,
      roster,
    });
  })
);

// POST /api/shifts/roster/assign — Assign shift to employee from roster
router.post(
  '/roster/assign',
  requireAdmin,
  asyncHandler(async (req, res) => {
    requireFields(req.body, 'userId', 'shiftId', 'effectiveFrom');
    const { userId, shiftId, effectiveFrom, effectiveTo, reason } = req.body;

    const userIdNum = parseInt(userId);
    const shiftIdNum = parseInt(shiftId);
    if (isNaN(userIdNum) || isNaN(shiftIdNum)) throw badRequest('Invalid userId or shiftId');

    // Verify user and shift exist
    const [user, shift] = await Promise.all([
      req.prisma.user.findUnique({ where: { id: userIdNum } }),
      req.prisma.shift.findUnique({ where: { id: shiftIdNum } }),
    ]);
    if (!user) throw notFound('User');
    if (!shift) throw notFound('Shift');

    const today = new Date().toISOString().split('T')[0];
    const status = effectiveFrom > today ? 'pending' : 'active';

    // Expire any existing active/pending assignments that overlap
    await req.prisma.shiftAssignment.updateMany({
      where: {
        userId: userIdNum,
        status: { in: ['active', 'pending'] },
        effectiveFrom: { lte: effectiveTo || '9999-12-31' },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveFrom } },
        ],
      },
      data: { status: 'expired', effectiveTo: effectiveFrom },
    });

    // Create new assignment
    const assignment = await req.prisma.shiftAssignment.create({
      data: {
        userId: userIdNum,
        shiftId: shiftIdNum,
        assignedBy: req.user.id,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        reason: reason || 'Roster Assignment',
        status,
      },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        user: { select: { id: true, name: true, employeeId: true } },
      },
    });

    // Update user's shift field
    if (status === 'active') {
      await req.prisma.user.update({
        where: { id: userIdNum },
        data: { shift: shift.name },
      });
    }

    res.status(201).json(assignment);
  })
);

// ═══════════════════════════════════════════════
// SHIFT ASSIGNMENTS (named routes — before /:id)
// ═══════════════════════════════════════════════

// POST /api/shifts/assign - Assign shift to employee (manager/admin only)
router.post(
  '/assign',
  requireAdmin,
  asyncHandler(async (req, res) => {
    requireFields(req.body, 'userId', 'shiftId');

    const { userId, shiftId, effectiveFrom, reason, notes } = req.body;
    const userIdNum = parseInt(userId);
    const shiftIdNum = parseInt(shiftId);

    // Verify user exists
    const user = await req.prisma.user.findUnique({ where: { id: userIdNum } });
    if (!user) throw notFound('User');

    // Verify shift exists
    const shift = await req.prisma.shift.findUnique({ where: { id: shiftIdNum } });
    if (!shift) throw notFound('Shift');

    // If effectiveFrom is in future, set status to pending
    const effectiveDate = effectiveFrom || new Date().toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const status = effectiveDate > today ? 'pending' : 'active';

    // Expire any existing active assignment for this user
    await req.prisma.shiftAssignment.updateMany(
      { where: { userId: userIdNum, status: 'active' } },
      { data: { status: 'expired', effectiveTo: effectiveDate } }
    );

    const assignment = await req.prisma.shiftAssignment.create({
      data: {
        userId: userIdNum,
        shiftId: shiftIdNum,
        assignedBy: req.user.id,
        effectiveFrom: effectiveDate,
        reason: reason || 'Manager Decision',
        status,
        notes: notes || null
      },
      include: {
        user: { select: { id: true, name: true, employeeId: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } }
      }
    });

    // Update user's shift field for quick access
    if (status === 'active') {
      await req.prisma.user.update({
        where: { id: userIdNum },
        data: { shift: shift.name }
      });
    }

    res.status(201).json(assignment);
  })
);

// GET /api/shifts/employee/:userId - Get employee's shift history
router.get(
  '/employee/:userId',
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.userId);

    // Check authorization
    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && req.user.id !== userId) {
      throw forbidden();
    }

    const assignments = await req.prisma.shiftAssignment.findMany({
      where: { userId },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, breakDuration: true } },
        assignedByUser: { select: { id: true, name: true } }
      },
      orderBy: { assignedAt: 'desc' }
    });

    res.json(assignments);
  })
);

// GET /api/shifts/employee/:userId/current - Get employee's current active shift
router.get(
  '/employee/:userId/current',
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.userId);

    // Check authorization
    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && req.user.id !== userId) {
      throw forbidden();
    }

    const today = new Date().toISOString().split('T')[0];

    const assignment = await req.prisma.shiftAssignment.findFirst({
      where: {
        userId,
        status: 'active',
        effectiveFrom: { lte: today },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: today } }
        ]
      },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, breakDuration: true, flexibility: true } }
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (!assignment) {
      res.json(null);
    } else {
      res.json(assignment);
    }
  })
);

// PUT /api/shifts/assignment/:assignmentId - Update shift assignment
router.put(
  '/assignment/:assignmentId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const assignmentId = parseId(req.params.assignmentId);
    const { effectiveTo, reason, notes, status } = req.body;

    const assignment = await req.prisma.shiftAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) throw notFound('Shift Assignment');

    // Cannot update if already expired or cancelled
    if (['expired', 'cancelled'].includes(assignment.status)) {
      throw conflict(`Cannot modify ${assignment.status} assignment`);
    }

    const updated = await req.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(effectiveTo && { effectiveTo }),
        ...(reason && { reason }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status && { status })
      },
      include: {
        user: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true } }
      }
    });

    res.json(updated);
  })
);

// DELETE /api/shifts/assignment/:assignmentId - Cancel shift assignment
router.delete(
  '/assignment/:assignmentId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const assignmentId = parseId(req.params.assignmentId);

    const assignment = await req.prisma.shiftAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) throw notFound('Shift Assignment');

    // Set status to cancelled with effective end date as today
    const today = new Date().toISOString().split('T')[0];

    const updated = await req.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'cancelled',
        effectiveTo: today
      }
    });

    res.json({ message: 'Shift assignment cancelled' });
  })
);

// ═══════════════════════════════════════════════
// PARAM-BASED ROUTES (/:id) — MUST be LAST
// ═══════════════════════════════════════════════

// GET /api/shifts/:id - Get shift details
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const shift = await req.prisma.shift.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        shiftAssignments: {
          where: { status: 'active' },
          include: {
            user: { select: { id: true, name: true, employeeId: true } }
          },
          take: 10 // Limit to recent assignments
        }
      }
    });

    if (!shift) throw notFound('Shift');
    res.json(shift);
  })
);

// PUT /api/shifts/:id - Update shift (admin only)
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { name, startTime, endTime, breakDuration, flexibility, description, isActive } = req.body;

    const shift = await req.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw notFound('Shift');

    // Validate time format if provided
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
      throw badRequest('Start time must be in HH:MM format');
    }
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
      throw badRequest('End time must be in HH:MM format');
    }

    // Check for duplicate shift name (excluding current shift)
    if (name && name !== shift.name) {
      const existing = await req.prisma.shift.findFirst({
        where: {
          name: name.trim(),
          companyId: shift.companyId,
          NOT: { id }
        }
      });
      if (existing) throw conflict(`Shift "${name}" already exists`);
    }

    const updated = await req.prisma.shift.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(breakDuration !== undefined && { breakDuration: parseInt(breakDuration) }),
        ...(flexibility !== undefined && { flexibility: parseInt(flexibility) }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(updated);
  })
);

// DELETE /api/shifts/:id - Delete shift (soft delete by marking inactive)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const shift = await req.prisma.shift.findUnique({
      where: { id },
      include: { _count: { select: { shiftAssignments: { where: { status: 'active' } } } } }
    });

    if (!shift) throw notFound('Shift');

    // Prevent deletion if active assignments exist
    if (shift._count.shiftAssignments > 0) {
      throw conflict('Cannot delete shift with active employee assignments. Deactivate the shift instead.');
    }

    await req.prisma.shift.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Shift deleted successfully' });
  })
);

module.exports = router;
