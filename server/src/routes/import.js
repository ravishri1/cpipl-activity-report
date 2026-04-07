const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const { normalizeEmail, normalizeName } = require('../utils/normalize');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// greytHR CSV column → our DB field mapping
const FIELD_MAP = {
  'employee name': 'name', 'name': 'name', 'full name': 'name', 'employee_name': 'name',
  'email': 'email', 'official email': 'email', 'work email': 'email', 'email id': 'email', 'email_id': 'email', 'official_email': 'email',
  'employee id': 'employeeId', 'emp id': 'employeeId', 'employee_id': 'employeeId', 'emp_id': 'employeeId',
  'employee no': 'employeeId', 'employee number': 'employeeId', 'emp no': 'employeeId', 'emp code': 'employeeId',
  'department': 'department', 'dept': 'department', 'department name': 'department',
  'designation': 'designation', 'job title': 'designation', 'position': 'designation', 'title': 'designation',
  'date of joining': 'dateOfJoining', 'joining date': 'dateOfJoining', 'join date': 'dateOfJoining', 'doj': 'dateOfJoining', 'date_of_joining': 'dateOfJoining',
  'date of birth': 'dateOfBirth', 'dob': 'dateOfBirth', 'birth date': 'dateOfBirth', 'date_of_birth': 'dateOfBirth',
  'employment type': 'employmentType', 'emp type': 'employmentType', 'type': 'employmentType',
  'status': 'employmentStatus', 'employment status': 'employmentStatus', 'employee status': 'employmentStatus',
  'phone': 'phone', 'phone no': 'phone', 'mobile': 'phone', 'mobile number': 'phone', 'contact number': 'phone', 'phone number': 'phone', 'mobile no': 'phone',
  'personal email': 'personalEmail', 'personal_email': 'personalEmail', 'alternate email': 'personalEmail',
  'address': 'address', 'current address': 'address', 'permanent address': 'permanentAddress', 'permanent_address': 'permanentAddress',
  'gender': 'gender', 'blood group': 'bloodGroup', 'blood_group': 'bloodGroup',
  'marital status': 'maritalStatus', 'marital_status': 'maritalStatus', 'nationality': 'nationality',
  'father name': 'fatherName', "father's name": 'fatherName', 'father_name': 'fatherName',
  'spouse name': 'spouseName', 'spouse_name': 'spouseName', 'religion': 'religion',
  'place of birth': 'placeOfBirth', 'place_of_birth': 'placeOfBirth',
  'aadhaar': 'aadhaarNumber', 'aadhaar number': 'aadhaarNumber', 'aadhar number': 'aadhaarNumber', 'aadhaar_number': 'aadhaarNumber',
  'pan': 'panNumber', 'pan number': 'panNumber', 'pan_number': 'panNumber', 'pan card': 'panNumber',
  'passport number': 'passportNumber', 'passport': 'passportNumber', 'passport_number': 'passportNumber',
  'passport expiry': 'passportExpiry', 'passport_expiry': 'passportExpiry',
  'driving license': 'drivingLicense', 'driving_license': 'drivingLicense', 'dl number': 'drivingLicense',
  'uan': 'uanNumber', 'uan number': 'uanNumber', 'uan_number': 'uanNumber',
  'bank name': 'bankName', 'bank_name': 'bankName',
  'bank account': 'bankAccountNumber', 'bank account number': 'bankAccountNumber', 'account number': 'bankAccountNumber', 'bank_account_number': 'bankAccountNumber',
  'bank branch': 'bankBranch', 'branch': 'bankBranch', 'bank_branch': 'bankBranch',
  'ifsc': 'bankIfscCode', 'ifsc code': 'bankIfscCode', 'bank_ifsc': 'bankIfscCode',
  'confirmation date': 'confirmationDate', 'confirmation_date': 'confirmationDate',
  'probation end date': 'probationEndDate', 'probation_end_date': 'probationEndDate',
  'notice period': 'noticePeriodDays', 'notice period days': 'noticePeriodDays', 'notice_period_days': 'noticePeriodDays',
  'previous experience': 'previousExperience', 'experience': 'previousExperience', 'previous_experience': 'previousExperience',
  'location': 'location', 'office location': 'location', 'branch location': 'location',
  'grade': 'grade', 'pay grade': 'grade', 'shift': 'shift',
  'emergency contact': 'emergencyContact', 'emergency_contact': 'emergencyContact',
  'reporting manager': 'reportingManagerName', 'manager': 'reportingManagerName', 'reports to': 'reportingManagerName',
  'reporting_manager': 'reportingManagerName', 'manager name': 'reportingManagerName',
  'role': 'role',
};

function normalizeDate(val) {
  if (!val) return null;
  val = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const match1 = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match1) return `${match1[3]}-${match1[2].padStart(2, '0')}-${match1[1].padStart(2, '0')}`;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function normalizeEmploymentType(val) {
  if (!val) return 'full_time';
  val = String(val).toLowerCase().trim().replace(/[\s-]+/g, '_');
  const map = {
    'full_time': 'full_time', 'fulltime': 'full_time', 'full': 'full_time', 'permanent': 'full_time',
    'part_time': 'part_time', 'parttime': 'part_time', 'part': 'part_time',
    'contract': 'contract', 'contractual': 'contract', 'temp': 'contract', 'temporary': 'contract',
    'intern': 'intern', 'internship': 'intern', 'trainee': 'intern',
  };
  return map[val] || 'full_time';
}

function normalizeGender(val) {
  if (!val) return null;
  val = String(val).toLowerCase().trim();
  if (val.startsWith('m')) return 'male';
  if (val.startsWith('f')) return 'female';
  return 'other';
}

function normalizeMaritalStatus(val) {
  if (!val) return null;
  val = String(val).toLowerCase().trim();
  if (val.startsWith('s') || val === 'unmarried') return 'single';
  if (val.startsWith('m')) return 'married';
  if (val.startsWith('d')) return 'divorced';
  if (val.startsWith('w')) return 'widowed';
  return val;
}

// POST /preview — Parse CSV/JSON and return mapped preview
router.post('/preview', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows, headers } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) throw badRequest('No data rows provided.');

  const mapping = {};
  const unmapped = [];
  (headers || []).forEach(h => {
    const normalized = String(h).toLowerCase().trim();
    const dbField = FIELD_MAP[normalized];
    if (dbField) { mapping[h] = dbField; } else { unmapped.push(h); }
  });

  const preview = rows.slice(0, 5).map(row => {
    const mapped = {};
    Object.entries(row).forEach(([key, val]) => {
      const field = mapping[key];
      if (field && val !== undefined && val !== null && String(val).trim() !== '') {
        mapped[field] = String(val).trim();
      }
    });
    return mapped;
  });

  res.json({
    totalRows: rows.length, mapping, unmappedHeaders: unmapped,
    availableFields: [...new Set(Object.values(FIELD_MAP))].sort(), preview,
  });
}));

// POST /execute — Execute bulk import/update
// Inner per-row try-catch intentional: partial failure per row
router.post('/execute', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows, mapping, mode, companyId } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) throw badRequest('No data rows provided.');
  if (!mapping || typeof mapping !== 'object') throw badRequest('Field mapping required.');

  const importMode = mode || 'upsert';
  const results = { created: 0, updated: 0, skipped: 0, errors: [] };

  const existingUsers = await req.prisma.user.findMany({
    select: { id: true, email: true, name: true, employeeId: true },
  });
  const emailMap = {};
  const empIdMap = {};
  const nameMap = {};
  existingUsers.forEach(u => {
    emailMap[u.email.toLowerCase()] = u;
    if (u.employeeId) empIdMap[u.employeeId.toUpperCase()] = u;
    nameMap[u.name.toLowerCase().trim()] = u;
  });

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const mapped = {};
      let reportingManagerName = null;

      Object.entries(row).forEach(([csvHeader, value]) => {
        const dbField = mapping[csvHeader];
        if (dbField && value !== undefined && value !== null && String(value).trim() !== '') {
          if (dbField === 'reportingManagerName') {
            reportingManagerName = String(value).trim();
          } else {
            mapped[dbField] = String(value).trim();
          }
        }
      });

      if (!mapped.email && !mapped.name && !mapped.employeeId) {
        results.skipped++;
        results.errors.push({ row: i + 1, error: 'No email, name, or employee ID to match.' });
        continue;
      }

      const data = {};
      const stringFields = [
        'name', 'email', 'department', 'designation', 'employeeId', 'phone',
        'personalEmail', 'address', 'permanentAddress', 'bloodGroup',
        'nationality', 'fatherName', 'spouseName', 'religion', 'placeOfBirth',
        'aadhaarNumber', 'panNumber', 'passportNumber', 'drivingLicense', 'uanNumber',
        'bankName', 'bankAccountNumber', 'bankBranch', 'bankIfscCode',
        'location', 'grade', 'shift', 'emergencyContact', 'role',
      ];
      stringFields.forEach(f => { if (mapped[f]) data[f] = mapped[f]; });

      if (data.name) data.name = normalizeName(data.name);
      if (data.email) data.email = normalizeEmail(data.email);
      if (data.personalEmail) data.personalEmail = normalizeEmail(data.personalEmail);
      if (data.fatherName) data.fatherName = normalizeName(data.fatherName);
      if (data.spouseName) data.spouseName = normalizeName(data.spouseName);

      ['dateOfJoining', 'dateOfBirth', 'passportExpiry', 'confirmationDate', 'probationEndDate'].forEach(f => {
        if (mapped[f]) { const nd = normalizeDate(mapped[f]); if (nd) data[f] = nd; }
      });

      // Auto-calculate confirmationDate & probationEndDate from DOJ + 6 months (if not explicitly provided)
      if (data.dateOfJoining) {
        const dojDate = new Date(data.dateOfJoining);
        dojDate.setMonth(dojDate.getMonth() + 6);
        const sixMonthDate = dojDate.toISOString().slice(0, 10);
        if (!data.confirmationDate) data.confirmationDate = sixMonthDate;
        if (!data.probationEndDate) data.probationEndDate = sixMonthDate;
      }

      if (mapped.employmentType) data.employmentType = normalizeEmploymentType(mapped.employmentType);
      if (mapped.employmentStatus) {
        const status = String(mapped.employmentStatus).toLowerCase().trim();
        if (status === 'intern' || status === 'internship') data.employmentType = 'intern';
        else if (status === 'probation') data.employmentType = data.employmentType || 'full_time';
        else if (status === 'confirmed') data.employmentType = data.employmentType || 'full_time';
        else if (status === 'contract' || status === 'contractual') data.employmentType = 'contract';
      }
      if (mapped.gender) data.gender = normalizeGender(mapped.gender);
      if (mapped.maritalStatus) data.maritalStatus = normalizeMaritalStatus(mapped.maritalStatus);

      if (mapped.noticePeriodDays) { const n = parseInt(mapped.noticePeriodDays); if (!isNaN(n)) data.noticePeriodDays = n; }
      if (mapped.previousExperience) { const n = parseFloat(mapped.previousExperience); if (!isNaN(n)) data.previousExperience = n; }

      if (data.role) {
        const r = data.role.toLowerCase().trim().replace(/[\s-]+/g, '_');
        if (['admin', 'team_lead', 'member'].includes(r)) data.role = r;
        else delete data.role;
      }

      let existingUser = null;
      if (mapped.email) existingUser = emailMap[mapped.email.toLowerCase()];
      if (!existingUser && mapped.employeeId) existingUser = empIdMap[mapped.employeeId.toUpperCase()];
      if (!existingUser && mapped.name) existingUser = nameMap[mapped.name.toLowerCase().trim()];

      if (reportingManagerName) {
        const mgrName = reportingManagerName.toLowerCase().trim();
        const mgr = nameMap[mgrName];
        if (mgr) data.reportingManagerId = mgr.id;
        if (!data.reportingManagerId) {
          const found = existingUsers.find(u => u.name.toLowerCase().includes(mgrName) || mgrName.includes(u.name.toLowerCase()));
          if (found) data.reportingManagerId = found.id;
        }
      }

      if (existingUser && (importMode === 'update' || importMode === 'upsert')) {
        const updateData = { ...data };
        delete updateData.email;
        if (!updateData.name) delete updateData.name;
        if (Object.keys(updateData).length > 0) {
          await req.prisma.user.update({ where: { id: existingUser.id }, data: updateData });
          results.updated++;
        } else { results.skipped++; }
      } else if (!existingUser && (importMode === 'create' || importMode === 'upsert')) {
        if (!data.email) { results.skipped++; results.errors.push({ row: i + 1, error: 'Email required to create new user.' }); continue; }
        if (!data.name) { results.skipped++; results.errors.push({ row: i + 1, error: 'Name required to create new user.' }); continue; }

        const bcrypt = require('bcryptjs');
        const defaultPass = await bcrypt.hash('Welcome@123', 10);
        const newUser = await req.prisma.user.create({
          data: { ...data, password: defaultPass, role: data.role || 'member', department: data.department || '', companyId: companyId ? parseInt(companyId) : null },
        });
        emailMap[newUser.email.toLowerCase()] = newUser;
        if (newUser.name) nameMap[newUser.name.toLowerCase().trim()] = newUser;
        if (newUser.employeeId) empIdMap[newUser.employeeId.toUpperCase()] = newUser;
        existingUsers.push(newUser);
        results.created++;
      } else { results.skipped++; }
    } catch (rowErr) {
      results.errors.push({ row: i + 1, error: rowErr.message });
    }
  }

  res.json(results);
}));

// GET /template — Return expected CSV columns
router.get('/template', authenticate, requireAdmin, (req, res) => {
  res.json({
    columns: [
      'Employee ID', 'Employee Name', 'Email', 'Department', 'Designation',
      'Date of Joining', 'Date of Birth', 'Gender', 'Phone', 'Personal Email',
      'Employment Type', 'Reporting Manager', 'Location', 'Blood Group',
      'Marital Status', 'Father Name', 'Spouse Name', 'Nationality', 'Religion',
      'Address', 'Permanent Address', 'Place of Birth',
      'Aadhaar Number', 'PAN Number', 'Passport Number', 'Passport Expiry',
      'Driving License', 'UAN Number',
      'Bank Name', 'Bank Account Number', 'Bank Branch', 'IFSC Code',
      'Confirmation Date', 'Probation End Date', 'Notice Period Days',
      'Previous Experience', 'Grade', 'Shift',
    ],
  });
});

module.exports = router;
