import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 10000; // 10 seconds

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Helper function to create fetch with timeout
const fetchWithTimeout = (url, options = {}, timeout = FETCH_TIMEOUT) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout)),
  ]);
};

// Helper function to make authenticated API calls
const makeAuthRequest = async (endpoint, method = 'POST', body = null) => {
  if (!BACKEND_URL) {
    throw new Error('REACT_APP_BACKEND_URL is not defined');
  }

  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetchWithTimeout(`${BACKEND_URL}${endpoint}`, options);

    if (!response.ok) {
      let errorMessage = 'Request failed';
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
      throw new Error('Invalid server response');
    }

    return await response.json();
  } catch (error) {
    console.error(`API request error (${endpoint}):`, error);
    throw error;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const authCheckInProgressRef = useRef(false);

  const isMountedRef = useRef(true);
  const authCheckInProgressRef = useRef(false);

  // Memoized auth check function
  const checkAuth = useCallback(async (isInitialLoad = false) => {
    // Prevent concurrent auth checks
    if (authCheckInProgressRef.current) {
      return;
    }

    authCheckInProgressRef.current = true;

    try {
      if (!BACKEND_URL) {
        console.error('REACT_APP_BACKEND_URL is not defined');
        if (isInitialLoad && isMountedRef.current) {
          setLoading(false);
        }
        return;
      }

      const response = await fetchWithTimeout(`${BACKEND_URL}/api/auth/me`, { credentials: 'include' });

      if (!isMountedRef.current) return;

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

      if (isMountedRef.current) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Don't clear user on network errors - they might be temporary
    } finally {
      authCheckInProgressRef.current = false;
      if (isInitialLoad && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Initial auth check
    checkAuth(true);

    // Set up periodic re-validation (every 5 minutes)
    const interval = setInterval(() => {
      checkAuth(false);
    }, AUTH_CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      isMountedRef.current = false;
    };
  }, [checkAuth]);

  const register = useCallback(async (email, password, name) => {
    // Input validation
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email is required');
    }
    if (!password || typeof password !== 'string') {
      throw new Error('Valid password is required');
    }

    const userData = await makeAuthRequest('/api/auth/register', 'POST', {
      email: email.trim(),
      password,
      name: name?.trim() || undefined,
    });

    if (isMountedRef.current) {
      setUser(userData);
    }
    return userData;
  }, []);

  const login = useCallback(async (email, password) => {
    // Input validation
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email is required');
    }
    if (!password || typeof password !== 'string') {
      throw new Error('Valid password is required');
    }

    const userData = await makeAuthRequest('/api/auth/login', 'POST', {
      email: email.trim(),
      password,
    });

    if (isMountedRef.current) {
      setUser(userData);
    }
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (BACKEND_URL) {
        await fetchWithTimeout(
          `${BACKEND_URL}/api/auth/logout`,
          { method: 'POST', credentials: 'include' },
          5000 // Shorter timeout for logout
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if API call fails
    } finally {
      if (isMountedRef.current) {
        setUser(null);
      }
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
