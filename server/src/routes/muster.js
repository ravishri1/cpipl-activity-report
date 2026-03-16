const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');
const { getAttendanceMuster, updateMusterCell } = require('../services/attendance/musterService');

const router = express.Router();
router.use(authenticate);
router.use(requireAdmin);

// GET /api/muster?month=YYYY-MM&department=X — Get muster grid
router.get('/', asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be in YYYY-MM format');
  const department = req.query.department || null;
  const data = await getAttendanceMuster(month, department, req.prisma);
  res.json(data);
}));

// PUT /api/muster/:userId/:date — Admin update cell
router.put('/:userId/:date', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Date must be in YYYY-MM-DD format');

  const { session1, session2, remark } = req.body;
  if (!session1 || !session2) throw badRequest('session1 and session2 are required');

  const validStatuses = ['P', 'A', 'L', 'LOP', 'OD', 'COF', 'HD'];
  if (!validStatuses.includes(session1) || !validStatuses.includes(session2)) {
    throw badRequest(`session1 and session2 must be one of: ${validStatuses.join(', ')}`);
  }

  const record = await updateMusterCell(userId, date, session1, session2, remark, req.user.id, req.prisma);
  res.json(record);
}));

module.exports = router;
