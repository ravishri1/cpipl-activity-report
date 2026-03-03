const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'team_lead'; }

// Valid types and statuses
const VALID_TYPES = [
  'laptop', 'phone', 'simcard', 'mouse', 'charger', 'monitor', 'keyboard',
  'headset', 'id_card', 'access_card', 'scanner', 'ac_remote', 'printer',
  'webcam', 'dongle', 'ups', 'cable', 'adapter', 'other',
];
const VALID_STATUSES = ['available', 'assigned', 'maintenance', 'retired', 'lost'];
const VALID_CATEGORIES = ['personal', 'office', 'infrastructure'];
const VALID_CONDITIONS = ['new', 'good', 'fair', 'damaged', 'non_working'];

// ─── 1. GET /my ─── My assigned assets (any authenticated user)
router.get('/my', asyncHandler(async (req, res) => {
  const assets = await req.prisma.asset.findMany({
    where: { assignedTo: req.user.id, status: 'assigned' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(assets);
}));

// ─── 2. GET /summary ─── Asset summary with enhanced breakdown (admin)
router.get('/summary', requireAdmin, asyncHandler(async (req, res) => {
  const assets = await req.prisma.asset.findMany({
    include: { assignee: { select: { id: true, name: true } } },
  });

  const totalCount = assets.length;
  let totalValue = 0;
  const byType = {};
  const byStatus = {};
  const byCategory = {};
  const byCondition = {};
  let warrantyExpiring = 0;
  let freeAssets = 0;

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const asset of assets) {
    byType[asset.type] = (byType[asset.type] || 0) + 1;
    byStatus[asset.status] = (byStatus[asset.status] || 0) + 1;
    byCategory[asset.category] = (byCategory[asset.category] || 0) + 1;
    byCondition[asset.condition] = (byCondition[asset.condition] || 0) + 1;
    if (asset.value) totalValue += asset.value;
    if (asset.status === 'available') freeAssets++;
    if (asset.warrantyExpiry && asset.warrantyExpiry >= today && asset.warrantyExpiry <= thirtyDaysLater) warrantyExpiring++;
  }

  res.json({ totalCount, totalValue: Math.round(totalValue * 100) / 100, freeAssets, warrantyExpiring, byType, byStatus, byCategory, byCondition });
}));

// ─── 3. GET /free ─── List free/available assets (admin)
router.get('/free', requireAdmin, asyncHandler(async (req, res) => {
  const { category, type } = req.query;
  const where = { status: 'available' };
  if (category) where.category = category;
  if (type) where.type = type;

  const assets = await req.prisma.asset.findMany({
    where,
    include: { assignee: { select: { id: true, name: true, email: true } } },
    orderBy: [{ category: 'asc' }, { type: 'asc' }, { name: 'asc' }],
  });
  res.json(assets);
}));

// ─── 4. GET /warranty-expiring ─── Assets with warranty expiring soon (admin)
router.get('/warranty-expiring', requireAdmin, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const assets = await req.prisma.asset.findMany({
    where: { warrantyExpiry: { not: null, gte: today, lte: cutoff }, status: { notIn: ['retired', 'lost'] } },
    include: { assignee: { select: { id: true, name: true, email: true, department: true } } },
    orderBy: { warrantyExpiry: 'asc' },
  });
  res.json(assets);
}));

// ─── 5. GET /exit-pending/:userId ─── Assets pending return for exiting employee (admin)
router.get('/exit-pending/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const assets = await req.prisma.asset.findMany({
    where: { assignedTo: userId, status: 'assigned', isMandatoryReturn: true },
    orderBy: { type: 'asc' },
  });

  const separation = await req.prisma.separation.findUnique({ where: { userId } });
  res.json({
    assets, totalPending: assets.length, allReturned: assets.length === 0,
    separation: separation ? { status: separation.status, allAssetsReturned: separation.allAssetsReturned, fnfHoldReason: separation.fnfHoldReason, lastWorkingDate: separation.lastWorkingDate } : null,
  });
}));

// ─── 6. GET /handover-history/:assetId ─── Get handover history for an asset (admin)
router.get('/handover-history/:assetId', requireAdmin, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const handovers = await req.prisma.assetHandover.findMany({ where: { assetId }, orderBy: { createdAt: 'desc' } });
  res.json(handovers);
}));

// ─── 7. GET / ─── List all assets with enhanced filters (admin)
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status, type, assignedTo, category, condition, search } = req.query;
  const where = {};
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (type && VALID_TYPES.includes(type)) where.type = type;
  if (category && VALID_CATEGORIES.includes(category)) where.category = category;
  if (condition && VALID_CONDITIONS.includes(condition)) where.condition = condition;
  if (assignedTo) where.assignedTo = parseInt(assignedTo);
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { assetTag: { contains: search, mode: 'insensitive' } },
    ];
  }

  const assets = await req.prisma.asset.findMany({
    where,
    include: { assignee: { select: { id: true, name: true, email: true, employeeId: true, department: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(assets);
}));

// ─── 8. POST / ─── Create asset with enhanced fields (admin)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'type');
  const { name, type, serialNumber, assetTag, category, purchaseDate, value, warrantyExpiry, warrantyVendor, condition, notes, companyId, isMandatoryReturn, assignedTo, location } = req.body;

  requireEnum(type, VALID_TYPES, 'type');
  if (category) requireEnum(category, VALID_CATEGORIES, 'category');

  const data = {
    name, type,
    serialNumber: serialNumber || null, assetTag: assetTag || null,
    category: category || 'personal', purchaseDate: purchaseDate || null,
    value: value ? parseFloat(value) : null, warrantyExpiry: warrantyExpiry || null,
    warrantyVendor: warrantyVendor || null, condition: condition || 'good',
    notes: notes || null, companyId: companyId ? parseInt(companyId) : null,
    location: location || null, isMandatoryReturn: isMandatoryReturn !== undefined ? isMandatoryReturn : true,
    status: 'available',
  };

  if (assignedTo) {
    const user = await req.prisma.user.findUnique({ where: { id: parseInt(assignedTo) } });
    if (!user) throw notFound('Assignee user');
    data.assignedTo = parseInt(assignedTo);
    data.assignedDate = new Date().toISOString().slice(0, 10);
    data.status = 'assigned';
  }

  const asset = await req.prisma.asset.create({ data });
  res.status(201).json(asset);
}));

// ─── 9. PUT /:id/assign ─── Assign/transfer asset to employee (admin)
router.put('/:id/assign', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { userId, assignedDate, notes } = req.body;
  if (!userId) throw badRequest('userId is required');

  const asset = await req.prisma.asset.findUnique({ where: { id } });
  if (!asset) throw notFound('Asset');

  const user = await req.prisma.user.findUnique({ where: { id: parseInt(userId) } });
  if (!user) throw notFound('User');

  if (asset.assignedTo && asset.assignedTo !== parseInt(userId)) {
    await req.prisma.assetHandover.create({
      data: {
        assetId: id, fromUserId: asset.assignedTo, toUserId: parseInt(userId),
        handoverType: 'transfer', condition: asset.condition || 'good',
        notes: notes || `Transferred from user ${asset.assignedTo} to user ${userId}`,
        handoverDate: new Date().toISOString().slice(0, 10), receivedBy: req.user.id,
      },
    });
  }

  const updated = await req.prisma.asset.update({
    where: { id },
    data: { assignedTo: parseInt(userId), assignedDate: assignedDate || new Date().toISOString().slice(0, 10), returnDate: null, status: 'assigned' },
    include: { assignee: { select: { id: true, name: true, email: true, employeeId: true, department: true } } },
  });
  res.json(updated);
}));

// ─── 10. PUT /:id/return ─── Return asset (with handover record) (admin)
router.put('/:id/return', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { condition, notes, handoverType } = req.body;

  const asset = await req.prisma.asset.findUnique({ where: { id } });
  if (!asset) throw notFound('Asset');

  if (asset.assignedTo) {
    await req.prisma.assetHandover.create({
      data: {
        assetId: id, fromUserId: asset.assignedTo, toUserId: null,
        handoverType: handoverType || 'return', condition: condition || asset.condition || 'good',
        notes: notes || null, handoverDate: new Date().toISOString().slice(0, 10), receivedBy: req.user.id,
      },
    });
  }

  const updated = await req.prisma.asset.update({
    where: { id },
    data: { returnDate: new Date().toISOString().slice(0, 10), assignedTo: null, status: 'available', condition: condition || asset.condition },
  });

  if (handoverType === 'exit_return' && asset.assignedTo) {
    const remainingAssets = await req.prisma.asset.count({
      where: { assignedTo: asset.assignedTo, status: 'assigned', isMandatoryReturn: true },
    });
    if (remainingAssets === 0) {
      await req.prisma.separation.updateMany({
        where: { userId: asset.assignedTo, status: { notIn: ['completed', 'cancelled'] } },
        data: { allAssetsReturned: true, fnfHoldReason: null },
      });
    }
  }

  res.json(updated);
}));

// ─── 11. PUT /:id/detach ─── Detach asset (admin)
router.put('/:id/detach', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { notes } = req.body;

  const asset = await req.prisma.asset.findUnique({ where: { id } });
  if (!asset) throw notFound('Asset');

  if (asset.assignedTo) {
    await req.prisma.assetHandover.create({
      data: {
        assetId: id, fromUserId: asset.assignedTo, toUserId: null,
        handoverType: 'return', condition: asset.condition || 'good',
        notes: notes || 'Detached by admin', handoverDate: new Date().toISOString().slice(0, 10), receivedBy: req.user.id,
      },
    });
  }

  const updated = await req.prisma.asset.update({
    where: { id }, data: { assignedTo: null, assignedDate: null, returnDate: new Date().toISOString().slice(0, 10), status: 'available' },
  });
  res.json(updated);
}));

// ─── 12. GET /employee/:userId ─── Assets for specific employee (admin)
router.get('/employee/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const assets = await req.prisma.asset.findMany({
    where: { assignedTo: userId },
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(assets);
}));

// ─── 13. PUT /:id ─── Update asset fields (admin)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const asset = await req.prisma.asset.findUnique({ where: { id } });
  if (!asset) throw notFound('Asset');

  const { name, type, serialNumber, assetTag, category, purchaseDate, value, warrantyExpiry, warrantyVendor, condition, notes, companyId, status, isMandatoryReturn, location } = req.body;

  if (type) requireEnum(type, VALID_TYPES, 'type');
  if (status) requireEnum(status, VALID_STATUSES, 'status');
  if (category) requireEnum(category, VALID_CATEGORIES, 'category');
  if (condition) requireEnum(condition, VALID_CONDITIONS, 'condition');

  const data = {};
  if (name !== undefined) data.name = name;
  if (type !== undefined) data.type = type;
  if (serialNumber !== undefined) data.serialNumber = serialNumber || null;
  if (assetTag !== undefined) data.assetTag = assetTag || null;
  if (category !== undefined) data.category = category;
  if (purchaseDate !== undefined) data.purchaseDate = purchaseDate || null;
  if (value !== undefined) data.value = value ? parseFloat(value) : null;
  if (warrantyExpiry !== undefined) data.warrantyExpiry = warrantyExpiry || null;
  if (warrantyVendor !== undefined) data.warrantyVendor = warrantyVendor || null;
  if (condition !== undefined) data.condition = condition;
  if (notes !== undefined) data.notes = notes || null;
  if (companyId !== undefined) data.companyId = companyId ? parseInt(companyId) : null;
  if (location !== undefined) data.location = location || null;
  if (status !== undefined) data.status = status;
  if (isMandatoryReturn !== undefined) data.isMandatoryReturn = isMandatoryReturn;

  const updated = await req.prisma.asset.update({
    where: { id }, data,
    include: { assignee: { select: { id: true, name: true, email: true, employeeId: true, department: true } } },
  });
  res.json(updated);
}));

// ─── 14. DELETE /:id ─── Retire/permanently remove asset (admin)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const asset = await req.prisma.asset.findUnique({ where: { id } });
  if (!asset) throw notFound('Asset');
  if (asset.status === 'assigned') throw badRequest('Cannot delete an assigned asset. Return it first.');

  const updated = await req.prisma.asset.update({ where: { id }, data: { status: 'retired' } });
  res.json({ message: 'Asset retired successfully.', asset: updated });
}));

module.exports = router;
