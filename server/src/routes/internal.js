const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const INTERNAL_KEY = 'cpdesk-eod-sync-2026';

// GET /internal/staff/active — CPDesk integration
router.get('/staff/active', asyncHandler(async (req, res) => {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const users = await req.prisma.user.findMany({
    where: {
      isActive: true,
      separation: null, // no separation record = still active
    },
    select: {
      email: true,
      name: true,
      employeeId: true,
      separation: { select: { lastWorkingDate: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    users: users.map(u => ({
      email_for_work: u.email,
      name: u.name,
      employee_code: u.employeeId,
      last_date_of_working: null,
    })),
  });
}));

module.exports = router;
