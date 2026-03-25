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

// GET /internal/companies/active — CPDesk company master data (LegalEntity + Registrations)
router.get('/companies/active', asyncHandler(async (req, res) => {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const entities = await req.prisma.legalEntity.findMany({
    orderBy: { legalName: 'asc' },
    select: {
      id: true,
      legalName: true,
      shortName: true,
      pan: true,
      tan: true,
      lei: true,
      registrations: {
        where: { isActive: true },
        orderBy: { officeCity: 'asc' },
        select: {
          id: true,
          abbr: true,
          gstin: true,
          officeCity: true,
          state: true,
          district: true,
          stateCode: true,
          placeType: true,
          address: true,
          fssai: true,
          udyam: true,
          iec: true,
        },
      },
    },
  });

  res.json({
    legal_entities: entities.map(e => ({
      id: e.id,
      legal_name: e.legalName,
      short_name: e.shortName,
      pan: e.pan,
      tan: e.tan,
      lei: e.lei,
      registrations: e.registrations.map(r => ({
        id: r.id,
        abbr: r.abbr,
        gstin: r.gstin,
        office_city: r.officeCity,
        state: r.state,
        district: r.district,
        state_code: r.stateCode,
        place_type: r.placeType,
        address: r.address,
        fssai: r.fssai,
        udyam: r.udyam,
        iec: r.iec,
      })),
    })),
  });
}));

module.exports = router;
