import { useEffect } from 'react';
import type { JSX } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { fetchOrgPermissions } from '../api/auth';
import { loginUrl } from '../paths';
import { Permissions } from '../constants/permissions';

export default function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, isOidcUser, userId } = useAuth();
  const { setOrgPermissions } = useAccessControl();

  useEffect(() => {
    if (!isAuthenticated) return;

    if (isOidcUser) {
      // For Asgardeo/Choreo users the bearer token enforces access server-side.
      // Grant all permissions locally so that all UI features are visible.
      setOrgPermissions(Object.values(Permissions));
      return;
    }

    // ICP-managed users: fetch permissions from the local auth backend.
    if (userId) {
      fetchOrgPermissions('default', userId)
        .then((data) => setOrgPermissions(data.permissionNames))
        .catch((err) => console.error('Failed to fetch org permissions', err));
    }
  }, [isAuthenticated, isOidcUser, userId, setOrgPermissions]);

  if (!isAuthenticated) {
    return <Navigate to={loginUrl()} replace />;
  }

  return <Outlet />;
}
