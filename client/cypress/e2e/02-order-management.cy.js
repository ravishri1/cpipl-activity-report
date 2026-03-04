describe('Order Management Workflow', () => {
  beforeEach(() => {
    cy.login('admin@cpipl.com', 'password123');
    cy.navigateToProcurement();
  });

  it('should display all orders with correct status badges', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('[data-testid="order-list"]').should('be.visible');
    cy.get('[data-testid="order-item"]').should('have.length.greaterThan', 0);
    
    cy.get('[data-testid="order-status"]').each(($el) => {
      cy.wrap($el).should('contain.one.of', ['Submitted', 'Approved', 'Rejected']);
    });
  });

  it('should create a new order with line items', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button').contains('Create Order').click();
    
    cy.get('select[name="vendor"]').select('vendor-1');
    cy.get('input[name="orderDate"]').type('2026-03-10');
    cy.get('input[name="deliveryDate"]').type('2026-03-25');
    
    cy.get('button').contains('Add Line Item').click();
    cy.get('input[name="itemName"]').type('Laptops');
    cy.get('input[name="quantity"]').type('5');
    cy.get('input[name="rate"]').type('75000');
    cy.get('select[name="unit"]').select('pcs');
    
    cy.get('button').contains('Add Line Item').click();
    cy.get('input[name="itemName"]').eq(1).type('Monitors');
    cy.get('input[name="quantity"]').eq(1).type('10');
    cy.get('input[name="rate"]').eq(1).type('25000');
    
    cy.get('button').contains('Submit Order').click();
    cy.contains('Order created successfully').should('be.visible');
  });

  it('should calculate total amount automatically from line items', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button').contains('Create Order').click();
    
    cy.get('select[name="vendor"]').select('vendor-1');
    cy.get('input[name="orderDate"]').type('2026-03-10');
    cy.get('input[name="deliveryDate"]').type('2026-03-25');
    
    cy.get('button').contains('Add Line Item').click();
    cy.get('input[name="quantity"]').type('10');
    cy.get('input[name="rate"]').type('1000');
    
    cy.get('[data-testid="total-amount"]').should('contain', '10000');
  });

  it('should filter orders by status', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('select[name="statusFilter"]').select('submitted');
    cy.get('button').contains('Apply Filter').click();
    
    cy.get('[data-testid="order-status"]').each(($el) => {
      cy.wrap($el).should('contain', 'Submitted');
    });
  });

  it('should search orders by order ID or vendor name', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('input[placeholder="Search orders..."]').type('Tech Solutions');
    cy.get('button').contains('Search').click();
    
    cy.get('[data-testid="order-vendor-name"]').each(($el) => {
      cy.wrap($el).should('contain', 'Tech Solutions');
    });
  });

  it('should display order details when clicked', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('[data-testid="order-item"]').first().click();
    
    cy.get('[data-testid="order-detail-panel"]').should('be.visible');
    cy.get('[data-testid="order-vendor"]').should('not.be.empty');
    cy.get('[data-testid="order-amount"]').should('not.be.empty');
    cy.get('[data-testid="order-date"]').should('not.be.empty');
  });

  it('should show line items for an order', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('[data-testid="line-item"]').should('have.length.greaterThan', 0);
    cy.get('[data-testid="line-item-quantity"]').should('not.be.empty');
    cy.get('[data-testid="line-item-rate"]').should('not.be.empty');
  });

  it('should remove line item before submission', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button').contains('Create Order').click();
    
    cy.get('select[name="vendor"]').select('vendor-1');
    cy.get('input[name="orderDate"]').type('2026-03-10');
    cy.get('input[name="deliveryDate"]').type('2026-03-25');
    
    cy.get('button').contains('Add Line Item').click();
    cy.get('button').contains('Add Line Item').click();
    
    cy.get('[data-testid="remove-line-item"]').first().click();
    cy.get('[data-testid="line-item-count"]').should('contain', '1');
  });

  it('should validate required order fields', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button').contains('Create Order').click();
    
    cy.get('button').contains('Submit Order').click();
    cy.contains('Vendor is required').should('be.visible');
    cy.contains('At least one line item is required').should('be.visible');
  });

  it('should export orders as CSV', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('button[data-action="export-orders"]').click();
    cy.get('button').contains('Export as CSV').click();
    
    cy.readFile('cypress/downloads/orders.csv').should('exist');
  });

  it('should display order statistics in header', () => {
    cy.get('[data-testid="orders-tab"]').click();
    cy.get('[data-testid="total-orders"]').should('not.be.empty');
    cy.get('[data-testid="pending-orders"]').should('not.be.empty');
    cy.get('[data-testid="total-order-value"]').should('not.be.empty');
  });
});
