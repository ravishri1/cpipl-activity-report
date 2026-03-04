describe('Performance and Accessibility Tests', () => {
  beforeEach(() => {
    cy.login('admin@cpipl.com', 'password123');
  });

  describe('Page Load Performance', () => {
    it('should load Procurement dashboard within acceptable time', () => {
      cy.visit('/admin/procurement');
      cy.get('[data-testid="procurement-dashboard"]').should('be.visible');
      cy.window().then((win) => {
        const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart;
        expect(loadTime).to.be.lessThan(3000); // 3 seconds
      });
    });

    it('should load vendor list quickly', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="vendors-tab"]').click();
      cy.get('[data-testid="vendor-list"]').should('be.visible');
      
      cy.window().then((win) => {
        const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart;
        expect(loadTime).to.be.lessThan(2500);
      });
    });

    it('should search orders without noticeable lag', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="orders-tab"]').click();
      
      const startTime = Date.now();
      cy.get('input[placeholder="Search orders..."]').type('Tech');
      cy.get('button').contains('Search').click();
      cy.get('[data-testid="order-item"]').should('have.length.greaterThan', 0);
      
      cy.window().then(() => {
        const searchTime = Date.now() - startTime;
        expect(searchTime).to.be.lessThan(1000); // 1 second
      });
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper heading hierarchy', () => {
      cy.navigateToProcurement();
      cy.get('h1').should('have.length', 1);
      cy.get('h1').should('contain', 'Procurement Manager');
    });

    it('should have descriptive labels for all inputs', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="vendors-tab"]').click();
      cy.get('button').contains('Add Vendor').click();
      
      cy.get('label').should('have.length.greaterThan', 0);
      cy.get('input').each(($input) => {
        const inputId = $input.attr('id');
        if (inputId) {
          cy.get(`label[for="${inputId}"]`).should('exist');
        }
      });
    });

    it('should have proper ARIA labels for interactive elements', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="approval-tab"]').click();
      
      cy.get('button[data-action="expand"]').should('have.attr', 'aria-label');
      cy.get('button[data-action="collapse"]').should('have.attr', 'aria-label');
      cy.get('button[data-action="delete"]').should('have.attr', 'aria-label');
    });

    it('should be keyboard navigable', () => {
      cy.navigateToProcurement();
      
      // Tab through elements
      cy.get('body').tab();
      cy.focused().should('exist');
      
      cy.get('body').tab();
      cy.focused().should('exist');
    });

    it('should have sufficient color contrast', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="order-status"]').each(($el) => {
        cy.wrap($el).should('have.css', 'color');
      });
    });

    it('should have alternative text for images', () => {
      cy.navigateToProcurement();
      cy.get('img').each(($img) => {
        cy.wrap($img).should(($image) => {
          expect($image.attr('alt')).to.exist;
        });
      });
    });

    it('should support screen reader navigation', () => {
      cy.navigateToProcurement();
      cy.get('[role="button"]').should('have.length.greaterThan', 0);
      cy.get('[role="tab"]').should('have.length.greaterThan', 0);
      cy.get('[role="tablist"]').should('have.length.greaterThan', 0);
    });

    it('should have skip navigation links', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="skip-to-content"]').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive on mobile (375px)', () => {
      cy.viewport(375, 667);
      cy.navigateToProcurement();
      
      cy.get('[data-testid="procurement-dashboard"]').should('be.visible');
      cy.get('[data-testid="vendors-tab"]').should('be.visible');
    });

    it('should be responsive on tablet (768px)', () => {
      cy.viewport(768, 1024);
      cy.navigateToProcurement();
      
      cy.get('[data-testid="procurement-dashboard"]').should('be.visible');
    });

    it('should be responsive on desktop (1280px)', () => {
      cy.viewport(1280, 720);
      cy.navigateToProcurement();
      
      cy.get('[data-testid="procurement-dashboard"]').should('be.visible');
    });

    it('should handle mobile navigation menu', () => {
      cy.viewport(375, 667);
      cy.navigateToProcurement();
      
      cy.get('[data-testid="mobile-menu-toggle"]').click();
      cy.get('[data-testid="vendors-tab"]').should('be.visible');
    });
  });

  describe('Data Handling and Validation', () => {
    it('should handle large vendor lists without lag', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="vendors-tab"]').click();
      
      // Simulate scrolling through large list
      cy.get('[data-testid="vendor-list"]').scrollTo('bottom');
      cy.get('[data-testid="vendor-item"]').last().should('be.visible');
    });

    it('should handle special characters in search', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="vendors-tab"]').click();
      
      cy.get('input[placeholder="Search vendors..."]').type('&@#$%');
      cy.get('button').contains('Search').click();
      cy.get('[data-testid="no-results"]').should('be.visible');
    });

    it('should handle numeric values correctly', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="orders-tab"]').click();
      cy.get('button').contains('Create Order').click();
      
      cy.get('input[name="quantity"]').type('999999');
      cy.get('input[name="rate"]').type('99999.99');
      
      cy.get('[data-testid="total-amount"]').then(($el) => {
        const total = parseFloat($el.text().replace('₹', '').replace(',', ''));
        expect(total).to.be.greaterThan(0);
      });
    });

    it('should validate date inputs correctly', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="orders-tab"]').click();
      cy.get('button').contains('Create Order').click();
      
      cy.get('input[name="orderDate"]').type('2020-01-01');
      cy.get('input[name="deliveryDate"]').type('2020-01-01');
      
      cy.get('button').contains('Submit Order').click();
      cy.contains('Delivery date must be after order date').should('be.visible');
    });

    it('should handle currency formatting', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="total-value-card"]').then(($el) => {
        const value = $el.text();
        expect(value).to.match(/₹[\d,]+(\.\d{2})?/);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show user-friendly error messages', () => {
      cy.navigateToProcurement();
      cy.get('[data-testid="vendors-tab"]').click();
      cy.get('button').contains('Add Vendor').click();
      
      cy.get('button').contains('Save Vendor').click();
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="error-message"]').should('not.contain', '500');
      cy.get('[data-testid="error-message"]').should('not.contain', 'Error');
    });

    it('should recover from network errors gracefully', () => {
      cy.navigateToProcurement();
      cy.intercept('/api/orders', { statusCode: 500 }).as('serverError');
      
      cy.get('[data-testid="orders-tab"]').click();
      cy.wait('@serverError');
      
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('button').contains('Retry').should('be.visible');
    });
  });
});
