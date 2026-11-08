import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from './BrandMark';

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
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-4">
          <BrandMark className="h-10 w-10 animate-pulse rounded-xl" />
          <p className="eyebrow">Laster</p>
        </div>
      </div>
    );
  }

  return <Navigate to="/login" replace state={{ from: location }} />;
}
