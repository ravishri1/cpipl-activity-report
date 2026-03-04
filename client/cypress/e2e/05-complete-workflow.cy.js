describe('Complete Procurement Workflow - End-to-End', () => {
  beforeEach(() => {
    cy.login('admin@cpipl.com', 'password123');
    cy.navigateToProcurement();
  });

  it('should complete full procurement cycle: vendor > order > approval > inventory', () => {
    // Step 1: Create a new vendor
    cy.log('Creating new vendor');
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('button').contains('Add Vendor').click();
    
    cy.get('input[placeholder="Vendor Name"]').type('Integration Test Vendor');
    cy.get('input[placeholder="Email"]').type('integration@test.com');
    cy.get('input[placeholder="Phone"]').type('9876543210');
    cy.get('input[placeholder="Location"]').type('Test City');
    cy.get('select[name="category"]').select('Technology');
    cy.get('button').contains('Save Vendor').click();
    
    cy.contains('Vendor created successfully').should('be.visible');

    // Step 2: Create an order with that vendor
    cy.log('Creating order with new vendor');
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button').contains('Create Order').click();
    
    cy.get('select[name="vendor"]').select('Integration Test Vendor');
    cy.get('input[name="orderDate"]').type('2026-03-10');
    cy.get('input[name="deliveryDate"]').type('2026-03-25');
    
    cy.get('button').contains('Add Line Item').click();
    cy.get('input[name="itemName"]').type('Test Equipment');
    cy.get('input[name="quantity"]').type('10');
    cy.get('input[name="rate"]').type('5000');
    cy.get('select[name="unit"]').select('pcs');
    
    cy.get('button').contains('Submit Order').click();
    cy.contains('Order created successfully').should('be.visible');

    // Step 3: Approve the order
    cy.log('Approving the order');
    cy.get('[data-testid="approval-tab"]').click();
    
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('[data-testid="approval-notes-input"]').type('Approved for integration test.');
    cy.get('button').contains('Approve').click();
    cy.get('button').contains('Confirm').click();
    
    cy.contains('Order approved successfully').should('be.visible');

    // Step 4: Verify order is approved
    cy.log('Verifying approval status');
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('[data-testid="order-status"]').should('contain', 'Approved');
    });

    // Step 5: Check inventory impact
    cy.log('Checking inventory updates');
    cy.get('[data-testid="inventory-tab"]').click();
    cy.get('input[placeholder="Search inventory..."]').type('Test Equipment');
    cy.get('button').contains('Search').click();
    
    cy.get('[data-testid="inventory-item"]').should('contain', 'Test Equipment');
  });

  it('should handle rejection workflow completely', () => {
    // Step 1: Create order
    cy.log('Creating order for rejection test');
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button').contains('Create Order').click();
    
    cy.get('select[name="vendor"]').select('vendor-1');
    cy.get('input[name="orderDate"]').type('2026-03-10');
    cy.get('input[name="deliveryDate"]').type('2026-03-25');
    
    cy.get('button').contains('Add Line Item').click();
    cy.get('input[name="itemName"]').type('Expensive Item');
    cy.get('input[name="quantity"]').type('100');
    cy.get('input[name="rate"]').type('50000');
    
    cy.get('button').contains('Submit Order').click();
    cy.contains('Order created successfully').should('be.visible');

    // Step 2: Reject the order
    cy.log('Rejecting the order');
    cy.get('[data-testid="approval-tab"]').click();
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('button').contains('Reject').click();
    cy.get('[data-testid="rejection-reason-input"]').type('Budget exceeded. Requires re-evaluation.');
    cy.get('button').contains('Confirm Rejection').click();
    
    cy.contains('Order rejected successfully').should('be.visible');

    // Step 3: Verify rejection status
    cy.log('Verifying rejection status');
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('[data-testid="order-status"]').should('contain', 'Rejected');
    });
  });

  it('should filter and analyze procurement data', () => {
    // Step 1: Filter orders by status
    cy.log('Filtering orders by status');
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('select[name="statusFilter"]').select('submitted');
    cy.get('button').contains('Apply Filter').click();
    
    cy.get('[data-testid="order-item"]').each(($el) => {
      cy.wrap($el).within(() => {
        cy.get('[data-testid="order-status"]').should('contain', 'Submitted');
      });
    });

    // Step 2: Check approval queue
    cy.log('Checking approval queue');
    cy.get('[data-testid="approval-tab"]').click();
    cy.get('[data-testid="pending-count"]').then(($el) => {
      const pendingCount = parseInt($el.text());
      cy.get('[data-testid="order-item"]').should('have.length', pendingCount);
    });

    // Step 3: Analyze inventory
    cy.log('Analyzing inventory');
    cy.get('[data-testid="inventory-tab"]').click();
    cy.get('[data-testid="analysis-tab"]').click();
    
    cy.get('[data-testid="high-value-items"]').should('be.visible');
    cy.get('[data-testid="fast-moving-items"]').should('be.visible');
  });

  it('should export comprehensive procurement report', () => {
    // Step 1: Export vendors
    cy.log('Exporting vendors');
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('button[data-action="export-vendors"]').click();
    cy.get('button').contains('Export as CSV').click();
    cy.readFile('cypress/downloads/vendors.csv').should('exist');

    // Step 2: Export orders
    cy.log('Exporting orders');
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button[data-action="export-orders"]').click();
    cy.get('button').contains('Export as CSV').click();
    cy.readFile('cypress/downloads/orders.csv').should('exist');

    // Step 3: Export inventory
    cy.log('Exporting inventory');
    cy.get('[data-testid="inventory-tab"]').click();
    cy.get('button[data-action="export-inventory"]').click();
    cy.get('button').contains('Export as CSV').click();
    cy.readFile('cypress/downloads/inventory.csv').should('exist');
  });

  it('should maintain data consistency across modules', () => {
    // Get initial counts
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('[data-testid="vendor-count"]').then(($el) => {
      const vendorCount = parseInt($el.text());
      
      cy.get('[data-testid="orders-tab"]').click();
      cy.get('[data-testid="order-count"]').then(($orderEl) => {
        const orderCount = parseInt($orderEl.text());
        
        cy.get('[data-testid="inventory-tab"]').click();
        cy.get('[data-testid="item-count"]').then(($invEl) => {
          const itemCount = parseInt($invEl.text());
          
          // Reload and verify counts remain same
          cy.reload();
          cy.navigateToProcurement();
          
          cy.get('[data-testid="vendors-tab"]').click();
          cy.get('[data-testid="vendor-count"]').should('contain', vendorCount);
          
          cy.get('[data-testid="orders-tab"]').click();
          cy.get('[data-testid="order-count"]').should('contain', orderCount);
          
          cy.get('[data-testid="inventory-tab"]').click();
          cy.get('[data-testid="item-count"]').should('contain', itemCount);
        });
      });
    });
  });

  it('should handle concurrent operations', () => {
    // Create vendor in one tab context
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('button').contains('Add Vendor').click();
    cy.get('input[placeholder="Vendor Name"]').type('Concurrent Test Vendor');
    cy.get('input[placeholder="Email"]').type('concurrent@test.com');
    cy.get('input[placeholder="Phone"]').type('9876543210');
    
    // Switch to orders without completing vendor creation
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('[data-testid="order-list"]').should('be.visible');
    
    // Switch back and complete vendor creation
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('input[placeholder="Location"]').type('Test City');
    cy.get('select[name="category"]').select('Technology');
    cy.get('button').contains('Save Vendor').click();
    
    cy.contains('Vendor created successfully').should('be.visible');
  });

  it('should handle error scenarios gracefully', () => {
    // Try to create duplicate vendor
    cy.log('Testing duplicate vendor prevention');
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('button').contains('Add Vendor').click();
    
    cy.get('input[placeholder="Vendor Name"]').type('Tech Solutions India');
    cy.get('input[placeholder="Email"]').type('duplicate@example.com');
    cy.get('input[placeholder="Phone"]').type('9876543210');
    cy.get('input[placeholder="Location"]').type('Test City');
    cy.get('select[name="category"]').select('Technology');
    cy.get('button').contains('Save Vendor').click();
    
    cy.contains('Vendor already exists').should('be.visible');

    // Try to create order without vendor selection
    cy.log('Testing order validation');
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button').contains('Create Order').click();
    cy.get('button').contains('Submit Order').click();
    cy.contains('Vendor is required').should('be.visible');
  });

  it('should display real-time KPI updates', () => {
    cy.get('[data-testid="total-orders"]').then(($initialEl) => {
      const initialCount = parseInt($initialEl.text());
      
      // Create new order
      cy.get('[data-testid="orders-tab"]').click();
      cy.get('button').contains('Create Order').click();
      cy.get('select[name="vendor"]').select('vendor-1');
      cy.get('input[name="orderDate"]').type('2026-03-10');
      cy.get('input[name="deliveryDate"]').type('2026-03-25');
      cy.get('button').contains('Add Line Item').click();
      cy.get('input[name="itemName"]').type('New Item');
      cy.get('input[name="quantity"]').type('5');
      cy.get('input[name="rate"]').type('1000');
      cy.get('button').contains('Submit Order').click();
      
      // Verify KPI updated
      cy.get('[data-testid="total-orders"]').should('contain', initialCount + 1);
    });
  });
});
