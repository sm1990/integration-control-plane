import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { fetchProjectPermissions, fetchComponentPermissions } from '../api/auth';

export function useLoadProjectPermissions(orgHandle: string, projectId: string) {
  const { userId } = useAuth();
  const { setProjectPermissions, clearProjectPermissions } = useAccessControl();
  const loadedRef = useRef<string>('');

  useEffect(() => {
    if (!projectId || !userId) return;

    // If switching to a different project, clear previous permissions
    if (loadedRef.current && loadedRef.current !== projectId) {
      clearProjectPermissions();
    }

    if (loadedRef.current === projectId) return;
    loadedRef.current = projectId;

    fetchProjectPermissions(orgHandle, userId, projectId)
      .then((data) => setProjectPermissions(projectId, data.permissionNames))
      .catch((err) => console.error('Failed to fetch project permissions', err));
  }, [orgHandle, projectId, userId, setProjectPermissions, clearProjectPermissions]);
}

export function useLoadComponentPermissions(orgHandle: string, projectId: string, componentId: string) {
  const { userId } = useAuth();
  const { setComponentPermissions, clearComponentPermissions } = useAccessControl();
  const loadedRef = useRef<string>('');

  useEffect(() => {
    // Early return if any required value is missing
    if (!componentId || !projectId || !userId) return;

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
  }, [orgHandle, projectId, componentId, userId, setComponentPermissions, clearComponentPermissions]);
}
