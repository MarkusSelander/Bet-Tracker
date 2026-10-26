const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let authErrorMessage;
let googleAuthError;
let networkErrorMessage;

before(async () => {
  ({ authErrorMessage, googleAuthError, networkErrorMessage } = await import('./authForm.js'));
});

test('authErrorMessage maps Google login failures to Norwegian messages', () => {
  assert.equal(authErrorMessage(401, 'Ugyldig token'), 'Ugyldig token');
  assert.match(authErrorMessage(401), /avvist/);
  assert.equal(authErrorMessage(409, 'Opptatt'), 'Opptatt');
  assert.match(authErrorMessage(409), /annen konto/);
  assert.equal(authErrorMessage(400, 'Mangler Google-token'), 'Mangler Google-token');
  assert.equal(authErrorMessage(503, 'Firebase er ikke konfigurert'), 'Firebase er ikke konfigurert');
  assert.match(authErrorMessage(503), /Databasen/);
  assert.match(authErrorMessage(502), /Serveren/);
  assert.match(authErrorMessage(404), /Noe gikk galt/);
});

test('googleAuthError explains a closed or blocked popup', () => {
  assert.match(googleAuthError({ code: 'auth/popup-closed-by-user' }), /avbrutt/);
  assert.match(googleAuthError({ code: 'auth/popup-blocked' }), /popup/);
  assert.match(googleAuthError({ code: 'auth/unauthorized-domain' }), /Firebase/);
  assert.match(googleAuthError({ code: 'auth/unknown' }), /Prøv igjen/);
});

test('networkErrorMessage explains a sleeping server on timeout', () => {
  assert.match(networkErrorMessage(new Error('Forespørselen tok for lang tid')), /starte opp/);
  assert.match(networkErrorMessage(new TypeError('Failed to fetch')), /kontakt/);
});
