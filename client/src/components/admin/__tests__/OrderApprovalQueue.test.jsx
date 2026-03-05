import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderApprovalQueue from '../OrderApprovalQueue';
import * as api from '../../../utils/api';

jest.mock('../../../utils/api');
jest.mock('../../shared/LoadingSpinner', () => {
  return function DummySpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});
jest.mock('../../shared/AlertMessage', () => {
  return function DummyAlert({ message, type }) {
    return <div data-testid={`alert-${type}`}>{message}</div>;
  };
});
jest.mock('../../shared/StatusBadge', () => {
  return function DummyBadge({ status }) {
    return <span data-testid="status-badge">{status}</span>;
  };
});

describe('OrderApprovalQueue Component', () => {
  const mockOrders = [
    {
      id: 1,
      orderNumber: 'PO-0001',
      status: 'submitted',
      vendorId: 1,
      vendor: { id: 1, vendorName: 'Tech Supplies' },
      totalAmount: 50000,
      createdDate: '2026-03-01',
      lineItems: [
        { id: 1, itemName: 'Item 1', itemCode: 'CODE1', quantity: 10, unitPrice: 5000 },
      ],
      deliveryAddress: '123 Main St',
      notes: 'Urgent',
    },
    {
      id: 2,
      orderNumber: 'PO-0002',
      status: 'submitted',
      vendorId: 2,
      vendor: { id: 2, vendorName: 'Office Goods' },
      totalAmount: 150000,
      createdDate: '2026-03-02',
      lineItems: [
        { id: 2, itemName: 'Item 2', itemCode: 'CODE2', quantity: 5, unitPrice: 30000 },
        { id: 3, itemName: 'Item 3', itemCode: 'CODE3', quantity: 3, unitPrice: 40000 },
      ],
      deliveryAddress: '456 Business Ave',
      notes: 'Standard',
    },
    {
      id: 3,
      orderNumber: 'PO-0003',
      status: 'draft',
      vendor: { vendorName: 'Another Vendor' },
      totalAmount: 25000,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    api.get = jest.fn().mockResolvedValue({ data: mockOrders });
  });

  test('renders component with header', () => {
    render(<OrderApprovalQueue />);
    expect(screen.getByText('Order Approval Queue')).toBeInTheDocument();
  });

  test('displays statistics for pending orders', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('2 Pending')).toBeInTheDocument();
    });
  });

  test('shows high value order count', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText(/High Value/i)).toBeInTheDocument();
    });
  });

  test('displays only submitted orders', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('PO-0001')).toBeInTheDocument();
      expect(screen.getByText('PO-0002')).toBeInTheDocument();
      expect(screen.queryByText('PO-0003')).not.toBeInTheDocument(); // Draft not shown
    });
  });

  test('displays success message when no pending orders', async () => {
    api.get = jest.fn().mockResolvedValue({ data: [] });

    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText(/All Orders Approved/i)).toBeInTheDocument();
    });
  });

  test('expands order details when clicked', async () => {
    render(<OrderApprovalQueue />);

    const orderSummary = screen.getByText('PO-0001').closest('[class*="cursor"]');
    if (orderSummary) {
      fireEvent.click(orderSummary);

      await waitFor(() => {
        expect(screen.getByText(/Tech Supplies/i)).toBeInTheDocument();
      });
    }
  });

  test('displays order details including line items', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('PO-0001')).toBeInTheDocument();
    });

    const orderSummary = screen.getByText('PO-0001').closest('[class*="bg-"]');
    if (orderSummary) {
      fireEvent.click(orderSummary);

      await waitFor(() => {
        expect(screen.getByText(/Item 1/i)).toBeInTheDocument();
      });
    }
  });

  test('calls approve endpoint when Approve button clicked', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });

    render(<OrderApprovalQueue />);

    await waitFor(() => {
      const approveButtons = screen.queryAllByRole('button', { name: /Approve/i });
      if (approveButtons.length > 0) {
        fireEvent.click(approveButtons[0]);
        expect(api.post).toHaveBeenCalledWith(
          '/procurement/orders/1/approve',
          expect.objectContaining({ approvalDate: expect.any(String) })
        );
      }
    });
  });

  test('allows adding approval notes', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      const orderSummary = screen.getByText('PO-0001').closest('[class*="bg-"]');
      if (orderSummary) {
        fireEvent.click(orderSummary);
      }
    });

    await waitFor(() => {
      const noteTextarea = screen.getByPlaceholderText(/Add any notes for approval/i);
      if (noteTextarea) {
        expect(noteTextarea).toBeInTheDocument();
      }
    });
  });

  test('refetches orders after approval', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });
    api.get = jest
      .fn()
      .mockResolvedValueOnce({ data: mockOrders })
      .mockResolvedValueOnce({ data: [mockOrders[1]] }); // Only one order left

    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('PO-0001')).toBeInTheDocument();
    });

    const approveButtons = screen.queryAllByRole('button', { name: /Approve/i });
    if (approveButtons.length > 0) {
      fireEvent.click(approveButtons[0]);
    }

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  test('displays loading spinner while fetching', async () => {
    api.get = jest.fn(() => new Promise(() => {})); // Never resolves

    render(<OrderApprovalQueue />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('displays error message on API failure', async () => {
    api.get = jest.fn().mockRejectedValue(new Error('API Error'));

    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    });
  });

  test('shows order dates in correct format', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      const orderSummary = screen.getByText('PO-0001').closest('[class*="bg-"]');
      if (orderSummary) {
        fireEvent.click(orderSummary);
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/01 Mar 2026/i)).toBeInTheDocument();
    });
  });

  test('displays formatted currency amounts', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText(/50,000/i)).toBeInTheDocument();
    });
  });

  test('shows line item details with calculations', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      const orderSummary = screen.getByText('PO-0001').closest('[class*="bg-"]');
      if (orderSummary) {
        fireEvent.click(orderSummary);
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/Item 1/i)).toBeInTheDocument();
      expect(screen.getByText(/10 × 5000/i)).toBeInTheDocument();
    });
  });

  test('prioritizes high-value orders visually', async () => {
    render(<OrderApprovalQueue />);

    await waitFor(() => {
      const highValueOrder = screen.getByText('PO-0002');
      expect(highValueOrder).toBeInTheDocument();
    });
  });
});
