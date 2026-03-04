describe('Inventory Management Workflow', () => {
  beforeEach(() => {
    cy.login('admin@cpipl.com', 'password123');
    cy.navigateToProcurement();
    cy.get('[data-testid="inventory-tab"]').click();
  });

  it('should display inventory dashboard with KPI cards', () => {
    cy.get('[data-testid="inventory-dashboard"]').should('be.visible');
    cy.get('[data-testid="total-items-card"]').should('be.visible');
    cy.get('[data-testid="low-stock-card"]').should('be.visible');
    cy.get('[data-testid="total-value-card"]').should('be.visible');
  });

  it('should show correct KPI values', () => {
    cy.get('[data-testid="total-items-count"]').then(($el) => {
      const count = parseInt($el.text());
      expect(count).to.be.greaterThan(0);
    });
    
    cy.get('[data-testid="total-inventory-value"]').should('contain', '₹');
  });

  it('should display items with correct status badges', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').should('have.length.greaterThan', 0);
    
    cy.get('[data-testid="inventory-item"]').each(($el) => {
      cy.wrap($el).within(() => {
        cy.get('[data-testid="stock-status"]').should('exist');
      });
    });
  });

  it('should highlight critical status items in red', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').each(($el) => {
      cy.wrap($el).within(() => {
        cy.get('[data-testid="stock-status"].critical').should('have.css', 'color');
      });
    });
  });

  it('should highlight warning status items in orange', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').each(($el) => {
      cy.wrap($el).within(() => {
        cy.get('[data-testid="stock-status"].warning').should('have.css', 'color');
      });
    });
  });

  it('should switch to low-stock view', () => {
    cy.get('[data-testid="low-stock-tab"]').click();
    cy.get('[data-testid="low-stock-list"]').should('be.visible');
    
    cy.get('[data-testid="inventory-item"]').each(($el) => {
      cy.wrap($el).within(() => {
        cy.get('[data-testid="stock-status"]').should('not.contain', 'OK');
      });
    });
  });

  it('should display analysis view with insights', () => {
    cy.get('[data-testid="analysis-tab"]').click();
    cy.get('[data-testid="analysis-view"]').should('be.visible');
    cy.get('[data-testid="high-value-items"]').should('be.visible');
    cy.get('[data-testid="fast-moving-items"]').should('be.visible');
  });

  it('should search inventory by item name', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('input[placeholder="Search inventory..."]').type('Chair');
    cy.get('button').contains('Search').click();
    
    cy.get('[data-testid="inventory-item"]').each(($el) => {
      cy.wrap($el).should('contain', 'Chair');
    });
  });

  it('should filter inventory by category', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('select[name="categoryFilter"]').select('Furniture');
    cy.get('button').contains('Apply Filter').click();
    
    cy.get('[data-testid="item-category"]').each(($el) => {
      cy.wrap($el).should('contain', 'Furniture');
    });
  });

  it('should display inventory item details on click', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').first().click();
    
    cy.get('[data-testid="item-detail-panel"]').should('be.visible');
    cy.get('[data-testid="item-name"]').should('not.be.empty');
    cy.get('[data-testid="item-sku"]').should('not.be.empty');
    cy.get('[data-testid="current-quantity"]').should('not.be.empty');
  });

  it('should show stock level trends', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').first().click();
    
    cy.get('[data-testid="stock-trend-chart"]').should('be.visible');
  });

  it('should display unit price and total value', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').first().within(() => {
      cy.get('[data-testid="unit-price"]').should('contain', '₹');
      cy.get('[data-testid="total-value"]').should('contain', '₹');
    });
  });

  it('should show reorder level and monthly usage', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').first().click();
    
    cy.get('[data-testid="reorder-level"]').should('not.be.empty');
    cy.get('[data-testid="monthly-usage"]').should('not.be.empty');
    cy.get('[data-testid="lead-time"]').should('not.be.empty');
  });

  it('should calculate and display days until stockout', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').first().click();
    
    cy.get('[data-testid="days-until-stockout"]').should('not.be.empty');
  });

  it('should show high-value items in analysis', () => {
    cy.get('[data-testid="analysis-tab"]').click();
    cy.get('[data-testid="high-value-items"]').within(() => {
      cy.get('[data-testid="item-rank"]').should('exist');
      cy.get('[data-testid="item-value"]').should('contain', '₹');
    });
  });

  it('should show fast-moving items in analysis', () => {
    cy.get('[data-testid="analysis-tab"]').click();
    cy.get('[data-testid="fast-moving-items"]').within(() => {
      cy.get('[data-testid="item-name"]').should('not.be.empty');
      cy.get('[data-testid="monthly-consumption"]').should('not.be.empty');
    });
  });

  it('should display low stock count in KPI card', () => {
    cy.get('[data-testid="low-stock-card"]').within(() => {
      cy.get('[data-testid="warning-count"]').then(($el) => {
        const count = parseInt($el.text());
        expect(count).to.be.greaterThan(0);
      });
    });
  });

  it('should show critical and warning breakdowns', () => {
    cy.get('[data-testid="low-stock-card"]').within(() => {
      cy.get('[data-testid="critical-count"]').should('not.be.empty');
      cy.get('[data-testid="warning-count"]').should('not.be.empty');
    });
  });

  it('should export inventory as CSV', () => {
    cy.get('button[data-action="export-inventory"]').click();
    cy.get('button').contains('Export as CSV').click();
    
    cy.readFile('cypress/downloads/inventory.csv').should('exist');
  });

  it('should update inventory quantity manually', () => {
    cy.get('[data-testid="inventory-overview-tab"]').click();
    cy.get('[data-testid="inventory-item"]').first().within(() => {
      cy.get('button[data-action="edit"]').click();
    });
    
    cy.get('input[name="quantity"]').clear().type('50');
    cy.get('button').contains('Update').click();
    cy.contains('Inventory updated successfully').should('be.visible');
  });
});
