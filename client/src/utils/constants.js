/**
 * Shared constants — color maps, status options, category lists.
 * Import from here instead of defining locally in each component.
 */

// ═══ Generic status colors (used by StatusBadge default) ═══
export const STATUS_STYLES = {
  // Approval workflow
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  // Active/inactive
  active: 'bg-green-100 text-green-700 border-green-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  expired: 'bg-red-100 text-red-600 border-red-200',
  // Generic
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  published: 'bg-green-100 text-green-700 border-green-200',
};

// ═══ Ticket-specific ═══
export const TICKET_STATUS_STYLES = {
  open: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const TICKET_PRIORITY_STYLES = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

export const TICKET_CATEGORIES = ['it', 'hr', 'admin', 'finance', 'facilities', 'other'];

// ═══ Expense-specific ═══
export const EXPENSE_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
};

export const EXPENSE_CATEGORIES = ['travel', 'food', 'medical', 'office', 'communication', 'other'];

// ═══ Asset-specific ═══
export const ASSET_STATUS_STYLES = {
  available: 'bg-green-100 text-green-700 border-green-200',
  assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  retired: 'bg-slate-100 text-slate-500 border-slate-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
};

export const ASSET_TYPES = [
  'laptop', 'desktop', 'monitor', 'phone', 'tablet',
  'headset', 'keyboard', 'mouse', 'id_card', 'access_card', 'other',
];

// ═══ Leave-specific ═══
export const LEAVE_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

// ═══ Payroll-specific ═══
export const PAYSLIP_STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  generated: 'bg-amber-100 text-amber-700 border-amber-200',
  published: 'bg-green-100 text-green-700 border-green-200',
};

// ═══ Survey-specific ═══
export const SURVEY_STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-red-100 text-red-600 border-red-200',
};

// ═══ Asset Repair-specific ═══
export const REPAIR_STATUS_STYLES = {
  initiated: 'bg-slate-100 text-slate-700 border-slate-200',
  in_transit: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ready_for_pickup: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export const REPAIR_TYPE_STYLES = {
  repair: 'bg-orange-50 text-orange-700 border-orange-200',
  maintenance: 'bg-blue-50 text-blue-700 border-blue-200',
  inspection: 'bg-purple-50 text-purple-700 border-purple-200',
  calibration: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

export const REPAIR_TYPES = ['repair', 'maintenance', 'inspection', 'calibration'];

// ═══ Error Reports ═══
export const ERROR_REPORT_STATUS_STYLES = {
  new:        'bg-red-100 text-red-700 border-red-200',
  reviewing:  'bg-amber-100 text-amber-700 border-amber-200',
  fixed:      'bg-green-100 text-green-700 border-green-200',
  dismissed:  'bg-slate-100 text-slate-500 border-slate-200',
};

export const ERROR_SEVERITY_STYLES = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-amber-100 text-amber-700 border-amber-200',
  low:      'bg-blue-100 text-blue-700 border-blue-200',
  unknown:  'bg-slate-100 text-slate-500 border-slate-200',
};
