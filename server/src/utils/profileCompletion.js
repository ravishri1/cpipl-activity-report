/**
 * profileCompletion.js
 * Computes a profile completion percentage (0–100) for a User record.
 * Each field is worth 1 point unless weighted otherwise.
 * Returns { score, total, filled, missing[] }
 */

const FIELDS = [
  // Identity (weight 1 each)
  { key: 'name',              label: 'Full Name' },
  { key: 'email',             label: 'Work Email' },
  { key: 'personalEmail',     label: 'Personal Email' },
  { key: 'phone',             label: 'Phone Number' },
  { key: 'dateOfBirth',       label: 'Date of Birth' },
  { key: 'gender',            label: 'Gender' },
  { key: 'bloodGroup',        label: 'Blood Group' },
  { key: 'nationality',       label: 'Nationality' },
  { key: 'address',           label: 'Current Address' },
  { key: 'permanentAddress',  label: 'Permanent Address' },
  { key: 'profilePhotoUrl',   label: 'Profile Photo', alt: 'driveProfilePhotoUrl' },

  // HR
  { key: 'employeeId',        label: 'Employee ID' },
  { key: 'designation',       label: 'Designation' },
  { key: 'department',        label: 'Department', alwaysFilled: true },
  { key: 'dateOfJoining',     label: 'Date of Joining' },
  { key: 'reportingManagerId',label: 'Reporting Manager' },

  // Identity documents
  { key: 'aadhaarNumber',     label: 'Aadhaar Number' },
  { key: 'panNumber',         label: 'PAN Number' },

  // Financial
  { key: 'bankAccountNumber', label: 'Bank Account' },
  { key: 'bankIfsc',          label: 'IFSC Code' },

  // Emergency contact
  { key: 'emergencyContact',  label: 'Emergency Contact' },

  // Relations (must have at least one record)
  { key: '_education',        label: 'Education Record',       relCheck: true },
  { key: '_family',           label: 'Family Member',          relCheck: true },
];

/**
 * @param {object} user  – full User record from Prisma (with _count or relations)
 * @param {object} counts – { education: n, family: n } from relation counts
 * @returns {{ score: number, total: number, filled: number, missing: string[] }}
 */
function computeProfileCompletion(user, counts = {}) {
  let filled = 0;
  const missing = [];

  for (const field of FIELDS) {
    if (field.alwaysFilled) { filled++; continue; }

    if (field.relCheck) {
      const relKey = field.key === '_education' ? 'education' : 'family';
      if ((counts[relKey] || 0) > 0) {
        filled++;
      } else {
        missing.push(field.label);
      }
      continue;
    }

    // Normal scalar field
    const val = user[field.key];
    const alt = field.alt ? user[field.alt] : null;
    const present = (val && String(val).trim() !== '') || (alt && String(alt).trim() !== '');
    if (present) {
      filled++;
    } else {
      missing.push(field.label);
    }
  }

  const total = FIELDS.length;
  const score = Math.round((filled / total) * 100);

  return { score, total, filled, missing };
}

module.exports = { computeProfileCompletion };
