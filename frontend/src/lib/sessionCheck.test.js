const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');

let sessionCheckPlan;
let SESSION_RESTORE_GRACE_MS;

before(async () => {
  ({ sessionCheckPlan, SESSION_RESTORE_GRACE_MS } = await import('./sessionCheck.js'));
});

test('session check does not block when there is no stored token', () => {
  assert.deepEqual(sessionCheckPlan(null), { restore: false, block: false, immediate: false });
  assert.deepEqual(sessionCheckPlan(''), { restore: false, block: false, immediate: false });
});

test('session check only blocks briefly when a token is stored', () => {
  const plan = sessionCheckPlan('session_abc');
  assert.equal(plan.restore, true);
  assert.equal(plan.block, true);
  assert.equal(plan.immediate, true);
  assert.equal(plan.graceMs, SESSION_RESTORE_GRACE_MS);
  assert.ok(plan.graceMs < 2000);
  assert.ok(plan.timeoutMs > plan.graceMs);
});

test('stored session is read before Firebase auth state resolves', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../contexts/AuthContext.jsx'), 'utf8');
  const immediate = source.indexOf('plan.immediate');
  const firebaseListener = source.indexOf('onAuthStateChanged(');
  assert.ok(immediate !== -1);
  assert.ok(firebaseListener !== -1);
  assert.ok(immediate < firebaseListener);
  assert.match(source, /readCurrentSession\(\)/);
});
