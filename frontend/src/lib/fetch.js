const AUTH_TIMEOUT_MS = 10000;
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

async function fetchWithTimeout(url, options = {}, timeoutMs = AUTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { headers, credentials = 'include', ...rest } = options;
    return await fetch(url, {
      ...rest,
      credentials,
      headers: authHeaders(headers, getSessionToken()),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Forespørselen tok for lang tid');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export { AUTH_TIMEOUT_MS, SESSION_TOKEN_KEY, getSessionToken, setSessionToken, authHeaders, fetchWithTimeout };
