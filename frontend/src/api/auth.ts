import { getAccessToken } from '../auth/tokenManager';
import { authApiBaseUrl } from '../paths';

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${authApiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export function authGet<T>(path: string): Promise<T> {
  return authFetch<T>(path);
}

export function authPost<T>(path: string, body: unknown): Promise<T> {
  return authFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function authPut<T>(path: string, body: unknown): Promise<T> {
  return authFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function authDelete<T>(path: string): Promise<T> {
  return authFetch<T>(path, { method: 'DELETE' });
}

// ── Types ──

export interface User {
  userId: string;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  groups: { groupId: string; groupName: string; groupDescription: string }[];
  groupCount: number;
}

export interface Role {
  roleId: string;
  roleName: string;
  description: string;
  orgId: number;
}

export interface Permission {
  permissionId: string;
  permissionName: string;
  permissionDomain: string;
  resourceType: string;
  action: string;
  description: string;
}

export interface PermissionsResponse {
  permissions: Permission[];
  groupedByDomain: Record<string, Permission[]>;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
}

export interface Group {
  groupId: string;
  groupName: string;
  description: string;
}

export interface GroupRoleMapping {
  id: number;
  groupId: string;
  roleId: string;
  roleName: string;
  roleDescription: string;
  orgUuid: number;
  projectUuid: string | null;
  envUuid: string | null;
  integrationUuid: string | null;
}

export interface GroupUser {
  userId: string;
  username: string;
  displayName: string;
}

export interface RoleGroupMapping {
  id: number;
  groupId: string;
  groupName?: string;
  groupDescription?: string;
  roleId: string;
  orgUuid: number;
  projectUuid: string | null;
  envUuid: string | null;
  integrationUuid: string | null;
}
