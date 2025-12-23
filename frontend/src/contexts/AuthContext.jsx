import { createContext, useContext, useEffect, useState } from 'react';

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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!BACKEND_URL) {
          throw new Error('REACT_APP_BACKEND_URL is not defined');
        }

        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include',
        });

        if (!response.ok) {
          // Clear user state on auth failure (401, 403, etc.)
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
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Periodically re-validate session (every 5 minutes) to prevent unexpected logouts
    const interval = setInterval(checkAuth, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const register = async (email, password, name) => {
    if (!BACKEND_URL) {
      throw new Error('REACT_APP_BACKEND_URL is not defined');
    }

    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Registration failed');
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid registration response');
    }

    const userData = await response.json();
    setUser(userData);
    return userData;
  };

  const login = async (email, password) => {
    if (!BACKEND_URL) {
      throw new Error('REACT_APP_BACKEND_URL is not defined');
    }

    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Login failed');
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid login response');
    }

    const userData = await response.json();
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      if (BACKEND_URL) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, register }}>{children}</AuthContext.Provider>;
};
