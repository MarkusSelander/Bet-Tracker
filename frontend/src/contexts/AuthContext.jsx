import { getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authErrorMessage, networkErrorMessage } from '../lib/authForm';
import {
  AUTH_SUBMIT_TIMEOUT_MS,
  fetchAuth,
  fetchWithTimeout,
  getSessionToken,
  isAuthTimeoutError,
  setSessionToken,
} from '../lib/fetch';
import { getFirebaseAuth, isFirebaseReady } from '../lib/firebase';
import { prefetchDashboard } from '../lib/queries';
import { queryClient } from '../lib/queryClient';
import { SESSION_RESTORE_GRACE_MS, SESSION_RESTORE_TIMEOUT_MS, sessionCheckPlan } from '../lib/sessionCheck';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

let activeGoogleLogin = null;

function shareGoogleLogin(uid, run) {
  if (!activeGoogleLogin || activeGoogleLogin.uid !== uid) {
    const promise = run().finally(() => {
      if (activeGoogleLogin?.promise === promise) activeGoogleLogin = null;
    });
    activeGoogleLogin = { uid, promise };
  }
  return activeGoogleLogin.promise;
}

export function warmUpBackend() {
  if (!BACKEND_URL) return;
  fetch(`${BACKEND_URL}/api/health`, { credentials: 'omit', cache: 'no-store' }).catch(() => {});
}

async function fetchCurrentUser(signal) {
  if (!BACKEND_URL) return null;
  const response = await fetchWithTimeout(
    `${BACKEND_URL}/api/auth/me`,
    { credentials: 'include', signal },
    SESSION_RESTORE_TIMEOUT_MS
  );
  if (response.status === 401) {
    setSessionToken(null);
    return null;
  }
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json();
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
  const [loading, setLoading] = useState(() => sessionCheckPlan(getSessionToken()).block || isFirebaseReady());
  const epoch = useRef(0);

  const authenticate = useCallback(async (path, payload) => {
    if (!BACKEND_URL) {
      throw new Error('REACT_APP_BACKEND_URL mangler i bygget');
    }
    const generation = epoch.current;

    let response;
    try {
      response = await fetchAuth(
        `${BACKEND_URL}${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        },
        AUTH_SUBMIT_TIMEOUT_MS
      );
    } catch (error) {
      throw new Error(networkErrorMessage(error));
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const failure = new Error(authErrorMessage(response.status, data?.detail));
      failure.status = response.status;
      throw failure;
    }
    if (!data) {
      const failure = new Error(authErrorMessage(response.status));
      failure.status = response.status;
      throw failure;
    }

    const { session_token: sessionToken, ...userData } = data;
    if (epoch.current !== generation) return userData;
    if (sessionToken) setSessionToken(sessionToken);
    queryClient.clear();
    setUser(userData);
    setLoading(false);
    prefetchDashboard().catch(() => {});
    return userData;
  }, []);

  const loginWithGoogle = useCallback(
    (firebaseUser, { force = false } = {}) => {
      if (force) epoch.current += 1;
      const generation = epoch.current;
      return shareGoogleLogin(`${firebaseUser.uid}:${force ? 'new' : 'restore'}`, async () => {
        if (!force && getSessionToken()) {
          try {
            const existing = await fetchCurrentUser();
            if (existing) {
              if (epoch.current === generation) {
                setUser(existing);
                setLoading(false);
              }
              return existing;
            }
          } catch (error) {
            if (!isAuthTimeoutError(error)) console.error('Auth check failed:', error);
          }
        }

        const idToken = await firebaseUser.getIdToken();
        try {
          return await authenticate('/api/auth/google', {
            id_token: idToken,
            name: firebaseUser.displayName || '',
            picture: firebaseUser.photoURL || '',
          });
        } catch (error) {
          if (error.status === 401) {
            const auth = getFirebaseAuth();
            if (auth) await signOut(auth).catch(() => {});
          }
          throw error;
        }
      });
    },
    [authenticate]
  );

  useEffect(() => {
    warmUpBackend();
    let cancelled = false;
    const grace = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, SESSION_RESTORE_GRACE_MS);

    const applyUser = (next, generation) => {
      if (cancelled || epoch.current !== generation) return;
      setUser(next);
      setLoading(false);
    };

    const restore = async (firebaseUser) => {
      const generation = epoch.current;
      try {
        if (firebaseUser) {
          applyUser(await loginWithGoogle(firebaseUser), generation);
          return;
        }
        if (getSessionToken()) {
          applyUser(await fetchCurrentUser(), generation);
          return;
        }
        applyUser(null, generation);
      } catch (error) {
        if (cancelled || epoch.current !== generation) return;
        if (!isAuthTimeoutError(error)) console.error('Auth check failed:', error);
        applyUser(null, generation);
      }
    };

    const auth = getFirebaseAuth();
    if (!auth) {
      restore(null);
      return () => {
        cancelled = true;
        clearTimeout(grace);
      };
    }

    getRedirectResult(auth).catch((error) => {
      if (!cancelled) console.error('Google redirect failed:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      restore(firebaseUser);
    });

    return () => {
      cancelled = true;
      clearTimeout(grace);
      unsubscribe();
    };
  }, [loginWithGoogle]);

  const logout = useCallback(async () => {
    epoch.current += 1;
    activeGoogleLogin = null;
    setSessionToken(null);
    try {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
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
      queryClient.clear();
      setUser(null);
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, loading, loginWithGoogle, logout, updateUser }),
    [user, loading, loginWithGoogle, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
