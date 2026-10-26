const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let firebaseConfigured;
let readFirebaseConfig;

before(async () => {
  ({ firebaseConfigured, readFirebaseConfig } = await import('./firebaseConfig.js'));
});

test('the Bet Tracker web app is configured and env can override it', () => {
  const shipped = readFirebaseConfig({});
  assert.equal(shipped.projectId, 'bettracker-f5d99');
  assert.equal(shipped.authDomain, 'bettracker-f5d99.firebaseapp.com');
  assert.equal(firebaseConfigured(shipped), true);

  const config = readFirebaseConfig({
    REACT_APP_FIREBASE_API_KEY: 'key',
    REACT_APP_FIREBASE_AUTH_DOMAIN: 'app.firebaseapp.com',
    REACT_APP_FIREBASE_PROJECT_ID: 'app',
    REACT_APP_FIREBASE_APP_ID: '1:web:app',
  });
  assert.equal(config.projectId, 'app');
  assert.equal(firebaseConfigured(config), true);
  assert.equal(firebaseConfigured({ ...config, apiKey: '' }), false);
});
