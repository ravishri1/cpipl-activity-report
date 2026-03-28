// server/src/routes/companyMaster.js
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ─── Abbr Auto-generation ──────────────────────────────────────────────────
async function computeAbbr(prisma, gstin, officeCity, legalEntityId, siteCode) {
  const stateCode = gstin.slice(0, 2);
  const entity = await prisma.legalEntity.findUnique({ where: { id: legalEntityId } });
  if (!entity) throw badRequest('Legal entity not found');
  const entityCode = await prisma.entityCode.findFirst({ where: { legalName: entity.legalName } });
  if (!entityCode) throw badRequest(`No entity code found for "${entity.legalName}". Add one first.`);
  const cityCode = await prisma.cityCode.findFirst({ where: { cityName: officeCity } });
  if (!cityCode) throw badRequest(`No city code found for "${officeCity}". Add one first.`);
  const code = (siteCode || '').trim().toUpperCase() || `R${parseInt(gstin[12])}`;
  return `${entityCode.code}-${cityCode.code}/${stateCode}-${code}`;
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
      principalRegistration: { select: { id: true, abbr: true, officeCity: true, gstin: true } },
      additionalRegistrations: {
        select: {
          id: true, abbr: true, officeCity: true, gstin: true, placeType: true,
          state: true, district: true, address: true, isActive: true, stateCode: true,
          fssai: true, udyam: true, iec: true, legalEntityId: true, principalRegistrationId: true,
        },
        orderBy: { abbr: 'asc' },
      },
      _count: { select: { users: true, assets: true, certificates: true } },
      locations: { orderBy: [{ locationType: 'asc' }, { city: 'asc' }] },
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
      locations: { orderBy: [{ locationType: 'asc' }, { city: 'asc' }] },
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
          placeType, principalRegistrationId, fssai, udyam, iec, primaryBusiness, siteCode } = req.body;
  if (gstin.length !== 15) throw badRequest('GSTIN must be exactly 15 characters');
  const stateCode = gstin.slice(0, 2);
  const regNo = parseInt(gstin[12]);
  const abbr = await computeAbbr(req.prisma, gstin, officeCity, parseInt(legalEntityId), siteCode);
  const reg = await req.prisma.companyRegistration.create({
    data: { legalEntityId: parseInt(legalEntityId), gstin, stateCode, regNo, abbr,
            siteCode: siteCode?.trim().toUpperCase() || null,
            officeCity, state, district, address, placeType: placeType || 'Principal',
            principalRegistrationId: principalRegistrationId ? parseInt(principalRegistrationId) : null,
            fssai, udyam, iec, primaryBusiness: primaryBusiness || null },
    include: { legalEntity: { select: { legalName: true } }, principalRegistration: { select: { id: true, abbr: true, officeCity: true } } },
  });
  res.status(201).json(reg);
}));

// PUT /api/company-master/registrations/:id
router.put('/registrations/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { officeCity, state, district, address, placeType, principalRegistrationId, fssai, udyam, iec, primaryBusiness, siteCode, isActive } = req.body;

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

  // Re-compute abbr if officeCity or siteCode changed
  const existing = await req.prisma.companyRegistration.findUnique({ where: { id } });
  if (!existing) throw notFound('Company registration');
  let abbr = existing.abbr;
  const newCity = officeCity ?? existing.officeCity;
  const newSiteCode = siteCode !== undefined ? siteCode : existing.siteCode;
  const cityChanged = officeCity !== undefined && officeCity !== existing.officeCity;
  const siteChanged = siteCode !== undefined &&
    (siteCode || '').trim().toUpperCase() !== (existing.siteCode || '').trim().toUpperCase();
  if (cityChanged || siteChanged) {
    try {
      abbr = await computeAbbr(req.prisma, existing.gstin, newCity, existing.legalEntityId, newSiteCode);
    } catch (e) {
      // If entity/city code lookup fails, keep existing abbr but still save siteCode
      console.warn(`[companyMaster] abbr recompute skipped for id=${id}: ${e.message}`);
    }
  }

  const reg = await req.prisma.companyRegistration.update({
    where: { id },
    data: { officeCity: officeCity ?? existing.officeCity, state: state ?? existing.state,
            district: district ?? existing.district, address: address ?? existing.address,
            placeType: placeType ?? existing.placeType, abbr,
            siteCode: siteCode !== undefined ? (siteCode?.trim().toUpperCase() || null) : existing.siteCode,
            principalRegistrationId: principalRegistrationId !== undefined ? (principalRegistrationId ? parseInt(principalRegistrationId) : null) : existing.principalRegistrationId,
            fssai: fssai ?? existing.fssai, udyam: udyam ?? existing.udyam,
            iec: iec ?? existing.iec,
            primaryBusiness: primaryBusiness !== undefined ? (primaryBusiness || null) : existing.primaryBusiness,
            isActive: true },
    include: { legalEntity: { select: { legalName: true } }, principalRegistration: { select: { id: true, abbr: true, officeCity: true } } },
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

router.delete('/city-codes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.cityCode.delete({ where: { id } });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════
// GST LOCATIONS (physical addresses under a GSTIN)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/company-master/registrations/:regId/locations
router.get('/registrations/:regId/locations', asyncHandler(async (req, res) => {
  const companyRegistrationId = parseId(req.params.regId);
  const locations = await req.prisma.gstLocation.findMany({
    where: { companyRegistrationId },
    orderBy: [{ locationType: 'asc' }, { city: 'asc' }],
  });
  res.json(locations);
}));

// POST /api/company-master/registrations/:regId/locations
router.post('/registrations/:regId/locations', requireAdmin, asyncHandler(async (req, res) => {
  const companyRegistrationId = parseId(req.params.regId);
  requireFields(req.body, 'city', 'locationType');
  const { locationType, locationName, address, city, state, district, pincode } = req.body;
  const loc = await req.prisma.gstLocation.create({
    data: { companyRegistrationId, locationType, locationName: locationName || null,
            address: address || null, city, state: state || null,
            district: district || null, pincode: pincode || null },
  });
  res.status(201).json(loc);
}));

// PUT /api/company-master/locations/:id
router.put('/locations/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { locationType, locationName, address, city, state, district, pincode, isActive } = req.body;
  const loc = await req.prisma.gstLocation.update({
    where: { id },
    data: {
      locationType: locationType ?? undefined,
      locationName: locationName !== undefined ? (locationName || null) : undefined,
      address: address !== undefined ? (address || null) : undefined,
      city: city ?? undefined,
      state: state !== undefined ? (state || null) : undefined,
      district: district !== undefined ? (district || null) : undefined,
      pincode: pincode !== undefined ? (pincode || null) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    },
  });
  res.json(loc);
}));

// DELETE /api/company-master/locations/:id
router.delete('/locations/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.gstLocation.delete({ where: { id } });
  res.json({ success: true });
}));

// ─── BANK ACCOUNTS ──────────────────────────────────────────────────────────

// GET /api/company-master/bank-accounts?companyRegistrationId=X  (or ?legalEntityId=X for entity-level)
router.get('/bank-accounts', asyncHandler(async (req, res) => {
  const { legalEntityId, companyRegistrationId } = req.query;
  const where = { isActive: true };
  if (companyRegistrationId) where.companyRegistrationId = parseId(companyRegistrationId);
  else if (legalEntityId) where.legalEntityId = parseId(legalEntityId);

  const accounts = await req.prisma.companyBankAccount.findMany({
    where,
    include: {
      companyRegistration: { select: { id: true, abbr: true, gstin: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  res.json(accounts);
}));

// POST /api/company-master/bank-accounts
router.post('/bank-accounts', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'legalEntityId', 'bankName', 'accountNumber', 'ifscCode', 'accountHolderName');

  const legalEntityId = parseInt(req.body.legalEntityId);

  // Only one primary per entity
  if (req.body.isPrimary) {
    await req.prisma.companyBankAccount.updateMany({
      where: { legalEntityId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const account = await req.prisma.companyBankAccount.create({
    data: {
      legalEntityId,
      companyRegistrationId: null,
      accountHolderName: req.body.accountHolderName.trim(),
      bankName: req.body.bankName.trim(),
      accountNumber: req.body.accountNumber.trim(),
      ifscCode: req.body.ifscCode.trim().toUpperCase(),
      branchName: req.body.branchName?.trim() || null,
      accountType: req.body.accountType || 'current',
      isPrimary: Boolean(req.body.isPrimary),
      notes: req.body.notes?.trim() || null,
    },
    include: { companyRegistration: { select: { id: true, abbr: true, gstin: true } } },
  });
  res.status(201).json(account);
}));

// PUT /api/company-master/bank-accounts/:id
router.put('/bank-accounts/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  // If setting as primary, unset others for same entity
  if (req.body.isPrimary) {
    const existing = await req.prisma.companyBankAccount.findUnique({ where: { id }, select: { legalEntityId: true } });
    if (existing) {
      await req.prisma.companyBankAccount.updateMany({
        where: { legalEntityId: existing.legalEntityId, isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }
  }

  const account = await req.prisma.companyBankAccount.update({
    where: { id },
    data: {
      ...(req.body.accountHolderName !== undefined && { accountHolderName: req.body.accountHolderName.trim() }),
      ...(req.body.bankName !== undefined && { bankName: req.body.bankName.trim() }),
      ...(req.body.accountNumber !== undefined && { accountNumber: req.body.accountNumber.trim() }),
      ...(req.body.ifscCode !== undefined && { ifscCode: req.body.ifscCode.trim().toUpperCase() }),
      ...(req.body.branchName !== undefined && { branchName: req.body.branchName?.trim() || null }),
      ...(req.body.accountType !== undefined && { accountType: req.body.accountType }),
      ...(req.body.isPrimary !== undefined && { isPrimary: Boolean(req.body.isPrimary) }),
      ...(req.body.notes !== undefined && { notes: req.body.notes?.trim() || null }),
      ...(req.body.companyRegistrationId !== undefined && {
        companyRegistrationId: req.body.companyRegistrationId ? parseInt(req.body.companyRegistrationId) : null,
      }),
    },
    include: { companyRegistration: { select: { id: true, abbr: true, gstin: true } } },
  });
  res.json(account);
}));

// DELETE /api/company-master/bank-accounts/:id  (soft delete)
router.delete('/bank-accounts/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.companyBankAccount.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Bank account removed' });
}));

module.exports = router;
