import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VendorForm from '../VendorForm';
import * as api from '../../../utils/api';

jest.mock('../../../utils/api');
jest.mock('../../shared/AlertMessage', () => {
  return function DummyAlert({ message, type }) {
    return <div data-testid={`alert-${type}`}>{message}</div>;
  };
});

describe('VendorForm Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(
      <VendorForm isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders when isOpen is true', () => {
    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.getByText('Add New Vendor')).toBeInTheDocument();
  });

  test('shows edit title when vendorId is provided', () => {
    api.get = jest.fn().mockResolvedValue({
      data: { id: 1, vendorName: 'Test Vendor' },
    });

    render(
      <VendorForm
        isOpen={true}
        vendorId={1}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Edit Vendor')).toBeInTheDocument();
  });

  test('has all required form fields', () => {
    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByLabelText(/Vendor Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Address/i)).toBeInTheDocument();
  });

  test('fills in form fields with provided data', async () => {
    const mockVendor = {
      id: 1,
      vendorName: 'Tech Corp',
      email: 'tech@corp.com',
      phone: '9876543210',
      address: '123 Tech St',
      gstNumber: '27AABCU1234H1Z0',
      category: 'supplier',
      contactPerson: 'John Doe',
    };

    api.get = jest.fn().mockResolvedValue({ data: mockVendor });

    render(
      <VendorForm
        isOpen={true}
        vendorId={1}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tech Corp')).toBeInTheDocument();
      expect(screen.getByDisplayValue('tech@corp.com')).toBeInTheDocument();
    });
  });

  test('submits form with correct data', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });

    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await userEvent.type(screen.getByLabelText(/Vendor Name/i), 'New Vendor');
    await userEvent.type(screen.getByLabelText(/Email/i), 'vendor@test.com');
    await userEvent.type(screen.getByLabelText(/Phone/i), '9876543210');
    await userEvent.type(screen.getByLabelText(/Address/i), '123 Main St');

    const submitButton = screen.getByRole('button', { name: /Create Vendor/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/procurement/vendors',
        expect.objectContaining({
          vendorName: 'New Vendor',
          email: 'vendor@test.com',
          phone: '9876543210',
          address: '123 Main St',
        })
      );
    });
  });

  test('calls onSuccess after successful submission', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });

    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await userEvent.type(screen.getByLabelText(/Vendor Name/i), 'New Vendor');
    await userEvent.type(screen.getByLabelText(/Email/i), 'vendor@test.com');
    await userEvent.type(screen.getByLabelText(/Phone/i), '9876543210');
    await userEvent.type(screen.getByLabelText(/Address/i), '123 Main St');

    fireEvent.click(screen.getByRole('button', { name: /Create Vendor/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  test('closes form after successful submission', async () => {
    api.post = jest.fn().mockResolvedValue({ data: { id: 1 } });

    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await userEvent.type(screen.getByLabelText(/Vendor Name/i), 'New Vendor');
    await userEvent.type(screen.getByLabelText(/Email/i), 'vendor@test.com');
    await userEvent.type(screen.getByLabelText(/Phone/i), '9876543210');
    await userEvent.type(screen.getByLabelText(/Address/i), '123 Main St');

    fireEvent.click(screen.getByRole('button', { name: /Create Vendor/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('closes form when cancel button is clicked', () => {
    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('closes form when X button is clicked', () => {
    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const closeButton = screen.getByRole('button').parentElement.querySelector('button');
    if (closeButton) fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('validates required fields', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Create Vendor/i }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('required fields')
      );
    });

    alertSpy.mockRestore();
  });

  test('displays error message on API failure', async () => {
    api.post = jest
      .fn()
      .mockRejectedValue({ response: { data: { message: 'Vendor already exists' } } });

    render(
      <VendorForm isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await userEvent.type(screen.getByLabelText(/Vendor Name/i), 'New Vendor');
    await userEvent.type(screen.getByLabelText(/Email/i), 'vendor@test.com');
    await userEvent.type(screen.getByLabelText(/Phone/i), '9876543210');
    await userEvent.type(screen.getByLabelText(/Address/i), '123 Main St');

    fireEvent.click(screen.getByRole('button', { name: /Create Vendor/i }));

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    });
  });

  test('updates vendor when vendorId is provided', async () => {
    const mockVendor = {
      id: 1,
      vendorName: 'Tech Corp',
      email: 'tech@corp.com',
      phone: '9876543210',
      address: '123 Tech St',
      gstNumber: '27AABCU1234H1Z0',
      category: 'supplier',
      contactPerson: 'John Doe',
    };

    api.get = jest.fn().mockResolvedValue({ data: mockVendor });
    api.put = jest.fn().mockResolvedValue({ data: { ...mockVendor, vendorName: 'Updated Corp' } });

    render(
      <VendorForm
        isOpen={true}
        vendorId={1}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tech Corp')).toBeInTheDocument();
    });

    await userEvent.clear(screen.getByDisplayValue('Tech Corp'));
    await userEvent.type(screen.getByLabelText(/Vendor Name/i), 'Updated Corp');

    fireEvent.click(screen.getByRole('button', { name: /Update Vendor/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/api/procurement/vendors/1',
        expect.objectContaining({ vendorName: 'Updated Corp' })
      );
    });
  });
});
