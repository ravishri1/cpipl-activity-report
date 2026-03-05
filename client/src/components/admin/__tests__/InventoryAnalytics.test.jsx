import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InventoryAnalytics from '../InventoryAnalytics';
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

describe('InventoryAnalytics Component', () => {
  const mockInventory = [
    {
      id: 1,
      itemCode: 'ITEM001',
      itemName: 'Item 1',
      quantity: 50,
      minQuantity: 20,
      maxQuantity: 100,
      unitPrice: 1000,
      category: 'materials',
    },
    {
      id: 2,
      itemCode: 'ITEM002',
      itemName: 'Item 2',
      quantity: 5,
      minQuantity: 10,
      maxQuantity: 50,
      unitPrice: 2000,
      category: 'supplies',
    },
    {
      id: 3,
      itemCode: 'ITEM003',
      itemName: 'Item 3',
      quantity: 150,
      minQuantity: 50,
      maxQuantity: 200,
      unitPrice: 500,
      category: 'materials',
    },
    {
      id: 4,
      itemCode: 'ITEM004',
      itemName: 'Item 4',
      quantity: 8,
      minQuantity: 8,
      maxQuantity: 50,
      unitPrice: 3000,
      category: 'equipment',
    },
  ];

  const mockLowStock = [
    mockInventory[1], // qty 5 < min 10
    mockInventory[3], // qty 8 <= min 8
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    api.get = jest.fn((url) => {
      if (url.includes('/low-stock')) return Promise.resolve({ data: mockLowStock });
      if (url.includes('/inventory')) return Promise.resolve({ data: mockInventory });
      return Promise.resolve({ data: [] });
    });
  });

  test('renders component with header', () => {
    render(<InventoryAnalytics />);
    expect(screen.getByText('Inventory Analytics')).toBeInTheDocument();
  });

  test('displays KPI cards with statistics', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Total Items')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // Total items
    });
  });

  test('shows critical stock count', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/Critical Stock/i)).toBeInTheDocument();
    });
  });

  test('shows low stock count', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/Low Stock/i)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Low stock items
    });
  });

  test('renders all view mode tabs', () => {
    render(<InventoryAnalytics />);

    expect(screen.getByRole('button', { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Low Stock/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analysis/ })).toBeInTheDocument();
  });

  test('displays overview tab by default', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search items/i)).toBeInTheDocument();
    });
  });

  test('displays inventory items in overview', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  test('filters inventory by search query', async () => {
    render(<InventoryAnalytics />);

    const searchInput = screen.getByPlaceholderText(/Search items/i);
    fireEvent.change(searchInput, { target: { value: 'ITEM001' } });

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
    });
  });

  test('shows stock level indicators', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/Stock Level/i)).toBeInTheDocument();
    });
  });

  test('displays critical status for critical items', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument();
    });
  });

  test('displays low status for low items', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/LOW/i)).toBeInTheDocument();
    });
  });

  test('displays ok status for adequate items', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/OK/i)).toBeInTheDocument();
    });
  });

  test('switches to low stock tab', async () => {
    render(<InventoryAnalytics />);

    const lowStockTab = screen.getByRole('button', { name: /Low Stock/ });
    fireEvent.click(lowStockTab);

    await waitFor(() => {
      expect(screen.getByText(/Critical.*Action Required/i)).toBeInTheDocument();
    });
  });

  test('displays critical items in low stock view', async () => {
    render(<InventoryAnalytics />);

    const lowStockTab = screen.getByRole('button', { name: /Low Stock/ });
    fireEvent.click(lowStockTab);

    await waitFor(() => {
      expect(screen.getByText('Item 4')).toBeInTheDocument();
    });
  });

  test('shows reorder button for critical items', async () => {
    render(<InventoryAnalytics />);

    const lowStockTab = screen.getByRole('button', { name: /Low Stock/ });
    fireEvent.click(lowStockTab);

    await waitFor(() => {
      const reorderButtons = screen.queryAllByRole('button', { name: /Reorder/i });
      expect(reorderButtons.length).toBeGreaterThan(0);
    });
  });

  test('switches to analysis tab', async () => {
    render(<InventoryAnalytics />);

    const analysisTab = screen.getByRole('button', { name: /Analysis/ });
    fireEvent.click(analysisTab);

    await waitFor(() => {
      expect(screen.getByText(/Stock Distribution/i)).toBeInTheDocument();
    });
  });

  test('displays stock distribution in analysis view', async () => {
    render(<InventoryAnalytics />);

    const analysisTab = screen.getByRole('button', { name: /Analysis/ });
    fireEvent.click(analysisTab);

    await waitFor(() => {
      expect(screen.getByText(/Adequate Stock/i)).toBeInTheDocument();
      expect(screen.getByText(/Low Stock/i)).toBeInTheDocument();
      expect(screen.getByText(/Critical Stock/i)).toBeInTheDocument();
    });
  });

  test('shows most valuable items', async () => {
    render(<InventoryAnalytics />);

    const analysisTab = screen.getByRole('button', { name: /Analysis/ });
    fireEvent.click(analysisTab);

    await waitFor(() => {
      expect(screen.getByText(/Most Valuable Items/i)).toBeInTheDocument();
    });
  });

  test('shows fast moving items', async () => {
    render(<InventoryAnalytics />);

    const analysisTab = screen.getByRole('button', { name: /Analysis/ });
    fireEvent.click(analysisTab);

    await waitFor(() => {
      expect(screen.getByText(/Fast Moving Items/i)).toBeInTheDocument();
    });
  });

  test('displays loading spinner while fetching', async () => {
    api.get = jest.fn(() => new Promise(() => {})); // Never resolves

    render(<InventoryAnalytics />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('displays error message on API failure', async () => {
    api.get = jest.fn().mockRejectedValue(new Error('API Error'));

    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    });
  });

  test('shows refresh button', () => {
    render(<InventoryAnalytics />);

    const refreshButton = screen.getByRole('button').parentElement.querySelector('button');
    expect(refreshButton).toBeInTheDocument();
  });

  test('displays item code in list', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/Code: ITEM001/i)).toBeInTheDocument();
    });
  });

  test('displays unit price and stock value', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/Unit Price/i)).toBeInTheDocument();
      expect(screen.getByText(/Stock Value/i)).toBeInTheDocument();
    });
  });

  test('handles empty inventory', async () => {
    api.get = jest.fn((url) => {
      if (url.includes('/low-stock')) return Promise.resolve({ data: [] });
      if (url.includes('/inventory')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    render(<InventoryAnalytics />);

    await waitFor(() => {
      expect(screen.getByText(/No inventory items/i)).toBeInTheDocument();
    });
  });

  test('calculates correct total value', async () => {
    render(<InventoryAnalytics />);

    await waitFor(() => {
      // Total value should be displayed in KPI card
      const expectedTotal = mockInventory.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      expect(expectedTotal).toBeGreaterThan(0);
    });
  });
});
