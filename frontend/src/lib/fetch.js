const AUTH_TIMEOUT_MS = 10000;
const AUTH_ATTEMPTS = 2;
const TIMEOUT_MESSAGE = 'Forespørselen tok for lang tid';
const SESSION_TOKEN_KEY = 'bet_tracker_session_token';

function getSessionToken() {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch (error) {
    return null;
  }
}

function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
    else localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch (error) {
    /* private mode */
  }
}

function authHeaders(headers, token) {
  const next = { ...(headers || {}) };
  const hasAuth = Object.keys(next).some((key) => key.toLowerCase() === 'authorization');
  if (token && !hasAuth) {
    next.Authorization = `Bearer ${token}`;
  }
  return next;
}

function isAuthTimeoutError(error) {
  return Boolean(error && error.message === TIMEOUT_MESSAGE);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AUTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const callerSignal = options.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort);
  }
  try {
    const { headers, credentials = 'include', signal: _callerSignal, ...rest } = options;
    return await fetch(url, {
      ...rest,
      credentials,
      headers: authHeaders(headers, getSessionToken()),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (callerSignal?.aborted) throw error;
      throw new Error(TIMEOUT_MESSAGE);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
  }
}

// Ett ekstra forsøk når API-prosessen fortsatt våkner. Vanlige kall beholder
// samme tidsfrist, så en hengende spørring ikke får et lengre vindu.
async function fetchAuth(url, options = {}, timeoutMs = AUTH_TIMEOUT_MS) {
  for (let attempt = 1; attempt <= AUTH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (error) {
      const canRetry = isAuthTimeoutError(error) && !options.signal?.aborted && attempt < AUTH_ATTEMPTS;
      if (!canRetry) throw error;
    }
  }
  throw new Error(TIMEOUT_MESSAGE);
}

export {
  AUTH_ATTEMPTS,
  AUTH_TIMEOUT_MS,
  SESSION_TOKEN_KEY,
  TIMEOUT_MESSAGE,
  authHeaders,
  fetchAuth,
  fetchWithTimeout,
  getSessionToken,
  isAuthTimeoutError,
  setSessionToken,
};
