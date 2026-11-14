import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const dest = user.role === 'admin'
      ? '/admin'
      : user.role === 'owner'
        ? '/owner'
      : user.role === 'collector'
          ? '/collector'
          : '/subscriber';
    return <Navigate to={dest} replace />;
  }
  return children;
}
