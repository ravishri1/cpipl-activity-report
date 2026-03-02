const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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
