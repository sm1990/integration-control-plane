import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  PageContent,
  PageTitle,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@wso2/oxygen-ui';
import { ArrowLeft, ChevronDown, ChevronUp, Key, LogOut, Pencil, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { useState, useMemo, useCallback, useEffect, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router';
import SearchField from '../components/SearchField';
import { useAuth } from '../auth/AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { Permissions, ALL_ROLE_MODIFY_PERMISSIONS, ALL_USER_MGT_PERMISSIONS } from '../constants/permissions';
import Authorized from '../components/Authorized';
import { orgRoleDetailUrl, projectRoleDetailUrl, componentRoleDetailUrl, componentAccessControlUrl } from '../paths';
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useRoles,
  useAllPermissions,
  useCreateRole,
  useDeleteRole,
  useGroups,
  useCreateGroup,
  useDeleteGroup,
  useGroupRoles,
  useGroupUsers,
  useAddRolesToGroup,
  useRemoveRoleFromGroup,
  useAddUsersToGroup,
  useUpdateUserGroups,
  useRemoveUserFromGroup,
  useResetPassword,
  useRevokeUserTokens,
} from '../api/authQueries';
import type { User, Group, Permission, Role } from '../api/auth';
import { useAllEnvironments, useProjectByHandler, useComponentByHandler } from '../api/queries';
import type { ComponentScope } from '../nav';

function Loading() {
  return <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />;
}

function useFiltered<T>(items: T[] | undefined, search: string, getSearchStr: (item: T) => string): T[] {
  return useMemo(() => {
    if (!items) return [];
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((x) => getSearchStr(x).toLowerCase().includes(s));
  }, [items, search, getSearchStr]);
}

function FormDialog({
  open,
  onClose,
  title,
  maxWidth = 'xs',
  primaryLabel,
  primaryDisabled,
  onPrimary,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: 'xs' | 'sm';
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ mt: 1 }}>
          {children}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={primaryDisabled} onClick={onPrimary}>
          {primaryLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const mappingLevel = (m: { projectUuid?: string | null; integrationUuid?: string | null }) => (m.integrationUuid ? 'Component' : m.projectUuid ? 'Project' : 'Organization');
const envLabel = (m: { envUuid?: string | null }, environments: { id: string; name: string }[]) => {
  if (!m.envUuid) return 'All';
  const env = environments.find((e) => e.id === m.envUuid);
  return env?.name ?? m.envUuid;
};

const getUserInitial = (user: { displayName?: string; username?: string; email?: string }): string => {
  const initial = user.displayName?.trim().charAt(0) || user.email?.trim().charAt(0) || user.username?.trim().charAt(0) || '?';
  return initial.toUpperCase();
};

// ── Users ──

function CreateUserDialog({ orgHandler, onClose }: { orgHandler: string; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useCreateUser(orgHandler);
  const canSubmit = username.trim() && password.trim() && !mutation.isPending;
  return (
    <FormDialog open onClose={onClose} primaryLabel="Create" primaryDisabled={!canSubmit} onPrimary={() => mutation.mutate({ username, displayName, password }, { onSuccess: onClose })} title="Create User">
      <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
      <TextField label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth />
      <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
    </FormDialog>
  );
}

function AssignGroupsDialog({ orgHandler, user, onClose }: { orgHandler: string; user: User; onClose: () => void }) {
  const { data: allGroups = [] } = useGroups(orgHandler);
  const mutation = useUpdateUserGroups(orgHandler);
  const [selected, setSelected] = useState<Group[]>([]);
  const available = allGroups.filter((g) => !user.groups.some((ug) => ug.groupId === g.groupId));
  return (
    <FormDialog
      open
      onClose={onClose}
      primaryLabel="Assign"
      primaryDisabled={selected.length === 0 || mutation.isPending}
      onPrimary={() => mutation.mutate({ userId: user.userId, groupIds: [...user.groups.map((g) => g.groupId), ...selected.map((g) => g.groupId)] }, { onSuccess: onClose })}
      title="Assign Groups">
      <Autocomplete
        multiple
        options={available}
        getOptionLabel={(g) => g.groupName}
        value={selected}
        onChange={(_, v) => setSelected(v)}
        isOptionEqualToValue={(a, b) => a.groupId === b.groupId}
        renderInput={(params) => <TextField {...params} label="Groups" placeholder="Select groups" />}
      />
    </FormDialog>
  );
}

function UserDetailView({ orgHandler, user, onBack }: { orgHandler: string; user: User; onBack: () => void }) {
  const { username: currentUsername } = useAuth();
  const { hasOrgPermission } = useAccessControl();
  const canManageUsers = hasOrgPermission(Permissions.USER_MANAGE_USERS);
  const isSelf = user.username === currentUsername;
  const removeUserMutation = useRemoveUserFromGroup(orgHandler);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);
  const getSearchStr = useCallback((g: User['groups'][number]) => `${g.groupName} ${g.groupDescription}`, []);
  const filtered = useFiltered(user.groups, search, getSearchStr);
  const removingGroup = removingGroupId ? user.groups.find((g) => g.groupId === removingGroupId) : null;

  return (
    <>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onBack} sx={{ mb: 2 }}>
        Back to Users List
      </Button>
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 3 }}>
        <Avatar sx={{ width: 48, height: 48 }}>{getUserInitial(user)}</Avatar>
        <Stack>
          <Typography variant="h6">{user.displayName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {user.username}
          </Typography>
        </Stack>
      </Stack>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        {!isSelf && (
          <Authorized permissions={Permissions.USER_MANAGE_USERS}>
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAssigning(true)}>
              Assign Groups
            </Button>
          </Authorized>
        )}
      </Stack>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Group Name</TableCell>
            <TableCell>Description</TableCell>
            {!isSelf && (
              <Authorized permissions={Permissions.USER_MANAGE_USERS}>
                <TableCell align="right">Action</TableCell>
              </Authorized>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={!isSelf && canManageUsers ? 3 : 2} align="center">
                No groups assigned
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((g) => (
              <TableRow key={g.groupId}>
                <TableCell>{g.groupName}</TableCell>
                <TableCell>{g.groupDescription}</TableCell>
                {!isSelf && (
                  <Authorized permissions={Permissions.USER_MANAGE_USERS}>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setRemovingGroupId(g.groupId)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </TableCell>
                  </Authorized>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {assigning && <AssignGroupsDialog orgHandler={orgHandler} user={user} onClose={() => setAssigning(false)} />}
      {removingGroup && (
        <Dialog open onClose={() => setRemovingGroupId(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Remove Group</DialogTitle>
          <DialogContent>
            <Typography>
              Remove <strong>{user.displayName}</strong> from <strong>{removingGroup.groupName}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRemovingGroupId(null)}>Cancel</Button>
            <Button variant="contained" color="error" disabled={removeUserMutation.isPending} onClick={() => removeUserMutation.mutate({ groupId: removingGroup.groupId, userId: user.userId }, { onSuccess: () => setRemovingGroupId(null) })}>
              Remove
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

function UsersTab({ orgHandler }: { orgHandler: string }) {
  const { data: users, isLoading } = useUsers(orgHandler);
  const deleteMutation = useDeleteUser(orgHandler);
  const resetPasswordMutation = useResetPassword(orgHandler);
  const revokeTokensMutation = useRevokeUserTokens(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ username: string; password: string } | null>(null);
  const getSearchStr = useCallback((u: User) => `${u.username} ${u.displayName}`, []);
  const filtered = useFiltered(users ?? [], search, getSearchStr);
  const viewingUser = viewingUserId ? users?.find((u) => u.userId === viewingUserId) : null;

  if (isLoading) return <Loading />;
  if (viewingUser) return <UserDetailView orgHandler={orgHandler} user={viewingUser} onBack={() => setViewingUserId(null)} />;
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        <Authorized permissions={Permissions.USER_MANAGE_USERS}>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreating(true)}>
            Create User
          </Button>
        </Authorized>
      </Stack>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Username</TableCell>
            <TableCell>Groups</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((u) => (
            <TableRow key={u.userId} hover sx={{ cursor: 'pointer' }} onClick={() => setViewingUserId(u.userId)}>
              <TableCell>
                <Stack direction="row" alignItems="center" gap={1}>
                  {u.displayName}
                  {u.isOidcUser && <Chip label="OIDC" size="small" color="info" />}
                </Stack>
              </TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>
                {u.groupCount > 0 ? (
                  u.groups.map((g) => <Chip key={g.groupId} label={g.groupName} size="small" sx={{ mr: 0.5 }} />)
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No groups
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                {!u.isSuperAdmin && (
                  <Authorized permissions={Permissions.USER_MANAGE_USERS}>
                    <Tooltip title={u.isOidcUser ? 'Cannot reset password of OIDC user' : 'Reset Password'}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={u.isOidcUser}
                          onClick={(e) => {
                            e.stopPropagation();
                            setResettingUserId(u.userId);
                          }}>
                          <Key size={16} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Revoke Sessions">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevokingUserId(u.userId);
                        }}>
                        <LogOut size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingUserId(u.userId);
                        }}>
                        <Pencil size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingUserId(u.userId);
                        }}>
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Authorized>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {creating && <CreateUserDialog orgHandler={orgHandler} onClose={() => setCreating(false)} />}
      {deletingUserId &&
        (() => {
          const u = users?.find((x) => x.userId === deletingUserId);
          return u ? (
            <Dialog open onClose={() => setDeletingUserId(null)} maxWidth="xs" fullWidth>
              <DialogTitle>Delete User</DialogTitle>
              <DialogContent>
                <Typography>
                  Delete <strong>{u.displayName}</strong> ({u.username})?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDeletingUserId(null)}>Cancel</Button>
                <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(u.userId, { onSuccess: () => setDeletingUserId(null) })}>
                  Delete
                </Button>
              </DialogActions>
            </Dialog>
          ) : null;
        })()}
      {resettingUserId &&
        (() => {
          const u = users?.find((x) => x.userId === resettingUserId);
          return u ? (
            <Dialog open onClose={() => setResettingUserId(null)} maxWidth="xs" fullWidth>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogContent>
                <Typography>
                  Reset the password for <strong>{u.displayName}</strong> ({u.username})? This will generate a one-time password that the user must change on next login.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setResettingUserId(null)}>Cancel</Button>
                <Button
                  variant="contained"
                  color="error"
                  disabled={resetPasswordMutation.isPending}
                  onClick={() =>
                    resetPasswordMutation.mutate(u.userId, {
                      onSuccess: (data) => {
                        setResettingUserId(null);
                        setResetPasswordResult({ username: u.username, password: data.password });
                      },
                    })
                  }>
                  Reset Password
                </Button>
              </DialogActions>
            </Dialog>
          ) : null;
        })()}
      {revokingUserId &&
        (() => {
          const u = users?.find((x) => x.userId === revokingUserId);
          return u ? (
            <Dialog open onClose={() => setRevokingUserId(null)} maxWidth="xs" fullWidth>
              <DialogTitle>Revoke Sessions</DialogTitle>
              <DialogContent>
                <Typography>
                  Revoke all sessions for <strong>{u.displayName}</strong> ({u.username})? This will log the user out of all devices.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRevokingUserId(null)}>Cancel</Button>
                <Button variant="contained" color="error" disabled={revokeTokensMutation.isPending} onClick={() => revokeTokensMutation.mutate(u.userId, { onSuccess: () => setRevokingUserId(null) })}>
                  Revoke Sessions
                </Button>
              </DialogActions>
            </Dialog>
          ) : null;
        })()}
      {resetPasswordResult && <ResetPasswordDialog username={resetPasswordResult.username} password={resetPasswordResult.password} onClose={() => setResetPasswordResult(null)} />}
    </>
  );
}

function ResetPasswordDialog({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Password Reset</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          The password for <strong>{username}</strong> has been reset. Share this one-time password with the user. They will be required to change it on their next login.
        </Typography>
        <Stack direction="row" alignItems="center" gap={1} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600, flex: 1 }}>
            {password}
          </Typography>
          <Button size="small" variant="outlined" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Roles ──

function PermissionsEditor({ allPermissions, selectedIds, onChange }: { allPermissions: Record<string, Permission[]>; selectedIds: Set<string>; onChange: (ids: Set<string>) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (domain: string) => setExpanded((p) => ({ ...p, [domain]: !p[domain] }));
  const toggleDomain = (_domain: string, perms: Permission[]) => {
    const allSelected = perms.every((p) => selectedIds.has(p.permissionId));
    const next = new Set(selectedIds);
    for (const p of perms) {
      if (allSelected) {
        next.delete(p.permissionId);
      } else {
        next.add(p.permissionId);
      }
    }
    onChange(next);
  };
  const togglePerm = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select permissions to assign to this role
      </Typography>
      {Object.entries(allPermissions).map(([domain, perms]) => {
        const count = perms.filter((p) => selectedIds.has(p.permissionId)).length;
        const allChecked = count === perms.length;
        const indeterminate = count > 0 && count < perms.length;
        const isExpanded = expanded[domain] ?? false;
        return (
          <Box key={domain} sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => toggle(domain)}>
              <Checkbox checked={allChecked} indeterminate={indeterminate} onClick={(e) => e.stopPropagation()} onChange={() => toggleDomain(domain, perms)} />
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {domain} ({count}/{perms.length})
              </Typography>
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </Stack>
            {isExpanded && (
              <Box sx={{ pl: 4 }}>
                {perms.map((p) => (
                  <Box key={p.permissionId}>
                    <FormControlLabel control={<Checkbox checked={selectedIds.has(p.permissionId)} onChange={() => togglePerm(p.permissionId)} />} label={p.permissionName} />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function CreateRoleDialog({ orgHandler, allPermissions, onClose }: { orgHandler: string; allPermissions: Record<string, Permission[]>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const mutation = useCreateRole(orgHandler);
  return (
    <FormDialog
      open
      onClose={onClose}
      maxWidth="sm"
      primaryLabel="Create"
      primaryDisabled={!name.trim() || mutation.isPending}
      onPrimary={() => mutation.mutate({ roleName: name, description, permissionIds: [...selectedIds] }, { onSuccess: onClose })}
      title="Create Role">
      <TextField label="Role Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
      <PermissionsEditor allPermissions={allPermissions} selectedIds={selectedIds} onChange={setSelectedIds} />
    </FormDialog>
  );
}

export function RolesTab({ orgHandler, projectId, projectHandler, componentHandler, readOnly }: { orgHandler: string; projectId?: string; projectHandler?: string; componentHandler?: string; readOnly?: boolean }) {
  const navigate = useNavigate();
  const { hasOrgPermission } = useAccessControl();
  const canManageRoles = hasOrgPermission(Permissions.USER_MANAGE_ROLES);
  const effectiveReadOnly = readOnly || !canManageRoles;
  const { data: componentData } = useComponentByHandler(projectId ?? '', componentHandler);
  const componentId = componentData?.id;
  const { data: roles, isLoading } = useRoles(orgHandler, projectId, componentId);
  const { data: allPermsData } = useAllPermissions();
  const deleteMutation = useDeleteRole(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const filtered = useFiltered(roles ?? [], search, (r) => r.roleName);

  const getRoleDetailUrl = (roleId: string) => {
    if (componentHandler && projectHandler) return componentRoleDetailUrl(orgHandler, projectHandler, componentHandler, roleId);
    if (projectHandler) return projectRoleDetailUrl(orgHandler, projectHandler, roleId);
    return orgRoleDetailUrl(orgHandler, roleId);
  };

  if (isLoading) return <Loading />;
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        {!effectiveReadOnly && (
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreating(true)}>
            Create Role
          </Button>
        )}
      </Stack>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Role Name</TableCell>
            <TableCell>Description</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.roleId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(getRoleDetailUrl(r.roleId))}>
              <TableCell>{r.roleName}</TableCell>
              <TableCell>{r.description}</TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(getRoleDetailUrl(r.roleId));
                  }}>
                  <Pencil size={16} />
                </IconButton>
                {!effectiveReadOnly && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingRole(r);
                    }}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {creating && allPermsData && <CreateRoleDialog orgHandler={orgHandler} allPermissions={allPermsData.groupedByDomain} onClose={() => setCreating(false)} />}
      {deletingRole && (
        <Dialog open onClose={() => setDeletingRole(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the role <strong>{deletingRole.roleName}</strong>?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeletingRole(null)}>Cancel</Button>
            <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingRole.roleId, { onSuccess: () => setDeletingRole(null) })}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

// ── Groups ──

function AddToGroupDialog<T>({
  title,
  label,
  placeholder,
  options,
  getOptionLabel,
  idKey,
  existingIds,
  onClose,
  mutate,
  getPayload,
  isPending,
}: {
  title: string;
  label: string;
  placeholder: string;
  options: T[];
  getOptionLabel: (x: T) => string;
  idKey: keyof T;
  existingIds: string[];
  onClose: () => void;
  mutate: (payload: unknown) => void;
  getPayload: (selected: T[]) => unknown;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<T[]>([]);
  const available = options.filter((o) => !existingIds.includes(String((o as Record<string, unknown>)[idKey as string])));
  return (
    <FormDialog open onClose={onClose} primaryLabel="Add" primaryDisabled={selected.length === 0 || isPending} onPrimary={() => mutate(getPayload(selected))} title={title}>
      <Autocomplete
        multiple
        options={available}
        getOptionLabel={getOptionLabel}
        value={selected}
        onChange={(_, v) => setSelected(v)}
        isOptionEqualToValue={(a, b) => (a as Record<string, unknown>)[idKey as string] === (b as Record<string, unknown>)[idKey as string]}
        renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
      />
    </FormDialog>
  );
}

function AddRolesToGroupDialog({ orgHandler, projectId, componentId, groupId, existingRoleIds, onClose }: { orgHandler: string; projectId?: string; componentId?: string; groupId: string; existingRoleIds: string[]; onClose: () => void }) {
  const { data: allRoles = [] } = useRoles(orgHandler, projectId, componentId);
  const { data: allEnvironments = [] } = useAllEnvironments();
  const mutation = useAddRolesToGroup(orgHandler, projectId, componentId);
  const [selected, setSelected] = useState<Role[]>([]);
  const [envMode, setEnvMode] = useState<'all' | 'selected'>('all');
  const [selectedEnvs, setSelectedEnvs] = useState<string[]>([]);
  const available = allRoles.filter((r) => !existingRoleIds.includes(r.roleId));
  const pending = mutation.isPending;

  const assign = () => {
    if (envMode === 'selected' && selectedEnvs.length === 0) {
      return;
    }
    const envUuid = envMode === 'selected' && selectedEnvs.length > 0 ? selectedEnvs[0] : undefined;
    const roleIds = selected.map((r) => r.roleId);
    mutation.mutate(
      { groupId, roleIds, envUuid },
      {
        onSuccess: () => onClose(),
        onError: (error) => {
          console.error('Failed to add roles to group:', error);
        },
      },
    );
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Roles to Group</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            multiple
            options={available}
            getOptionLabel={(r) => r.roleName}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            isOptionEqualToValue={(a, b) => a.roleId === b.roleId}
            renderInput={(params) => <TextField {...params} label="Roles" placeholder="Select roles to add to group" />}
          />
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Applicable Environments
            </Typography>
            <RadioGroup value={envMode} onChange={(e) => setEnvMode(e.target.value as 'all' | 'selected')}>
              <FormControlLabel value="all" control={<Radio />} label="All Environments" />
              <FormControlLabel value="selected" control={<Radio />} label="Selected Environments" />
            </RadioGroup>
            {envMode === 'selected' && (
              <TextField select fullWidth label="Select applicable environments" value={selectedEnvs[0] || ''} onChange={(e) => setSelectedEnvs(e.target.value ? [e.target.value] : [])} sx={{ mt: 2 }}>
                {allEnvironments.map((env) => (
                  <MenuItem key={env.id} value={env.id}>
                    {env.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={selected.length === 0 || pending || (envMode === 'selected' && selectedEnvs.length === 0)} onClick={assign}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AddUsersToGroupDialog({ orgHandler, groupId, existingUserIds, onClose }: { orgHandler: string; groupId: string; existingUserIds: string[]; onClose: () => void }) {
  const { data: allUsers = [] } = useUsers(orgHandler);
  const mutation = useAddUsersToGroup(orgHandler);
  return (
    <AddToGroupDialog
      title="Add Users to Group"
      label="Users"
      placeholder="Select users to add"
      options={allUsers}
      getOptionLabel={(u) => `${u.displayName} (${u.username})`}
      idKey="userId"
      existingIds={existingUserIds}
      onClose={onClose}
      mutate={(payload) => mutation.mutate(payload as { groupId: string; userIds: string[] }, { onSuccess: onClose })}
      getPayload={(selected) => ({ groupId, userIds: selected.map((u) => u.userId) })}
      isPending={mutation.isPending}
    />
  );
}

function GroupDetailView({ orgHandler, projectId, componentId, group, onBack, showUsers = true }: { orgHandler: string; projectId?: string; componentId?: string; group: Group; onBack: () => void; showUsers?: boolean }) {
  const roleModifyPerms: string[] = [...ALL_ROLE_MODIFY_PERMISSIONS];
  if (projectId) roleModifyPerms.push(Permissions.PROJECT_EDIT, Permissions.PROJECT_MANAGE);
  if (componentId) roleModifyPerms.push(Permissions.INTEGRATION_EDIT, Permissions.INTEGRATION_MANAGE);

  const { data: groupRoles = [], isLoading: loadingRoles } = useGroupRoles(orgHandler, group.groupId, projectId, componentId);
  const { data: groupUsers = [], isLoading: loadingUsers } = useGroupUsers(orgHandler, group.groupId, { enabled: showUsers });
  const { data: allEnvironments = [] } = useAllEnvironments();
  const removeRoleMutation = useRemoveRoleFromGroup(orgHandler);
  const removeUserMutation = useRemoveUserFromGroup(orgHandler);
  const [subTab, setSubTab] = useState(showUsers ? 0 : 1);
  const [search, setSearch] = useState('');
  const [addingRoles, setAddingRoles] = useState(false);
  const [addingUsers, setAddingUsers] = useState(false);
  const [removingUser, setRemovingUser] = useState<{ userId: string; displayName: string; username: string } | null>(null);
  const [removingRole, setRemovingRole] = useState<{ id: number; roleName: string } | null>(null);
  const filteredUsers = useFiltered(groupUsers, search, (u) => `${u.displayName} ${u.username}`);
  const filteredRoles = useFiltered(groupRoles, search, (r) => r.roleName);

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onBack} sx={{ mb: 2 }}>
        Back to Group List
      </Button>
      <Typography variant="h6">Group : {group.groupName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Description : {group.description}
      </Typography>
      {showUsers ? (
        <Tabs
          value={subTab}
          onChange={(_, v) => {
            setSubTab(v);
            setSearch('');
          }}
          sx={{ mb: 2 }}>
          <Tab label="Users" />
          <Tab label="Roles" />
        </Tabs>
      ) : (
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Roles
        </Typography>
      )}
      {subTab === 0 && showUsers && (
        <>
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
            <SearchField value={search} onChange={setSearch} />
            <Authorized permissions={Permissions.USER_MANAGE_GROUPS}>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingUsers(true)}>
                Add Users
              </Button>
            </Authorized>
          </Stack>
          {loadingUsers ? (
            <Loading />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Username</TableCell>
                  <Authorized permissions={Permissions.USER_MANAGE_GROUPS}>
                    <TableCell align="right">Action</TableCell>
                  </Authorized>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell>{u.displayName}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <Authorized permissions={Permissions.USER_MANAGE_GROUPS}>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => setRemovingUser(u)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </Authorized>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {addingUsers && <AddUsersToGroupDialog orgHandler={orgHandler} groupId={group.groupId} existingUserIds={groupUsers.map((u) => u.userId)} onClose={() => setAddingUsers(false)} />}
          {removingUser && (
            <Dialog open onClose={() => setRemovingUser(null)} maxWidth="sm" fullWidth>
              <DialogTitle>Remove User from Group</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Are you sure you want to remove <strong>{removingUser.displayName}</strong> from this group?
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRemovingUser(null)}>Cancel</Button>
                <Button variant="contained" color="error" disabled={removeUserMutation.isPending} onClick={() => removeUserMutation.mutate({ groupId: group.groupId, userId: removingUser.userId }, { onSuccess: () => setRemovingUser(null) })}>
                  Remove
                </Button>
              </DialogActions>
            </Dialog>
          )}
        </>
      )}
      {((showUsers && subTab === 1) || !showUsers) && (
        <>
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
            <SearchField value={search} onChange={setSearch} />
            <Authorized permissions={roleModifyPerms}>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingRoles(true)}>
                Add Roles
              </Button>
            </Authorized>
          </Stack>
          {loadingRoles ? (
            <Loading />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Role Name</TableCell>
                  <TableCell align="center">Mapping Level</TableCell>
                  <TableCell align="center">Applicable Environment</TableCell>
                  <Authorized permissions={roleModifyPerms}>
                    <TableCell align="right">Action</TableCell>
                  </Authorized>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.roleName}</TableCell>
                    <TableCell align="center">
                      <Chip label={mappingLevel(r)} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={envLabel(r, allEnvironments)} size="small" />
                    </TableCell>
                    <Authorized permissions={roleModifyPerms}>
                      <TableCell align="right">
                        <Tooltip title={componentId ? (!r.integrationUuid ? 'Org/Project-level mapping' : '') : projectId && !r.projectUuid ? 'Org-level mapping' : ''} placement="right">
                          <span>
                            <IconButton size="small" onClick={() => setRemovingRole({ id: r.id, roleName: r.roleName })} disabled={componentId ? !r.integrationUuid : Boolean(projectId && !r.projectUuid)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </Authorized>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {addingRoles && <AddRolesToGroupDialog orgHandler={orgHandler} projectId={projectId} componentId={componentId} groupId={group.groupId} existingRoleIds={groupRoles.map((r) => r.roleId)} onClose={() => setAddingRoles(false)} />}
          {removingRole && (
            <Dialog open onClose={() => setRemovingRole(null)} maxWidth="sm" fullWidth>
              <DialogTitle>Remove Role from Group</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Are you sure you want to remove the role <strong>{removingRole.roleName}</strong> from this group?
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRemovingRole(null)}>Cancel</Button>
                <Button variant="contained" color="error" disabled={removeRoleMutation.isPending} onClick={() => removeRoleMutation.mutate({ groupId: group.groupId, mappingId: removingRole.id }, { onSuccess: () => setRemovingRole(null) })}>
                  Remove
                </Button>
              </DialogActions>
            </Dialog>
          )}
        </>
      )}
    </Box>
  );
}

function CreateGroupDialog({ orgHandler, onClose }: { orgHandler: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const mutation = useCreateGroup(orgHandler);
  return (
    <FormDialog open onClose={onClose} primaryLabel="Create" primaryDisabled={!name.trim() || mutation.isPending} onPrimary={() => mutation.mutate({ groupName: name, description }, { onSuccess: onClose })} title="Create Group">
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
    </FormDialog>
  );
}

export function GroupsTab({ orgHandler, projectId, componentHandler, readOnly }: { orgHandler: string; projectId?: string; projectHandler?: string; componentHandler?: string; readOnly?: boolean }) {
  const { hasOrgPermission } = useAccessControl();
  const canManageGroups = hasOrgPermission(Permissions.USER_MANAGE_GROUPS);
  const effectiveReadOnly = readOnly || !canManageGroups;
  const { data: componentData } = useComponentByHandler(projectId ?? '', componentHandler);
  const componentId = componentData?.id;
  const { data: groups, isLoading } = useGroups(orgHandler, projectId, componentId);
  const deleteMutation = useDeleteGroup(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const filtered = useFiltered(groups ?? [], search, (g) => g.groupName);

  if (isLoading) return <Loading />;
  if (viewingGroup) return <GroupDetailView orgHandler={orgHandler} projectId={projectId} componentId={componentId} group={viewingGroup} onBack={() => setViewingGroup(null)} showUsers={!projectId && !effectiveReadOnly} />;
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        {!effectiveReadOnly && (
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreating(true)}>
            Create Group
          </Button>
        )}
      </Stack>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Description</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((g) => (
            <TableRow key={g.groupId} hover sx={{ cursor: 'pointer' }} onClick={() => setViewingGroup(g)}>
              <TableCell>{g.groupName}</TableCell>
              <TableCell>{g.description}</TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingGroup(g);
                  }}>
                  <Pencil size={16} />
                </IconButton>
                {!effectiveReadOnly && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingGroup(g);
                    }}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {creating && <CreateGroupDialog orgHandler={orgHandler} onClose={() => setCreating(false)} />}
      {deletingGroup && (
        <Dialog open onClose={() => setDeletingGroup(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Group</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the group <strong>{deletingGroup.groupName}</strong>?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeletingGroup(null)}>Cancel</Button>
            <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingGroup.groupId, { onSuccess: () => setDeletingGroup(null) })}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

// ── Main ──

const ORG_TABS = ['users', 'roles', 'groups'] as const;
const PROJECT_TABS = ['roles', 'groups'] as const;

export default function AccessControl(): JSX.Element {
  const { orgHandler = 'default', tab = 'users' } = useParams();
  const navigate = useNavigate();
  const { hasAnyPermission } = useAccessControl();

  const accessControlPerms: string[] = [...ALL_USER_MGT_PERMISSIONS];
  const canSeeAccessControl = hasAnyPermission(accessControlPerms);

  useEffect(() => {
    if (!canSeeAccessControl) {
      navigate(`/organizations/${orgHandler}`);
    }
  }, [canSeeAccessControl, navigate, orgHandler]);

  const tabIndex = ORG_TABS.indexOf(tab as string as (typeof ORG_TABS)[number]);
  const safeIndex = tabIndex < 0 ? 0 : tabIndex;
  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Access Control</PageTitle.Header>
      </PageTitle>
      <Tabs value={safeIndex} onChange={(_, v) => navigate(`/organizations/${orgHandler}/settings/access-control/${ORG_TABS[v] ?? 'users'}`)} sx={{ mb: 3 }}>
        <Tab label="Users" />
        <Tab label="Roles" />
        <Tab label="Groups" />
      </Tabs>
      {safeIndex === 0 && <UsersTab orgHandler={orgHandler} />}
      {safeIndex === 1 && <RolesTab orgHandler={orgHandler} />}
      {safeIndex === 2 && <GroupsTab orgHandler={orgHandler} />}
    </PageContent>
  );
}

// Wrapper component for organization-level access control (matrix-compatible)
export function OrgAccessControl({ org }: { org: string }): JSX.Element {
  const { tab = 'users' } = useParams();
  const navigate = useNavigate();
  const { hasAnyPermission } = useAccessControl();

  const accessControlPerms: string[] = [...ALL_USER_MGT_PERMISSIONS];
  const canSeeAccessControl = hasAnyPermission(accessControlPerms);

  useEffect(() => {
    if (!canSeeAccessControl) {
      navigate(`/organizations/${org}`);
    }
  }, [canSeeAccessControl, navigate, org]);

  const tabIndex = ORG_TABS.indexOf(tab as string as (typeof ORG_TABS)[number]);
  const safeIndex = tabIndex < 0 ? 0 : tabIndex;
  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Access Control</PageTitle.Header>
      </PageTitle>
      <Tabs value={safeIndex} onChange={(_, v) => navigate(`/organizations/${org}/settings/access-control/${ORG_TABS[v] ?? 'users'}`)} sx={{ mb: 3 }}>
        <Tab label="Users" />
        <Tab label="Roles" />
        <Tab label="Groups" />
      </Tabs>
      {safeIndex === 0 && <UsersTab orgHandler={org} />}
      {safeIndex === 1 && <RolesTab orgHandler={org} />}
      {safeIndex === 2 && <GroupsTab orgHandler={org} />}
    </PageContent>
  );
}

// Wrapper component for project-level access control (matrix-compatible)
export function ProjectAccessControl({ org, project }: { org: string; project: string }): JSX.Element {
  const { tab = 'roles' } = useParams();
  const navigate = useNavigate();
  const { hasAnyPermission } = useAccessControl();
  const { data: projectData, isLoading } = useProjectByHandler(project);
  const projectId = projectData?.id ?? '';

  const accessControlPerms: string[] = [...ALL_USER_MGT_PERMISSIONS, Permissions.PROJECT_EDIT, Permissions.PROJECT_MANAGE];
  const canSeeAccessControl = hasAnyPermission(accessControlPerms, projectId || undefined);

  useEffect(() => {
    if (!isLoading && projectId && !canSeeAccessControl) {
      navigate(`/organizations/${org}/projects/${project}`);
    }
  }, [canSeeAccessControl, isLoading, projectId, navigate, org, project]);

  const tabIndex = PROJECT_TABS.indexOf(tab as string as (typeof PROJECT_TABS)[number]);
  const safeIndex = tabIndex < 0 ? 0 : tabIndex;

  if (isLoading)
    return (
      <PageContent>
        <Loading />
      </PageContent>
    );

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Access Control</PageTitle.Header>
      </PageTitle>
      <Tabs value={safeIndex} onChange={(_, v) => navigate(`/organizations/${org}/projects/${project}/settings/access-control/${PROJECT_TABS[v] ?? 'roles'}`)} sx={{ mb: 3 }}>
        <Tab label="Roles" />
        <Tab label="Groups" />
      </Tabs>
      {safeIndex === 0 && <RolesTab orgHandler={org} projectId={projectId} projectHandler={project} readOnly />}
      {safeIndex === 1 && <GroupsTab orgHandler={org} projectId={projectId} projectHandler={project} readOnly />}
    </PageContent>
  );
}

// Wrapper component for component-level access control (matrix-compatible)
export function ComponentAccessControl({ org, project, component }: ComponentScope): JSX.Element {
  const { tab = 'roles' } = useParams();
  const navigate = useNavigate();
  const { hasAnyPermission } = useAccessControl();
  const { data: projectData, isLoading: loadingProject } = useProjectByHandler(project);
  const projectId = projectData?.id ?? '';
  const { data: componentData, isLoading: loadingComponent } = useComponentByHandler(projectId, component);
  const componentId = componentData?.id;

  const accessControlPerms: string[] = [...ALL_USER_MGT_PERMISSIONS, Permissions.PROJECT_EDIT, Permissions.PROJECT_MANAGE, Permissions.INTEGRATION_EDIT, Permissions.INTEGRATION_MANAGE];
  const canSeeAccessControl = hasAnyPermission(accessControlPerms, projectId || undefined, componentId);

  useEffect(() => {
    if (!loadingProject && !loadingComponent && componentId && !canSeeAccessControl) {
      navigate(`/organizations/${org}/projects/${project}/integrations/${component}`);
    }
  }, [canSeeAccessControl, loadingProject, loadingComponent, componentId, navigate, org, project, component]);

  const tabIndex = PROJECT_TABS.indexOf(tab as string as (typeof PROJECT_TABS)[number]);
  const safeIndex = tabIndex < 0 ? 0 : tabIndex;

  if (loadingProject || loadingComponent)
    return (
      <PageContent>
        <Loading />
      </PageContent>
    );
  if (!projectData)
    return (
      <PageContent>
        <Typography>Project not found</Typography>
      </PageContent>
    );
  if (!componentData)
    return (
      <PageContent>
        <Typography>Component not found</Typography>
      </PageContent>
    );

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Access Control</PageTitle.Header>
      </PageTitle>
      <Tabs value={safeIndex} onChange={(_, v) => navigate(componentAccessControlUrl(org, project, component, PROJECT_TABS[v] ?? 'roles'))} sx={{ mb: 3 }}>
        <Tab label="Roles" />
        <Tab label="Groups" />
      </Tabs>
      {safeIndex === 0 && <RolesTab orgHandler={org} projectId={projectId} projectHandler={project} componentHandler={component} readOnly />}
      {safeIndex === 1 && <GroupsTab orgHandler={org} projectId={projectId} projectHandler={project} componentHandler={component} readOnly />}
    </PageContent>
  );
}
