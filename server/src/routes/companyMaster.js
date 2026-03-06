const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, conflict } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ──────────────────────────────────────────────────────────
// Helper: compute abbreviation from GSTIN + officeCity + legalEntityId
// ──────────────────────────────────────────────────────────
async function computeAbbr(prisma, gstin, officeCity, legalEntityId) {
  const stateCode = gstin.slice(0, 2);
  const regNo     = parseInt(gstin[12]) || 1;

  const entity = await prisma.legalEntity.findUnique({ where: { id: legalEntityId } });
  if (!entity) throw badRequest('Legal entity not found');

  const entityCode = await prisma.entityCode.findFirst({ where: { legalName: entity.legalName } });
  if (!entityCode) throw badRequest(`No EntityCode found for legal name: ${entity.legalName}`);

  const cityCode = await prisma.cityCode.findFirst({ where: { cityName: officeCity } });
  if (!cityCode) throw badRequest(`No CityCode found for city: ${officeCity}. Add it via POST /api/company-master/city-codes first.`);

  return `${entityCode.code}-${cityCode.code}/${stateCode}-R${regNo}`;
}

// GET /api/company-master/abbr-preview
// Query: ?gstin=27AAJCC2415M1ZJ&legalEntityId=1&officeCity=Mumbai
// Returns a live abbreviation preview without saving anything
router.get('/abbr-preview', asyncHandler(async (req, res) => {
  const { gstin, legalEntityId, officeCity } = req.query;
  if (!gstin || !legalEntityId || !officeCity) {
    throw badRequest('gstin, legalEntityId and officeCity are required');
  }
  if (gstin.length !== 15) throw badRequest('GSTIN must be exactly 15 characters');
  const abbr = await computeAbbr(req.prisma, gstin, officeCity, parseInt(legalEntityId));
  res.json({ abbr });
}));

// ══════════════════════════════════════════════════════════
// LEGAL ENTITIES
// ══════════════════════════════════════════════════════════

// GET /api/company-master/legal-entities
router.get('/legal-entities', asyncHandler(async (req, res) => {
  const entities = await req.prisma.legalEntity.findMany({
    include: {
      registrations: {
        select: {
          id: true, abbr: true, gstin: true, state: true, officeCity: true,
          isActive: true, placeType: true,
        },
        orderBy: { abbr: 'asc' },
      },
    },
    orderBy: { legalName: 'asc' },
  });
  res.json(entities);
}));

// POST /api/company-master/legal-entities
router.post('/legal-entities', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'legalName');
  const { legalName, pan, tan, lei } = req.body;
  const entity = await req.prisma.legalEntity.create({ data: { legalName, pan, tan, lei } });
  res.status(201).json(entity);
}));

// PUT /api/company-master/legal-entities/:id
router.put('/legal-entities/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { legalName, pan, tan, lei } = req.body;
  const entity = await req.prisma.legalEntity.update({
    where: { id },
    data: { legalName, pan, tan, lei },
  });
  res.json(entity);
}));

// ══════════════════════════════════════════════════════════
// COMPANY REGISTRATIONS (GSTIN-LEVEL)
// ══════════════════════════════════════════════════════════

// GET /api/company-master/registrations
router.get('/registrations', asyncHandler(async (req, res) => {
  const registrations = await req.prisma.companyRegistration.findMany({
    include: {
      legalEntity: true,
      _count: { select: { users: true, assets: true, certificates: true } },
    },
    orderBy: [{ legalEntityId: 'asc' }, { abbr: 'asc' }],
  });
  res.json(registrations);
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
  if (!reg) throw notFound('Company Registration');
  res.json(reg);
}));

// POST /api/company-master/registrations
router.post('/registrations', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'legalEntityId', 'gstin', 'officeCity', 'state');
  const { legalEntityId, gstin, officeCity, state, district, placeType, address, fssai, udyam, iec } = req.body;
  const lid = parseId(String(legalEntityId));

  const stateCode = gstin.slice(0, 2);
  const regNo     = parseInt(gstin[12]) || 1;
  const abbr      = await computeAbbr(req.prisma, gstin, officeCity, lid);

  const reg = await req.prisma.companyRegistration.create({
    data: { legalEntityId: lid, abbr, gstin, officeCity, state, district, stateCode, regNo, placeType: placeType || 'Additional', address, fssai, udyam, iec },
    include: { legalEntity: true },
  });
  res.status(201).json(reg);
}));

// PUT /api/company-master/registrations/:id
// Supports deactivation cascade with ?confirm=true
router.put('/registrations/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await req.prisma.companyRegistration.findUnique({ where: { id } });
  if (!existing) throw notFound('Company Registration');

  const { isActive, gstin, officeCity, legalEntityId, state, district, placeType, address, fssai, udyam, iec } = req.body;
  const confirm = req.query.confirm === 'true';

  // ── Deactivation cascade preview ──
  if (isActive === false && existing.isActive === true) {
    const [empCount, assetCount, certCount] = await Promise.all([
      req.prisma.user.count({ where: { companyRegistrationId: id } }),
      req.prisma.asset.count({ where: { companyRegistrationId: id } }),
      req.prisma.complianceCertificate.count({ where: { companyRegistrationId: id } }),
    ]);

    if (!confirm) {
      return res.json({
        preview: true,
        message: 'Review the impact below. Send request again with ?confirm=true to proceed.',
        abbr: existing.abbr,
        impact: { employees: empCount, assets: assetCount, certificates: certCount },
      });
    }
    // Proceed with deactivation
    await req.prisma.companyRegistration.update({ where: { id }, data: { isActive: false } });
    return res.json({
      deactivated: true,
      abbr: existing.abbr,
      flaggedEmployees: empCount,
      flaggedAssets:    assetCount,
      message: `${existing.abbr} deactivated. ${empCount} employees and ${assetCount} assets are now flagged.`,
    });
  }

  // ── Normal update ──
  const updateData = {};
  if (state)      updateData.state      = state;
  if (district !== undefined) updateData.district = district;
  if (placeType)  updateData.placeType  = placeType;
  if (address !== undefined) updateData.address  = address;
  if (fssai !== undefined)   updateData.fssai    = fssai;
  if (udyam !== undefined)   updateData.udyam    = udyam;
  if (iec !== undefined)     updateData.iec      = iec;
  if (isActive !== undefined) updateData.isActive = isActive;

  // Recompute abbr if officeCity or GSTIN changed
  const newGstin      = gstin ?? existing.gstin;
  const newOfficeCity = officeCity ?? existing.officeCity;
  const newEntityId   = legalEntityId ? parseId(String(legalEntityId)) : existing.legalEntityId;

  if (officeCity || gstin || legalEntityId) {
    updateData.abbr      = await computeAbbr(req.prisma, newGstin, newOfficeCity, newEntityId);
    updateData.gstin     = newGstin;
    updateData.officeCity= newOfficeCity;
    updateData.stateCode = newGstin.slice(0, 2);
    updateData.regNo     = parseInt(newGstin[12]) || 1;
    updateData.legalEntityId = newEntityId;
  }

  const reg = await req.prisma.companyRegistration.update({
    where: { id },
    data: updateData,
    include: { legalEntity: true },
  });
  res.json(reg);
}));

// DELETE /api/company-master/registrations/:id  (soft deactivate)
router.delete('/registrations/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const reg = await req.prisma.companyRegistration.findUnique({ where: { id } });
  if (!reg) throw notFound('Company Registration');
  await req.prisma.companyRegistration.update({ where: { id }, data: { isActive: false } });
  res.json({ message: `${reg.abbr} deactivated.` });
}));

// ══════════════════════════════════════════════════════════
// ENTITY CODES (lookup table)
// ══════════════════════════════════════════════════════════

// GET /api/company-master/entity-codes
router.get('/entity-codes', asyncHandler(async (req, res) => {
  const codes = await req.prisma.entityCode.findMany({ orderBy: { code: 'asc' } });
  res.json(codes);
}));

// POST /api/company-master/entity-codes
router.post('/entity-codes', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'legalName', 'code');
  const ec = await req.prisma.entityCode.create({ data: { legalName: req.body.legalName, code: req.body.code.toUpperCase() } });
  res.status(201).json(ec);
}));

// PUT /api/company-master/entity-codes/:id
router.put('/entity-codes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const ec = await req.prisma.entityCode.update({
    where: { id },
    data: { legalName: req.body.legalName, code: req.body.code?.toUpperCase() },
  });
  res.json(ec);
}));

// ══════════════════════════════════════════════════════════
// CITY CODES (lookup table)
// ══════════════════════════════════════════════════════════

// GET /api/company-master/city-codes
router.get('/city-codes', asyncHandler(async (req, res) => {
  const codes = await req.prisma.cityCode.findMany({ orderBy: { code: 'asc' } });
  res.json(codes);
}));

// POST /api/company-master/city-codes
router.post('/city-codes', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'cityName', 'code');
  const cc = await req.prisma.cityCode.create({ data: { cityName: req.body.cityName, code: req.body.code.toUpperCase() } });
  res.status(201).json(cc);
}));

// PUT /api/company-master/city-codes/:id
router.put('/city-codes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const cc = await req.prisma.cityCode.update({
    where: { id },
    data: { cityName: req.body.cityName, code: req.body.code?.toUpperCase() },
  });
  res.json(cc);
}));

// ══════════════════════════════════════════════════════════
// SUMMARY (dashboard stats)
// ══════════════════════════════════════════════════════════

// GET /api/company-master/summary
router.get('/summary', asyncHandler(async (req, res) => {
  const [entityCount, regCount, activeCount, certCount] = await Promise.all([
    req.prisma.legalEntity.count(),
    req.prisma.companyRegistration.count(),
    req.prisma.companyRegistration.count({ where: { isActive: true } }),
    req.prisma.complianceCertificate.count(),
  ]);
  res.json({ legalEntities: entityCount, registrations: regCount, activeRegistrations: activeCount, certificates: certCount });
}));

module.exports = router;
