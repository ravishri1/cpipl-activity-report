// Cypress E2E Support File
import './commands';

// Disable uncaught exception handling for specific errors
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  if (err.message.includes('ChunkLoadError') || err.message.includes('Loading chunk')) {
    return false;
  }
  return true;
});

// Global test timeout
beforeEach(() => {
  cy.viewport(1280, 720);
});

// Mock API responses for consistent testing
const mockApiResponses = {
  vendors: [
    { id: '1', name: 'Tech Supplies Inc', email: 'contact@techsupplies.com', phone: '9876543210', location: 'Mumbai', category: 'Technology' },
    { id: '2', name: 'Office Solutions', email: 'info@officesolutions.com', phone: '9123456789', location: 'Delhi', category: 'Office' },
  ],
  orders: [
    {
      id: '1',
      vendorId: '1',
      status: 'submitted',
      totalAmount: 50000,
      orderDate: '2026-03-01',
      deliveryDate: '2026-03-15',
      lineItems: [{ id: 'li1', quantity: 100, rate: 500, unit: 'pcs' }],
    },
    {
      id: '2',
      vendorId: '2',
      status: 'approved',
      totalAmount: 75000,
      orderDate: '2026-02-28',
      deliveryDate: '2026-03-14',
      lineItems: [{ id: 'li2', quantity: 50, rate: 1500, unit: 'boxes' }],
    },
  ],
  inventory: [
    { id: '1', name: 'Office Chair', quantity: 45, reorderLevel: 20, unitPrice: 5000, lastUpdated: '2026-03-05', status: 'ok' },
    { id: '2', name: 'Desk Lamp', quantity: 8, reorderLevel: 15, unitPrice: 1200, lastUpdated: '2026-03-05', status: 'warning' },
    { id: '3', name: 'Monitor Stand', quantity: 2, reorderLevel: 10, unitPrice: 3500, lastUpdated: '2026-03-05', status: 'critical' },
  ],
};

// Store mock data globally
window.mockApiResponses = mockApiResponses;
