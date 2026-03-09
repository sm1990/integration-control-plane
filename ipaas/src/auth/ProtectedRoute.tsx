import { useEffect } from 'react';
import type { JSX } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { fetchOrgPermissions } from '../api/auth';
import { loginUrl } from '../paths';

export default function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, userId } = useAuth();
  const { setOrgPermissions } = useAccessControl();

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchOrgPermissions('default', userId)
        .then((data) => setOrgPermissions(data.permissionNames))
        .catch((err) => console.error('Failed to fetch org permissions', err));
    }
  }, [isAuthenticated, userId, setOrgPermissions]);

  if (!isAuthenticated) {
    return <Navigate to={loginUrl()} replace />;
  }

  return <Outlet />;
}
