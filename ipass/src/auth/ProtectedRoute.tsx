import { useEffect } from 'react';
import type { JSX } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { fetchOrgPermissions } from '../api/auth';
import { loginUrl, forceChangePasswordUrl } from '../paths';
import { saveRedirectUrl } from './tokenManager';
import { Permissions } from '../constants/permissions';

export default function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, userId, requirePasswordChange, isOidcUser } = useAuth();
  const { setOrgPermissions } = useAccessControl();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    if (isOidcUser) {
      // OIDC users are authorized by Choreo/Asgardeo with an org-scoped STS token.
      // The local ICP permission backend does not apply — grant all ipass permissions.
      setOrgPermissions(Object.values(Permissions));
      return;
    }

    // For local-auth users, extract the org handle from the current URL path.
    const orgMatch = pathname.match(/^\/organizations\/([^/]+)/);
    const orgHandle = orgMatch?.[1] ?? 'default';
    fetchOrgPermissions(orgHandle, userId)
      .then((data) => setOrgPermissions(data.permissionNames))
      .catch((err) => console.error('Failed to fetch org permissions', err));
  }, [isAuthenticated, userId, isOidcUser, pathname, setOrgPermissions]);

  if (!isAuthenticated) {
    saveRedirectUrl(window.location.href);
    return <Navigate to={loginUrl()} replace />;
  }

  if (requirePasswordChange && pathname !== forceChangePasswordUrl()) {
    return <Navigate to={forceChangePasswordUrl()} replace />;
  }

  return <Outlet />;
}
