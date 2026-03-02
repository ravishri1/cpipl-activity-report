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
      ...t,
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

    res.json(ticket);
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
      ...t,
      commentCount: t._count.comments,
      _count: undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /tickets/admin/all error:', err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// ─── 10. GET /admin/stats ─── Ticket statistics (admin only)
router.get('/admin/stats', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Count by status
    const [openCount, inProgressCount, resolvedThisMonth] = await Promise.all([
      req.prisma.ticket.count({ where: { status: 'open' } }),
      req.prisma.ticket.count({ where: { status: 'in_progress' } }),
      req.prisma.ticket.count({
        where: {
          status: { in: ['resolved', 'closed'] },
          resolvedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

    // Average resolution time (for tickets resolved this month)
    const resolvedTickets = await req.prisma.ticket.findMany({
      where: {
        resolvedAt: { not: null, gte: monthStart, lte: monthEnd },
      },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalMs = resolvedTickets.reduce((sum, t) => {
        return sum + (new Date(t.resolvedAt) - new Date(t.createdAt));
      }, 0);
      avgResolutionHours = Math.round((totalMs / resolvedTickets.length) / (1000 * 60 * 60) * 10) / 10;
    }

    // Tickets by category
    const allTickets = await req.prisma.ticket.findMany({
      select: { category: true, priority: true },
    });

    const byCategory = {};
    const byPriority = {};
    for (const t of allTickets) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    }

    res.json({
      open: openCount,
      inProgress: inProgressCount,
      resolvedThisMonth,
      avgResolutionHours,
      byCategory,
      byPriority,
    });
  } catch (err) {
    console.error('GET /tickets/admin/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch ticket statistics' });
  }
});

module.exports = router;
