const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const INTERNAL_KEY = 'cpdesk-eod-sync-2026';

// "2026-03-31" → "31/03/2026"
function toIndianDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// GET /internal/staff/active — CPDesk integration
router.get('/staff/active', asyncHandler(async (req, res) => {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const users = await req.prisma.user.findMany({
    where: { isActive: true },
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
      last_date_of_working: toIndianDate(u.separation?.lastWorkingDate),
    })),
  });
}));

module.exports = router;
