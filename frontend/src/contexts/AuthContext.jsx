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
          console.error('REACT_APP_BACKEND_URL is not defined');
          setLoading(false);
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include',
        });

        if (!response.ok) {
          // Only clear user on explicit auth failure (401, 403)
          if (response.status === 401 || response.status === 403) {
            setUser(null);
          }
          // Don't clear user on network errors or server errors (5xx)
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Non-JSON response from /me');
          return;
        }

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error('Auth check failed:', error);
        // Don't clear user on network errors - they might be temporary
      } finally {
        // Only set loading to false on initial load
        if (loading) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    // Periodically re-validate session (every 5 minutes)
    // This won't kick users out on network errors
    const interval = setInterval(
      () => {
        if (user) {
          // Only recheck if user is logged in
          checkAuth();
        }
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only re-run when user changes

  const register = async (email, password, name) => {
    if (!BACKEND_URL) {
      throw new Error('REACT_APP_BACKEND_URL is not defined');
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        let errorMessage = 'Registrering feilet';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Ugyldig svar fra serveren');
      }

      const userData = await response.json();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Registration error details:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    if (!BACKEND_URL) {
      throw new Error('REACT_APP_BACKEND_URL is not defined');
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let errorMessage = 'Innlogging feilet';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Ugyldig svar fra serveren');
      }

      const userData = await response.json();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Login error details:', error);
      throw error;
    }
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
