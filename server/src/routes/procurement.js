const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate); // All routes require authentication

// ═══════════════════════════════════════════════
// PROCUREMENT ORDER ENDPOINTS
// ═══════════════════════════════════════════════

/**
 * POST /api/procurement/orders
 * Create new procurement order (Admin/Manager only)
 */
router.post('/orders', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'vendorId', 'status', 'totalAmount', 'createdDate');
  requireEnum(req.body.status, ['draft', 'submitted', 'pending_approval', 'approved', 'received', 'cancelled'], 'status');
  
  // Generate order number
  const latestOrder = await req.prisma.procurementOrder.findFirst({
    orderBy: { id: 'desc' },
    select: { orderNumber: true }
  });
  
  let nextNumber = 1;
  if (latestOrder && latestOrder.orderNumber) {
    const match = latestOrder.orderNumber.match(/PO-(\d+)/);
    if (match) nextNumber = parseInt(match[1]) + 1;
  }
  
  const orderNumber = `PO-${String(nextNumber).padStart(4, '0')}`;
  
  const order = await req.prisma.procurementOrder.create({
    data: {
      orderNumber,
      vendorId: parseId(req.body.vendorId),
      departmentId: req.body.departmentId,
      status: req.body.status,
      totalAmount: parseFloat(req.body.totalAmount),
      description: req.body.description,
      notes: req.body.notes,
      createdDate: req.body.createdDate,
      deliveryDate: req.body.deliveryDate,
      createdBy: req.user.id
    },
    include: {
      vendor: true,
      creator: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } }
    }
  });
  
  res.status(201).json(order);
}));

/**
 * GET /api/procurement/orders
 * List all procurement orders (Admin: all, Others: own department)
 */
router.get('/orders', asyncHandler(async (req, res) => {
  const { status, vendorId, departmentId, page = 1, limit = 20 } = req.query;
  
  const where = {};
  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
    where.departmentId = req.user.department;
  }
  if (status) where.status = status;
  if (vendorId) where.vendorId = parseId(vendorId);
  if (departmentId) where.departmentId = departmentId;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [orders, total] = await Promise.all([
    req.prisma.procurementOrder.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdDate: 'desc' },
      include: {
        vendor: true,
        creator: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        lineItems: true
      }
    }),
    req.prisma.procurementOrder.count({ where })
  ]);
  
  res.json({
    data: orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/procurement/orders/:id
 * Get procurement order details
 */
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const order = await req.prisma.procurementOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      creator: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
      lineItems: true,
      approvalWorkflows: {
        include: {
          approver: { select: { id: true, name: true, email: true } }
        }
      },
      assetInventoryLinks: {
        include: {
          asset: true,
          inventoryItem: true
        }
      }
    }
  });
  
  if (!order) throw notFound('Procurement Order');
  
  // Check access: admin or creator
  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && req.user.id !== order.createdBy) {
    throw forbidden();
  }
  
  res.json(order);
}));

/**
 * PUT /api/procurement/orders/:id
 * Update procurement order (draft status only)
 */
router.put('/orders/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const order = await req.prisma.procurementOrder.findUnique({ where: { id } });
  if (!order) throw notFound('Procurement Order');
  
  // Can only edit draft orders
  if (order.status !== 'draft') {
    throw badRequest('Cannot edit orders that are not in draft status');
  }
  
  const updated = await req.prisma.procurementOrder.update({
    where: { id },
    data: {
      vendorId: req.body.vendorId ? parseId(req.body.vendorId) : undefined,
      departmentId: req.body.departmentId,
      totalAmount: req.body.totalAmount ? parseFloat(req.body.totalAmount) : undefined,
      description: req.body.description,
      notes: req.body.notes,
      deliveryDate: req.body.deliveryDate
    },
    include: {
      vendor: true,
      creator: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } }
    }
  });
  
  res.json(updated);
}));

/**
 * POST /api/procurement/orders/:id/submit
 * Submit order for approval
 */
router.post('/orders/:id/submit', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const order = await req.prisma.procurementOrder.findUnique({
    where: { id },
    include: { lineItems: true }
  });
  
  if (!order) throw notFound('Procurement Order');
  if (req.user.id !== order.createdBy && req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();
  if (order.status !== 'draft') throw badRequest('Only draft orders can be submitted');
  if (!order.lineItems || order.lineItems.length === 0) {
    throw badRequest('Order must have at least one line item');
  }
  
  const updated = await req.prisma.procurementOrder.update({
    where: { id },
    data: { status: 'submitted' },
    include: {
      vendor: true,
      creator: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } }
    }
  });
  
  res.json(updated);
}));

/**
 * POST /api/procurement/orders/:id/approve
 * Approve procurement order (Admin only)
 */
router.post('/orders/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'approvalDate');
  
  const id = parseId(req.params.id);
  
  const order = await req.prisma.procurementOrder.findUnique({ where: { id } });
  if (!order) throw notFound('Procurement Order');
  if (order.status !== 'submitted' && order.status !== 'pending_approval') {
    throw badRequest('Only submitted or pending approval orders can be approved');
  }
  
  const updated = await req.prisma.procurementOrder.update({
    where: { id },
    data: {
      status: 'approved',
      approvalStatus: 'approved',
      approvedBy: req.user.id,
      approvalDate: new Date()
    },
    include: {
      vendor: true,
      creator: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } }
    }
  });
  
  res.json(updated);
}));

/**
 * POST /api/procurement/orders/:id/reject
 * Reject procurement order (Admin only)
 */
router.post('/orders/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'rejectionReason');
  
  const id = parseId(req.params.id);
  
  const order = await req.prisma.procurementOrder.findUnique({ where: { id } });
  if (!order) throw notFound('Procurement Order');
  
  const updated = await req.prisma.procurementOrder.update({
    where: { id },
    data: {
      status: 'cancelled',
      approvalStatus: 'rejected',
      rejectionReason: req.body.rejectionReason
    },
    include: {
      vendor: true,
      creator: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } }
    }
  });
  
  res.json(updated);
}));

/**
 * POST /api/procurement/orders/:id/mark-received
 * Mark order as received (Admin only)
 */
router.post('/orders/:id/mark-received', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'actualDeliveryDate');
  
  const id = parseId(req.params.id);
  
  const order = await req.prisma.procurementOrder.findUnique({ where: { id } });
  if (!order) throw notFound('Procurement Order');
  if (order.status !== 'approved') {
    throw badRequest('Only approved orders can be marked as received');
  }
  
  const updated = await req.prisma.procurementOrder.update({
    where: { id },
    data: {
      status: 'received',
      actualDeliveryDate: req.body.actualDeliveryDate
    },
    include: {
      vendor: true,
      creator: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } }
    }
  });
  
  res.json(updated);
}));

// ═══════════════════════════════════════════════
// PROCUREMENT LINE ITEMS ENDPOINTS
// ═══════════════════════════════════════════════

/**
 * POST /api/procurement/orders/:orderId/line-items
 * Add line item to order
 */
router.post('/orders/:orderId/line-items', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'itemCode', 'itemName', 'quantity', 'unitPrice', 'category');
  
  const orderId = parseId(req.params.orderId);
  
  const order = await req.prisma.procurementOrder.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Procurement Order');
  
  const totalPrice = parseFloat(req.body.quantity) * parseFloat(req.body.unitPrice);
  
  const lineItem = await req.prisma.procurementLineItem.create({
    data: {
      procurementId: orderId,
      itemCode: req.body.itemCode,
      itemName: req.body.itemName,
      quantity: parseInt(req.body.quantity),
      unitPrice: parseFloat(req.body.unitPrice),
      totalPrice,
      category: req.body.category,
      notes: req.body.notes
    }
  });
  
  // Update order total amount
  const allLineItems = await req.prisma.procurementLineItem.findMany({
    where: { procurementId: orderId }
  });
  const newTotal = allLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  
  await req.prisma.procurementOrder.update({
    where: { id: orderId },
    data: { totalAmount: newTotal }
  });
  
  res.status(201).json(lineItem);
}));

/**
 * GET /api/procurement/orders/:orderId/line-items
 * Get all line items for an order
 */
router.get('/orders/:orderId/line-items', asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.orderId);
  
  const lineItems = await req.prisma.procurementLineItem.findMany({
    where: { procurementId: orderId },
    orderBy: { id: 'asc' }
  });
  
  res.json(lineItems);
}));

/**
 * DELETE /api/procurement/line-items/:id
 * Delete line item (order must be in draft)
 */
router.delete('/line-items/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const lineItem = await req.prisma.procurementLineItem.findUnique({
    where: { id },
    include: { procurement: true }
  });
  
  if (!lineItem) throw notFound('Line Item');
  if (lineItem.procurement.status !== 'draft') {
    throw badRequest('Can only delete line items from draft orders');
  }
  
  await req.prisma.procurementLineItem.delete({ where: { id } });
  
  // Recalculate order total
  const remainingItems = await req.prisma.procurementLineItem.findMany({
    where: { procurementId: lineItem.procurementId }
  });
  const newTotal = remainingItems.reduce((sum, item) => sum + item.totalPrice, 0);
  
  await req.prisma.procurementOrder.update({
    where: { id: lineItem.procurementId },
    data: { totalAmount: newTotal }
  });
  
  res.json({ message: 'Line item deleted', orderId: lineItem.procurementId });
}));

// ═══════════════════════════════════════════════
// VENDOR MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════

/**
 * POST /api/procurement/vendors
 * Create new vendor (Admin only)
 */
router.post('/vendors', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'vendorName', 'email', 'phone', 'address');
  
  // Generate vendor code
  const lastVendor = await req.prisma.vendor.findFirst({
    orderBy: { id: 'desc' },
    select: { vendorCode: true }
  });
  
  let nextNumber = 1;
  if (lastVendor && lastVendor.vendorCode) {
    const match = lastVendor.vendorCode.match(/VND-(\d+)/);
    if (match) nextNumber = parseInt(match[1]) + 1;
  }
  
  const vendorCode = `VND-${String(nextNumber).padStart(3, '0')}`;
  
  const vendor = await req.prisma.vendor.create({
    data: {
      vendorCode,
      vendorName: req.body.vendorName,
      contactPerson: req.body.contactPerson,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      gstNumber: req.body.gstNumber,
      panNumber: req.body.panNumber,
      bankDetails: req.body.bankDetails,
      status: req.body.status || 'active',
      category: req.body.category,
      notes: req.body.notes
    }
  });
  
  res.status(201).json(vendor);
}));

/**
 * GET /api/procurement/vendors
 * List all vendors
 */
router.get('/vendors', asyncHandler(async (req, res) => {
  const { status = 'active', category, page = 1, limit = 20 } = req.query;
  
  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [vendors, total] = await Promise.all([
    req.prisma.vendor.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { vendorName: 'asc' }
    }),
    req.prisma.vendor.count({ where })
  ]);
  
  res.json({
    data: vendors,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/procurement/vendors/:id
 * Get vendor details
 */
router.get('/vendors/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const vendor = await req.prisma.vendor.findUnique({
    where: { id },
    include: {
      procurementOrders: {
        select: { id: true, orderNumber: true, status: true, totalAmount: true, createdDate: true }
      }
    }
  });
  
  if (!vendor) throw notFound('Vendor');
  res.json(vendor);
}));

/**
 * PUT /api/procurement/vendors/:id
 * Update vendor details (Admin only)
 */
router.put('/vendors/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const vendor = await req.prisma.vendor.findUnique({ where: { id } });
  if (!vendor) throw notFound('Vendor');
  
  const updated = await req.prisma.vendor.update({
    where: { id },
    data: {
      vendorName: req.body.vendorName,
      contactPerson: req.body.contactPerson,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      gstNumber: req.body.gstNumber,
      panNumber: req.body.panNumber,
      bankDetails: req.body.bankDetails,
      status: req.body.status,
      category: req.body.category,
      rating: req.body.rating,
      notes: req.body.notes
    }
  });
  
  res.json(updated);
}));

// ═══════════════════════════════════════════════
// INVENTORY ENDPOINTS
// ═══════════════════════════════════════════════

/**
 * POST /api/procurement/inventory
 * Create inventory item (Admin only)
 */
router.post('/inventory', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'itemCode', 'itemName', 'category', 'unitPrice');
  
  const item = await req.prisma.inventoryItem.create({
    data: {
      itemCode: req.body.itemCode,
      itemName: req.body.itemName,
      category: req.body.category,
      unitPrice: parseFloat(req.body.unitPrice),
      quantityOnHand: parseInt(req.body.quantityOnHand) || 0,
      reorderLevel: parseInt(req.body.reorderLevel) || 10,
      reorderQuantity: parseInt(req.body.reorderQuantity) || 20,
      storageLocationId: req.body.storageLocationId ? parseId(req.body.storageLocationId) : undefined,
      supplier: req.body.supplier,
      description: req.body.description,
      hsn_sac_code: req.body.hsn_sac_code,
      status: 'active'
    }
  });
  
  res.status(201).json(item);
}));

/**
 * GET /api/procurement/inventory
 * List inventory items
 */
router.get('/inventory', asyncHandler(async (req, res) => {
  const { category, status = 'active', page = 1, limit = 20 } = req.query;
  
  const where = {};
  if (category) where.category = category;
  if (status) where.status = status;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [items, total] = await Promise.all([
    req.prisma.inventoryItem.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: { storageLocation: true },
      orderBy: { itemCode: 'asc' }
    }),
    req.prisma.inventoryItem.count({ where })
  ]);
  
  res.json({
    data: items,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/procurement/inventory/low-stock
 * List items below reorder level
 */
router.get('/inventory/low-stock', requireAdmin, asyncHandler(async (req, res) => {
  const lowStock = await req.prisma.inventoryItem.findMany({
    where: {
      status: 'active',
      quantityOnHand: {
        lt: req.prisma.inventoryItem.fields.reorderLevel // This is a simplified approach
      }
    },
    include: { storageLocation: true },
    orderBy: { quantityOnHand: 'asc' }
  });
  
  res.json(lowStock);
}));

// ═══════════════════════════════════════════════
// BUDGET ENDPOINTS
// ═══════════════════════════════════════════════

/**
 * POST /api/procurement/budgets
 * Create/allocate budget for employee (Admin only)
 */
router.post('/budgets', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'employeeId', 'year', 'assetBudget');
  
  const employeeId = parseId(req.body.employeeId);
  const year = parseInt(req.body.year);
  
  // Check if budget already exists
  const existing = await req.prisma.employeeBudget.findUnique({
    where: {
      employeeId_year: { employeeId, year }
    }
  });
  
  if (existing) {
    throw conflict('Budget already allocated for this employee and year');
  }
  
  const budget = await req.prisma.employeeBudget.create({
    data: {
      employeeId,
      year,
      assetBudget: parseFloat(req.body.assetBudget),
      remainingBudget: parseFloat(req.body.assetBudget),
      budgetCategory: req.body.budgetCategory,
      notes: req.body.notes
    }
  });
  
  res.status(201).json(budget);
}));

/**
 * GET /api/procurement/budgets/:employeeId/:year
 * Get budget for employee in given year
 */
router.get('/budgets/:employeeId/:year', asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.employeeId);
  const year = parseInt(req.params.year);
  
  // Check access
  if (req.user.id !== employeeId && req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
    throw forbidden();
  }
  
  const budget = await req.prisma.employeeBudget.findUnique({
    where: {
      employeeId_year: { employeeId, year }
    },
    include: {
      employee: { select: { id: true, name: true, email: true, department: true } }
    }
  });
  
  if (!budget) throw notFound('Budget Allocation');
  res.json(budget);
}));

/**
 * PUT /api/procurement/budgets/:employeeId/:year
 * Update budget allocation (Admin only)
 */
router.put('/budgets/:employeeId/:year', requireAdmin, asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.employeeId);
  const year = parseInt(req.params.year);
  
  const budget = await req.prisma.employeeBudget.findUnique({
    where: {
      employeeId_year: { employeeId, year }
    }
  });
  
  if (!budget) throw notFound('Budget Allocation');
  
  const newAssetBudget = parseFloat(req.body.assetBudget);
  const remainingBudget = newAssetBudget - budget.totalSpent;
  
  const updated = await req.prisma.employeeBudget.update({
    where: {
      employeeId_year: { employeeId, year }
    },
    data: {
      assetBudget: newAssetBudget,
      remainingBudget: Math.max(0, remainingBudget),
      budgetCategory: req.body.budgetCategory,
      notes: req.body.notes
    }
  });
  
  res.json(updated);
}));

module.exports = router;
