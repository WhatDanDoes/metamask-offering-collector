context('transaction view', () => {

  afterEach(() => {
    cy.task('dropDatabase');
  });

  beforeEach(() => {
    cy.task('dropDatabase');
    cy.visit('/');
    cy.contains('Confirm your identity with Metamask').click();
    cy.confirmMetamaskSignatureRequest();
  });

  it('displays links to account and donate pages', () => {
    cy.visit('/transaction');
    cy.get('header p a[href="/transfer"] i').contains('Donate');
    cy.get('header p a[href="/account"] i').contains('Account');
  });

  describe('no transactions', () => {

    it('displays an empty table and a message', () => {
      cy.visit('/transaction');
      cy.get('body header h4').contains('You have not sent any ETH yet');
      cy.get('#transaction-table').find('tbody tr').should('have.length', 0);
      cy.get('#transaction-table').find('thead tr th:first-child').contains('Date');
      cy.get('#transaction-table').find('thead tr th:nth-child(2)').contains('Value');
      cy.get('#transaction-table').find('thead tr th:last-child').contains('Tx Hash');
    });
  });

  context('with one transactions', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.get('#eth-value-input').type('1');
      cy.get('form#send-eth #send-eth-button[type="submit"]').click();
      cy.confirmMetamaskTransaction();
    });

    it('shows the transaction details in a list', () => {
      cy.get('#transaction-table').find('tbody tr').should('have.length', 1);
      cy.get('#transaction-table').find('tbody tr td:nth-child(2)').contains('1.0');
    });
  });

  context('with multiple transactions', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.get('#eth-value-input').type('1');
      cy.get('form#send-eth #send-eth-button[type="submit"]').click();
      cy.confirmMetamaskTransaction();

      cy.visit('/');
      cy.get('#eth-value-input').type('.1');
      cy.get('form#send-eth #send-eth-button[type="submit"]').click();
      cy.confirmMetamaskTransaction();

      cy.visit('/');
      cy.get('#eth-value-input').type('0.01');
      cy.get('form#send-eth #send-eth-button[type="submit"]').click();
      cy.confirmMetamaskTransaction();
    });

    it('shows the transaction details ordered by createdAt', () => {
      cy.get('#transaction-table').find('tbody tr').should('have.length', 3);
      cy.get('#transaction-table').find('tbody tr:first-child td:nth-child(2)').contains('0.01');
      cy.get('#transaction-table').find('tbody tr:nth-child(2) td:nth-child(2)').contains('0.1');
      cy.get('#transaction-table').find('tbody tr:last-child td:nth-child(2)').contains('1.0');
    });
  });
});

export {}
