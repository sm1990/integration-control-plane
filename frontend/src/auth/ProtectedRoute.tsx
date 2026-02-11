import type { JSX } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthContext';
import { loginUrl } from '../paths';

export default function ProtectedRoute(): JSX.Element {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={loginUrl()} replace />;
  }

  return <Outlet />;
}
