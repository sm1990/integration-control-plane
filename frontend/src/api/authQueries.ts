import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authGet, authPost, authPut, authDelete } from './auth';
import type { User, Role, RoleDetail, Group, GroupRoleMapping, GroupUser, PermissionsResponse, RoleGroupMapping } from './auth';

export function useUsers(orgHandler: string) {
  return useQuery({
    queryKey: ['users', orgHandler],
    queryFn: () => authGet<{ users: User[]; count: number }>(`/orgs/${orgHandler}/users`).then((d) => d.users),
  });
}

export function useCreateUser(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; displayName: string; password: string }) => authPost(`/orgs/${orgHandler}/users`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', orgHandler] }),
  });
}

export function useUpdateUser(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; displayName: string; groupIds: string[] }) => authPut(`/orgs/${orgHandler}/users/${input.userId}`, { displayName: input.displayName, groupIds: input.groupIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', orgHandler] });
      qc.invalidateQueries({ queryKey: ['groupUsers'] });
    },
  });
}

export function useUpdateUserGroups(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; groupIds: string[] }) => authPut(`/orgs/${orgHandler}/users/${input.userId}/groups`, { groupIds: input.groupIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', orgHandler] });
      qc.invalidateQueries({ queryKey: ['groupUsers'] });
    },
  });
}

export function useDeleteUser(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => authDelete(`/orgs/${orgHandler}/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', orgHandler] }),
  });
}

// ── Roles ──

export function useRoles(orgHandler: string, projectId?: string, integrationId?: string) {
  const queryParams = new URLSearchParams();
  if (projectId) queryParams.append('projectId', projectId);
  if (integrationId) queryParams.append('integrationId', integrationId);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return useQuery({
    queryKey: ['roles', orgHandler, projectId, integrationId],
    queryFn: () => authGet<Role[]>(`/orgs/${orgHandler}/roles${queryString}`),
  });
}

export function useRoleDetail(orgHandler: string, roleId: string, projectId?: string, integrationId?: string) {
  const queryParams = new URLSearchParams();
  if (projectId) queryParams.append('projectId', projectId);
  if (integrationId) queryParams.append('integrationId', integrationId);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return useQuery({
    queryKey: ['roleDetail', orgHandler, roleId, projectId, integrationId],
    queryFn: () => authGet<RoleDetail>(`/orgs/${orgHandler}/roles/${roleId}${queryString}`),
    enabled: !!roleId,
  });
}

export function useAllPermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => authGet<PermissionsResponse>('/permissions'),
  });
}

export function useCreateRole(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleName: string; description: string; permissionIds: string[] }) => authPost(`/orgs/${orgHandler}/roles`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles', orgHandler] }),
  });
}

export function useUpdateRole(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string; roleName: string; description: string; permissionIds: string[] }) =>
      authPut(`/orgs/${orgHandler}/roles/${input.roleId}`, { roleName: input.roleName, description: input.description, permissionIds: input.permissionIds }),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['roles', orgHandler] });
      qc.invalidateQueries({ queryKey: ['roleDetail', orgHandler, input.roleId] });
    },
  });
}

export function useDeleteRole(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => authDelete(`/orgs/${orgHandler}/roles/${roleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles', orgHandler] }),
  });
}

export function useRoleGroups(orgHandler: string, roleId: string, projectId?: string, integrationId?: string) {
  const queryParams = new URLSearchParams();
  if (projectId) queryParams.append('projectId', projectId);
  if (integrationId) queryParams.append('integrationId', integrationId);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return useQuery({
    queryKey: ['roleGroups', orgHandler, roleId, projectId, integrationId],
    queryFn: () => authGet<{ mappings: RoleGroupMapping[] }>(`/orgs/${orgHandler}/roles/${roleId}/groups${queryString}`).then((d) => d.mappings ?? []),
    enabled: !!roleId,
  });
}

// ── Groups ──

export function useGroups(orgHandler: string, projectId?: string, integrationId?: string) {
  const queryParams = new URLSearchParams();
  if (projectId) queryParams.append('projectId', projectId);
  if (integrationId) queryParams.append('integrationId', integrationId);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return useQuery({
    queryKey: ['groups', orgHandler, projectId, integrationId],
    queryFn: () => authGet<Group[]>(`/orgs/${orgHandler}/groups${queryString}`),
  });
}

export function useCreateGroup(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupName: string; description: string }) => authPost(`/orgs/${orgHandler}/groups`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', orgHandler] }),
  });
}

export function useUpdateGroup(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupId: string; groupName: string; description: string }) => authPut(`/orgs/${orgHandler}/groups/${input.groupId}`, { groupName: input.groupName, description: input.description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', orgHandler] }),
  });
}

export function useDeleteGroup(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => authDelete(`/orgs/${orgHandler}/groups/${groupId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', orgHandler] }),
  });
}

export function useGroupRoles(orgHandler: string, groupId: string, projectId?: string, integrationId?: string) {
  const queryParams = new URLSearchParams();
  if (projectId) queryParams.append('projectId', projectId);
  if (integrationId) queryParams.append('integrationId', integrationId);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return useQuery({
    queryKey: ['groupRoles', orgHandler, groupId, projectId, integrationId],
    queryFn: () => authGet<{ mappings: GroupRoleMapping[] }>(`/orgs/${orgHandler}/groups/${groupId}/roles${queryString}`).then((d) => d.mappings ?? []),
    enabled: !!groupId,
  });
}

export function useGroupUsers(orgHandler: string, groupId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['groupUsers', orgHandler, groupId],
    queryFn: () => authGet<{ users: GroupUser[] }>(`/orgs/${orgHandler}/groups/${groupId}/users`).then((d) => d.users ?? []),
    enabled: !!groupId && (options?.enabled ?? true),
  });
}

export function useAddRolesToGroup(orgHandler: string, projectId?: string, componentId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupId: string; roleIds: string[]; envUuid?: string }) => {
      const body = {
        roleIds: input.roleIds,
        envUuid: input.envUuid,
        ...(projectId ? { projectUuid: projectId } : {}),
        ...(componentId ? { integrationUuid: componentId } : {}),
      };
      return authPost(`/orgs/${orgHandler}/groups/${input.groupId}/roles`, body);
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['groupRoles', orgHandler, input.groupId] });
      qc.invalidateQueries({ queryKey: ['roleGroups'] });
    },
  });
}

export function useRemoveRoleFromGroup(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupId: string; mappingId: number }) => {
      return authDelete(`/orgs/${orgHandler}/groups/${input.groupId}/roles/${input.mappingId}`);
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['groupRoles', orgHandler, input.groupId] });
      qc.invalidateQueries({ queryKey: ['roleGroups'] });
    },
  });
}

export function useAddUsersToGroup(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupId: string; userIds: string[] }) => authPost(`/orgs/${orgHandler}/groups/${input.groupId}/users`, { userIds: input.userIds }),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['groupUsers', orgHandler, input.groupId] });
      qc.invalidateQueries({ queryKey: ['users', orgHandler] });
    },
  });
}

export function useRemoveUserFromGroup(orgHandler: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupId: string; userId: string }) => authDelete(`/orgs/${orgHandler}/groups/${input.groupId}/users/${input.userId}`),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['groupUsers', orgHandler, input.groupId] });
      qc.invalidateQueries({ queryKey: ['users', orgHandler] });
    },
  });
}
