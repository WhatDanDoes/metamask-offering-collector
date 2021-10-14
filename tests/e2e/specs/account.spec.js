context('account managment', () => {

  afterEach(() => {
    cy.task('dropDatabase');
  });

  beforeEach(() => {
    cy.task('dropDatabase');
    cy.visit('/');
    cy.contains('Confirm your identity with Metamask').click();
    cy.confirmMetamaskSignatureRequest();
    cy.get('a[href="/account"]').click();
  });

  it('displays the connected wallet', () => {
    cy.fetchMetamaskWalletAddress().then(address => {
      cy.get('body header h1').contains('You are connected with:');
      cy.get('body header h4').contains(address.toLowerCase());
    });
  });

  describe('Account Details form', () => {

    it('presents a form to edit account details', () => {
      cy.get('form#account-details').should('have.attr', 'action', '/account?_method=PUT');
      cy.get('form#account-details').should('have.attr', 'method', 'post');
      cy.get('form#account-details input[type="text"][name="name"]').should('not.be.disabled');
      cy.get('form#account-details button#update-account-button[type="submit"]').should('not.be.disabled');
    });

    describe('Update button', () => {

      it('allows you to set the name field', () => {
        cy.get('input[type="text"][name="name"]').should('have.value', '');
        cy.get('input[type="text"][name="name"]').type('Some Guy');
        cy.get('#update-account-button').click();
        cy.get('input[type="text"][name="name"]').should('have.value', 'Some Guy');
      });

      it('allows you to set an empty name field', () => {
        cy.get('input[type="text"][name="name"]').should('have.value', '');
        cy.get('input[type="text"][name="name"]').type('Some Guy');
        cy.get('#update-account-button').click();
        cy.get('input[type="text"][name="name"]').should('have.value', 'Some Guy');
        cy.get('input[type="text"][name="name"]').clear();
        cy.get('#update-account-button').click();
        cy.get('input[type="text"][name="name"]').should('have.value', '');
      });

      it('shows a friendly message on success', () => {
        cy.get('input[type="text"][name="name"]').should('have.value', '');
        cy.get('input[type="text"][name="name"]').type('Some Guy');
        cy.get('#update-account-button').click();
        cy.get('input[type="text"][name="name"]').should('have.value', 'Some Guy');
        cy.get('.alert.alert-success').contains('Info updated');
      });
    });
  });
});

export {}
