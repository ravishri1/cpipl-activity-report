describe('Vendor Management Workflow', () => {
  beforeEach(() => {
    cy.login('admin@cpipl.com', 'password123');
    cy.navigateToProcurement();
  });

  it('should display vendor list with all vendors', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('[data-testid="vendor-list"]').should('be.visible');
    cy.get('[data-testid="vendor-item"]').should('have.length.greaterThan', 0);
  });

  it('should create a new vendor successfully', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('button').contains('Add Vendor').click();
    
    cy.get('input[placeholder="Vendor Name"]').type('New Tech Solutions');
    cy.get('input[placeholder="Email"]').type('newtechsol@example.com');
    cy.get('input[placeholder="Phone"]').type('9876543210');
    cy.get('input[placeholder="Location"]').type('Bangalore');
    cy.get('select[name="category"]').select('Technology');
    
    cy.get('button').contains('Save Vendor').click();
    cy.contains('Vendor created successfully').should('be.visible');
    cy.get('[data-testid="vendor-item"]').should('contain', 'New Tech Solutions');
  });

  it('should update vendor information', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('[data-testid="vendor-item"]').first().within(() => {
      cy.get('button[data-action="edit"]').click();
    });
    
    cy.get('input[placeholder="Vendor Name"]').clear().type('Updated Vendor Name');
    cy.get('input[placeholder="Phone"]').clear().type('9999999999');
    cy.get('button').contains('Update Vendor').click();
    
    cy.contains('Vendor updated successfully').should('be.visible');
  });

  it('should delete a vendor with confirmation', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('[data-testid="vendor-item"]').first().within(() => {
      cy.get('button[data-action="delete"]').click();
    });
    
    cy.get('[data-testid="delete-confirmation"]').should('be.visible');
    cy.get('button').contains('Confirm Delete').click();
    cy.contains('Vendor deleted successfully').should('be.visible');
  });

  it('should search vendors by name', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('input[placeholder="Search vendors..."]').type('Tech');
    cy.get('button').contains('Search').click();
    
    cy.get('[data-testid="vendor-item"]').each(($el) => {
      cy.wrap($el).should('contain', 'Tech');
    });
  });

  it('should filter vendors by category', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('select[name="categoryFilter"]').select('Technology');
    cy.get('button').contains('Apply Filter').click();
    
    cy.get('[data-testid="vendor-category"]').each(($el) => {
      cy.wrap($el).should('contain', 'Technology');
    });
  });

  it('should validate required vendor fields', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('button').contains('Add Vendor').click();
    
    cy.get('button').contains('Save Vendor').click();
    cy.contains('Vendor name is required').should('be.visible');
    cy.contains('Email is required').should('be.visible');
    cy.contains('Phone is required').should('be.visible');
  });

  it('should validate email format', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('button').contains('Add Vendor').click();
    
    cy.get('input[placeholder="Vendor Name"]').type('Test Vendor');
    cy.get('input[placeholder="Email"]').type('invalid-email');
    cy.get('input[placeholder="Phone"]').type('9876543210');
    cy.get('button').contains('Save Vendor').click();
    
    cy.contains('Please enter a valid email').should('be.visible');
  });

  it('should display vendor details correctly', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('[data-testid="vendor-item"]').first().click();
    
    cy.get('[data-testid="vendor-detail-panel"]').should('be.visible');
    cy.get('[data-testid="vendor-name"]').should('not.be.empty');
    cy.get('[data-testid="vendor-email"]').should('not.be.empty');
    cy.get('[data-testid="vendor-phone"]').should('not.be.empty');
  });

  it('should show vendor statistics (total orders, rating)', () => {
    cy.get('[data-testid="vendors-tab"]').click();
    cy.get('[data-testid="vendor-item"]').first().within(() => {
      cy.get('[data-testid="vendor-orders-count"]').should('exist');
      cy.get('[data-testid="vendor-rating"]').should('exist');
    });
  });
});
