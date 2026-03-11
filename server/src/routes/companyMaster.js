// server/src/routes/companyMaster.js
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ─── Abbr Auto-generation ──────────────────────────────────────────────────
async function computeAbbr(prisma, gstin, officeCity, legalEntityId) {
  const stateCode = gstin.slice(0, 2);
  const regNo = parseInt(gstin[12]);
  const entity = await prisma.legalEntity.findUnique({ where: { id: legalEntityId } });
  if (!entity) throw badRequest('Legal entity not found');
  const entityCode = await prisma.entityCode.findFirst({ where: { legalName: entity.legalName } });
  if (!entityCode) throw badRequest(`No entity code found for "${entity.legalName}". Add one first.`);
  const cityCode = await prisma.cityCode.findFirst({ where: { cityName: officeCity } });
  if (!cityCode) throw badRequest(`No city code found for "${officeCity}". Add one first.`);
  return `${entityCode.code}-${cityCode.code}/${stateCode}-R${regNo}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGAL ENTITIES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/company-master/legal-entities
router.get('/legal-entities', asyncHandler(async (req, res) => {
  const entities = await req.prisma.legalEntity.findMany({
    include: {
      _count: { select: { registrations: true } },
      registrations: { select: { id: true, abbr: true, gstin: true, isActive: true, officeCity: true, state: true } },
    },
    orderBy: { legalName: 'asc' },
  });
  res.json(entities);
}));

// POST /api/company-master/legal-entities
router.post('/legal-entities', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'legalName');
  const { legalName, shortName, pan, tan, lei } = req.body;
  const entity = await req.prisma.legalEntity.create({
    data: { legalName, shortName: shortName?.trim() || null, pan, tan, lei },
  });
  res.status(201).json(entity);
}));

// PUT /api/company-master/legal-entities/:id
router.put('/legal-entities/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { legalName, shortName, pan, tan, lei } = req.body;
  const entity = await req.prisma.legalEntity.update({
    where: { id },
    data: { legalName, shortName: shortName !== undefined ? (shortName?.trim() || null) : undefined, pan, tan, lei },
  });
  res.json(entity);
}));

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY REGISTRATIONS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/company-master/registrations
router.get('/registrations', asyncHandler(async (req, res) => {
  const { legalEntityId, isActive } = req.query;
  const where = {};
  if (legalEntityId) where.legalEntityId = parseInt(legalEntityId);
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const regs = await req.prisma.companyRegistration.findMany({
    where,
    include: {
      legalEntity: { select: { id: true, legalName: true, pan: true } },
      _count: { select: { users: true, assets: true, certificates: true } },
    },
    orderBy: [{ legalEntityId: 'asc' }, { abbr: 'asc' }],
  });
  res.json(regs);
}));

// GET /api/company-master/registrations/:id
router.get('/registrations/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const reg = await req.prisma.companyRegistration.findUnique({
    where: { id },
    include: {
      legalEntity: true,
      certificates: { orderBy: { certificateType: 'asc' } },
      _count: { select: { users: true, assets: true } },
    },
  });
  if (!reg) throw notFound('Company registration');
  res.json(reg);
}));

// POST /api/company-master/registrations
router.post('/registrations', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'legalEntityId', 'gstin', 'officeCity', 'state');
  const { legalEntityId, gstin, officeCity, state, district, address,
          placeType, fssai, udyam, iec } = req.body;
  if (gstin.length !== 15) throw badRequest('GSTIN must be exactly 15 characters');
  const stateCode = gstin.slice(0, 2);
  const regNo = parseInt(gstin[12]);
  const abbr = await computeAbbr(req.prisma, gstin, officeCity, parseInt(legalEntityId));
  const reg = await req.prisma.companyRegistration.create({
    data: { legalEntityId: parseInt(legalEntityId), gstin, stateCode, regNo, abbr,
            officeCity, state, district, address, placeType: placeType || 'Principal',
            fssai, udyam, iec },
    include: { legalEntity: { select: { legalName: true } } },
  });
  res.status(201).json(reg);
}));

// PUT /api/company-master/registrations/:id
router.put('/registrations/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { officeCity, state, district, address, placeType, fssai, udyam, iec, isActive } = req.body;

  // Deactivation preview (isActive = false without ?confirm=true shows impact summary)
  if (isActive === false || isActive === 'false') {
    const confirm = req.query.confirm === 'true';
    const [empCount, assetCount, certCount] = await Promise.all([
      req.prisma.user.count({ where: { companyRegistrationId: id } }),
      req.prisma.asset.count({ where: { companyRegistrationId: id } }),
      req.prisma.complianceCertificate.count({ where: { companyRegistrationId: id } }),
    ]);
    if (!confirm) {
      return res.json({
        preview: true, employees: empCount, assets: assetCount, certificates: certCount,
        message: `Deactivating this registration will flag ${empCount} employee(s) and ${assetCount} asset(s). Pass ?confirm=true to proceed.`,
      });
    }
    // Confirmed — deactivate
    const reg = await req.prisma.companyRegistration.update({
      where: { id }, data: { isActive: false },
    });
    return res.json({ deactivated: true, flaggedEmployees: empCount, flaggedAssets: assetCount, registration: reg });
  }

  // Re-compute abbr if officeCity changed
  const existing = await req.prisma.companyRegistration.findUnique({ where: { id } });
  if (!existing) throw notFound('Company registration');
  let abbr = existing.abbr;
  if (officeCity && officeCity !== existing.officeCity) {
    abbr = await computeAbbr(req.prisma, existing.gstin, officeCity, existing.legalEntityId);
  }

  const reg = await req.prisma.companyRegistration.update({
    where: { id },
    data: { officeCity: officeCity ?? existing.officeCity, state: state ?? existing.state,
            district: district ?? existing.district, address: address ?? existing.address,
            placeType: placeType ?? existing.placeType, abbr,
            fssai: fssai ?? existing.fssai, udyam: udyam ?? existing.udyam,
            iec: iec ?? existing.iec, isActive: true },
    include: { legalEntity: { select: { legalName: true } } },
  });
  res.json(reg);
}));

// DELETE /api/company-master/registrations/:id  (soft-deactivate)
router.delete('/registrations/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.companyRegistration.update({ where: { id }, data: { isActive: false } });
  res.json({ success: true, message: 'Registration deactivated' });
}));

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY CODES (lookup)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/entity-codes', asyncHandler(async (req, res) => {
  const codes = await req.prisma.entityCode.findMany({ orderBy: { legalName: 'asc' } });
  res.json(codes);
}));

router.post('/entity-codes', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'legalName', 'code');
  const { legalName, code } = req.body;
  const ec = await req.prisma.entityCode.create({ data: { legalName, code: code.toUpperCase() } });
  res.status(201).json(ec);
}));

router.put('/entity-codes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { legalName, code } = req.body;
  const ec = await req.prisma.entityCode.update({
    where: { id },
    data: { legalName, code: code?.toUpperCase() },
  });
  res.json(ec);
}));

// ═══════════════════════════════════════════════════════════════════════════
// CITY CODES (lookup)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/city-codes', asyncHandler(async (req, res) => {
  const codes = await req.prisma.cityCode.findMany({ orderBy: { cityName: 'asc' } });
  res.json(codes);
}));

router.post('/city-codes', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'cityName', 'code');
  const { cityName, code } = req.body;
  const cc = await req.prisma.cityCode.create({ data: { cityName, code: code.toUpperCase() } });
  res.status(201).json(cc);
}));

router.put('/city-codes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { cityName, code } = req.body;
  const cc = await req.prisma.cityCode.update({
    where: { id },
    data: { cityName, code: code?.toUpperCase() },
  });
  res.json(cc);
}));

module.exports = router;
