describe('Order Approval Workflow', () => {
  beforeEach(() => {
    cy.login('admin@cpipl.com', 'password123');
    cy.navigateToProcurement();
    cy.get('[data-testid="approval-tab"]').click();
  });

  it('should display Approval Queue with pending orders only', () => {
    cy.get('[data-testid="approval-queue"]').should('be.visible');
    cy.get('[data-testid="order-item"]').each(($el) => {
      cy.wrap($el).within(() => {
        cy.get('[data-testid="order-status"]').should('contain', 'Submitted');
      });
    });
  });

  it('should show pending order count in header', () => {
    cy.get('[data-testid="pending-count"]').should('not.be.empty');
    cy.get('[data-testid="pending-count"]').then(($el) => {
      const count = parseInt($el.text());
      expect(count).to.be.greaterThan(0);
    });
  });

  it('should expand order to show full details', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('[data-testid="order-expansion-panel"]').should('be.visible');
    cy.get('[data-testid="order-full-details"]').should('be.visible');
  });

  it('should display line items when order is expanded', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('[data-testid="line-item"]').should('have.length.greaterThan', 0);
    cy.get('[data-testid="line-item-details"]').should('be.visible');
  });

  it('should collapse order details after expansion', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('[data-testid="order-expansion-panel"]').should('be.visible');
    
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="collapse"]').click();
    });
    
    cy.get('[data-testid="order-expansion-panel"]').should('not.be.visible');
  });

  it('should approve order with approval notes', () => {
    cy.get('[data-testid="order-item"]').first().as('firstOrder');
    cy.get('@firstOrder').within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('[data-testid="approval-notes-input"]').type('Approved. Budget allocated for Q1.');
    cy.get('button').contains('Approve').click();
    
    cy.get('[data-testid="approval-confirmation"]').should('be.visible');
    cy.get('button').contains('Confirm').click();
    
    cy.contains('Order approved successfully').should('be.visible');
  });

  it('should approve order without notes', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('button').contains('Approve').click();
    cy.get('[data-testid="approval-confirmation"]').should('be.visible');
    cy.get('button').contains('Confirm').click();
    
    cy.contains('Order approved successfully').should('be.visible');
  });

  it('should reject order with rejection reason', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('button').contains('Reject').click();
    cy.get('[data-testid="rejection-reason-input"]').type('Budget not allocated for this category in current quarter.');
    cy.get('button').contains('Confirm Rejection').click();
    
    cy.contains('Order rejected successfully').should('be.visible');
  });

  it('should require rejection reason before rejecting', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('button').contains('Reject').click();
    cy.get('button').contains('Confirm Rejection').click();
    
    cy.contains('Please provide a reason for rejection').should('be.visible');
  });

  it('should refetch orders after approval', () => {
    cy.get('[data-testid="order-item"]').then(($items) => {
      const initialCount = $items.length;
      
      cy.get('[data-testid="order-item"]').first().within(() => {
        cy.get('button[data-action="expand"]').click();
      });
      
      cy.get('button').contains('Approve').click();
      cy.get('button').contains('Confirm').click();
      
      cy.get('[data-testid="order-item"]').should('have.length.lessThan', initialCount);
    });
  });

  it('should display approval status in order', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
    });
    
    cy.get('[data-testid="order-status"]').should('contain', 'Submitted');
    
    cy.get('button').contains('Approve').click();
    cy.get('button').contains('Confirm').click();
    
    cy.wait(1000);
    cy.reload();
    
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('[data-testid="order-status"]').should('contain', 'Approved');
    });
  });

  it('should show order details with vendor information', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
      cy.get('[data-testid="vendor-name"]').should('not.be.empty');
      cy.get('[data-testid="order-date"]').should('not.be.empty');
      cy.get('[data-testid="total-amount"]').should('not.be.empty');
    });
  });

  it('should show order creator information', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
      cy.get('[data-testid="created-by"]').should('contain', '@cpipl.com');
      cy.get('[data-testid="created-date"]').should('not.be.empty');
    });
  });

  it('should display delivery date and expected arrival', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
      cy.get('[data-testid="delivery-date"]').should('not.be.empty');
    });
  });

  it('should handle bulk approval (if feature exists)', () => {
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('input[type="checkbox"]').check();
    });
    
    cy.get('[data-testid="order-item"]').eq(1).within(() => {
      cy.get('input[type="checkbox"]').check();
    });
    
    cy.get('button[data-action="bulk-approve"]').should('be.visible');
  });

  it('should show approval history for approved orders', () => {
    cy.get('[data-testid="approved-tab"]').click();
    cy.get('[data-testid="order-item"]').first().within(() => {
      cy.get('button[data-action="expand"]').click();
      cy.get('[data-testid="approval-details"]').should('be.visible');
      cy.get('[data-testid="approved-by"]').should('not.be.empty');
      cy.get('[data-testid="approval-date"]').should('not.be.empty');
    });
  });
});
