const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');

let sessionCheckPlan;
let shouldReleaseLoading;
let SESSION_RESTORE_GRACE_MS;

before(async () => {
  ({ sessionCheckPlan, shouldReleaseLoading, SESSION_RESTORE_GRACE_MS } = await import('./sessionCheck.js'));
});

test('session check does not block when there is no stored token', () => {
  assert.deepEqual(sessionCheckPlan(null), {
    restore: false,
    block: false,
    immediate: false,
    holdUntilSettled: false,
  });
  assert.deepEqual(sessionCheckPlan(''), {
    restore: false,
    block: false,
    immediate: false,
    holdUntilSettled: false,
  });
});

test('a stored token keeps the session check until the API answers', () => {
  const plan = sessionCheckPlan('session_abc');
  assert.equal(plan.restore, true);
  assert.equal(plan.block, true);
  assert.equal(plan.immediate, true);
  assert.equal(plan.holdUntilSettled, true);
  assert.equal(plan.graceMs, SESSION_RESTORE_GRACE_MS);
  assert.equal(plan.timeoutMs, 60000);
  assert.ok(plan.timeoutMs > plan.graceMs);
});

test('grace does not drop a stored or in-flight session onto the login form', () => {
  assert.equal(shouldReleaseLoading(null, 0), true);
  assert.equal(shouldReleaseLoading('', 0), true);
  assert.equal(shouldReleaseLoading('session_abc', 0), false);
  assert.equal(shouldReleaseLoading(null, 1), false);
});

test('stored session is read before Firebase auth state resolves', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../contexts/AuthContext.jsx'), 'utf8');
  const immediate = source.indexOf('plan.immediate');
  const firebaseListener = source.indexOf('onAuthStateChanged(');
  assert.ok(immediate !== -1);
  assert.ok(firebaseListener !== -1);
  assert.ok(immediate < firebaseListener);
  assert.match(source, /readCurrentSession\(\)/);
  assert.match(source, /shouldReleaseLoading\(getSessionToken\(\), restoreInFlight\)/);
  assert.doesNotMatch(source, /warmUpBackend/);
});
