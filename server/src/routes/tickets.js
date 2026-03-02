const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Helper: check if user is admin or team_lead
function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

// Valid enums
const VALID_CATEGORIES = ['it', 'hr', 'admin', 'facilities', 'other'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// Priority sort weight (urgent first)
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

// SLA targets in hours by priority
const SLA_TARGETS = { urgent: 4, high: 24, medium: 72, low: 168 };

// Helper: compute resolution hours and SLA status for a ticket
function enrichTicket(t) {
  const enriched = { ...t };
  if (t.resolvedAt && t.createdAt) {
    const ms = new Date(t.resolvedAt) - new Date(t.createdAt);
    enriched.resolutionHours = Math.round(ms / (1000 * 60 * 60) * 10) / 10;
  }
  // SLA: compute elapsed hours and breach status
  const refTime = t.resolvedAt || new Date();
  const elapsedMs = new Date(refTime) - new Date(t.createdAt);
  const elapsedHours = Math.round(elapsedMs / (1000 * 60 * 60) * 10) / 10;
  const slaTarget = SLA_TARGETS[t.priority] || 72;
  enriched.slaTargetHours = slaTarget;
  enriched.elapsedHours = elapsedHours;
  enriched.slaBreached = elapsedHours > slaTarget;
  enriched.slaPercentUsed = Math.round((elapsedHours / slaTarget) * 100);
  return enriched;
}

// ─── 1. GET /my ─── My tickets (any user)
router.get('/my', async (req, res) => {
  try {
    const tickets = await req.prisma.ticket.findMany({
      where: { userId: req.user.id },
      include: {
        assignee: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = tickets.map(t => ({
      ...enrichTicket(t),
      commentCount: t._count.comments,
      _count: undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /tickets/my error:', err);
    res.status(500).json({ error: 'Failed to fetch your tickets' });
  }
});

// ─── 2. POST / ─── Create a new ticket
router.post('/', async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    const ticket = await req.prisma.ticket.create({
      data: {
        userId: req.user.id,
        subject,
        description,
        category: category || 'other',
        priority: priority || 'medium',
        status: 'open',
      },
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error('POST /tickets error:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// ─── 3. GET /:id ─── Ticket detail with comments
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID' });

    const ticket = await req.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        assignee: { select: { id: true, name: true, email: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Regular users can only view their own tickets
    if (!isAdmin(req) && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Filter out internal comments for non-admin users
    if (!isAdmin(req)) {
      ticket.comments = ticket.comments.filter(c => !c.isInternal);
    }

    res.json(enrichTicket(ticket));
  } catch (err) {
    console.error('GET /tickets/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// ─── 4. POST /:id/comment ─── Add comment to a ticket
router.post('/:id/comment', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID' });

    const { content, isInternal } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const ticket = await req.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Regular users can only comment on their own tickets
    if (!isAdmin(req) && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only comment on your own tickets' });
    }

    // Only admin can set isInternal
    const internalFlag = isAdmin(req) && isInternal === true;

    const comment = await req.prisma.ticketComment.create({
      data: {
        ticketId: id,
        userId: req.user.id,
        content: content.trim(),
        isInternal: internalFlag,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    res.status(201).json(comment);
  } catch (err) {
    console.error('POST /tickets/:id/comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ─── 5. PUT /:id/assign ─── Assign ticket (admin only)
router.put('/:id/assign', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID' });

    const { assignedTo, priority } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ error: 'assignedTo (user ID) is required' });
    }

    const ticket = await req.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Verify the assignee exists
    const assignee = await req.prisma.user.findUnique({ where: { id: assignedTo } });
    if (!assignee) return res.status(404).json({ error: 'Assignee user not found' });

    // Build update data
    const data = { assignedTo };

    // Auto-advance status from open to in_progress
    if (ticket.status === 'open') {
      data.status = 'in_progress';
    }

    // Optionally update priority
    if (priority) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
      }
      data.priority = priority;
    }

    const updated = await req.prisma.ticket.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /tickets/:id/assign error:', err);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// ─── 6. PUT /:id/resolve ─── Resolve ticket (admin or ticket owner)
router.put('/:id/resolve', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID' });

    const { resolution } = req.body;
    if (!resolution || !resolution.trim()) {
      return res.status(400).json({ error: 'Resolution text is required' });
    }

    const ticket = await req.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!isAdmin(req) && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'Only the ticket owner or admin can resolve this ticket' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Cannot resolve a closed ticket. Reopen it first.' });
    }

    const updated = await req.prisma.ticket.update({
      where: { id },
      data: {
        status: 'resolved',
        resolution: resolution.trim(),
        resolvedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /tickets/:id/resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

// ─── 7. PUT /:id/close ─── Close ticket (admin only)
router.put('/:id/close', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID' });

    const ticket = await req.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Ticket is already closed' });
    }

    const updated = await req.prisma.ticket.update({
      where: { id },
      data: { status: 'closed' },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /tickets/:id/close error:', err);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
});

// ─── 8. PUT /:id/reopen ─── Reopen ticket (owner or admin)
router.put('/:id/reopen', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID' });

    const ticket = await req.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!isAdmin(req) && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'Only the ticket owner or admin can reopen this ticket' });
    }

    if (ticket.status === 'open') {
      return res.status(400).json({ error: 'Ticket is already open' });
    }

    const updated = await req.prisma.ticket.update({
      where: { id },
      data: {
        status: 'open',
        resolution: null,
        resolvedAt: null,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /tickets/:id/reopen error:', err);
    res.status(500).json({ error: 'Failed to reopen ticket' });
  }
});

// ─── 9. GET /admin/all ─── All tickets with filters (admin only)
router.get('/admin/all', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const { status, category, priority, assignedTo } = req.query;
    const where = {};

    if (status && VALID_STATUSES.includes(status)) where.status = status;
    if (category && VALID_CATEGORIES.includes(category)) where.category = category;
    if (priority && VALID_PRIORITIES.includes(priority)) where.priority = priority;
    if (assignedTo) where.assignedTo = parseInt(assignedTo);

    const tickets = await req.prisma.ticket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Sort by priority weight (urgent first), then by createdAt desc (already from DB)
    tickets.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const result = tickets.map(t => ({
      ...enrichTicket(t),
      commentCount: t._count.comments,
      _count: undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /tickets/admin/all error:', err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// ─── 10. GET /admin/stats ─── Ticket statistics with SLA tracking (admin only)
router.get('/admin/stats', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Count by status
    const [openCount, inProgressCount, resolvedThisMonth, totalClosed] = await Promise.all([
      req.prisma.ticket.count({ where: { status: 'open' } }),
      req.prisma.ticket.count({ where: { status: 'in_progress' } }),
      req.prisma.ticket.count({
        where: {
          status: { in: ['resolved', 'closed'] },
          resolvedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      req.prisma.ticket.count({ where: { status: 'closed' } }),
    ]);

    // All tickets for deep analysis
    const allTickets = await req.prisma.ticket.findMany({
      select: {
        id: true, category: true, priority: true, status: true,
        createdAt: true, resolvedAt: true, assignedTo: true,
      },
    });

    // ── Basic breakdowns ──
    const byCategory = {};
    const byPriority = {};
    for (const t of allTickets) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    }

    // ── Resolution speed analysis ──
    const resolvedTickets = allTickets.filter(t => t.resolvedAt);
    const thisMonthResolved = resolvedTickets.filter(t => {
      const d = new Date(t.resolvedAt);
      return d >= monthStart && d <= monthEnd;
    });

    // Average resolution time (all time)
    let avgResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalMs = resolvedTickets.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
      avgResolutionHours = Math.round((totalMs / resolvedTickets.length) / (1000 * 60 * 60) * 10) / 10;
    }

    // Avg resolution this month
    let avgResolutionHoursThisMonth = 0;
    if (thisMonthResolved.length > 0) {
      const totalMs = thisMonthResolved.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
      avgResolutionHoursThisMonth = Math.round((totalMs / thisMonthResolved.length) / (1000 * 60 * 60) * 10) / 10;
    }

    // ── SLA compliance ──
    let slaCompliant = 0;
    let slaBreached = 0;
    for (const t of resolvedTickets) {
      const hours = (new Date(t.resolvedAt) - new Date(t.createdAt)) / (1000 * 60 * 60);
      const target = SLA_TARGETS[t.priority] || 72;
      if (hours <= target) slaCompliant++;
      else slaBreached++;
    }

    // Currently open tickets breaching SLA
    const openBreaching = allTickets.filter(t => {
      if (t.status === 'closed' || t.resolvedAt) return false;
      const hours = (now - new Date(t.createdAt)) / (1000 * 60 * 60);
      return hours > (SLA_TARGETS[t.priority] || 72);
    }).length;

    // ── Resolution by priority ──
    const resolutionByPriority = {};
    for (const p of VALID_PRIORITIES) {
      const tickets = resolvedTickets.filter(t => t.priority === p);
      if (tickets.length > 0) {
        const totalMs = tickets.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
        resolutionByPriority[p] = {
          count: tickets.length,
          avgHours: Math.round((totalMs / tickets.length) / (1000 * 60 * 60) * 10) / 10,
          slaTarget: SLA_TARGETS[p],
        };
      } else {
        resolutionByPriority[p] = { count: 0, avgHours: 0, slaTarget: SLA_TARGETS[p] };
      }
    }

    // ── Resolution by category ──
    const resolutionByCategory = {};
    for (const c of VALID_CATEGORIES) {
      const tickets = resolvedTickets.filter(t => t.category === c);
      if (tickets.length > 0) {
        const totalMs = tickets.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
        resolutionByCategory[c] = {
          count: tickets.length,
          avgHours: Math.round((totalMs / tickets.length) / (1000 * 60 * 60) * 10) / 10,
        };
      }
    }

    // ── Resolution by assignee ──
    const assigneeMap = {};
    for (const t of resolvedTickets) {
      if (!t.assignedTo) continue;
      if (!assigneeMap[t.assignedTo]) assigneeMap[t.assignedTo] = { resolved: 0, totalMs: 0, breached: 0 };
      const ms = new Date(t.resolvedAt) - new Date(t.createdAt);
      assigneeMap[t.assignedTo].resolved++;
      assigneeMap[t.assignedTo].totalMs += ms;
      if (ms / (1000 * 60 * 60) > (SLA_TARGETS[t.priority] || 72)) assigneeMap[t.assignedTo].breached++;
    }

    // Fetch assignee names
    const assigneeIds = Object.keys(assigneeMap).map(Number);
    const assignees = assigneeIds.length > 0
      ? await req.prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
      : [];
    const nameMap = Object.fromEntries(assignees.map(u => [u.id, u.name]));

    const resolutionByAssignee = assigneeIds.map(id => ({
      id,
      name: nameMap[id] || 'Unknown',
      resolved: assigneeMap[id].resolved,
      avgHours: Math.round((assigneeMap[id].totalMs / assigneeMap[id].resolved) / (1000 * 60 * 60) * 10) / 10,
      slaBreached: assigneeMap[id].breached,
    })).sort((a, b) => b.resolved - a.resolved);

    // ── Monthly trend (last 6 months) ──
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const created = allTickets.filter(t => new Date(t.createdAt) >= mStart && new Date(t.createdAt) <= mEnd).length;
      const resolved = resolvedTickets.filter(t => new Date(t.resolvedAt) >= mStart && new Date(t.resolvedAt) <= mEnd);
      let avgH = 0;
      if (resolved.length > 0) {
        const totalMs = resolved.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
        avgH = Math.round((totalMs / resolved.length) / (1000 * 60 * 60) * 10) / 10;
      }

      monthlyTrend.push({ month: label, created, resolved: resolved.length, avgResolutionHours: avgH });
    }

    res.json({
      open: openCount,
      inProgress: inProgressCount,
      resolvedThisMonth,
      totalClosed,
      avgResolutionHours,
      avgResolutionHoursThisMonth,
      sla: {
        compliant: slaCompliant,
        breached: slaBreached,
        complianceRate: resolvedTickets.length > 0 ? Math.round((slaCompliant / resolvedTickets.length) * 100) : 100,
        openBreaching,
        targets: SLA_TARGETS,
      },
      byCategory,
      byPriority,
      resolutionByPriority,
      resolutionByCategory,
      resolutionByAssignee,
      monthlyTrend,
    });
  } catch (err) {
    console.error('GET /tickets/admin/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch ticket statistics' });
  }
});

module.exports = router;
