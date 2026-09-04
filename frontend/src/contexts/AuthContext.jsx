import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fetchWithTimeout } from '../lib/fetch';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
  const [loading, setLoading] = useState(true);
  const authCheckId = useRef(0);

  useEffect(() => {
    const checkId = ++authCheckId.current;

    const checkAuth = async () => {
      try {
        if (!BACKEND_URL) {
          throw new Error('REACT_APP_BACKEND_URL is not defined');
        }

        const response = await fetchWithTimeout(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include',
        });

        if (authCheckId.current !== checkId) return;

        if (!response.ok) {
          setUser(null);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Non-JSON response from /me');
        }

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        if (authCheckId.current !== checkId) return;
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        if (authCheckId.current === checkId) {
          setLoading(false);
        }
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    if (!BACKEND_URL) {
      throw new Error('REACT_APP_BACKEND_URL is not defined');
    }

    authCheckId.current += 1;
    setLoading(false);

    const response = await fetchWithTimeout(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('Databasen er utilgjengelig. Prøv igjen om et øyeblikk.');
      }
      throw new Error('Login failed');
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid login response');
    }

    const userData = await response.json();
    delete userData.session_token;
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    authCheckId.current += 1;
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
      setUser(null);
      setLoading(false);
    }
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
};
