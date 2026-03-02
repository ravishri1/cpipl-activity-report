const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { put } = require('@vercel/blob');
const { authenticate, requireAdmin, requireManagerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Multer config — memory storage for Vercel Blob uploads (max 5 MB images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed.'));
  },
});

// ═══════════════════════════════════════════════
// Photo Upload
// ═══════════════════════════════════════════════

// POST /api/users/:id/photo — Upload profile photo (self or admin)
router.post('/:id/photo', authenticate, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be under 5 MB.' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const isSelf = req.user.id === targetId;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'You can only upload your own photo.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Upload to Vercel Blob
    const ext = req.file.mimetype.split('/')[1] || 'jpg';
    const filename = `profile-photos/user-${targetId}-${Date.now()}.${ext}`;

    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });

    // Update user's profilePhotoUrl in DB
    const user = await req.prisma.user.update({
      where: { id: targetId },
      data: { profilePhotoUrl: blob.url },
      select: { id: true, profilePhotoUrl: true },
    });

    res.json({ profilePhotoUrl: user.profilePhotoUrl });
  } catch (err) {
    console.error('Photo upload error:', err);
    if (err.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      return res.status(500).json({ error: 'Photo storage not configured. Ask admin to set BLOB_READ_WRITE_TOKEN.' });
    }
    res.status(500).json({ error: 'Failed to upload photo.' });
  }
});

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
        location: true,
        reportingManagerId: true,
        reportingManager: { select: { id: true, name: true, employeeId: true } },
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

// GET /api/users/org-chart — Org chart data (reporting hierarchy)
router.get('/org-chart', authenticate, async (req, res) => {
  try {
    const users = await req.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, employeeId: true, designation: true,
        department: true, profilePhotoUrl: true, reportingManagerId: true, role: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch org chart.' });
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
        // Basic HR
        employeeId: true, designation: true, dateOfJoining: true, dateOfBirth: true,
        employmentType: true, phone: true, personalEmail: true, address: true,
        emergencyContact: true, gender: true, bloodGroup: true,
        profilePhotoUrl: true, reportingManagerId: true,
        // Extended Personal
        maritalStatus: true, nationality: true, fatherName: true, spouseName: true,
        religion: true, placeOfBirth: true, permanentAddress: true,
        // Identity Documents
        aadhaarNumber: true, panNumber: true, passportNumber: true, passportExpiry: true,
        drivingLicense: true, uanNumber: true,
        // Bank Details
        bankName: true, bankAccountNumber: true, bankBranch: true, bankIfscCode: true,
        // Employment Extended
        confirmationDate: true, probationEndDate: true, noticePeriodDays: true,
        previousExperience: true, location: true, grade: true, shift: true,
        // Relations
        reportingManager: { select: { id: true, name: true, employeeId: true, designation: true, department: true, profilePhotoUrl: true } },
        subordinates: { select: { id: true, name: true, employeeId: true, designation: true, department: true, profilePhotoUrl: true } },
        educations: { orderBy: { id: 'desc' } },
        familyMembers: { orderBy: { id: 'asc' } },
        previousEmployments: { orderBy: { id: 'desc' } },
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
      const selfFields = ['name', 'phone', 'personalEmail', 'address', 'permanentAddress', 'emergencyContact', 'profilePhotoUrl'];
      selfFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    }

    // Admin-only fields
    if (isAdmin) {
      const adminFields = [
        // Basic
        'name', 'email', 'role', 'department', 'employeeId',
        'designation', 'dateOfJoining', 'dateOfBirth', 'employmentType',
        'gender', 'bloodGroup',
        // Extended Personal
        'maritalStatus', 'nationality', 'fatherName', 'spouseName',
        'religion', 'placeOfBirth',
        // Identity
        'aadhaarNumber', 'panNumber', 'passportNumber', 'passportExpiry',
        'drivingLicense', 'uanNumber',
        // Bank
        'bankName', 'bankAccountNumber', 'bankBranch', 'bankIfscCode',
        // Employment Extended
        'confirmationDate', 'probationEndDate', 'noticePeriodDays',
        'previousExperience', 'location', 'grade', 'shift',
      ];
      adminFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
      // Handle reportingManagerId specially (can be null)
      if (req.body.reportingManagerId !== undefined) data.reportingManagerId = req.body.reportingManagerId || null;
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
        // Extended fields
        maritalStatus: true, nationality: true, fatherName: true, spouseName: true,
        religion: true, placeOfBirth: true, permanentAddress: true, address: true,
        aadhaarNumber: true, panNumber: true, passportNumber: true, passportExpiry: true,
        drivingLicense: true, uanNumber: true,
        bankName: true, bankAccountNumber: true, bankBranch: true, bankIfscCode: true,
        confirmationDate: true, probationEndDate: true, noticePeriodDays: true,
        previousExperience: true, location: true, grade: true, shift: true,
        dateOfBirth: true, emergencyContact: true,
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

// ═══════════════════════════════════════════════
// Education CRUD
// ═══════════════════════════════════════════════

// POST /api/users/:id/education — Add education record (admin or self)
router.post('/:id/education', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const { degree, institution, university, specialization, yearOfPassing, percentage } = req.body;
    if (!degree || !institution) return res.status(400).json({ error: 'Degree and institution are required.' });
    const record = await req.prisma.education.create({
      data: { userId: targetId, degree, institution, university, specialization, yearOfPassing, percentage },
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('Add education error:', err);
    res.status(500).json({ error: 'Failed to add education.' });
  }
});

// DELETE /api/users/:id/education/:eduId — Remove education record (admin or self)
router.delete('/:id/education/:eduId', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await req.prisma.education.delete({ where: { id: parseInt(req.params.eduId) } });
    res.json({ message: 'Education record deleted.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
    res.status(500).json({ error: 'Failed to delete education.' });
  }
});

// ═══════════════════════════════════════════════
// Family Members CRUD
// ═══════════════════════════════════════════════

// POST /api/users/:id/family — Add family member (admin or self)
router.post('/:id/family', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const { name, relationship, dateOfBirth, occupation, phone, isDependent, isNominee, nomineeShare } = req.body;
    if (!name || !relationship) return res.status(400).json({ error: 'Name and relationship are required.' });
    const record = await req.prisma.familyMember.create({
      data: { userId: targetId, name, relationship, dateOfBirth, occupation, phone, isDependent, isNominee, nomineeShare },
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('Add family member error:', err);
    res.status(500).json({ error: 'Failed to add family member.' });
  }
});

// DELETE /api/users/:id/family/:fmId — Remove family member (admin or self)
router.delete('/:id/family/:fmId', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await req.prisma.familyMember.delete({ where: { id: parseInt(req.params.fmId) } });
    res.json({ message: 'Family member deleted.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
    res.status(500).json({ error: 'Failed to delete family member.' });
  }
});

// ═══════════════════════════════════════════════
// Previous Employment CRUD
// ═══════════════════════════════════════════════

// POST /api/users/:id/employment-history — Add previous employment (admin or self)
router.post('/:id/employment-history', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const { company, designation, fromDate, toDate, ctc, reasonForLeaving } = req.body;
    if (!company) return res.status(400).json({ error: 'Company name is required.' });
    const record = await req.prisma.previousEmployment.create({
      data: { userId: targetId, company, designation, fromDate, toDate, ctc, reasonForLeaving },
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('Add employment error:', err);
    res.status(500).json({ error: 'Failed to add employment history.' });
  }
});

// DELETE /api/users/:id/employment-history/:empId — Remove previous employment (admin or self)
router.delete('/:id/employment-history/:empId', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await req.prisma.previousEmployment.delete({ where: { id: parseInt(req.params.empId) } });
    res.json({ message: 'Employment record deleted.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
    res.status(500).json({ error: 'Failed to delete employment record.' });
  }
});

module.exports = router;
