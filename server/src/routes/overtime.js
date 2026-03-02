const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Helper: check admin or team_lead role
function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin or Team Lead access required.' });
  }
  next();
}

// ──────────────────────────────────────────────────────────────
// POST / — Request overtime (any authenticated user)
// Body: { date, hours, reason }
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { date, hours, reason } = req.body;

    if (!date || hours === undefined || hours === null) {
      return res.status(400).json({ error: 'date and hours are required.' });
    }

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 12) {
      return res.status(400).json({ error: 'hours must be greater than 0 and at most 12.' });
    }

    // Check for duplicate request on the same date
    const existing = await req.prisma.overtimeRequest.findUnique({
      where: {
        userId_date: {
          userId: req.user.id,
          date: date,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'You already have an overtime request for this date.' });
    }

    const request = await req.prisma.overtimeRequest.create({
      data: {
        userId: req.user.id,
        date,
        hours: parsedHours,
        reason: reason || null,
      },
    });

    res.status(201).json(request);
  } catch (err) {
    console.error('Create overtime error:', err);
    res.status(500).json({ error: 'Failed to create overtime request.' });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /my — Own overtime requests, ordered by date desc
// ──────────────────────────────────────────────────────────────
router.get('/my', async (req, res) => {
  try {
    const requests = await req.prisma.overtimeRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    console.error('Fetch own overtime error:', err);
    res.status(500).json({ error: 'Failed to fetch overtime requests.' });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /pending — Pending OT requests (admin/team_lead only)
// Includes user details, ordered by createdAt asc
// ──────────────────────────────────────────────────────────────
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const requests = await req.prisma.overtimeRequest.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            employeeId: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(requests);
  } catch (err) {
    console.error('Fetch pending overtime error:', err);
    res.status(500).json({ error: 'Failed to fetch pending overtime requests.' });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /all — All OT requests with optional filters (admin/team_lead)
// Query params: status, month (YYYY-MM), userId
// ──────────────────────────────────────────────────────────────
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const { status, month, userId } = req.query;
    const where = {};

    if (status) {
      where.status = status;
    }

    if (month) {
      // Filter by month — date field is stored as "YYYY-MM-DD"
      where.date = {
        startsWith: month,
      };
    }

    if (userId) {
      where.userId = parseInt(userId);
    }

    const requests = await req.prisma.overtimeRequest.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            employeeId: true,
            department: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    console.error('Fetch all overtime error:', err);
    res.status(500).json({ error: 'Failed to fetch overtime requests.' });
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /:id/review — Approve or reject an overtime request (admin/team_lead)
// Body: { status ('approved'/'rejected'), compOffEarned (boolean) }
// ──────────────────────────────────────────────────────────────
router.put('/:id/review', requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { status, compOffEarned } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected".' });
    }

    // Fetch the existing request
    const existing = await req.prisma.overtimeRequest.findUnique({
      where: { id: requestId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Overtime request not found.' });
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be reviewed.' });
    }

    const updated = await req.prisma.overtimeRequest.update({
      where: { id: requestId },
      data: {
        status,
        compOffEarned: compOffEarned === true,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            employeeId: true,
            department: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('Review overtime error:', err);
    res.status(500).json({ error: 'Failed to review overtime request.' });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /summary — Monthly summary (admin/team_lead)
// Query param: month (YYYY-MM)
// Returns aggregate stats and department breakdown
// ──────────────────────────────────────────────────────────────
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'month query parameter is required (YYYY-MM).' });
    }

    // Fetch all requests for the month with user details
    const requests = await req.prisma.overtimeRequest.findMany({
      where: {
        date: { startsWith: month },
      },
      include: {
        user: {
          select: {
            department: true,
          },
        },
      },
    });

    const totalRequests = requests.length;
    const totalHours = requests.reduce((sum, r) => sum + r.hours, 0);
    const approved = requests.filter((r) => r.status === 'approved').length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    const compOffsEarned = requests.filter((r) => r.compOffEarned === true).length;

    // Build department breakdown
    const deptMap = {};
    for (const r of requests) {
      const dept = r.user?.department || 'Unknown';
      if (!deptMap[dept]) {
        deptMap[dept] = {
          department: dept,
          totalRequests: 0,
          totalHours: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          compOffsEarned: 0,
        };
      }
      deptMap[dept].totalRequests++;
      deptMap[dept].totalHours += r.hours;
      if (r.status === 'approved') deptMap[dept].approved++;
      if (r.status === 'pending') deptMap[dept].pending++;
      if (r.status === 'rejected') deptMap[dept].rejected++;
      if (r.compOffEarned) deptMap[dept].compOffsEarned++;
    }

    const byDepartment = Object.values(deptMap);

    res.json({
      month,
      totalRequests,
      totalHours,
      approved,
      pending,
      rejected,
      compOffsEarned,
      byDepartment,
    });
  } catch (err) {
    console.error('Overtime summary error:', err);
    res.status(500).json({ error: 'Failed to generate overtime summary.' });
  }
});

module.exports = router;
