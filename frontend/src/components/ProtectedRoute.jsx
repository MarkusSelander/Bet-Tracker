import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (user) {
    return React.cloneElement(children, { user });
  }

  // Lagret token eller en Firebase-økt som fortsatt leses skal ikke vise
  // innloggingsskjemaet. Uten økt blir loading false etter en kort grace.
  if (loading) {
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
