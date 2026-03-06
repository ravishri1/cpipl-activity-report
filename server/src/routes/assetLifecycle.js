const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate); // All routes require authentication

// ═══════════════════════════════════════════════════════════════════════════════════
// ASSET CONDITION & INSPECTION (2 endpoints)
// ═══════════════════════════════════════════════════════════════════════════════════

// 21. Log Condition Check
router.post('/assets/:assetId/condition', requireAdmin, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  requireFields(req.body, 'previousCondition', 'newCondition', 'checkDate');
  
  const asset = await req.prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound('Asset');
  
  requireEnum(req.body.newCondition, 
    ['new', 'good', 'fair', 'damaged', 'non_working', 'beyond_repair'], 
    'newCondition'
  );
  
  const conditionLog = await req.prisma.assetConditionLog.create({
    data: {
      assetId,
      previousCondition: req.body.previousCondition,
      newCondition: req.body.newCondition,
      checkDate: req.body.checkDate,
      notes: req.body.notes,
      photosUrl: req.body.photosUrl ? JSON.stringify(req.body.photosUrl) : null,
      requiresRepair: req.body.requiresRepair || false,
      checkedBy: req.user.id
    }
  });
  
  // Update asset condition
  await req.prisma.asset.update({
    where: { id: assetId },
    data: {
      condition: req.body.newCondition,
      status: req.body.requiresRepair ? 'maintenance' : asset.status
    }
  });
  
  res.status(201).json(conditionLog);
}));

// 22. Get Condition History
router.get('/assets/:assetId/condition-history', authenticate, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  
  const asset = await req.prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound('Asset');
  
  // Check access: user owns asset or is admin/sub_admin
  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && req.user.id !== asset.assignedTo) {
    throw forbidden('Access denied');
  }
  
  const conditionLogs = await req.prisma.assetConditionLog.findMany({
    where: { assetId },
    include: {
      checker: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  res.json({
    asset: { id: asset.id, name: asset.name, currentCondition: asset.condition },
    conditionLogs: conditionLogs.map(log => ({
      ...log,
      photosUrl: log.photosUrl ? JSON.parse(log.photosUrl) : []
    }))
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════════
// ASSET DISPOSAL / SCRAPPING (3 endpoints)
// ═══════════════════════════════════════════════════════════════════════════════════

// 23. Request Asset Disposal
router.post('/assets/:assetId/disposal', requireAdmin, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  requireFields(req.body, 'disposalType');
  
  const asset = await req.prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound('Asset');
  
  const disposal = await req.prisma.assetDisposal.create({
    data: {
      assetId,
      disposalType: req.body.disposalType,
      disposalReason: req.body.disposalReason,
      disposalDate: req.body.disposalDate || new Date().toISOString().split('T')[0],
      notes: req.body.notes,
      createdBy: req.user.id,
      approvalStatus: 'pending'
    }
  });
  
  res.status(201).json(disposal);
}));

// 24. Approve Disposal
router.put('/disposals/:disposalId/approve', requireAdmin, asyncHandler(async (req, res) => {
  const disposalId = parseId(req.params.disposalId);
  
  const disposal = await req.prisma.assetDisposal.findUnique({ where: { id: disposalId } });
  if (!disposal) throw notFound('Disposal');
  if (disposal.approvalStatus !== 'pending') throw badRequest('Only pending disposals can be approved');
  
  const updated = await req.prisma.assetDisposal.update({
    where: { id: disposalId },
    data: {
      approvalStatus: 'approved',
      approvedBy: req.user.id,
      approvalDate: new Date(),
      recoveryValue: req.body.recoveryValue,
      recoveryVendor: req.body.recoveryVendor,
      notes: req.body.approvalNotes
    }
  });
  
  // Update asset status
  await req.prisma.asset.update({
    where: { id: disposal.assetId },
    data: { status: 'retired' }
  });
  
  res.json(updated);
}));

// 25. List Pending Disposals
router.get('/disposals', requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const where = {};
  if (req.query.status) where.approvalStatus = req.query.status;
  if (req.query.disposalType) where.disposalType = req.query.disposalType;
  
  const [disposals, total] = await Promise.all([
    req.prisma.assetDisposal.findMany({
      where,
      skip,
      take: limit,
      include: {
        asset: { select: { id: true, name: true, type: true } },
        creator: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    req.prisma.assetDisposal.count({ where })
  ]);
  
  res.json({
    disposals,
    total,
    page,
    hasMore: skip + disposals.length < total
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════════
// ASSET DETACHMENT REQUESTS (4 endpoints)
// ═══════════════════════════════════════════════════════════════════════════════════

// 26. Employee Request Asset Detachment
router.post('/assets/:assetId/request-detachment', authenticate, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  requireFields(req.body, 'reason');
  
  const asset = await req.prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound('Asset');
  
  // Check if user is assigned the asset
  if (asset.assignedTo !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
    throw forbidden('Can only request detachment for your assigned assets');
  }
  
  const request = await req.prisma.assetDetachmentRequest.create({
    data: {
      assetId,
      userId: req.user.id,
      reason: req.body.reason,
      description: req.body.description,
      requestDate: req.body.requestDate || new Date().toISOString().split('T')[0],
      requestStatus: 'pending'
    }
  });
  
  res.status(201).json(request);
}));

// 27. HR Approve Detachment Request
router.put('/detachment-requests/:requestId/approve', requireAdmin, asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.requestId);
  requireFields(req.body, 'postApprovalAction');
  
  const request = await req.prisma.assetDetachmentRequest.findUnique({ 
    where: { id: requestId } 
  });
  if (!request) throw notFound('Detachment Request');
  if (request.requestStatus !== 'pending') throw badRequest('Only pending requests can be approved');
  
  requireEnum(
    req.body.postApprovalAction,
    ['repair', 'scrap', 'return', 'custody'],
    'postApprovalAction'
  );
  
  const updated = await req.prisma.assetDetachmentRequest.update({
    where: { id: requestId },
    data: {
      requestStatus: 'approved',
      postApprovalAction: req.body.postApprovalAction,
      approvedBy: req.user.id,
      approvalDate: new Date(),
      approvalNotes: req.body.approvalNotes,
      actionCompletedDate: new Date().toISOString().split('T')[0]
    }
  });
  
  res.json(updated);
}));

// 28. HR Reject Detachment Request
router.put('/detachment-requests/:requestId/reject', requireAdmin, asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.requestId);
  
  const request = await req.prisma.assetDetachmentRequest.findUnique({ 
    where: { id: requestId } 
  });
  if (!request) throw notFound('Detachment Request');
  if (request.requestStatus !== 'pending') throw badRequest('Only pending requests can be rejected');
  
  const updated = await req.prisma.assetDetachmentRequest.update({
    where: { id: requestId },
    data: {
      requestStatus: 'rejected',
      approvedBy: req.user.id,
      approvalDate: new Date(),
      approvalNotes: req.body.approvalNotes
    }
  });
  
  res.json(updated);
}));

// 29. List Detachment Requests
router.get('/detachment-requests', requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const where = {};
  if (req.query.status) where.requestStatus = req.query.status;
  if (req.query.action) where.postApprovalAction = req.query.action;
  
  const [requests, total] = await Promise.all([
    req.prisma.assetDetachmentRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        asset: { select: { id: true, name: true, type: true } },
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true } }
      },
      orderBy: { requestDate: 'desc' }
    }),
    req.prisma.assetDetachmentRequest.count({ where })
  ]);
  
  res.json({
    requests,
    total,
    page,
    hasMore: skip + requests.length < total
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════════
// DASHBOARD & REPORTS (1 endpoint)
// ═══════════════════════════════════════════════════════════════════════════════════

// 30. Asset Lifecycle Dashboard
router.get('/dashboard', requireAdmin, asyncHandler(async (req, res) => {
  const companyId = req.query.companyId ? parseInt(req.query.companyId) : null;
  
  const where = companyId ? { companyId } : {};
  
  // Get all metrics in parallel
  const [totalAssets, assetsByStatus, assetsByType, pendingDetachments, pendingDisposals, pendingMaintenances] = await Promise.all([
    req.prisma.asset.count({ where }),
    req.prisma.asset.groupBy({
      by: ['status'],
      where,
      _count: { id: true }
    }),
    req.prisma.asset.groupBy({
      by: ['type'],
      where,
      _count: { id: true }
    }),
    req.prisma.assetDetachmentRequest.count({ 
      where: { requestStatus: 'pending', asset: where } 
    }),
    req.prisma.assetDisposal.count({ 
      where: { approvalStatus: 'pending', asset: where } 
    }),
    req.prisma.asset.count({ 
      where: { ...where, status: 'maintenance' } 
    })
  ]);
  
  // Format status counts
  const statusCounts = {
    available: 0,
    assigned: 0,
    maintenance: 0,
    retired: 0
  };
  
  assetsByStatus.forEach(item => {
    statusCounts[item.status] = item._count.id;
  });
  
  // Format type counts
  const typeCounts = {};
  assetsByType.forEach(item => {
    typeCounts[item.type] = item._count.id;
  });
  
  res.json({
    summary: {
      totalAssets,
      assetsStatus: statusCounts,
      assetsByType: typeCounts
    },
    pendingActions: {
      detachmentRequests: pendingDetachments,
      disposalApprovals: pendingDisposals,
      overdueMaintenance: pendingMaintenances
    },
    metrics: {
      utilizationRate: totalAssets > 0 ? ((statusCounts.assigned / totalAssets) * 100).toFixed(2) : 0,
      maintenanceRate: totalAssets > 0 ? ((statusCounts.maintenance / totalAssets) * 100).toFixed(2) : 0
    }
  });
}));

module.exports = router;
