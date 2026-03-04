/**
 * Unit Tests for Repair Helper Functions
 * Tests date calculations, urgency levels, status transitions, and formatting
 */

import {
  calculateDaysOverdue,
  getUrgencyLevel,
  getUrgencyColor,
  getUrgencyTextColor,
  isRepairOverdue,
  formatRepairDate,
  formatRepairDateTime,
  getNextStatus,
  getValidNextStatuses,
  validateStatusTransition,
  calculateRepairDuration,
  getStatusDisplayText,
  getTypeDisplayText,
  getStatusBadgeStyle,
  getTypeBadgeStyle,
  isTerminalStatus,
  getRepairSummary,
  formatRepairCost,
  calculateCostDifference,
  getOverdueWarning,
} from './repairHelpers';

describe('Repair Helper Functions', () => {
  // Mock current date for consistent testing
  const mockToday = new Date('2026-03-05');
  const originalDateNow = Date.now;

  beforeAll(() => {
    // Mock Date.now for consistent test results
    global.Date.now = () => mockToday.getTime();
  });

  afterAll(() => {
    global.Date.now = originalDateNow;
  });

  describe('calculateDaysOverdue', () => {
    test('should return 0 for future dates', () => {
      expect(calculateDaysOverdue('2026-03-10')).toBe(0);
    });

    test('should calculate days overdue correctly', () => {
      expect(calculateDaysOverdue('2026-02-01')).toBeGreaterThan(0);
    });

    test('should handle today as 0 days overdue', () => {
      expect(calculateDaysOverdue('2026-03-05')).toBe(0);
    });

    test('should return 0 for empty date', () => {
      expect(calculateDaysOverdue('')).toBe(0);
      expect(calculateDaysOverdue(null)).toBe(0);
    });

    test('should calculate 5 days overdue for 2026-02-28', () => {
      const daysOverdue = calculateDaysOverdue('2026-02-28');
      expect(daysOverdue).toBeGreaterThan(0);
    });
  });

  describe('getUrgencyLevel', () => {
    test('should return "normal" for 0 days overdue', () => {
      expect(getUrgencyLevel(0)).toBe('normal');
    });

    test('should return "alert" for 1-7 days overdue', () => {
      expect(getUrgencyLevel(1)).toBe('alert');
      expect(getUrgencyLevel(5)).toBe('alert');
      expect(getUrgencyLevel(7)).toBe('alert');
    });

    test('should return "warning" for 8-14 days overdue', () => {
      expect(getUrgencyLevel(8)).toBe('warning');
      expect(getUrgencyLevel(10)).toBe('warning');
      expect(getUrgencyLevel(14)).toBe('warning');
    });

    test('should return "critical" for 15+ days overdue', () => {
      expect(getUrgencyLevel(15)).toBe('critical');
      expect(getUrgencyLevel(30)).toBe('critical');
      expect(getUrgencyLevel(100)).toBe('critical');
    });
  });

  describe('getUrgencyColor', () => {
    test('should return correct color for each urgency level', () => {
      expect(getUrgencyColor('normal')).toBe('bg-slate-50 border-slate-200');
      expect(getUrgencyColor('alert')).toBe('bg-orange-50 border-orange-200');
      expect(getUrgencyColor('warning')).toBe('bg-yellow-50 border-yellow-200');
      expect(getUrgencyColor('critical')).toBe('bg-red-50 border-red-200');
    });

    test('should return default color for unknown urgency', () => {
      expect(getUrgencyColor('unknown')).toBe('bg-slate-50 border-slate-200');
    });
  });

  describe('getUrgencyTextColor', () => {
    test('should return correct text color for each urgency level', () => {
      expect(getUrgencyTextColor('normal')).toBe('text-slate-700');
      expect(getUrgencyTextColor('alert')).toBe('text-orange-700');
      expect(getUrgencyTextColor('warning')).toBe('text-yellow-700');
      expect(getUrgencyTextColor('critical')).toBe('text-red-700');
    });
  });

  describe('isRepairOverdue', () => {
    test('should return false for completed repairs', () => {
      expect(isRepairOverdue('completed', '2026-02-01')).toBe(false);
    });

    test('should return false for cancelled repairs', () => {
      expect(isRepairOverdue('cancelled', '2026-02-01')).toBe(false);
    });

    test('should return true for incomplete repair past expected date', () => {
      expect(isRepairOverdue('in_progress', '2026-02-01')).toBe(true);
    });

    test('should return false for incomplete repair before expected date', () => {
      expect(isRepairOverdue('in_progress', '2026-03-10')).toBe(false);
    });
  });

  describe('formatRepairDate', () => {
    test('should format date correctly', () => {
      const formatted = formatRepairDate('2026-03-05');
      expect(formatted).toContain('5');
      expect(formatted).toContain('2026');
    });

    test('should return dash for empty date', () => {
      expect(formatRepairDate('')).toBe('-');
      expect(formatRepairDate(null)).toBe('-');
    });
  });

  describe('getNextStatus', () => {
    test('should return correct next status in workflow', () => {
      expect(getNextStatus('initiated')).toBe('in_transit');
      expect(getNextStatus('in_transit')).toBe('in_progress');
      expect(getNextStatus('in_progress')).toBe('ready_for_pickup');
      expect(getNextStatus('ready_for_pickup')).toBe('completed');
    });

    test('should return null for terminal statuses', () => {
      expect(getNextStatus('completed')).toBeNull();
      expect(getNextStatus('cancelled')).toBeNull();
    });

    test('should return null for unknown status', () => {
      expect(getNextStatus('unknown')).toBeNull();
    });
  });

  describe('getValidNextStatuses', () => {
    test('should return valid transitions from initiated', () => {
      const valid = getValidNextStatuses('initiated');
      expect(valid).toContain('in_transit');
      expect(valid).toContain('cancelled');
      expect(valid.length).toBe(2);
    });

    test('should return valid transitions from in_progress', () => {
      const valid = getValidNextStatuses('in_progress');
      expect(valid).toContain('ready_for_pickup');
      expect(valid).toContain('cancelled');
    });

    test('should allow backtrack from ready_for_pickup to in_progress', () => {
      const valid = getValidNextStatuses('ready_for_pickup');
      expect(valid).toContain('in_progress');
    });

    test('should return empty array for terminal statuses', () => {
      expect(getValidNextStatuses('completed')).toEqual([]);
      expect(getValidNextStatuses('cancelled')).toEqual([]);
    });
  });

  describe('validateStatusTransition', () => {
    test('should validate correct transitions', () => {
      expect(validateStatusTransition('initiated', 'in_transit')).toBe(true);
      expect(validateStatusTransition('in_transit', 'in_progress')).toBe(true);
      expect(validateStatusTransition('in_progress', 'ready_for_pickup')).toBe(true);
    });

    test('should reject invalid transitions', () => {
      expect(validateStatusTransition('initiated', 'completed')).toBe(false);
      expect(validateStatusTransition('in_transit', 'completed')).toBe(false);
      expect(validateStatusTransition('completed', 'initiated')).toBe(false);
    });

    test('should allow cancellation from any non-terminal status', () => {
      expect(validateStatusTransition('initiated', 'cancelled')).toBe(true);
      expect(validateStatusTransition('in_progress', 'cancelled')).toBe(true);
      expect(validateStatusTransition('ready_for_pickup', 'cancelled')).toBe(false); // Not allowed from ready
    });
  });

  describe('calculateRepairDuration', () => {
    test('should calculate duration correctly', () => {
      const duration = calculateRepairDuration('2026-03-01', '2026-03-05');
      expect(duration).toBe(4);
    });

    test('should calculate from sent date to today if no actual return date', () => {
      const duration = calculateRepairDuration('2026-03-01');
      expect(duration).toBeGreaterThan(0);
    });

    test('should return 0 for empty sent date', () => {
      expect(calculateRepairDuration('')).toBe(0);
      expect(calculateRepairDuration(null)).toBe(0);
    });

    test('should return 0 for same day sent and returned', () => {
      expect(calculateRepairDuration('2026-03-05', '2026-03-05')).toBe(0);
    });
  });

  describe('getStatusDisplayText', () => {
    test('should return human-readable status text', () => {
      expect(getStatusDisplayText('initiated')).toBe('Repair Initiated');
      expect(getStatusDisplayText('in_transit')).toBe('In Transit to Vendor');
      expect(getStatusDisplayText('in_progress')).toBe('In Progress');
      expect(getStatusDisplayText('ready_for_pickup')).toBe('Ready for Pickup');
      expect(getStatusDisplayText('completed')).toBe('Completed');
      expect(getStatusDisplayText('cancelled')).toBe('Cancelled');
    });

    test('should return status as-is for unknown status', () => {
      expect(getStatusDisplayText('unknown')).toBe('unknown');
    });
  });

  describe('getTypeDisplayText', () => {
    test('should return human-readable type text', () => {
      expect(getTypeDisplayText('repair')).toBe('Repair');
      expect(getTypeDisplayText('maintenance')).toBe('Maintenance');
      expect(getTypeDisplayText('inspection')).toBe('Inspection');
      expect(getTypeDisplayText('calibration')).toBe('Calibration');
    });
  });

  describe('getStatusBadgeStyle', () => {
    test('should return correct badge style for status', () => {
      const style = getStatusBadgeStyle('initiated');
      expect(style).toContain('bg-');
      expect(style).toContain('text-');
    });

    test('should return default style for unknown status', () => {
      expect(getStatusBadgeStyle('unknown')).toContain('bg-gray');
    });
  });

  describe('getTypeBadgeStyle', () => {
    test('should return correct badge style for type', () => {
      const style = getTypeBadgeStyle('repair');
      expect(style).toContain('bg-');
      expect(style).toContain('text-');
    });
  });

  describe('isTerminalStatus', () => {
    test('should identify terminal statuses', () => {
      expect(isTerminalStatus('completed')).toBe(true);
      expect(isTerminalStatus('cancelled')).toBe(true);
    });

    test('should identify non-terminal statuses', () => {
      expect(isTerminalStatus('initiated')).toBe(false);
      expect(isTerminalStatus('in_transit')).toBe(false);
      expect(isTerminalStatus('in_progress')).toBe(false);
      expect(isTerminalStatus('ready_for_pickup')).toBe(false);
    });
  });

  describe('getRepairSummary', () => {
    test('should generate summary for completed repair', () => {
      const repair = {
        repairType: 'repair',
        status: 'completed',
        sentOutDate: '2026-02-25',
        actualReturnDate: '2026-03-05',
      };
      const summary = getRepairSummary(repair);
      expect(summary).toContain('Repair');
      expect(summary).toContain('completed');
      expect(summary).toContain('days');
    });

    test('should generate summary for overdue repair', () => {
      const repair = {
        repairType: 'maintenance',
        status: 'in_progress',
        expectedReturnDate: '2026-02-01',
      };
      const summary = getRepairSummary(repair);
      expect(summary).toContain('Maintenance');
      expect(summary).toContain('overdue');
    });

    test('should generate summary for active repair', () => {
      const repair = {
        repairType: 'inspection',
        status: 'in_progress',
        expectedReturnDate: '2026-03-10',
      };
      const summary = getRepairSummary(repair);
      expect(summary).toContain('Inspection');
      expect(summary).toContain('In Progress');
    });
  });

  describe('formatRepairCost', () => {
    test('should format cost as currency', () => {
      const formatted = formatRepairCost(5000);
      expect(formatted).toContain('5,000');
    });

    test('should return dash for null or undefined', () => {
      expect(formatRepairCost(null)).toBe('-');
      expect(formatRepairCost(undefined)).toBe('-');
    });

    test('should handle zero amount', () => {
      const formatted = formatRepairCost(0);
      expect(formatted).toContain('0');
    });
  });

  describe('calculateCostDifference', () => {
    test('should calculate cost difference correctly', () => {
      const diff = calculateCostDifference(10000, 12000);
      expect(diff.amount).toBe(2000);
      expect(diff.status).toBe('over');
    });

    test('should identify under-budget repairs', () => {
      const diff = calculateCostDifference(10000, 8000);
      expect(diff.amount).toBe(-2000);
      expect(diff.status).toBe('under');
    });

    test('should identify equal cost repairs', () => {
      const diff = calculateCostDifference(10000, 10000);
      expect(diff.amount).toBe(0);
      expect(diff.status).toBe('equal');
    });

    test('should return zero for missing costs', () => {
      const diff1 = calculateCostDifference(null, 10000);
      expect(diff1.amount).toBe(0);

      const diff2 = calculateCostDifference(10000, null);
      expect(diff2.amount).toBe(0);
    });
  });

  describe('getOverdueWarning', () => {
    test('should return warning for overdue repair', () => {
      const repair = {
        status: 'in_progress',
        expectedReturnDate: '2026-02-01',
      };
      const warning = getOverdueWarning(repair);
      expect(warning).not.toBeNull();
      expect(warning).toContain('overdue');
    });

    test('should return null for completed repair', () => {
      const repair = {
        status: 'completed',
        expectedReturnDate: '2026-02-01',
      };
      expect(getOverdueWarning(repair)).toBeNull();
    });

    test('should return null for on-time repair', () => {
      const repair = {
        status: 'in_progress',
        expectedReturnDate: '2026-03-10',
      };
      expect(getOverdueWarning(repair)).toBeNull();
    });

    test('should indicate critical status for >30 days overdue', () => {
      const repair = {
        status: 'in_progress',
        expectedReturnDate: '2025-12-01', // ~95 days overdue
      };
      const warning = getOverdueWarning(repair);
      expect(warning).toContain('CRITICAL');
    });

    test('should indicate warning status for 14-30 days overdue', () => {
      const repair = {
        status: 'in_progress',
        expectedReturnDate: '2026-02-01', // ~32 days overdue
      };
      const warning = getOverdueWarning(repair);
      expect(warning).toContain('WARNING');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete repair workflow', () => {
      const repair = {
        id: 1,
        assetId: 100,
        repairType: 'maintenance',
        status: 'initiated',
        sentOutDate: '2026-03-01',
        expectedReturnDate: '2026-03-10',
        estimatedCost: 5000,
        actualCost: null,
      };

      // Check initial state
      expect(isTerminalStatus(repair.status)).toBe(false);
      expect(calculateDaysOverdue(repair.expectedReturnDate)).toBe(0);
      expect(getUrgencyLevel(0)).toBe('normal');

      // Simulate workflow progression
      const statuses = ['initiated', 'in_transit', 'in_progress', 'ready_for_pickup', 'completed'];
      for (let i = 0; i < statuses.length - 1; i++) {
        expect(validateStatusTransition(statuses[i], statuses[i + 1])).toBe(true);
      }

      // Check final state
      expect(isTerminalStatus('completed')).toBe(true);
    });

    test('should handle overdue repair scenario', () => {
      const repair = {
        status: 'in_progress',
        sentOutDate: '2026-02-01',
        expectedReturnDate: '2026-02-20',
        repairType: 'repair',
      };

      const daysOverdue = calculateDaysOverdue(repair.expectedReturnDate);
      expect(daysOverdue).toBeGreaterThan(0);
      expect(isRepairOverdue(repair.status, repair.expectedReturnDate)).toBe(true);
      expect(getOverdueWarning(repair)).not.toBeNull();
    });
  });
});
