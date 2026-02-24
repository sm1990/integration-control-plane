import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode, JSX } from 'react';

interface AccessControlContextType {
  setOrgPermissions: (permissions: string[]) => void;
  setProjectPermissions: (projectId: string, permissions: string[]) => void;
  setComponentPermissions: (componentId: string, permissions: string[]) => void;

  hasOrgPermission: (permission: string) => boolean;
  hasProjectPermission: (projectId: string, permission: string) => boolean;
  hasComponentPermission: (componentId: string, permission: string) => boolean;

  hasPermission: (permission: string, projectId?: string, componentId?: string) => boolean;
  hasAllPermissions: (permissions: string[], projectId?: string, componentId?: string) => boolean;
  hasAnyPermission: (permissions: string[], projectId?: string, componentId?: string) => boolean;

  clearPermissions: () => void;
  clearProjectPermissions: () => void;
  clearComponentPermissions: () => void;
}

const AccessControlContext = createContext<AccessControlContextType | undefined>(undefined);

export function AccessControlProvider({ children }: { children: ReactNode }): JSX.Element {
  const [orgPerms, setOrgPerms] = useState<Set<string>>(new Set());
  const [projectPermsMap, setProjectPermsMap] = useState<Map<string, Set<string>>>(new Map());
  const [componentPermsMap, setComponentPermsMap] = useState<Map<string, Set<string>>>(new Map());

  const setOrgPermissions = useCallback((permissions: string[]) => {
    setOrgPerms(new Set(permissions));
  }, []);

  const setProjectPermissions = useCallback((projectId: string, permissions: string[]) => {
    setProjectPermsMap((prev) => {
      const updated = new Map(prev);
      updated.set(projectId, new Set(permissions));
      return updated;
    });
  }, []);

  const setComponentPermissions = useCallback((componentId: string, permissions: string[]) => {
    setComponentPermsMap((prev) => {
      const updated = new Map(prev);
      updated.set(componentId, new Set(permissions));
      return updated;
    });
  }, []);

  const hasOrgPermission = useCallback((permission: string) => orgPerms.has(permission), [orgPerms]);

  const hasProjectPermission = useCallback((projectId: string, permission: string) => projectPermsMap.get(projectId)?.has(permission) ?? false, [projectPermsMap]);

  const hasComponentPermission = useCallback((componentId: string, permission: string) => componentPermsMap.get(componentId)?.has(permission) ?? false, [componentPermsMap]);

  const hasPermission = useCallback(
    (permission: string, projectId?: string, componentId?: string) => {
      if (hasOrgPermission(permission)) return true;
      if (projectId && hasProjectPermission(projectId, permission)) return true;
      if (componentId && hasComponentPermission(componentId, permission)) return true;
      return false;
    },
    [hasOrgPermission, hasProjectPermission, hasComponentPermission],
  );

  const hasAllPermissions = useCallback((permissions: string[], projectId?: string, componentId?: string) => permissions.every((p) => hasPermission(p, projectId, componentId)), [hasPermission]);

  const hasAnyPermission = useCallback((permissions: string[], projectId?: string, componentId?: string) => permissions.some((p) => hasPermission(p, projectId, componentId)), [hasPermission]);

  const clearPermissions = useCallback(() => {
    setOrgPerms(new Set());
    setProjectPermsMap(new Map());
    setComponentPermsMap(new Map());
  }, []);

  const clearProjectPermissions = useCallback(() => {
    setProjectPermsMap(new Map());
    setComponentPermsMap(new Map());
  }, []);

  const clearComponentPermissions = useCallback(() => {
    setComponentPermsMap(new Map());
  }, []);

  const value = useMemo<AccessControlContextType>(
    () => ({
      setOrgPermissions,
      setProjectPermissions,
      setComponentPermissions,
      hasOrgPermission,
      hasProjectPermission,
      hasComponentPermission,
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      clearPermissions,
      clearProjectPermissions,
      clearComponentPermissions,
    }),
    [setOrgPermissions, setProjectPermissions, setComponentPermissions, hasOrgPermission, hasProjectPermission, hasComponentPermission, hasPermission, hasAllPermissions, hasAnyPermission, clearPermissions, clearProjectPermissions, clearComponentPermissions],
  );

  return <AccessControlContext.Provider value={value}>{children}</AccessControlContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccessControl(): AccessControlContextType {
  const context = useContext(AccessControlContext);
  if (!context) {
    throw new Error('useAccessControl must be used within AccessControlProvider');
  }
  return context;
}
