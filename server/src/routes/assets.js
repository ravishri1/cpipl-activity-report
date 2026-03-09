const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead'; }

// Valid types and statuses
const VALID_TYPES = [
  'laptop', 'desktop', 'phone', 'tablet', 'simcard',
  'monitor', 'keyboard', 'mouse', 'headset', 'webcam',
  'printer', 'scanner', 'projector', 'camera',
  'router', 'switch', 'server',
  'charger', 'ac_remote', 'dongle', 'ups', 'cable', 'adapter',
  'id_card', 'access_card', 'furniture', 'other',
];
const VALID_STATUSES = ['available', 'assigned', 'maintenance', 'retired', 'lost'];
const VALID_CATEGORIES = ['personal', 'office', 'infrastructure'];
const VALID_CONDITIONS = ['new', 'good', 'fair', 'damaged', 'non_working'];

// â”€â”€â”€ 1. GET /my â”€â”€â”€ My assigned assets (any authenticated user)
router.get('/my', asyncHandler(async (req, res) => {
  const assets = await req.prisma.asset.findMany({
    where: { assignedTo: req.user.id, status: 'assigned' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(assets);
}));

// â”€â”€â”€ 2. GET /summary â”€â”€â”€ Asset summary with enhanced breakdown (admin)
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

// â”€â”€â”€ 3. GET /free â”€â”€â”€ List free/available assets (admin)
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

// â”€â”€â”€ 4. GET /warranty-expiring â”€â”€â”€ Assets with warranty expiring soon (admin)
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

// â”€â”€â”€ 4a. GET /in-repair â”€â”€â”€ Assets currently in maintenance with repair details (admin)
router.get('/in-repair', requireAdmin, asyncHandler(async (req, res) => {
  const assets = await req.prisma.asset.findMany({
    where: { status: 'maintenance' },
    include: {
      assignee: { select: { id: true, name: true, email: true, department: true } },
      repairHistory: {
        where: { status: { notIn: ['completed', 'cancelled'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          initiator: { select: { id: true, name: true } },
          completer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(assets);
}));

// â”€â”€â”€ 5. GET /exit-pending/:userId â”€â”€â”€ Assets pending return for exiting employee (admin)
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

// â”€â”€â”€ 6. GET /handover-history/:assetId â”€â”€â”€ Get handover history for an asset (admin)
router.get('/handover-history/:assetId', requireAdmin, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const handovers = await req.prisma.assetHandover.findMany({ where: { assetId }, orderBy: { createdAt: 'desc' } });
  res.json(handovers);
}));

// â”€â”€â”€ 7. GET / â”€â”€â”€ List all assets with enhanced filters (admin)
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
      { name: { contains: search } },
      { serialNumber: { contains: search } },
      { assetTag: { contains: search } },
    ];
  }

  const assets = await req.prisma.asset.findMany({
    where,
    include: { assignee: { select: { id: true, name: true, email: true, employeeId: true, department: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(assets);
}));

// â”€â”€â”€ 8. POST / â”€â”€â”€ Create asset with enhanced fields (admin)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'type');
  const { name, type, serialNumber, assetTag, category, purchaseDate, purchasePrice, value, warrantyExpiry, warrantyVendor, condition, notes, companyId, isMandatoryReturn, assignedTo, location } = req.body;

  requireEnum(type, VALID_TYPES, 'type');
  if (category) requireEnum(category, VALID_CATEGORIES, 'category');

  const data = {
    name, type,
    serialNumber: serialNumber || null, assetTag: assetTag || null,
    category: category || 'personal', purchaseDate: purchaseDate || null,
    purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
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

// â”€â”€â”€ 9. PUT /:id/assign â”€â”€â”€ Assign/transfer asset to employee (admin)
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

// â”€â”€â”€ 10. PUT /:id/return â”€â”€â”€ Return asset (with handover record) (admin)
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

// â”€â”€â”€ 11. PUT /:id/detach â”€â”€â”€ Detach asset (admin)
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

// â”€â”€â”€ 12. GET /employee/:userId â”€â”€â”€ Assets for specific employee (admin)
router.get('/employee/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const assets = await req.prisma.asset.findMany({
    where: { assignedTo: userId },
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(assets);
}));

// â”€â”€â”€ 13. PUT /:id â”€â”€â”€ Update asset fields (admin)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const asset = await req.prisma.asset.findUnique({ where: { id } });
  if (!asset) throw notFound('Asset');

  const { name, type, serialNumber, assetTag, category, purchaseDate, purchasePrice, value, warrantyExpiry, warrantyVendor, condition, notes, companyId, status, isMandatoryReturn, location } = req.body;

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
  if (purchasePrice !== undefined) data.purchasePrice = purchasePrice ? parseFloat(purchasePrice) : null;
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

// â”€â”€â”€ 14. DELETE /:id â”€â”€â”€ Retire/permanently remove asset (admin)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const asset = await req.prisma.asset.findUnique({ where: { id } });
  if (!asset) throw notFound('Asset');
  if (asset.status === 'assigned') throw badRequest('Cannot delete an assigned asset. Return it first.');

  const updated = await req.prisma.asset.update({ where: { id }, data: { status: 'retired' } });
  res.json({ message: 'Asset retired successfully.', asset: updated });
}));

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Asset Repair & Maintenance Endpoints
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€â”€ 15. POST /repairs/:assetId/initiate â”€â”€â”€ Mark asset for repair (admin)
router.post('/repairs/:assetId/initiate', requireAdmin, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const { repairType, expectedReturnDate, vendor, vendorLocation, issueDescription, vendorPhone, vendorEmail, estimatedCost, notes } = req.body;

  requireFields(req.body, 'repairType', 'expectedReturnDate', 'vendor', 'vendorLocation', 'issueDescription');
  requireEnum(repairType, ['maintenance', 'repair', 'inspection', 'calibration'], 'repairType');

  const asset = await req.prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound('Asset');
  if (!['available', 'assigned'].includes(asset.status)) throw badRequest('Only available or assigned assets can be sent for repair');

  const today = new Date().toISOString().slice(0, 10);
  if (expectedReturnDate <= today) throw badRequest('Expected return date must be in the future');

  const repair = await req.prisma.assetRepair.create({
    data: {
      assetId,
      repairType,
      sentOutDate: today,
      expectedReturnDate,
      vendor,
      vendorLocation,
      issueDescription,
      vendorPhone: vendorPhone || null,
      vendorEmail: vendorEmail || null,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
      notes: notes || null,
      initiatedBy: req.user.id,
      status: 'initiated',
    },
    include: { initiator: { select: { id: true, name: true, email: true } } },
  });

  // Update asset status to maintenance
  await req.prisma.asset.update({
    where: { id: assetId },
    data: { status: 'maintenance' },
  });

  res.status(201).json(repair);
}));


// â”€â”€â”€ 19. GET /repairs/overdue â”€â”€â”€ List overdue repairs (admin)
router.get('/repairs/overdue', requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const repairs = await req.prisma.assetRepair.findMany({
    where: {
      status: { not: 'completed' },
      expectedReturnDate: { lt: today },
    },
    include: {
      asset: { select: { id: true, name: true, serialNumber: true } },
      initiator: { select: { id: true, name: true } },
    },
    orderBy: { expectedReturnDate: 'asc' },
  });

  res.json(repairs.map(r => ({
    ...r,
    daysOverdue: Math.floor((new Date(today) - new Date(r.expectedReturnDate)) / (1000 * 60 * 60 * 24)),
  })));
}));

// â”€â”€â”€ 16. GET /repairs/:assetId â”€â”€â”€ Get active repair for an asset
router.get('/repairs/:assetId', asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const repair = await req.prisma.assetRepair.findFirst({
    where: { assetId, status: { not: 'completed' } },
    include: {
      initiator: { select: { id: true, name: true, email: true } },
      completer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!repair) throw notFound('Active repair');
  res.json(repair);
}));

// â”€â”€â”€ 17. GET /repairs â”€â”€â”€ List all repairs (admin, with filters)
router.get('/repairs', requireAdmin, asyncHandler(async (req, res) => {
  const { status, assetId, initiatedBy, overdue } = req.query;
  const where = {};
  if (status) where.status = status;
  if (assetId) where.assetId = parseInt(assetId);
  if (initiatedBy) where.initiatedBy = parseInt(initiatedBy);

  const repairs = await req.prisma.assetRepair.findMany({
    where,
    include: {
      asset: { select: { id: true, name: true, serialNumber: true } },
      initiator: { select: { id: true, name: true, email: true } },
      completer: { select: { id: true, name: true, email: true } },
      timeline: { orderBy: { changedAt: 'desc' } },
    },
    orderBy: [{ expectedReturnDate: 'asc' }, { createdAt: 'desc' }],
  });

  // Filter overdue if requested
  if (overdue === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    return res.json(repairs.filter(r => r.status !== 'completed' && r.expectedReturnDate < today));
  }

  res.json(repairs);
}));

// â”€â”€â”€ 18. PUT /repairs/:repairId/update-status â”€â”€â”€ Update repair status
router.put('/repairs/:repairId/update-status', requireAdmin, asyncHandler(async (req, res) => {
  const repairId = parseId(req.params.repairId);
  const { newStatus, notes } = req.body;

  requireFields(req.body, 'newStatus');
  requireEnum(newStatus, ['initiated', 'in_transit', 'in_progress', 'ready_for_pickup', 'completed', 'cancelled'], 'newStatus');

  const repair = await req.prisma.assetRepair.findUnique({ where: { id: repairId } });
  if (!repair) throw notFound('Repair');

  // Create timeline entry
  await req.prisma.repairTimeline.create({
    data: {
      repairId,
      oldStatus: repair.status,
      newStatus,
      changedBy: req.user.id,
      notes: notes || null,
    },
  });

  const updated = await req.prisma.assetRepair.update({
    where: { id: repairId },
    data: { status: newStatus },
    include: {
      asset: { select: { id: true, name: true } },
      initiator: { select: { id: true, name: true } },
    },
  });

  res.json(updated);
}));


// â”€â”€â”€ 20. POST /repairs/:repairId/complete â”€â”€â”€ Complete repair and return asset
router.post('/repairs/:repairId/complete', requireAdmin, asyncHandler(async (req, res) => {
  const repairId = parseId(req.params.repairId);
  const { actualReturnDate, actualCost, condition } = req.body;

  requireFields(req.body, 'actualReturnDate');

  const repair = await req.prisma.assetRepair.findUnique({ where: { id: repairId } });
  if (!repair) throw notFound('Repair');

  const today = new Date().toISOString().slice(0, 10);
  if (actualReturnDate > today) throw badRequest('Actual return date cannot be in the future');

  // Create timeline entry
  await req.prisma.repairTimeline.create({
    data: {
      repairId,
      oldStatus: repair.status,
      newStatus: 'completed',
      changedBy: req.user.id,
      notes: actualCost ? `Completed - Actual cost: â‚¹${actualCost}` : 'Completed',
    },
  });

  // Update repair
  const completed = await req.prisma.assetRepair.update({
    where: { id: repairId },
    data: {
      actualReturnDate,
      actualCost: actualCost ? parseFloat(actualCost) : null,
      completedBy: req.user.id,
      status: 'completed',
    },
  });

  // Create handover record
  const asset = await req.prisma.asset.findUnique({ where: { id: repair.assetId } });
  if (asset?.assignedTo) {
    await req.prisma.assetHandover.create({
      data: {
        assetId: repair.assetId,
        fromUserId: req.user.id,
        toUserId: asset.assignedTo,
        handoverType: 'repair_return',
      },
    });
  }

  // Update asset status back to available
  await req.prisma.asset.update({
    where: { id: repair.assetId },
    data: { status: 'available' },
  });

  res.json({ message: 'Repair completed and asset returned.', repair: completed });
}));

// â”€â”€â”€ 21. GET /repairs/:assetId/timeline â”€â”€â”€ Get repair history for an asset
router.get('/repairs/:assetId/timeline', asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const repairs = await req.prisma.assetRepair.findMany({
    where: { assetId },
    include: { timeline: { orderBy: { changedAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(repairs);
}));

// â”€â”€â”€ 22. PUT /repairs/:repairId/edit â”€â”€â”€ Update repair details (before completion)
router.put('/repairs/:repairId/edit', requireAdmin, asyncHandler(async (req, res) => {
  const repairId = parseId(req.params.repairId);
  const { vendor, vendorPhone, vendorEmail, vendorLocation, expectedReturnDate, notes, estimatedCost } = req.body;

  const repair = await req.prisma.assetRepair.findUnique({ where: { id: repairId } });
  if (!repair) throw notFound('Repair');
  if (repair.status === 'completed') throw badRequest('Cannot edit a completed repair');

  const data = {};
  if (vendor !== undefined) data.vendor = vendor;
  if (vendorPhone !== undefined) data.vendorPhone = vendorPhone || null;
  if (vendorEmail !== undefined) data.vendorEmail = vendorEmail || null;
  if (vendorLocation !== undefined) data.vendorLocation = vendorLocation;
  if (expectedReturnDate !== undefined) {
    const today = new Date().toISOString().slice(0, 10);
    if (expectedReturnDate <= today) throw badRequest('Expected return date must be in the future');
    data.expectedReturnDate = expectedReturnDate;
  }
  if (notes !== undefined) data.notes = notes || null;
  if (estimatedCost !== undefined) data.estimatedCost = estimatedCost ? parseFloat(estimatedCost) : null;

  const updated = await req.prisma.assetRepair.update({
    where: { id: repairId },
    data,
    include: { asset: { select: { id: true, name: true } } },
  });

  res.json(updated);
}));

module.exports = router;

