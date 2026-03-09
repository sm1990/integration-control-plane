import { useEffect } from 'react';
import type { JSX } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { fetchOrgPermissions } from '../api/auth';
import { loginUrl, forceChangePasswordUrl } from '../paths';

export default function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, userId, requirePasswordChange } = useAuth();
  const { setOrgPermissions } = useAccessControl();
  const { pathname } = useLocation();

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

  if (requirePasswordChange && pathname !== forceChangePasswordUrl()) {
    return <Navigate to={forceChangePasswordUrl()} replace />;
  }

  return <Outlet />;
}
