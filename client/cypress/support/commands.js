// Custom Cypress Commands for Procurement Module E2E Tests

// Login command
Cypress.Commands.add('login', (email = 'admin@cpipl.com', password = 'password123') => {
  cy.visit('/');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/dashboard');
});

// Navigate to Procurement module
Cypress.Commands.add('navigateToProcurement', () => {
  cy.visit('/admin/procurement');
  cy.contains('Procurement Manager').should('be.visible');
});

// Create a vendor
Cypress.Commands.add('createVendor', (vendorData) => {
  cy.get('button:contains("Add Vendor")').click();
  cy.get('input[placeholder="Vendor Name"]').type(vendorData.name);
  cy.get('input[placeholder="Email"]').type(vendorData.email);
  cy.get('input[placeholder="Phone"]').type(vendorData.phone);
  cy.get('input[placeholder="Location"]').type(vendorData.location);
  cy.get('select').select(vendorData.category);
  cy.get('button:contains("Create Vendor")').click();
  cy.contains('Vendor created successfully').should('be.visible');
});

// Create an order
Cypress.Commands.add('createOrder', (orderData) => {
  cy.get('button:contains("Create Order")').click();
  cy.get('select[name="vendor"]').select(orderData.vendorId);
  cy.get('input[type="date"][name="orderDate"]').type(orderData.orderDate);
  cy.get('input[type="date"][name="deliveryDate"]').type(orderData.deliveryDate);
  
  orderData.lineItems.forEach((item, index) => {
    cy.get('button:contains("Add Line Item")').click();
    cy.get(`input[name="lineItems[${index}].quantity"]`).type(item.quantity);
    cy.get(`input[name="lineItems[${index}].rate"]`).type(item.rate);
    cy.get(`select[name="lineItems[${index}].unit"]`).select(item.unit);
  });
  
  cy.get('button:contains("Submit Order")').click();
  cy.contains('Order created successfully').should('be.visible');
});

// Approve an order
Cypress.Commands.add('approveOrder', (orderId, notes = '') => {
  cy.get(`[data-testid="order-${orderId}"]`).within(() => {
    cy.get('button:contains("Approve")').click();
  });
  
  if (notes) {
    cy.get('textarea[placeholder="Approval notes"]').type(notes);
  }
  
  cy.get('button:contains("Confirm Approval")').click();
  cy.contains('Order approved successfully').should('be.visible');
});

// Reject an order
Cypress.Commands.add('rejectOrder', (orderId, reason) => {
  cy.get(`[data-testid="order-${orderId}"]`).within(() => {
    cy.get('button:contains("Reject")').click();
  });
  
  cy.get('textarea[placeholder="Rejection reason"]').type(reason);
  cy.get('button:contains("Confirm Rejection")').click();
  cy.contains('Order rejected successfully').should('be.visible');
});

// Filter orders by status
Cypress.Commands.add('filterOrdersByStatus', (status) => {
  cy.get('select[name="statusFilter"]').select(status);
  cy.get('button:contains("Apply Filter")').click();
});

// Search in orders
Cypress.Commands.add('searchOrders', (searchTerm) => {
  cy.get('input[placeholder="Search orders..."]').clear().type(searchTerm);
  cy.get('button:contains("Search")').click();
});

// Check inventory status
Cypress.Commands.add('checkInventoryStatus', (itemName, expectedStatus) => {
  cy.contains(itemName).parent().within(() => {
    cy.contains(expectedStatus).should('be.visible');
  });
});

// Verify low stock alert
Cypress.Commands.add('verifyLowStockAlert', (itemCount) => {
  cy.get('[data-testid="low-stock-count"]').should('contain', itemCount);
});

// Export data as CSV
Cypress.Commands.add('exportAsCSV', (section = 'orders') => {
  cy.get(`button[data-action="export-${section}"]`).click();
  cy.get('button:contains("Export as CSV")').click();
});

// Take screenshot with timestamp
Cypress.Commands.add('screenshotWithTimestamp', (name) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  cy.screenshot(`${name}-${timestamp}`);
});
