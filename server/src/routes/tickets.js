const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { notifyUsers } = require('../utils/notify');

const router = express.Router();
router.use(authenticate);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead'; }

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
router.get('/my', asyncHandler(async (req, res) => {
  const tickets = await req.prisma.ticket.findMany({
    where: { userId: req.user.id },
    include: { assignee: { select: { id: true, name: true } }, _count: { select: { comments: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(tickets.map(t => ({ ...enrichTicket(t), commentCount: t._count.comments, _count: undefined })));
}));

// ─── 2. POST / ─── Create a new ticket
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'subject', 'description');
  const { subject, description, category, priority } = req.body;
  if (category) requireEnum(category, VALID_CATEGORIES, 'category');
  if (priority) requireEnum(priority, VALID_PRIORITIES, 'priority');

  const ticket = await req.prisma.ticket.create({
    data: { userId: req.user.id, subject, description, category: category || 'other', priority: priority || 'medium', status: 'open' },
  });

  // Notify admins about new ticket
  const admins = await req.prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] }, id: { not: req.user.id } },
    select: { id: true },
  });
  notifyUsers(req.prisma, {
    userIds: admins.map(a => a.id), type: 'ticket',
    title: `New Ticket: ${subject}`,
    message: `${req.user.name || 'An employee'} raised a ${(priority || 'medium').toUpperCase()} priority ticket`,
    link: `/tickets/${ticket.id}`,
  });

  res.status(201).json(ticket);
}));

// ─── 3. GET /:id ─── Ticket detail with comments
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const ticket = await req.prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      assignee: { select: { id: true, name: true, email: true } },
      comments: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!ticket) throw notFound('Ticket');
  if (!isAdminRole(req.user) && ticket.userId !== req.user.id) throw forbidden();

  if (!isAdminRole(req.user)) {
    ticket.comments = ticket.comments.filter(c => !c.isInternal);
  }
  res.json(enrichTicket(ticket));
}));

// ─── 4. POST /:id/comment ─── Add comment to a ticket
router.post('/:id/comment', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { content, isInternal } = req.body;
  if (!content || !content.trim()) throw badRequest('Comment content is required');

  const ticket = await req.prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw notFound('Ticket');
  if (!isAdminRole(req.user) && ticket.userId !== req.user.id) throw forbidden('You can only comment on your own tickets');

  const internalFlag = isAdminRole(req.user) && isInternal === true;
  const comment = await req.prisma.ticketComment.create({
    data: { ticketId: id, userId: req.user.id, content: content.trim(), isInternal: internalFlag },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  // Notify the other party about the comment (skip internal notes to ticket owner)
  if (!internalFlag) {
    const notifyId = req.user.id === ticket.userId
      ? (ticket.assignedTo || null)  // employee commented → notify assignee
      : ticket.userId;                // admin/assignee commented → notify ticket owner
    if (notifyId && notifyId !== req.user.id) {
      notifyUsers(req.prisma, {
        userIds: [notifyId], type: 'ticket',
        title: `New Comment on Ticket #${id}`,
        message: `${req.user.name || 'Someone'} commented on "${ticket.subject}"`,
        link: `/tickets/${id}`,
      });
    }
  }

  res.status(201).json(comment);
}));

// ─── 5. PUT /:id/assign ─── Assign ticket (admin only)
// GET /:id/comments — fetch comments for a ticket
router.get('/:id/comments', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const ticket = await req.prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw notFound('Ticket');
  if (!isAdminRole(req.user) && ticket.userId !== req.user.id) throw forbidden();
  const where = { ticketId: id };
  if (!isAdminRole(req.user)) where.isInternal = false;
  const comments = await req.prisma.ticketComment.findMany({
    where,
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ comments });
}));

// PUT /:id/status — generic status change (resolve/close/reopen via single endpoint)
router.put('/:id/status', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, resolution } = req.body;
  requireEnum(status, VALID_STATUSES, 'status');
  const ticket = await req.prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw notFound('Ticket');
  if (!isAdminRole(req.user) && ticket.userId !== req.user.id) throw forbidden();
  if (status === 'closed' && !isAdminRole(req.user)) throw forbidden('Only admins can close tickets');
  const data = { status };
  if (status === 'resolved') {
    data.resolution = resolution?.trim() || null;
    data.resolvedAt = new Date();
  }
  if (status === 'open') { data.resolution = null; data.resolvedAt = null; }
  const updated = await req.prisma.ticket.update({
    where: { id }, data,
    include: { user: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
  });
  if (status === 'resolved' && ticket.userId !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [ticket.userId], type: 'ticket',
      title: `Ticket Resolved: #${id}`,
      message: `Your ticket "${ticket.subject}" has been resolved`,
      link: `/tickets/${id}`,
    });
  }
  res.json(updated);
}));

router.put('/:id/assign', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { assignedTo, priority } = req.body;
  if (!assignedTo) throw badRequest('assignedTo (user ID) is required');

  const ticket = await req.prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw notFound('Ticket');

  const assignee = await req.prisma.user.findUnique({ where: { id: assignedTo } });
  if (!assignee) throw notFound('Assignee user');

  const data = { assignedTo };
  if (ticket.status === 'open') data.status = 'in_progress';
  if (priority) {
    requireEnum(priority, VALID_PRIORITIES, 'priority');
    data.priority = priority;
  }

  const updated = await req.prisma.ticket.update({
    where: { id }, data,
    include: { user: { select: { id: true, name: true, email: true } }, assignee: { select: { id: true, name: true, email: true } } },
  });

  // Notify the assignee
  if (assignedTo !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [assignedTo], type: 'ticket',
      title: `Ticket Assigned to You: #${id}`,
      message: `"${ticket.subject}" has been assigned to you`,
      link: `/tickets/${id}`,
    });
  }

  res.json(updated);
}));

// ─── 6. PUT /:id/resolve ─── Resolve ticket (admin or ticket owner)
router.put('/:id/resolve', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { resolution } = req.body;
  if (!resolution || !resolution.trim()) throw badRequest('Resolution text is required');

  const ticket = await req.prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw notFound('Ticket');
  if (!isAdminRole(req.user) && ticket.userId !== req.user.id) throw forbidden('Only the ticket owner or admin can resolve this ticket');
  if (ticket.status === 'closed') throw badRequest('Cannot resolve a closed ticket. Reopen it first.');

  const updated = await req.prisma.ticket.update({
    where: { id },
    data: { status: 'resolved', resolution: resolution.trim(), resolvedAt: new Date() },
    include: { user: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
  });

  // Notify ticket owner if resolved by someone else
  if (ticket.userId !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [ticket.userId], type: 'ticket',
      title: `Ticket Resolved: #${id}`,
      message: `Your ticket "${ticket.subject}" has been resolved`,
      link: `/tickets/${id}`,
    });
  }

  res.json(updated);
}));

// ─── 7. PUT /:id/close ─── Close ticket (admin only)
router.put('/:id/close', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const ticket = await req.prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw notFound('Ticket');
  if (ticket.status === 'closed') throw badRequest('Ticket is already closed');

  const updated = await req.prisma.ticket.update({ where: { id }, data: { status: 'closed' } });
  res.json(updated);
}));

// ─── 8. PUT /:id/reopen ─── Reopen ticket (owner or admin)
router.put('/:id/reopen', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const ticket = await req.prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw notFound('Ticket');
  if (!isAdminRole(req.user) && ticket.userId !== req.user.id) throw forbidden('Only the ticket owner or admin can reopen this ticket');
  if (ticket.status === 'open') throw badRequest('Ticket is already open');

  const updated = await req.prisma.ticket.update({
    where: { id }, data: { status: 'open', resolution: null, resolvedAt: null },
  });
  res.json(updated);
}));

// ─── 9. GET /admin/all ─── All tickets with filters (admin only)
router.get('/admin/all', requireAdmin, asyncHandler(async (req, res) => {
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

  tickets.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  res.json(tickets.map(t => ({ ...enrichTicket(t), commentCount: t._count.comments, _count: undefined })));
}));

// ─── 10. GET /admin/stats ─── Ticket statistics with SLA tracking (admin only)
router.get('/admin/stats', requireAdmin, asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [openCount, inProgressCount, resolvedThisMonth, totalClosed] = await Promise.all([
    req.prisma.ticket.count({ where: { status: 'open' } }),
    req.prisma.ticket.count({ where: { status: 'in_progress' } }),
    req.prisma.ticket.count({ where: { status: { in: ['resolved', 'closed'] }, resolvedAt: { gte: monthStart, lte: monthEnd } } }),
    req.prisma.ticket.count({ where: { status: 'closed' } }),
  ]);

  const allTickets = await req.prisma.ticket.findMany({
    select: { id: true, category: true, priority: true, status: true, createdAt: true, resolvedAt: true, assignedTo: true },
  });

  const byCategory = {};
  const byPriority = {};
  for (const t of allTickets) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  }

  const resolvedTickets = allTickets.filter(t => t.resolvedAt);
  const thisMonthResolved = resolvedTickets.filter(t => {
    const d = new Date(t.resolvedAt);
    return d >= monthStart && d <= monthEnd;
  });

  let avgResolutionHours = 0;
  if (resolvedTickets.length > 0) {
    const totalMs = resolvedTickets.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
    avgResolutionHours = Math.round((totalMs / resolvedTickets.length) / (1000 * 60 * 60) * 10) / 10;
  }

  let avgResolutionHoursThisMonth = 0;
  if (thisMonthResolved.length > 0) {
    const totalMs = thisMonthResolved.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
    avgResolutionHoursThisMonth = Math.round((totalMs / thisMonthResolved.length) / (1000 * 60 * 60) * 10) / 10;
  }

  let slaCompliant = 0;
  let slaBreached = 0;
  for (const t of resolvedTickets) {
    const hours = (new Date(t.resolvedAt) - new Date(t.createdAt)) / (1000 * 60 * 60);
    if (hours <= (SLA_TARGETS[t.priority] || 72)) slaCompliant++;
    else slaBreached++;
  }

  const openBreaching = allTickets.filter(t => {
    if (t.status === 'closed' || t.resolvedAt) return false;
    return (now - new Date(t.createdAt)) / (1000 * 60 * 60) > (SLA_TARGETS[t.priority] || 72);
  }).length;

  const resolutionByPriority = {};
  for (const p of VALID_PRIORITIES) {
    const pTickets = resolvedTickets.filter(t => t.priority === p);
    if (pTickets.length > 0) {
      const totalMs = pTickets.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
      resolutionByPriority[p] = { count: pTickets.length, avgHours: Math.round((totalMs / pTickets.length) / (1000 * 60 * 60) * 10) / 10, slaTarget: SLA_TARGETS[p] };
    } else {
      resolutionByPriority[p] = { count: 0, avgHours: 0, slaTarget: SLA_TARGETS[p] };
    }
  }

  const resolutionByCategory = {};
  for (const c of VALID_CATEGORIES) {
    const cTickets = resolvedTickets.filter(t => t.category === c);
    if (cTickets.length > 0) {
      const totalMs = cTickets.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
      resolutionByCategory[c] = { count: cTickets.length, avgHours: Math.round((totalMs / cTickets.length) / (1000 * 60 * 60) * 10) / 10 };
    }
  }

  const assigneeMap = {};
  for (const t of resolvedTickets) {
    if (!t.assignedTo) continue;
    if (!assigneeMap[t.assignedTo]) assigneeMap[t.assignedTo] = { resolved: 0, totalMs: 0, breached: 0 };
    const ms = new Date(t.resolvedAt) - new Date(t.createdAt);
    assigneeMap[t.assignedTo].resolved++;
    assigneeMap[t.assignedTo].totalMs += ms;
    if (ms / (1000 * 60 * 60) > (SLA_TARGETS[t.priority] || 72)) assigneeMap[t.assignedTo].breached++;
  }

  const assigneeIds = Object.keys(assigneeMap).map(Number);
  const assignees = assigneeIds.length > 0
    ? await req.prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const nameMap = Object.fromEntries(assignees.map(u => [u.id, u.name]));

  const resolutionByAssignee = assigneeIds.map(id => ({
    id, name: nameMap[id] || 'Unknown', resolved: assigneeMap[id].resolved,
    avgHours: Math.round((assigneeMap[id].totalMs / assigneeMap[id].resolved) / (1000 * 60 * 60) * 10) / 10,
    slaBreached: assigneeMap[id].breached,
  })).sort((a, b) => b.resolved - a.resolved);

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
    open: openCount, inProgress: inProgressCount, resolvedThisMonth, totalClosed,
    avgResolutionHours, avgResolutionHoursThisMonth,
    sla: {
      compliant: slaCompliant, breached: slaBreached,
      complianceRate: resolvedTickets.length > 0 ? Math.round((slaCompliant / resolvedTickets.length) * 100) : 100,
      openBreaching, targets: SLA_TARGETS,
    },
    byCategory, byPriority, resolutionByPriority, resolutionByCategory, resolutionByAssignee, monthlyTrend,
  });
}));

module.exports = router;
