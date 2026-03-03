const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ─── 1. GET / ─── List my notifications (newest first, last 50)
router.get('/', asyncHandler(async (req, res) => {
  const notifications = await req.prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
}));

// ─── 2. GET /unread-count ─── Quick count for badge
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await req.prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  res.json({ count });
}));

// ─── 3. PUT /:id/read ─── Mark single notification as read
router.put('/:id/read', asyncHandler(async (req, res) => {
  await req.prisma.notification.updateMany({
    where: { id: parseId(req.params.id), userId: req.user.id },
    data: { isRead: true },
  });
  res.json({ message: 'Marked as read' });
}));

// ─── 4. PUT /read-all ─── Mark all as read
router.put('/read-all', asyncHandler(async (req, res) => {
  await req.prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ message: 'All marked as read' });
}));

module.exports = router;
