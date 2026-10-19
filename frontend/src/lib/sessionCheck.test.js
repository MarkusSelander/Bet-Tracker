const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let sessionCheckPlan;
let SESSION_RESTORE_GRACE_MS;

before(async () => {
  ({ sessionCheckPlan, SESSION_RESTORE_GRACE_MS } = await import('./sessionCheck.js'));
});

test('session check does not block when there is no stored token', () => {
  assert.deepEqual(sessionCheckPlan(null), { restore: false, block: false });
  assert.deepEqual(sessionCheckPlan(''), { restore: false, block: false });
});

test('session check only blocks briefly when a token is stored', () => {
  const plan = sessionCheckPlan('session_abc');
  assert.equal(plan.restore, true);
  assert.equal(plan.block, true);
  assert.equal(plan.graceMs, SESSION_RESTORE_GRACE_MS);
  assert.ok(plan.graceMs < 2000);
  assert.ok(plan.timeoutMs > plan.graceMs);
});
