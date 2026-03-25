/**
 * Centralized dependency checker for safe deletes.
 * Before deleting a record, checks all related models for linked data.
 * Throws a 409 error with structured dependency info if links exist.
 *
 * Usage in routes:
 *   const { throwIfHasDependencies } = require('../utils/dependencyCheck');
 *   await throwIfHasDependencies(req.prisma, 'Holiday', id);
 */

const { conflict } = require('./httpErrors');

// Map: ModelName → [{ model (prisma model name), field (FK field), label (human-readable) }]
const DEPENDENCY_MAP = {
  // Core
  User: [
    { model: 'dailyReport', field: 'userId', label: 'Activity Reports' },
    { model: 'attendance', field: 'userId', label: 'Attendance Records' },
    { model: 'leaveRequest', field: 'userId', label: 'Leave Requests' },
    { model: 'leaveBalance', field: 'userId', label: 'Leave Balances' },
    { model: 'payslip', field: 'userId', label: 'Payslips' },
    { model: 'salaryStructure', field: 'userId', label: 'Salary Structure' },
    { model: 'salaryRevision', field: 'userId', label: 'Salary Revisions' },
    { model: 'expenseClaim', field: 'userId', label: 'Expense Claims' },
    { model: 'ticket', field: 'createdById', label: 'Support Tickets' },
    { model: 'assetHandover', field: 'userId', label: 'Asset Handovers' },
    { model: 'surveyResponse', field: 'userId', label: 'Survey Responses' },
    { model: 'overtimeRequest', field: 'userId', label: 'Overtime Requests' },
    { model: 'onboardingChecklist', field: 'userId', label: 'Onboarding Checklists' },
    { model: 'separation', field: 'userId', label: 'Separation Records' },
    { model: 'generatedLetter', field: 'userId', label: 'Generated Letters' },
    { model: 'googleToken', field: 'userId', label: 'Google Tokens' },
    { model: 'pointLog', field: 'userId', label: 'Point Logs' },
  ],

  // Organization
  Branch: [
    { model: 'user', field: 'branchId', label: 'Employees' },
    { model: 'branchHoliday', field: 'branchId', label: 'Branch Holidays' },
  ],
  Company: [
    { model: 'user', field: 'companyId', label: 'Employees' },
    { model: 'companyRegistration', field: 'companyId', label: 'Registrations' },
  ],

  // Leave
  LeaveType: [
    { model: 'leaveBalance', field: 'leaveTypeId', label: 'Leave Balances' },
    { model: 'leaveRequest', field: 'leaveTypeId', label: 'Leave Requests' },
  ],

  // Recruitment
  JobOpening: [
    { model: 'candidate', field: 'jobOpeningId', label: 'Candidates' },
  ],
  Candidate: [
    { model: 'interview', field: 'candidateId', label: 'Interviews' },
    { model: 'jobOffer', field: 'candidateId', label: 'Job Offers' },
  ],

  // Assets
  Asset: [
    { model: 'assetHandover', field: 'assetId', label: 'Handover Records' },
    { model: 'assetRepair', field: 'assetId', label: 'Repair Records' },
    { model: 'assetAssignment', field: 'assetId', label: 'Assignments' },
    { model: 'assetMovement', field: 'assetId', label: 'Movement Records' },
    { model: 'assetMaintenance', field: 'assetId', label: 'Maintenance Records' },
    { model: 'assetConditionLog', field: 'assetId', label: 'Condition Logs' },
    { model: 'assetDisposal', field: 'assetId', label: 'Disposal Records' },
    { model: 'assetDetachmentRequest', field: 'assetId', label: 'Detachment Requests' },
  ],

  // Renewals (renewalHistory + emailRenewalScan cascade-delete automatically)
  Renewal: [],
  RenewalCategory: [
    { model: 'renewal', field: 'categoryId', label: 'Renewals' },
  ],
  PaymentAccount: [
    { model: 'renewal', field: 'paymentAccountId', label: 'Renewals' },
  ],

  // Communication
  Survey: [
    { model: 'surveyResponse', field: 'surveyId', label: 'Survey Responses' },
  ],
  Ticket: [
    { model: 'ticketComment', field: 'ticketId', label: 'Comments' },
  ],
  Policy: [
    { model: 'policySection', field: 'policyId', label: 'Policy Sections' },
    { model: 'policyAcceptance', field: 'policyId', label: 'Employee Acceptances' },
    { model: 'policyVersion', field: 'policyId', label: 'Policy Versions' },
  ],

  // Biometric
  BiometricDevice: [
    { model: 'biometricPunch', field: 'deviceId', label: 'Punch Records' },
  ],

  // Shifts
  ShiftDefinition: [
    { model: 'shiftAssignment', field: 'shiftId', label: 'Shift Assignments' },
  ],

  // Payroll
  SalaryComponent: [],
  SalaryTemplate: [],

  // Letters
  LetterTemplate: [
    { model: 'generatedLetter', field: 'templateId', label: 'Generated Letters' },
  ],

  // Company Registration
  CompanyRegistration: [
    { model: 'complianceCertificate', field: 'companyRegistrationId', label: 'Compliance Certificates' },
  ],

  // Insurance
  InsuranceCard: [],

  // Holidays
  Holiday: [],
  WeeklyOffPattern: [
    { model: 'user', field: 'weeklyOffPatternId', label: 'Employees' },
  ],

  // Files
  DriveFile: [],

  // Misc
  CompanyContract: [],
  ComplianceCertificate: [],
  ErrorReport: [],
  Announcement: [],
  WikiArticle: [],
  Suggestion: [],
  AutomationInsight: [],
};

/**
 * Check if a record has dependencies in related models.
 * @param {object} prisma - Prisma client instance
 * @param {string} modelName - PascalCase model name (e.g., 'Holiday', 'BiometricDevice')
 * @param {number} recordId - The record ID to check
 * @returns {{ canDelete: boolean, dependencies: Array<{model: string, label: string, count: number}> }}
 */
async function checkDependencies(prisma, modelName, recordId) {
  const relations = DEPENDENCY_MAP[modelName];
  if (!relations || relations.length === 0) {
    return { canDelete: true, dependencies: [] };
  }

  const dependencies = [];

  for (const rel of relations) {
    try {
      const count = await prisma[rel.model].count({
        where: { [rel.field]: recordId },
      });
      if (count > 0) {
        dependencies.push({ model: rel.model, label: rel.label, count });
      }
    } catch (err) {
      // Model or field doesn't exist — skip silently
      // This handles cases where schema has changed but map wasn't updated
    }
  }

  return {
    canDelete: dependencies.length === 0,
    dependencies,
  };
}

/**
 * Throws a 409 Conflict error if the record has dependencies.
 * Use in routes before calling prisma.model.delete().
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - PascalCase model name
 * @param {number} recordId - Record ID to check
 * @throws {HttpError} 409 with dependency list
 */
async function throwIfHasDependencies(prisma, modelName, recordId) {
  const result = await checkDependencies(prisma, modelName, recordId);
  if (!result.canDelete) {
    const depList = result.dependencies.map(d => `${d.label} (${d.count})`).join(', ');
    const error = conflict(
      `Cannot delete — this ${modelName} has linked data: ${depList}. Please remove or reassign the linked records first.`
    );
    // Attach structured dependency info for frontend
    error.dependencies = result.dependencies;
    error.code = 'DEPENDENCY_EXISTS';
    throw error;
  }
}

module.exports = { checkDependencies, throwIfHasDependencies, DEPENDENCY_MAP };
