import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderForm from '../OrderForm';
import * as api from '../../../utils/api';

jest.mock('../../../utils/api');
jest.mock('../../shared/AlertMessage', () => {
  return function DummyAlert({ message, type }) {
    return <div data-testid={`alert-${type}`}>{message}</div>;
  };
});
jest.mock('../../shared/LoadingSpinner', () => {
  return function DummySpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

describe('OrderForm Component', () => {
  const mockVendors = [
    { id: 1, vendorName: 'Tech Supplies', email: 'tech@supplies.com', phone: '9876543210' },
    { id: 2, vendorName: 'Office Goods', email: 'office@goods.com', phone: '9876543211' },
  ];

  const mockOnSuccess = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    api.get = jest.fn((url) => {
      if (url.includes('/vendors')) return Promise.resolve({ data: mockVendors });
      return Promise.resolve({ data: {} });
    });
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(
      <OrderForm isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders when isOpen is true', () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.getByText('Create Purchase Order')).toBeInTheDocument();
  });

  test('displays all order fields', async () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Vendor/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Total Amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Order Date/i)).toBeInTheDocument();
    });
  });

  test('loads vendors on mount', async () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      const vendorSelect = screen.getByDisplayValue(/Select a vendor/i);
      expect(vendorSelect).toBeInTheDocument();
    });
  });

  test('allows adding line items', async () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Item Code/i)).toBeInTheDocument();
    });
  });

  test('adds line item when Add button is clicked', async () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Open line item form
    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    // Fill in line item details
    const itemCodeInput = screen.getByPlaceholderText(/Item Code/i);
    const itemNameInput = screen.getByPlaceholderText(/Item Name/i);
    const quantityInput = screen.getByPlaceholderText(/Qty/i);
    const unitPriceInput = screen.getByPlaceholderText(/Unit Price/i);

    await userEvent.type(itemCodeInput, 'ITEM001');
    await userEvent.type(itemNameInput, 'Test Item');
    await userEvent.type(quantityInput, '10');
    await userEvent.type(unitPriceInput, '1000');

    const addButton = screen.getAllByRole('button', { name: /Add/i })[1]; // Second Add button
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });
  });

  test('removes line item when Remove button is clicked', async () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Add line item first
    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await userEvent.type(screen.getByPlaceholderText(/Item Code/i), 'ITEM001');
    await userEvent.type(screen.getByPlaceholderText(/Item Name/i), 'Test Item');
    await userEvent.type(screen.getByPlaceholderText(/Qty/i), '10');
    await userEvent.type(screen.getByPlaceholderText(/Unit Price/i), '1000');

    const addButton = screen.getAllByRole('button', { name: /Add/i })[1];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });

    // Remove line item
    const removeButton = screen.getByRole('button', { name: /Remove/i });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('Test Item')).not.toBeInTheDocument();
    });
  });

  test('calculates total amount from line items', async () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await userEvent.type(screen.getByPlaceholderText(/Item Code/i), 'ITEM001');
    await userEvent.type(screen.getByPlaceholderText(/Item Name/i), 'Test Item');
    await userEvent.type(screen.getByPlaceholderText(/Qty/i), '10');
    await userEvent.type(screen.getByPlaceholderText(/Unit Price/i), '1000');

    const addButton = screen.getAllByRole('button', { name: /Add/i })[1];
    fireEvent.click(addButton);

    await waitFor(() => {
      const totalAmountInput = screen.getByDisplayValue('10000');
      expect(totalAmountInput).toBeInTheDocument();
    });
  });

  test('validates form before submission', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const createButton = screen.getByRole('button', { name: /Create Order/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  test('requires at least one line item', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await userEvent.selectOptions(screen.getByLabelText(/Vendor/i), '1');
    await userEvent.type(screen.getByLabelText(/Total Amount/i), '10000');

    const createButton = screen.getByRole('button', { name: /Create Order/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createButton).toBeDisabled();
    });

    alertSpy.mockRestore();
  });

  test('submits form with correct data', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });

    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Select vendor
    await userEvent.selectOptions(screen.getByLabelText(/Vendor/i), '1');

    // Add line item
    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await userEvent.type(screen.getByPlaceholderText(/Item Code/i), 'ITEM001');
    await userEvent.type(screen.getByPlaceholderText(/Item Name/i), 'Test Item');
    await userEvent.type(screen.getByPlaceholderText(/Qty/i), '10');
    await userEvent.type(screen.getByPlaceholderText(/Unit Price/i), '1000');

    const addButton = screen.getAllByRole('button', { name: /Add/i })[1];
    fireEvent.click(addButton);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /Create Order/i });
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/procurement/orders',
        expect.objectContaining({
          vendorId: 1,
          status: 'draft',
        })
      );
    });
  });

  test('closes form after successful submission', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });

    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await userEvent.selectOptions(screen.getByLabelText(/Vendor/i), '1');

    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await userEvent.type(screen.getByPlaceholderText(/Item Code/i), 'ITEM001');
    await userEvent.type(screen.getByPlaceholderText(/Item Name/i), 'Test Item');
    await userEvent.type(screen.getByPlaceholderText(/Qty/i), '10');
    await userEvent.type(screen.getByPlaceholderText(/Unit Price/i), '1000');

    const addButton = screen.getAllByRole('button', { name: /Add/i })[1];
    fireEvent.click(addButton);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /Create Order/i });
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('closes form when cancel button is clicked', () => {
    render(
      <OrderForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
