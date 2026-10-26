const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let firebaseConfigured;
let readFirebaseConfig;

before(async () => {
  ({ firebaseConfigured, readFirebaseConfig } = await import('./firebaseConfig.js'));
});

test('firebase config is ready only when the web app fields are set', () => {
  const config = readFirebaseConfig({
    REACT_APP_FIREBASE_API_KEY: 'key',
    REACT_APP_FIREBASE_AUTH_DOMAIN: 'app.firebaseapp.com',
    REACT_APP_FIREBASE_PROJECT_ID: 'app',
    REACT_APP_FIREBASE_APP_ID: '1:web:app',
  });
  assert.equal(firebaseConfigured(config), true);
  assert.equal(firebaseConfigured(readFirebaseConfig({})), false);
  assert.equal(firebaseConfigured({ ...config, apiKey: '' }), false);
});
