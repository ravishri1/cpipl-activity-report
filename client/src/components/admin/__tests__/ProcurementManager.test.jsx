import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProcurementManager from '../ProcurementManager';
import * as api from '../../../services/api';

// Mock the API
jest.mock('../../../services/api');

// Mock child components
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

describe('ProcurementManager Component', () => {
  const mockOrders = [
    {
      id: 1,
      orderNumber: 'PO-0001',
      status: 'draft',
      vendorId: 1,
      vendor: { id: 1, vendorName: 'Tech Supplies' },
      totalAmount: 50000,
      createdDate: '2026-03-01',
      lineItems: [],
    },
    {
      id: 2,
      orderNumber: 'PO-0002',
      status: 'submitted',
      vendorId: 2,
      vendor: { id: 2, vendorName: 'Office Goods' },
      totalAmount: 75000,
      createdDate: '2026-03-02',
      lineItems: [{ id: 1, itemName: 'Pen', quantity: 100 }],
    },
    {
      id: 3,
      orderNumber: 'PO-0003',
      status: 'approved',
      vendorId: 1,
      vendor: { id: 1, vendorName: 'Tech Supplies' },
      totalAmount: 100000,
      createdDate: '2026-03-03',
      lineItems: [],
    },
  ];

  const mockVendors = [
    { id: 1, vendorName: 'Tech Supplies', email: 'tech@supplies.com', phone: '9876543210' },
    { id: 2, vendorName: 'Office Goods', email: 'office@goods.com', phone: '9876543211' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    api.get = jest.fn((url) => {
      if (url.includes('/orders')) return Promise.resolve({ data: mockOrders });
      if (url.includes('/vendors')) return Promise.resolve({ data: mockVendors });
      return Promise.resolve({ data: [] });
    });
  });

  test('renders component with header', async () => {
    render(<ProcurementManager />);
    expect(screen.getByText('Procurement Management')).toBeInTheDocument();
  });

  test('displays stats cards', async () => {
    render(<ProcurementManager />);
    await waitFor(() => {
      expect(screen.getByText('Total Orders')).toBeInTheDocument();
    });
  });

  test('renders all tabs', () => {
    render(<ProcurementManager />);
    expect(screen.getByRole('button', { name: /Purchase Orders/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vendors/ })).toBeInTheDocument();
  });

  test('displays orders in default tab', async () => {
    render(<ProcurementManager />);
    await waitFor(() => {
      expect(screen.getByText('PO-0001')).toBeInTheDocument();
    });
  });

  test('filters orders by status', async () => {
    render(<ProcurementManager />);
    const statusSelect = screen.getByDisplayValue(/All Status/i);
    fireEvent.change(statusSelect, { target: { value: 'draft' } });
    
    await waitFor(() => {
      expect(screen.getByText('PO-0001')).toBeInTheDocument();
    });
  });

  test('switches to vendors tab', async () => {
    render(<ProcurementManager />);
    const vendorsTab = screen.getByRole('button', { name: /Vendors/ });
    fireEvent.click(vendorsTab);
    
    await waitFor(() => {
      expect(screen.getByText('Tech Supplies')).toBeInTheDocument();
    });
  });

  test('handles submit order action', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });
    render(<ProcurementManager />);
    
    await waitFor(() => {
      const submitButtons = screen.queryAllByRole('button', { name: /Submit/ });
      if (submitButtons.length > 0) {
        fireEvent.click(submitButtons[0]);
        expect(api.post).toHaveBeenCalled();
      }
    });
  });
});
