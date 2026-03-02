const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Helper: check if user is admin or team_lead
function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

// Valid types and statuses
const VALID_TYPES = ['laptop', 'phone', 'id_card', 'access_card', 'monitor', 'headset', 'keyboard', 'mouse', 'other'];
const VALID_STATUSES = ['available', 'assigned', 'maintenance', 'retired'];

// ─── 1. GET /my ─── My assigned assets (any authenticated user)
// NOTE: Defined before /:id to avoid route conflict
router.get('/my', async (req, res) => {
  try {
    const assets = await req.prisma.asset.findMany({
      where: {
        assignedTo: req.user.id,
        status: 'assigned',
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assets);
  } catch (err) {
    console.error('GET /assets/my error:', err);
    res.status(500).json({ error: 'Failed to fetch your assets' });
  }
});

// ─── 2. GET /summary ─── Asset summary (admin)
// NOTE: Defined before /:id to avoid route conflict
router.get('/summary', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const assets = await req.prisma.asset.findMany();

    const totalCount = assets.length;
    let totalValue = 0;
    const byType = {};
    const byStatus = {};

    for (const asset of assets) {
      // By type
      if (!byType[asset.type]) byType[asset.type] = 0;
      byType[asset.type]++;

      // By status
      if (!byStatus[asset.status]) byStatus[asset.status] = 0;
      byStatus[asset.status]++;

      // Total value
      if (asset.value) totalValue += asset.value;
    }

    res.json({
      totalCount,
      totalValue: Math.round(totalValue * 100) / 100,
      byType,
      byStatus,
    });
  } catch (err) {
    console.error('GET /assets/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch asset summary' });
  }
});

// ─── 3. GET / ─── List all assets with optional filters (admin)
router.get('/', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const { status, type, assignedTo } = req.query;
    const where = {};

    if (status && VALID_STATUSES.includes(status)) where.status = status;
    if (type && VALID_TYPES.includes(type)) where.type = type;
    if (assignedTo) where.assignedTo = parseInt(assignedTo);

    const assets = await req.prisma.asset.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, employeeId: true, department: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(assets);
  } catch (err) {
    console.error('GET /assets error:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// ─── 4. POST / ─── Create asset (admin)
router.post('/', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const { name, type, serialNumber, purchaseDate, value, notes, companyId } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const asset = await req.prisma.asset.create({
      data: {
        name,
        type,
        serialNumber: serialNumber || null,
        purchaseDate: purchaseDate || null,
        value: value ? parseFloat(value) : null,
        notes: notes || null,
        companyId: companyId ? parseInt(companyId) : null,
        status: 'available',
      },
    });

    res.status(201).json(asset);
  } catch (err) {
    console.error('POST /assets error:', err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// ─── 5. PUT /:id/assign ─── Assign asset to employee (admin)
// NOTE: Defined before PUT /:id to avoid route conflict
router.put('/:id/assign', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);
    const { userId, assignedDate } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Validate asset exists
    const asset = await req.prisma.asset.findUnique({ where: { id } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Validate user exists
    const user = await req.prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await req.prisma.asset.update({
      where: { id },
      data: {
        assignedTo: parseInt(userId),
        assignedDate: assignedDate || new Date().toISOString().slice(0, 10),
        status: 'assigned',
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, employeeId: true, department: true },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /assets/:id/assign error:', err);
    res.status(500).json({ error: 'Failed to assign asset' });
  }
});

// ─── 6. PUT /:id/return ─── Mark asset as returned (admin)
router.put('/:id/return', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);

    const asset = await req.prisma.asset.findUnique({ where: { id } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const updated = await req.prisma.asset.update({
      where: { id },
      data: {
        returnDate: new Date().toISOString().slice(0, 10),
        assignedTo: null,
        status: 'available',
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /assets/:id/return error:', err);
    res.status(500).json({ error: 'Failed to return asset' });
  }
});

// ─── 7. GET /employee/:userId ─── Assets for specific employee (admin)
router.get('/employee/:userId', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const userId = parseInt(req.params.userId);

    const assets = await req.prisma.asset.findMany({
      where: { assignedTo: userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(assets);
  } catch (err) {
    console.error('GET /assets/employee/:userId error:', err);
    res.status(500).json({ error: 'Failed to fetch employee assets' });
  }
});

// ─── 8. PUT /:id ─── Update asset fields (admin)
router.put('/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);

    const asset = await req.prisma.asset.findUnique({ where: { id } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const { name, type, serialNumber, purchaseDate, value, notes, companyId, status } = req.body;

    // Validate type if provided
    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }
    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (serialNumber !== undefined) data.serialNumber = serialNumber || null;
    if (purchaseDate !== undefined) data.purchaseDate = purchaseDate || null;
    if (value !== undefined) data.value = value ? parseFloat(value) : null;
    if (notes !== undefined) data.notes = notes || null;
    if (companyId !== undefined) data.companyId = companyId ? parseInt(companyId) : null;
    if (status !== undefined) data.status = status;

    const updated = await req.prisma.asset.update({
      where: { id },
      data,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, employeeId: true, department: true },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /assets/:id error:', err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

module.exports = router;
