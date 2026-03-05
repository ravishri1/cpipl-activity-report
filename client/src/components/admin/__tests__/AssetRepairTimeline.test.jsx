/**
 * Component Tests for AssetRepairTimeline
 * Tests RepairStatusStepper, RepairCard, RepairDetailPanel, and main component
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RepairStatusStepper,
  RepairCard,
  AssetRepairTimeline,
} from './AssetRepairTimeline';

// Mock API module
vi.mock('../../utils/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

// Mock hooks
vi.mock('../../hooks/useFetch', () => ({
  default: () => ({
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useApi', () => ({
  default: () => ({
    execute: vi.fn(),
    loading: false,
    error: null,
    success: null,
  }),
}));

describe('RepairStatusStepper Component', () => {
  const mockRepair = {
    id: 1,
    status: 'in_progress',
    assetName: 'Laptop A',
  };

  test('should render all 5 status steps', () => {
    const { container } = render(<RepairStatusStepper repair={mockRepair} />);
    const steps = container.querySelectorAll('[data-testid="stepper-step"]');
    expect(steps.length).toBe(5);
  });

  test('should highlight current status step', () => {
    const { container } = render(
      <RepairStatusStepper repair={{ ...mockRepair, status: 'in_transit' }} />
    );
    const steps = container.querySelectorAll('[data-testid="stepper-step"]');
    // in_transit is the 2nd step
    expect(steps[1]).toHaveClass('bg-blue-600');
  });

  test('should show checkmark for completed steps', () => {
    const { container } = render(
      <RepairStatusStepper repair={{ ...mockRepair, status: 'completed' }} />
    );
    const checkmarks = container.querySelectorAll('[data-testid="checkmark"]');
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  test('should disable future status steps', () => {
    const { container } = render(<RepairStatusStepper repair={mockRepair} />);
    const steps = container.querySelectorAll('[data-testid="stepper-step"]');
    // Steps after 'in_progress' should be disabled
    expect(steps[3]).toHaveClass('opacity-50');
    expect(steps[4]).toHaveClass('opacity-50');
  });

  test('should render status labels', () => {
    render(<RepairStatusStepper repair={mockRepair} />);
    expect(screen.getByText('Initiated')).toBeInTheDocument();
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  test('should handle completed status', () => {
    const { container } = render(
      <RepairStatusStepper repair={{ ...mockRepair, status: 'completed' }} />
    );
    const steps = container.querySelectorAll('[data-testid="stepper-step"]');
    // All steps should have checkmarks
    steps.forEach((step) => {
      expect(step).toHaveClass('bg-green-600');
    });
  });
});

describe('RepairCard Component', () => {
  const mockRepair = {
    id: 1,
    assetId: 100,
    asset: {
      name: 'Laptop A',
      serialNumber: 'LAP-001',
    },
    repairType: 'maintenance',
    status: 'in_progress',
    sentOutDate: '2026-02-20',
    expectedReturnDate: '2026-03-10',
    actualReturnDate: null,
    daysOverdue: 0,
    vendor: 'Tech Repair Co',
  };

  test('should render repair card with asset information', () => {
    render(<RepairCard repair={mockRepair} onSelect={vi.fn()} />);
    expect(screen.getByText('Laptop A')).toBeInTheDocument();
    expect(screen.getByText('LAP-001')).toBeInTheDocument();
  });

  test('should display repair type badge', () => {
    render(<RepairCard repair={mockRepair} onSelect={vi.fn()} />);
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });

  test('should display status badge', () => {
    render(<RepairCard repair={mockRepair} onSelect={vi.fn()} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  test('should show sent out and expected return dates', () => {
    render(<RepairCard repair={mockRepair} onSelect={vi.fn()} />);
    expect(screen.getByText(/Sent:/)).toBeInTheDocument();
    expect(screen.getByText(/Expected:/)).toBeInTheDocument();
  });

  test('should highlight overdue repairs in red', () => {
    const overdueRepair = { ...mockRepair, daysOverdue: 5, status: 'in_progress' };
    const { container } = render(<RepairCard repair={overdueRepair} onSelect={vi.fn()} />);
    const card = container.querySelector('[data-testid="repair-card"]');
    expect(card).toHaveClass('border-red-300');
  });

  test('should show overdue indicator with days', () => {
    const overdueRepair = { ...mockRepair, daysOverdue: 5 };
    render(<RepairCard repair={overdueRepair} onSelect={vi.fn()} />);
    expect(screen.getByText(/5 days overdue/)).toBeInTheDocument();
  });

  test('should show color-coded urgency indicator', () => {
    const { container: normalContainer } = render(
      <RepairCard repair={{ ...mockRepair, daysOverdue: 0 }} onSelect={vi.fn()} />
    );
    expect(normalContainer.querySelector('[data-testid="urgency-indicator"]')).toHaveClass(
      'bg-slate-300'
    );

    const { container: alertContainer } = render(
      <RepairCard repair={{ ...mockRepair, daysOverdue: 3 }} onSelect={vi.fn()} />
    );
    expect(alertContainer.querySelector('[data-testid="urgency-indicator"]')).toHaveClass(
      'bg-orange-400'
    );

    const { container: criticalContainer } = render(
      <RepairCard repair={{ ...mockRepair, daysOverdue: 20 }} onSelect={vi.fn()} />
    );
    expect(criticalContainer.querySelector('[data-testid="urgency-indicator"]')).toHaveClass(
      'bg-red-600'
    );
  });

  test('should call onSelect when clicked', async () => {
    const onSelect = vi.fn();
    render(<RepairCard repair={mockRepair} onSelect={onSelect} isSelected={false} />);

    const card = screen.getByText('Laptop A').closest('[data-testid="repair-card"]');
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledWith(mockRepair.id);
  });

  test('should show selected state visually', () => {
    const { container } = render(
      <RepairCard repair={mockRepair} onSelect={vi.fn()} isSelected={true} />
    );
    const card = container.querySelector('[data-testid="repair-card"]');
    expect(card).toHaveClass('ring-2', 'ring-blue-500');
  });

  test('should display vendor name if available', () => {
    render(<RepairCard repair={mockRepair} onSelect={vi.fn()} />);
    expect(screen.getByText(/Tech Repair Co/)).toBeInTheDocument();
  });
});

describe('RepairDetailPanel Component', () => {
  const mockRepair = {
    id: 1,
    assetId: 100,
    asset: {
      name: 'Laptop A',
      serialNumber: 'LAP-001',
    },
    repairType: 'maintenance',
    status: 'in_progress',
    sentOutDate: '2026-02-20',
    expectedReturnDate: '2026-03-10',
    actualReturnDate: null,
    daysOverdue: 0,
    issueDescription: 'Annual maintenance',
    vendor: 'Tech Repair Co',
    vendorPhone: '9876543210',
    vendorEmail: 'tech@repair.com',
    vendorLocation: 'Downtown',
    estimatedCost: 5000,
    actualCost: null,
    notes: 'Routine service',
    timeline: [
      {
        id: 1,
        oldStatus: null,
        newStatus: 'initiated',
        changedAt: '2026-02-20T10:00:00',
      },
    ],
  };

  test('should render detail panel with sticky header', () => {
    const { container } = render(
      <RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />
    );
    const header = container.querySelector('[data-testid="detail-header"]');
    expect(header).toHaveClass('sticky', 'top-0');
  });

  test('should display asset and repair information', () => {
    render(<RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />);
    expect(screen.getByText('Laptop A')).toBeInTheDocument();
    expect(screen.getByText('LAP-001')).toBeInTheDocument();
  });

  test('should show status stepper', () => {
    const { container } = render(
      <RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />
    );
    const stepper = container.querySelector('[data-testid="status-stepper"]');
    expect(stepper).toBeInTheDocument();
  });

  test('should display repair details in grid layout', () => {
    render(<RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />);
    expect(screen.getByText(/Repair Type/)).toBeInTheDocument();
    expect(screen.getByText(/Sent Out/)).toBeInTheDocument();
    expect(screen.getByText(/Expected Return/)).toBeInTheDocument();
    expect(screen.getByText(/Status/)).toBeInTheDocument();
  });

  test('should display vendor information', () => {
    render(<RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />);
    expect(screen.getByText('Tech Repair Co')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('tech@repair.com')).toBeInTheDocument();
    expect(screen.getByText('Downtown')).toBeInTheDocument();
  });

  test('should show issue description', () => {
    render(<RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />);
    expect(screen.getByText('Annual maintenance')).toBeInTheDocument();
  });

  test('should display cost information', () => {
    render(<RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />);
    expect(screen.getByText(/₹5,000/)).toBeInTheDocument();
  });

  test('should show expandable timeline', async () => {
    const { container } = render(
      <RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />
    );

    const timelineToggle = screen.getByText(/Timeline/i).closest('button');
    expect(timelineToggle).toBeInTheDocument();

    fireEvent.click(timelineToggle);
    await waitFor(() => {
      expect(screen.getByText(/Initiated/)).toBeInTheDocument();
    });
  });

  test('should have close button in header', () => {
    render(<RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />);
    const closeButton = screen.getByTestId('close-button');
    expect(closeButton).toBeInTheDocument();
  });

  test('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<RepairDetailPanel repair={mockRepair} onClose={onClose} />);

    const closeButton = screen.getByTestId('close-button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  test('should show update status button for incomplete repairs', () => {
    render(<RepairDetailPanel repair={mockRepair} onClose={vi.fn()} />);
    expect(screen.getByText(/Update Status/)).toBeInTheDocument();
  });

  test('should hide update status button for completed repairs', () => {
    const completedRepair = { ...mockRepair, status: 'completed' };
    render(<RepairDetailPanel repair={completedRepair} onClose={vi.fn()} />);
    expect(screen.queryByText(/Update Status/)).not.toBeInTheDocument();
  });

  test('should display close/completion button for ready repairs', () => {
    const readyRepair = { ...mockRepair, status: 'ready_for_pickup' };
    render(<RepairDetailPanel repair={readyRepair} onClose={vi.fn()} />);
    expect(screen.getByText(/Complete Repair/)).toBeInTheDocument();
  });

  test('should handle status update callback', async () => {
    const onStatusChange = vi.fn();
    render(
      <RepairDetailPanel
        repair={mockRepair}
        onClose={vi.fn()}
        onStatusChange={onStatusChange}
      />
    );

    const updateButton = screen.getByText(/Update Status/);
    fireEvent.click(updateButton);

    // Simulate status selection
    await waitFor(() => {
      const nextStatusButton = screen.getByText(/In Transit/);
      fireEvent.click(nextStatusButton);
    });

    expect(onStatusChange).toHaveBeenCalled();
  });
});

describe('AssetRepairTimeline Main Component', () => {
  const mockRepairs = [
    {
      id: 1,
      assetId: 1,
      asset: { name: 'Laptop A' },
      repairType: 'maintenance',
      status: 'in_progress',
      daysOverdue: 0,
      sentOutDate: '2026-02-20',
      expectedReturnDate: '2026-03-10',
    },
    {
      id: 2,
      assetId: 2,
      asset: { name: 'Printer B' },
      repairType: 'repair',
      status: 'initiated',
      daysOverdue: 5,
      sentOutDate: '2026-02-28',
      expectedReturnDate: '2026-03-05',
    },
    {
      id: 3,
      assetId: 3,
      asset: { name: 'Monitor C' },
      repairType: 'inspection',
      status: 'completed',
      daysOverdue: 0,
      sentOutDate: '2026-02-01',
      expectedReturnDate: '2026-02-15',
    },
  ];

  test('should render header with filter tabs', () => {
    render(<AssetRepairTimeline />);
    expect(screen.getByText(/All Repairs/)).toBeInTheDocument();
  });

  test('should display status filter tabs', () => {
    render(<AssetRepairTimeline />);
    expect(screen.getByText(/All/)).toBeInTheDocument();
    expect(screen.getByText(/Initiated/)).toBeInTheDocument();
    expect(screen.getByText(/In Transit/)).toBeInTheDocument();
    expect(screen.getByText(/In Progress/)).toBeInTheDocument();
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  test('should show overdue toggle checkbox', () => {
    render(<AssetRepairTimeline />);
    const checkbox = screen.getByRole('checkbox', { name: /Overdue Only/i });
    expect(checkbox).toBeInTheDocument();
  });

  test('should filter repairs by status', async () => {
    render(<AssetRepairTimeline />);

    // Click on 'In Progress' tab
    fireEvent.click(screen.getByText(/In Progress/));

    await waitFor(() => {
      expect(screen.getByText('Laptop A')).toBeInTheDocument();
      expect(screen.queryByText('Printer B')).not.toBeInTheDocument();
    });
  });

  test('should filter repairs by overdue status', async () => {
    render(<AssetRepairTimeline />);

    const checkbox = screen.getByRole('checkbox', { name: /Overdue Only/i });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText('Printer B')).toBeInTheDocument(); // Has daysOverdue: 5
      expect(screen.queryByText('Laptop A')).not.toBeInTheDocument(); // Has daysOverdue: 0
    });
  });

  test('should display repair cards in grid', () => {
    render(<AssetRepairTimeline />);
    const grid = screen.getByTestId('repair-grid');
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2');
  });

  test('should show detail panel when repair card is clicked', async () => {
    render(<AssetRepairTimeline />);

    const laptopCard = screen.getByText('Laptop A').closest('[data-testid="repair-card"]');
    fireEvent.click(laptopCard);

    await waitFor(() => {
      const detailPanel = screen.getByTestId('detail-panel');
      expect(detailPanel).toBeInTheDocument();
    });
  });

  test('should close detail panel when close button is clicked', async () => {
    render(<AssetRepairTimeline />);

    // Open detail panel
    fireEvent.click(screen.getByText('Laptop A').closest('[data-testid="repair-card"]'));

    await waitFor(() => {
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
    });
  });

  test('should show empty state when no repairs', () => {
    render(<AssetRepairTimeline data={[]} />);
    expect(screen.getByText(/No repairs found/)).toBeInTheDocument();
  });

  test('should show empty state for filtered results', async () => {
    render(<AssetRepairTimeline data={mockRepairs} />);

    fireEvent.click(screen.getByText(/Initiated/));

    await waitFor(() => {
      // Only Printer B has status 'initiated'
      expect(screen.getByText('Printer B')).toBeInTheDocument();
    });
  });

  test('should handle refresh of repair list', async () => {
    const { rerender } = render(<AssetRepairTimeline />);

    // Simulate data update
    const updatedRepairs = [
      ...mockRepairs,
      {
        id: 4,
        assetId: 4,
        asset: { name: 'Scanner D' },
        status: 'in_transit',
        daysOverdue: 0,
      },
    ];

    rerender(<AssetRepairTimeline data={updatedRepairs} />);

    await waitFor(() => {
      expect(screen.getByText('Scanner D')).toBeInTheDocument();
    });
  });

  test('should display loading spinner while fetching', () => {
    render(<AssetRepairTimeline loading={true} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('should display error message if fetch fails', () => {
    const error = 'Failed to load repairs';
    render(<AssetRepairTimeline error={error} />);
    expect(screen.getByText(error)).toBeInTheDocument();
  });

  test('should combine filters (status AND overdue)', async () => {
    render(<AssetRepairTimeline data={mockRepairs} />);

    // Filter to in_progress repairs only
    fireEvent.click(screen.getByText(/In Progress/));

    // Enable overdue only
    const checkbox = screen.getByRole('checkbox', { name: /Overdue Only/i });
    fireEvent.click(checkbox);

    await waitFor(() => {
      // Should show no repairs (Laptop A is in_progress but not overdue)
      expect(screen.getByText(/No repairs found/)).toBeInTheDocument();
    });
  });
});

describe('Accessibility Tests', () => {
  test('should have proper heading hierarchy', () => {
    render(<AssetRepairTimeline />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  test('should have keyboard navigation support', async () => {
    const user = userEvent.setup();
    render(<AssetRepairTimeline />);

    const tabButtons = screen.getAllByRole('button', { name: /status/i });
    await user.tab();

    expect(tabButtons[0]).toHaveFocus();
  });

  test('should have ARIA labels for interactive elements', () => {
    render(<AssetRepairTimeline />);
    const closeButton = screen.getByTestId('close-button');
    expect(closeButton).toHaveAttribute('aria-label');
  });

  test('should announce overdue status to screen readers', () => {
    render(<AssetRepairTimeline />);
    const overdueRepair = screen.getByTestId('urgency-indicator');
    expect(overdueRepair).toHaveAttribute('aria-label');
  });
});
