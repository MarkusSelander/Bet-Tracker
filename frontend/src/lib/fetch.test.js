const fs = require('fs');
const Module = require('module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('path');

function loadFetchModule() {
  const filename = path.resolve(__dirname, 'fetch.js');
  let code = fs.readFileSync(filename, 'utf8');
  code = code.replace(/export\s+\{[^}]+\};?\s*$/, '');
  const m = new Module(filename);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const footer = [
    'module.exports = {',
    '  AUTH_TIMEOUT_MS, AUTH_SUBMIT_TIMEOUT_MS, AUTH_ATTEMPTS, TIMEOUT_MESSAGE, SESSION_TOKEN_KEY,',
    '  getSessionToken, setSessionToken, authHeaders,',
    '  fetchWithTimeout, fetchAuth, isAuthTimeoutError,',
    '};',
  ].join('\n');
  m._compile(`${code}\n${footer}\n`, filename);
  return m.exports;
}

const fetchApi = loadFetchModule();

function abortableHang(signal) {
  return new Promise((_resolve, reject) => {
    const fail = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal.aborted) {
      fail();
      return;
    }
    signal.addEventListener('abort', fail, { once: true });
  });
}

test('authHeaders adds Bearer when missing', () => {
  assert.deepEqual(fetchApi.authHeaders({ 'Content-Type': 'application/json' }, 'session_abc'), {
    'Content-Type': 'application/json',
    Authorization: 'Bearer session_abc',
  });
});

test('authHeaders does not overwrite existing Authorization', () => {
  const headers = { Authorization: 'Bearer keep' };
  assert.equal(fetchApi.authHeaders(headers, 'session_new').Authorization, 'Bearer keep');
});

test('authHeaders skips when token is empty', () => {
  assert.deepEqual(fetchApi.authHeaders({}, null), {});
});

test('fetchWithTimeout maps its own abort to the timeout error', async () => {
  const original = global.fetch;
  global.fetch = (_url, options) => abortableHang(options.signal);
  try {
    await assert.rejects(
      () => fetchApi.fetchWithTimeout('https://example.test/api/auth/me', {}, 30),
      (error) => error.message === 'Forespørselen tok for lang tid'
    );
  } finally {
    global.fetch = original;
  }
});

test('fetchAuth does not retry a timed-out auth call', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = (_url, options) => {
    calls += 1;
    return abortableHang(options.signal);
  };
  try {
    await assert.rejects(
      () => fetchApi.fetchAuth('https://example.test/api/auth/google', { method: 'POST' }, 30),
      (error) => error.message === 'Forespørselen tok for lang tid'
    );
    assert.equal(calls, 1);
    assert.equal(fetchApi.AUTH_ATTEMPTS, 1);
    assert.equal(fetchApi.AUTH_SUBMIT_TIMEOUT_MS, 60000);
    assert.equal(fetchApi.AUTH_TIMEOUT_MS, 10000);
  } finally {
    global.fetch = original;
  }
});

test('fetchAuth does not retry a caller abort or a network error', async () => {
  const original = global.fetch;
  const controller = new AbortController();
  let abortedCalls = 0;
  global.fetch = (_url, options) => {
    abortedCalls += 1;
    return abortableHang(options.signal);
  };
  const abortTimer = setTimeout(() => controller.abort(), 15);
  try {
    await assert.rejects(
      () => fetchApi.fetchAuth('https://example.test/api/auth/me', { signal: controller.signal }, 1000),
      (error) => error.name === 'AbortError'
    );
    assert.equal(abortedCalls, 1);
  } finally {
    clearTimeout(abortTimer);
    global.fetch = original;
  }

  let networkCalls = 0;
  global.fetch = async () => {
    networkCalls += 1;
    throw new TypeError('Failed to fetch');
  };
  try {
    await assert.rejects(
      () => fetchApi.fetchAuth('https://example.test/api/auth/me', {}, 50),
      (error) => error instanceof TypeError && error.message === 'Failed to fetch'
    );
    assert.equal(networkCalls, 1);
  } finally {
    global.fetch = original;
  }
});

test('fetchAuth does not retry after a fast response', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: true, status: 200 };
  };
  try {
    const response = await fetchApi.fetchAuth('https://example.test/api/auth/me', {}, 50);
    assert.equal(response.ok, true);
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test('session token is kept in localStorage so login survives a closed browser', () => {
  const source = fs.readFileSync(path.resolve(__dirname, 'fetch.js'), 'utf8');
  assert.match(source, /localStorage\.getItem\(SESSION_TOKEN_KEY\)/);
  assert.match(source, /localStorage\.setItem\(SESSION_TOKEN_KEY, token\)/);
  assert.doesNotMatch(source, /sessionStorage/);

  const store = new Map();
  global.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  assert.equal(fetchApi.SESSION_TOKEN_KEY, 'bet_tracker_session_token');
  fetchApi.setSessionToken('session_abc');
  assert.equal(store.get('bet_tracker_session_token'), 'session_abc');
  assert.equal(fetchApi.getSessionToken(), 'session_abc');
  fetchApi.setSessionToken(null);
  assert.equal(fetchApi.getSessionToken(), null);
  assert.equal(store.has('bet_tracker_session_token'), false);
});

test('auth page signs in with Google without a server-wake hint', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../pages/Login.jsx'), 'utf8');
  assert.match(source, /signInWithPopup/);
  assert.match(source, /Fortsett med Google/);
  assert.match(source, /Logger inn\.\.\./);
  assert.match(source, /data-testid="google-login-btn"/);
  assert.match(source, /data-testid="privacy-link"/);
  assert.match(source, /Personvern/);
  assert.doesNotMatch(source, /autoComplete="current-password"/);
  assert.doesNotMatch(source, /autoComplete="new-password"/);
  assert.doesNotMatch(source, /Vekker serveren/);
  assert.doesNotMatch(source, /setWarming/);
  assert.doesNotMatch(source, /warmUpBackend/);
  assert.doesNotMatch(source, /auth-warming/);
  assert.match(source, /preloadDashboard\(\)/);
  assert.match(source, /type="submit"/);
  assert.match(source, /submitRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(source, /select_account/);

  const firebaseSource = fs.readFileSync(path.resolve(__dirname, 'firebase.js'), 'utf8');
  assert.match(firebaseSource, /indexedDBLocalPersistence/);
  assert.match(firebaseSource, /browserLocalPersistence/);
  assert.doesNotMatch(firebaseSource, /browserSessionPersistence/);
  assert.doesNotMatch(firebaseSource, /inMemoryPersistence/);

  const authSource = fs.readFileSync(path.resolve(__dirname, '../contexts/AuthContext.jsx'), 'utf8');
  assert.doesNotMatch(authSource, /warmUpBackend/);
  assert.doesNotMatch(authSource, /\/api\/health/);
});
