/**
 * Repair System Helper Functions
 * Utilities for date calculations, urgency levels, status transitions, and formatting
 */

import { REPAIR_STATUS_STYLES, REPAIR_TYPE_STYLES } from './constants';

/**
 * Calculate days overdue from expected return date
 * @param {string} expectedReturnDate - Expected return date in YYYY-MM-DD format
 * @returns {number} Number of days overdue (negative if not yet overdue)
 */
export const calculateDaysOverdue = (expectedReturnDate) => {
  if (!expectedReturnDate) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expected = new Date(expectedReturnDate);
  expected.setHours(0, 0, 0, 0);
  
  const diffTime = today - expected;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
};

/**
 * Determine urgency level based on days overdue
 * @param {number} daysOverdue - Number of days overdue
 * @returns {string} Urgency level: 'normal', 'alert', 'warning', or 'critical'
 */
export const getUrgencyLevel = (daysOverdue) => {
  if (daysOverdue === 0) return 'normal';
  if (daysOverdue <= 7) return 'alert';
  if (daysOverdue <= 14) return 'warning';
  return 'critical';
};

/**
 * Get color styles for urgency level
 * @param {string} urgency - Urgency level from getUrgencyLevel()
 * @returns {string} Tailwind CSS classes for background color
 */
export const getUrgencyColor = (urgency) => {
  const colors = {
    normal: 'bg-slate-50 border-slate-200',
    alert: 'bg-orange-50 border-orange-200', // 1-7 days
    warning: 'bg-yellow-50 border-yellow-200', // 8-14 days
    critical: 'bg-red-50 border-red-200', // 15+ days
  };
  return colors[urgency] || colors.normal;
};

/**
 * Get text color for urgency level
 * @param {string} urgency - Urgency level
 * @returns {string} Tailwind CSS text color classes
 */
export const getUrgencyTextColor = (urgency) => {
  const colors = {
    normal: 'text-slate-700',
    alert: 'text-orange-700',
    warning: 'text-yellow-700',
    critical: 'text-red-700',
  };
  return colors[urgency] || colors.normal;
};

/**
 * Check if repair is overdue based on status and expected return date
 * @param {string} status - Current repair status
 * @param {string} expectedReturnDate - Expected return date in YYYY-MM-DD format
 * @returns {boolean} True if repair is overdue and not completed
 */
export const isRepairOverdue = (status, expectedReturnDate) => {
  // Only incomplete repairs can be overdue
  if (status === 'completed' || status === 'cancelled') {
    return false;
  }
  return calculateDaysOverdue(expectedReturnDate) > 0;
};

/**
 * Format date for repair display
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Formatted date (e.g., "5 Mar, 2026")
 */
export const formatRepairDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format date with time for detailed display
 * @param {string} dateStr - ISO datetime string
 * @returns {string} Formatted date and time
 */
export const formatRepairDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get the next valid status in repair workflow
 * @param {string} currentStatus - Current repair status
 * @returns {string|null} Next status or null if workflow complete
 */
export const getNextStatus = (currentStatus) => {
  const workflow = {
    initiated: 'in_transit',
    in_transit: 'in_progress',
    in_progress: 'ready_for_pickup',
    ready_for_pickup: 'completed',
    completed: null,
    cancelled: null,
  };
  return workflow[currentStatus] || null;
};

/**
 * Get all possible next statuses from current status
 * @param {string} currentStatus - Current repair status
 * @returns {string[]} Array of valid next statuses
 */
export const getValidNextStatuses = (currentStatus) => {
  const validTransitions = {
    initiated: ['in_transit', 'cancelled'],
    in_transit: ['in_progress', 'cancelled'],
    in_progress: ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['completed', 'in_progress'], // Can go back if issue found
    completed: [],
    cancelled: [],
  };
  return validTransitions[currentStatus] || [];
};

/**
 * Validate if status transition is allowed
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired status
 * @returns {boolean} True if transition is valid
 */
export const validateStatusTransition = (fromStatus, toStatus) => {
  return getValidNextStatuses(fromStatus).includes(toStatus);
};

/**
 * Calculate repair duration in days
 * @param {string} sentOutDate - Date asset sent for repair (YYYY-MM-DD)
 * @param {string} actualReturnDate - Date asset was returned (YYYY-MM-DD, optional)
 * @returns {number} Number of days in repair
 */
export const calculateRepairDuration = (sentOutDate, actualReturnDate) => {
  if (!sentOutDate) return 0;
  
  const startDate = new Date(sentOutDate);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = actualReturnDate ? new Date(actualReturnDate) : new Date();
  endDate.setHours(0, 0, 0, 0);
  
  const diffTime = endDate - startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

/**
 * Get display text for repair status
 * @param {string} status - Repair status
 * @returns {string} Human-readable status text
 */
export const getStatusDisplayText = (status) => {
  const displayTexts = {
    initiated: 'Repair Initiated',
    in_transit: 'In Transit to Vendor',
    in_progress: 'In Progress',
    ready_for_pickup: 'Ready for Pickup',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return displayTexts[status] || status;
};

/**
 * Get display text for repair type
 * @param {string} type - Repair type
 * @returns {string} Human-readable type text
 */
export const getTypeDisplayText = (type) => {
  const displayTexts = {
    repair: 'Repair',
    maintenance: 'Maintenance',
    inspection: 'Inspection',
    calibration: 'Calibration',
  };
  return displayTexts[type] || type;
};

/**
 * Get Tailwind CSS classes for status badge
 * @param {string} status - Repair status
 * @returns {string} Tailwind CSS classes for StatusBadge component
 */
export const getStatusBadgeStyle = (status) => {
  return REPAIR_STATUS_STYLES[status] || 'bg-gray-100 text-gray-700 border-gray-200';
};

/**
 * Get Tailwind CSS classes for type badge
 * @param {string} type - Repair type
 * @returns {string} Tailwind CSS classes for StatusBadge component
 */
export const getTypeBadgeStyle = (type) => {
  return REPAIR_TYPE_STYLES[type] || 'bg-gray-50 text-gray-700 border-gray-200';
};

/**
 * Check if repair status is in terminal state
 * @param {string} status - Repair status
 * @returns {boolean} True if status is completed or cancelled
 */
export const isTerminalStatus = (status) => {
  return status === 'completed' || status === 'cancelled';
};

/**
 * Get repair summary for display
 * @param {Object} repair - Repair object
 * @returns {string} Summary text describing repair
 */
export const getRepairSummary = (repair) => {
  const type = getTypeDisplayText(repair.repairType);
  const daysOverdue = calculateDaysOverdue(repair.expectedReturnDate);
  
  if (repair.status === 'completed') {
    const duration = calculateRepairDuration(repair.sentOutDate, repair.actualReturnDate);
    return `${type} completed in ${duration} days`;
  }
  
  if (daysOverdue > 0) {
    return `${type} overdue by ${daysOverdue} days`;
  }
  
  return `${type} - ${getStatusDisplayText(repair.status)}`;
};

/**
 * Format currency for cost display
 * @param {number} amount - Amount in rupees
 * @returns {string} Formatted currency string
 */
export const formatRepairCost = (amount) => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Calculate cost difference for display
 * @param {number} estimatedCost - Estimated cost
 * @param {number} actualCost - Actual cost
 * @returns {Object} Difference object { amount, percentage, status }
 */
export const calculateCostDifference = (estimatedCost, actualCost) => {
  if (!estimatedCost || !actualCost) {
    return { amount: 0, percentage: 0, status: 'none' };
  }
  
  const diff = actualCost - estimatedCost;
  const percentage = ((diff / estimatedCost) * 100).toFixed(1);
  
  return {
    amount: diff,
    percentage: parseFloat(percentage),
    status: diff === 0 ? 'equal' : diff > 0 ? 'over' : 'under',
  };
};

/**
 * Get warning message for overdue repairs
 * @param {Object} repair - Repair object
 * @returns {string|null} Warning message or null
 */
export const getOverdueWarning = (repair) => {
  if (isTerminalStatus(repair.status)) {
    return null;
  }
  
  const daysOverdue = calculateDaysOverdue(repair.expectedReturnDate);
  
  if (daysOverdue > 30) {
    return `⚠️ CRITICAL: Repair overdue by ${daysOverdue} days!`;
  }
  
  if (daysOverdue > 14) {
    return `⚠️ WARNING: Repair overdue by ${daysOverdue} days`;
  }
  
  if (daysOverdue > 0) {
    return `⚠️ ALERT: Repair is ${daysOverdue} days overdue`;
  }
  
  return null;
};
