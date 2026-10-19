import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authErrorMessage, networkErrorMessage } from '../lib/authForm';
import { fetchAuth, fetchWithTimeout, getSessionToken, isAuthTimeoutError, setSessionToken } from '../lib/fetch';
import { queryClient } from '../lib/queryClient';
import { sessionCheckPlan } from '../lib/sessionCheck';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Render legger API-et i dvale. En ping mens brukeren fyller ut skjemaet
// gjør at innloggingen ikke selv må vente på at prosessen starter.
export function warmUpBackend() {
  if (!BACKEND_URL) return;
  fetch(`${BACKEND_URL}/api/health`, { credentials: 'omit', cache: 'no-store' }).catch(() => {});
}

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => sessionCheckPlan(getSessionToken()).block);
  const authCheckId = useRef(0);
  const authCheckAbort = useRef(null);

  useEffect(() => {
    warmUpBackend();

    const plan = sessionCheckPlan(getSessionToken());
    if (!plan.restore) {
      setLoading(false);
      return undefined;
    }

    const checkId = ++authCheckId.current;
    const controller = new AbortController();
    authCheckAbort.current = controller;
    const graceTimer = setTimeout(() => {
      if (authCheckId.current === checkId) setLoading(false);
    }, plan.graceMs);

    const checkAuth = async () => {
      try {
        if (!BACKEND_URL) {
          throw new Error('REACT_APP_BACKEND_URL is not defined');
        }

        const response = await fetchWithTimeout(
          `${BACKEND_URL}/api/auth/me`,
          { credentials: 'include', signal: controller.signal },
          plan.timeoutMs
        );

        if (authCheckId.current !== checkId) return;

        if (!response.ok) {
          if (response.status === 401) setSessionToken(null);
          setUser(null);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Non-JSON response from /me');
        }

        const userData = await response.json();
        if (authCheckId.current !== checkId) return;
        setUser(userData);
      } catch (error) {
        if (authCheckId.current !== checkId || controller.signal.aborted) return;
        if (!isAuthTimeoutError(error)) console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        if (authCheckId.current === checkId) setLoading(false);
      }
    };

    checkAuth();
    return () => {
      clearTimeout(graceTimer);
      controller.abort();
    };
  }, []);

  const authenticate = useCallback(async (path, payload) => {
    if (!BACKEND_URL) {
      throw new Error('REACT_APP_BACKEND_URL mangler i bygget');
    }

    let response;
    try {
      response = await fetchAuth(`${BACKEND_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error(networkErrorMessage(error));
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      throw new Error(authErrorMessage(response.status, data?.detail));
    }
    if (!data) {
      throw new Error(authErrorMessage(response.status));
    }

    // /auth/me avbrytes først når innloggingen lyktes, så et feilet forsøk ikke
    // stopper sjekken av en gyldig cookie-sesjon.
    authCheckId.current += 1;
    authCheckAbort.current?.abort();
    setLoading(false);

    const { session_token: sessionToken, ...userData } = data;
    if (sessionToken) setSessionToken(sessionToken);
    queryClient.clear();
    setUser(userData);
    return userData;
  }, []);

  const login = useCallback(
    (email, password) => authenticate('/api/auth/login', { email: email.trim(), password }),
    [authenticate]
  );

  const register = useCallback(
    ({ name, email, password }) =>
      authenticate('/api/auth/register', { name: name.trim(), email: email.trim(), password }),
    [authenticate]
  );

  const logout = useCallback(async () => {
    authCheckId.current += 1;
    authCheckAbort.current?.abort();
    try {
      if (BACKEND_URL) {
        await fetchWithTimeout(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setSessionToken(null);
      queryClient.clear();
      setUser(null);
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateUser }),
    [user, loading, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
