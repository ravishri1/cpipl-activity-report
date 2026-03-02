const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireManagerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// ═══════════════════════════════════════════════
// Employee Directory & Profile (HR)
// ═══════════════════════════════════════════════

// GET /api/users/directory — Employee directory (all active users, public fields)
router.get('/directory', authenticate, async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.query.department && req.query.department !== 'all') {
      where.department = req.query.department;
    }
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { email: { contains: req.query.search, mode: 'insensitive' } },
        { designation: { contains: req.query.search, mode: 'insensitive' } },
        { employeeId: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }

    const employees = await req.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        designation: true,
        employeeId: true,
        profilePhotoUrl: true,
        phone: true,
        dateOfJoining: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(employees);
  } catch (err) {
    console.error('Directory error:', err);
    res.status(500).json({ error: 'Failed to fetch employee directory.' });
  }
});

// GET /api/users/departments — List unique departments
router.get('/departments', authenticate, async (req, res) => {
  try {
    const departments = await req.prisma.user.findMany({
      where: { isActive: true },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });
    res.json(departments.map((d) => d.department));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

// GET /api/users/:id/profile — Full employee profile (self or admin/manager)
router.get('/:id/profile', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const isSelf = req.user.id === targetId;
    const isAdminOrLead = req.user.role === 'admin' || req.user.role === 'team_lead';

    if (!isSelf && !isAdminOrLead) {
      return res.status(403).json({ error: 'You can only view your own profile or profiles in your team.' });
    }

    // Department scoping for team_leads
    if (req.user.role === 'team_lead' && !isSelf) {
      const target = await req.prisma.user.findUnique({
        where: { id: targetId },
        select: { department: true },
      });
      if (!target || target.department !== req.user.department) {
        return res.status(403).json({ error: 'You can only view profiles in your department.' });
      }
    }

    const user = await req.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true, name: true, email: true, role: true, department: true,
        isActive: true, createdAt: true,
        employeeId: true, designation: true, dateOfJoining: true, dateOfBirth: true,
        employmentType: true, phone: true, personalEmail: true, address: true,
        emergencyContact: true, gender: true, bloodGroup: true,
        profilePhotoUrl: true, reportingManagerId: true,
        reportingManager: { select: { id: true, name: true, employeeId: true } },
        subordinates: { select: { id: true, name: true, employeeId: true, designation: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(user);
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// PUT /api/users/:id/profile — Update employee profile (admin only, or self for limited fields)
router.put('/:id/profile', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const isSelf = req.user.id === targetId;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const data = {};

    // Self-editable fields (employees can update their own contact info)
    if (isSelf || isAdmin) {
      const { phone, personalEmail, address, emergencyContact, profilePhotoUrl } = req.body;
      if (phone !== undefined) data.phone = phone;
      if (personalEmail !== undefined) data.personalEmail = personalEmail;
      if (address !== undefined) data.address = address;
      if (emergencyContact !== undefined) data.emergencyContact = emergencyContact;
      if (profilePhotoUrl !== undefined) data.profilePhotoUrl = profilePhotoUrl;
    }

    // Admin-only fields
    if (isAdmin) {
      const {
        designation, dateOfJoining, dateOfBirth, employmentType,
        gender, bloodGroup, reportingManagerId, employeeId,
        department, role, name, email,
      } = req.body;
      if (designation !== undefined) data.designation = designation;
      if (dateOfJoining !== undefined) data.dateOfJoining = dateOfJoining;
      if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth;
      if (employmentType !== undefined) data.employmentType = employmentType;
      if (gender !== undefined) data.gender = gender;
      if (bloodGroup !== undefined) data.bloodGroup = bloodGroup;
      if (reportingManagerId !== undefined) data.reportingManagerId = reportingManagerId || null;
      if (employeeId !== undefined) data.employeeId = employeeId;
      if (department !== undefined) data.department = department;
      if (role !== undefined) data.role = role;
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    const user = await req.prisma.user.update({
      where: { id: targetId },
      data,
      select: {
        id: true, name: true, email: true, role: true, department: true,
        employeeId: true, designation: true, dateOfJoining: true,
        employmentType: true, phone: true, personalEmail: true,
        gender: true, bloodGroup: true, profilePhotoUrl: true,
        reportingManagerId: true,
      },
    });

    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Duplicate value for unique field (email or employeeId).' });
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// GET /api/users/:id/documents — List employee documents (self or admin)
router.get('/:id/documents', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const isSelf = req.user.id === targetId;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const documents = await req.prisma.employeeDocument.findMany({
      where: { userId: targetId },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

// POST /api/users/:id/documents — Upload employee document (admin only)
// Note: File upload via Vercel Blob - expects JSON body with { name, type, fileUrl }
// Frontend uploads to Vercel Blob first, then sends the URL here
router.post('/:id/documents', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can upload documents.' });
    }

    const targetId = parseInt(req.params.id);
    const { name, type, fileUrl } = req.body;

    if (!name || !type || !fileUrl) {
      return res.status(400).json({ error: 'Name, type, and fileUrl are required.' });
    }

    const validTypes = ['id_proof', 'address_proof', 'education', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }

    // Verify user exists
    const user = await req.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const doc = await req.prisma.employeeDocument.create({
      data: {
        userId: targetId,
        name: name.trim(),
        type,
        fileUrl,
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: 'Failed to upload document.' });
  }
});

// DELETE /api/users/:id/documents/:docId — Delete employee document (admin only)
router.delete('/:id/documents/:docId', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete documents.' });
    }

    const docId = parseInt(req.params.docId);
    await req.prisma.employeeDocument.delete({ where: { id: docId } });
    res.json({ message: 'Document deleted.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Document not found.' });
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

// ═══════════════════════════════════════════════
// Existing User Management (Admin)
// ═══════════════════════════════════════════════

// GET /api/users - List users (admins see all, team_leads see own department)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'team_lead') {
      where.department = req.user.department;
    }

    const users = await req.prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true,
        department: true, isActive: true, createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/users - Create user
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = await req.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await req.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'member',
        department: department || 'General',
      },
    });

    res.status(201).json({
      id: user.id, name: user.name, email: user.email,
      role: user.role, department: user.department,
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, role, department, isActive, password } = req.body;
    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (department) data.department = department;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await req.prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data,
      select: {
        id: true, name: true, email: true, role: true,
        department: true, isActive: true,
      },
    });
    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/users/:id - Deactivate user (soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await req.prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    });
    res.json({ message: 'User deactivated.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
