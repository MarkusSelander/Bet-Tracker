const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let authErrorMessage;
let networkErrorMessage;
let validateLogin;
let validateRegister;

before(async () => {
  ({ authErrorMessage, networkErrorMessage, validateLogin, validateRegister } = await import('./authForm.js'));
});

const valid = { name: '', email: 'ola@example.com', password: 'sterkt-passord', confirm: 'sterkt-passord' };

test('validateLogin requires email and password', () => {
  assert.equal(validateLogin({ email: '', password: 'x' }), 'Skriv inn e-post');
  assert.equal(validateLogin({ email: 'ola', password: 'x' }), 'Ugyldig e-postadresse');
  assert.equal(validateLogin({ email: 'ola@example.com', password: '' }), 'Skriv inn passord');
  assert.equal(validateLogin({ email: ' ola@example.com ', password: 'x' }), null);
});

test('validateRegister accepts a valid form', () => {
  assert.equal(validateRegister(valid), null);
});

test('validateRegister rejects weak, too long and mismatched passwords', () => {
  assert.match(validateRegister({ ...valid, password: 'kort', confirm: 'kort' }), /minst 8 tegn/);
  const long = 'x'.repeat(73);
  assert.match(validateRegister({ ...valid, password: long, confirm: long }), /maks 72/);
  const spaces = '         ';
  assert.match(validateRegister({ ...valid, password: spaces, confirm: spaces }), /mellomrom/);
  assert.equal(validateRegister({ ...valid, confirm: 'annet-passord' }), 'Passordene er ikke like');
});

test('authErrorMessage maps statuses to Norwegian messages', () => {
  assert.equal(authErrorMessage(401, 'Invalid'), 'Feil e-post eller passord');
  assert.equal(authErrorMessage(409, 'Finnes fra før'), 'Finnes fra før');
  assert.match(authErrorMessage(409), /allerede registrert/);
  assert.equal(authErrorMessage(400, 'Passordet må være minst 8 tegn'), 'Passordet må være minst 8 tegn');
  assert.match(authErrorMessage(503), /Databasen/);
  assert.match(authErrorMessage(502), /Serveren/);
  assert.match(authErrorMessage(404), /Noe gikk galt/);
});

test('networkErrorMessage explains a sleeping server on timeout', () => {
  assert.match(networkErrorMessage(new Error('Forespørselen tok for lang tid')), /starte opp/);
  assert.match(networkErrorMessage(new TypeError('Failed to fetch')), /kontakt/);
});
