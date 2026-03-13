import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { fetchProjectPermissions, fetchComponentPermissions } from '../api/auth';
import { Permissions } from '../constants/permissions';

const ALL_PERMISSIONS = Object.values(Permissions);

export function useLoadProjectPermissions(orgHandle: string, projectId: string) {
  const { userId, isOidcUser } = useAuth();
  const { setProjectPermissions, clearProjectPermissions } = useAccessControl();
  const loadedRef = useRef<string>('');

  useEffect(() => {
    if (!projectId) return;

    if (isOidcUser) {
      // Asgardeo users: grant all permissions locally; the API enforces access via bearer token.
      setProjectPermissions(projectId, ALL_PERMISSIONS);
      return;
    }

    if (!userId) return;

    // If switching to a different project, clear previous permissions
    if (loadedRef.current && loadedRef.current !== projectId) {
      clearProjectPermissions();
    }

    if (loadedRef.current === projectId) return;
    loadedRef.current = projectId;

    fetchProjectPermissions(orgHandle, userId, projectId)
      .then((data) => setProjectPermissions(projectId, data.permissionNames))
      .catch((err) => console.error('Failed to fetch project permissions', err));
  }, [orgHandle, projectId, userId, isOidcUser, setProjectPermissions, clearProjectPermissions]);
}

export function useLoadComponentPermissions(orgHandle: string, projectId: string, componentId: string) {
  const { userId, isOidcUser } = useAuth();
  const { setComponentPermissions, clearComponentPermissions } = useAccessControl();
  const loadedRef = useRef<string>('');

  useEffect(() => {
    if (!componentId || !projectId) return;

    if (isOidcUser) {
      // Asgardeo users: grant all permissions locally; the API enforces access via bearer token.
      setComponentPermissions(componentId, ALL_PERMISSIONS);
      return;
    }

    if (!userId) return;

    // If switching to a different component, clear previous permissions
    if (loadedRef.current && loadedRef.current !== componentId) {
      clearComponentPermissions();
    }

    // Skip if already loaded for this component
    if (loadedRef.current === componentId) return;

    loadedRef.current = componentId;

    fetchComponentPermissions(orgHandle, userId, projectId, componentId)
      .then((data) => setComponentPermissions(componentId, data.permissionNames))
      .catch((err) => console.error('Failed to fetch component permissions', err));
  }, [orgHandle, projectId, componentId, userId, isOidcUser, setComponentPermissions, clearComponentPermissions]);
}
