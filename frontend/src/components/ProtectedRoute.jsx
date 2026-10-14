import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSessionToken } from '../lib/fetch';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (user) {
    return React.cloneElement(children, { user });
  }

  // Uten lagret token er brukeren nesten alltid utlogget. Da vises innloggingen
  // med en gang; finnes det likevel en gyldig cookie, sender /login videre når
  // /auth/me svarer.
  if (loading && getSessionToken()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Laster...</p>
        </div>
      </div>
    );
  }

  return <Navigate to="/login" replace state={{ from: location }} />;
}
