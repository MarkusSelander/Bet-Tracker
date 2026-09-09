const { test } = require('node:test');
const assert = require('node:assert/strict');

function authHeaders(headers, token) {
  const next = { ...(headers || {}) };
  const hasAuth = Object.keys(next).some((key) => key.toLowerCase() === 'authorization');
  if (token && !hasAuth) {
    next.Authorization = `Bearer ${token}`;
  }
  return next;
}

test('authHeaders adds Bearer when missing', () => {
  assert.deepEqual(authHeaders({ 'Content-Type': 'application/json' }, 'session_abc'), {
    'Content-Type': 'application/json',
    Authorization: 'Bearer session_abc',
  });
});

test('authHeaders does not overwrite existing Authorization', () => {
  const headers = { Authorization: 'Bearer keep' };
  assert.equal(authHeaders(headers, 'session_new').Authorization, 'Bearer keep');
});

test('authHeaders skips when token is empty', () => {
  assert.deepEqual(authHeaders({}, null), {});
});
