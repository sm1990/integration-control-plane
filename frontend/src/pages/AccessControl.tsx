import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  PageContent,
  PageTitle,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@wso2/oxygen-ui';
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Plus, Trash2, Users, Lock } from '@wso2/oxygen-ui-icons-react';
import { useState, useMemo, useCallback, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router';
import SearchField from '../components/SearchField';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useRoles,
  useRoleDetail,
  useAllPermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useRoleGroups,
  useGroups,
  useCreateGroup,
  useDeleteGroup,
  useGroupRoles,
  useGroupUsers,
  useAddRolesToGroup,
  useRemoveRoleFromGroup,
  useAddUsersToGroup,
  useRemoveUserFromGroup,
} from '../api/authQueries';
import type { User, Group, Permission, RoleGroupMapping } from '../api/auth';

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

const mappingLevel = (m: { projectUuid?: string | null }) => (m.projectUuid ? 'Project' : 'Organization');
const envLabel = (m: { envUuid?: string | null }) => m.envUuid ?? 'All';

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

function EditUserDialog({ orgHandler, user, groups, onClose }: { orgHandler: string; user: User; groups: Group[]; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [selectedGroups, setSelectedGroups] = useState<Group[]>(groups.filter((g) => user.groups.some((ug) => ug.groupId === g.groupId)));
  const mutation = useUpdateUser(orgHandler);
  return (
    <FormDialog open onClose={onClose} primaryLabel="Save" primaryDisabled={mutation.isPending} onPrimary={() => mutation.mutate({ userId: user.userId, displayName, groupIds: selectedGroups.map((g) => g.groupId) }, { onSuccess: onClose })} title="Edit User">
      <TextField label="Username" value={user.username} disabled fullWidth />
      <TextField label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth />
      <Autocomplete
        multiple
        options={groups}
        getOptionLabel={(g) => g.groupName}
        value={selectedGroups}
        onChange={(_, v) => setSelectedGroups(v)}
        isOptionEqualToValue={(a, b) => a.groupId === b.groupId}
        renderInput={(params) => <TextField {...params} label="Groups" />}
      />
    </FormDialog>
  );
}

function UsersTab({ orgHandler }: { orgHandler: string }) {
  const { data: users, isLoading } = useUsers(orgHandler);
  const { data: groups = [] } = useGroups(orgHandler);
  const deleteMutation = useDeleteUser(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const getSearchStr = useCallback((u: User) => `${u.username} ${u.displayName}`, []);
  const filtered = useFiltered(users ?? [], search, getSearchStr);

  if (isLoading) return <Loading />;
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreating(true)}>
          Create User
        </Button>
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
            <TableRow key={u.userId}>
              <TableCell>{u.displayName}</TableCell>
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
                  <>
                    <IconButton size="small" onClick={() => setEditing(u)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(u.userId)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {creating && <CreateUserDialog orgHandler={orgHandler} onClose={() => setCreating(false)} />}
      {editing && <EditUserDialog orgHandler={orgHandler} user={editing} groups={groups} onClose={() => setEditing(null)} />}
    </>
  );
}

// ── Roles ──

function PermissionsEditor({ allPermissions, selectedIds, onChange }: { allPermissions: Record<string, Permission[]>; selectedIds: Set<string>; onChange: (ids: Set<string>) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (domain: string) => setExpanded((p) => ({ ...p, [domain]: !p[domain] }));
  const toggleDomain = (_domain: string, perms: Permission[]) => {
    const allSelected = perms.every((p) => selectedIds.has(p.permissionId));
    const next = new Set(selectedIds);
    perms.forEach((p) => (allSelected ? next.delete(p.permissionId) : next.add(p.permissionId)));
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

function RoleDetailView({ orgHandler, roleId, onBack, readOnly }: { orgHandler: string; roleId: string; onBack: () => void; readOnly?: boolean }) {
  const { data: role, isLoading: loadingRole } = useRoleDetail(orgHandler, roleId);
  const { data: allPermsData } = useAllPermissions();
  const { data: roleGroups = [], isLoading: loadingGroups } = useRoleGroups(orgHandler, roleId);
  const updateMutation = useUpdateRole(orgHandler);
  const [subTab, setSubTab] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [search, setSearch] = useState('');
  const permIds = useMemo(() => selectedIds ?? (role ? new Set(role.permissions.map((p) => p.permissionId)) : new Set<string>()), [role, selectedIds]);
  const grouped = allPermsData?.groupedByDomain ?? {};
  const getSearchStr = useCallback((g: RoleGroupMapping) => (g.groupName ?? '') + (g.groupId ?? ''), []);
  const filteredGroups = useFiltered(roleGroups, search, getSearchStr);

  if (loadingRole) return <Loading />;
  if (!role) return null;
  const dirty = selectedIds !== null;

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onBack} sx={{ mb: 2 }}>
        Back to Role List
      </Button>
      <Typography variant="h6">Role : {role.roleName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Description : {role.description}
      </Typography>
      <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Lock size={16} />} iconPosition="start" label="Permissions" />
        <Tab icon={<Users size={16} />} iconPosition="start" label="Groups" />
      </Tabs>
      {subTab === 0 && (
        <>
          <PermissionsEditor allPermissions={grouped} selectedIds={permIds} onChange={readOnly ? () => {} : setSelectedIds} />
          {dirty && !readOnly && (
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button variant="contained" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ roleId, roleName: role.roleName, description: role.description, permissionIds: [...permIds] }, { onSuccess: () => setSelectedIds(null) })}>
                Save Permissions
              </Button>
            </Stack>
          )}
        </>
      )}
      {subTab === 1 && (
        <>
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
            <SearchField value={search} onChange={setSearch} />
          </Stack>
          {loadingGroups ? (
            <Loading />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Group Name</TableCell>
                  <TableCell>Mapping Level</TableCell>
                  <TableCell>Applicable Environment</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No records to display
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.groupName ?? g.groupId}</TableCell>
                      <TableCell>
                        <Chip label={mappingLevel(g)} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={envLabel(g)} size="small" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Box>
  );
}

function RolesTab({ orgHandler, readOnly }: { orgHandler: string; readOnly?: boolean }) {
  const { data: roles, isLoading } = useRoles(orgHandler);
  const { data: allPermsData } = useAllPermissions();
  const deleteMutation = useDeleteRole(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewingRoleId, setViewingRoleId] = useState<string | null>(null);
  const filtered = useFiltered(roles ?? [], search, (r) => r.roleName);

  if (isLoading) return <Loading />;
  if (viewingRoleId) return <RoleDetailView orgHandler={orgHandler} roleId={viewingRoleId} onBack={() => setViewingRoleId(null)} readOnly={readOnly} />;
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        {!readOnly && (
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
            <TableRow key={r.roleId}>
              <TableCell>{r.roleName}</TableCell>
              <TableCell>{r.description}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => setViewingRoleId(r.roleId)}>
                  <Pencil size={16} />
                </IconButton>
                {!readOnly && (
                  <IconButton size="small" onClick={() => deleteMutation.mutate(r.roleId)}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {creating && allPermsData && <CreateRoleDialog orgHandler={orgHandler} allPermissions={allPermsData.groupedByDomain} onClose={() => setCreating(false)} />}
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

function AddRolesToGroupDialog({ orgHandler, groupId, existingRoleIds, onClose }: { orgHandler: string; groupId: string; existingRoleIds: string[]; onClose: () => void }) {
  const { data: allRoles = [] } = useRoles(orgHandler);
  const mutation = useAddRolesToGroup(orgHandler);
  return (
    <AddToGroupDialog
      title="Add Roles to Group"
      label="Roles"
      placeholder="Select roles to add to group"
      options={allRoles}
      getOptionLabel={(r) => r.roleName}
      idKey="roleId"
      existingIds={existingRoleIds}
      onClose={onClose}
      mutate={(payload) => mutation.mutate(payload as { groupId: string; roleIds: string[] }, { onSuccess: onClose })}
      getPayload={(selected) => ({ groupId, roleIds: selected.map((r) => r.roleId) })}
      isPending={mutation.isPending}
    />
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

function GroupDetailView({ orgHandler, group, onBack, showUsers = true }: { orgHandler: string; group: Group; onBack: () => void; showUsers?: boolean }) {
  const { data: groupRoles = [], isLoading: loadingRoles } = useGroupRoles(orgHandler, group.groupId);
  const { data: groupUsers = [], isLoading: loadingUsers } = useGroupUsers(orgHandler, group.groupId);
  const removeRoleMutation = useRemoveRoleFromGroup(orgHandler);
  const removeUserMutation = useRemoveUserFromGroup(orgHandler);
  const [subTab, setSubTab] = useState(showUsers ? 0 : 1);
  const [search, setSearch] = useState('');
  const [addingRoles, setAddingRoles] = useState(false);
  const [addingUsers, setAddingUsers] = useState(false);
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
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingUsers(true)}>
              Add Users
            </Button>
          </Stack>
          {loadingUsers ? (
            <Loading />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell>{u.displayName}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeUserMutation.mutate({ groupId: group.groupId, userId: u.userId })}>
                        <Trash2 size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {addingUsers && <AddUsersToGroupDialog orgHandler={orgHandler} groupId={group.groupId} existingUserIds={groupUsers.map((u) => u.userId)} onClose={() => setAddingUsers(false)} />}
        </>
      )}
      {((showUsers && subTab === 1) || !showUsers) && (
        <>
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
            <SearchField value={search} onChange={setSearch} />
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingRoles(true)}>
              Add Roles
            </Button>
          </Stack>
          {loadingRoles ? (
            <Loading />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Role Name</TableCell>
                  <TableCell>Mapping Level</TableCell>
                  <TableCell>Applicable Environment</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.roleName}</TableCell>
                    <TableCell>
                      <Chip label={mappingLevel(r)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={envLabel(r)} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeRoleMutation.mutate({ groupId: group.groupId, mappingId: r.id })}>
                        <Trash2 size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {addingRoles && <AddRolesToGroupDialog orgHandler={orgHandler} groupId={group.groupId} existingRoleIds={groupRoles.map((r) => r.roleId)} onClose={() => setAddingRoles(false)} />}
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

function GroupsTab({ orgHandler, readOnly }: { orgHandler: string; readOnly?: boolean }) {
  const { data: groups, isLoading } = useGroups(orgHandler);
  const deleteMutation = useDeleteGroup(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const filtered = useFiltered(groups ?? [], search, (g) => g.groupName);

  if (isLoading) return <Loading />;
  if (viewingGroup) return <GroupDetailView orgHandler={orgHandler} group={viewingGroup} onBack={() => setViewingGroup(null)} showUsers={!readOnly} />;
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        {!readOnly && (
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
            <TableRow key={g.groupId}>
              <TableCell>{g.groupName}</TableCell>
              <TableCell>{g.description}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => setViewingGroup(g)}>
                  <Pencil size={16} />
                </IconButton>
                {!readOnly && (
                  <IconButton size="small" onClick={() => deleteMutation.mutate(g.groupId)}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {creating && <CreateGroupDialog orgHandler={orgHandler} onClose={() => setCreating(false)} />}
    </>
  );
}

// ── Main ──

const ORG_TABS = ['users', 'roles', 'groups'] as const;
const PROJECT_TABS = ['roles', 'groups'] as const;

export default function AccessControl(): JSX.Element {
  const { orgHandler = 'default', tab = 'users' } = useParams();
  const navigate = useNavigate();
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

export function ProjectAccessControl(): JSX.Element {
  const { orgHandler = 'default', projectId = '', tab = 'groups' } = useParams();
  const navigate = useNavigate();
  const tabIndex = PROJECT_TABS.indexOf(tab as string as (typeof PROJECT_TABS)[number]);
  const safeIndex = tabIndex < 0 ? 0 : tabIndex;
  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Access Control</PageTitle.Header>
      </PageTitle>
      <Tabs value={safeIndex} onChange={(_, v) => navigate(`/organizations/${orgHandler}/projects/${projectId}/settings/access-control/${PROJECT_TABS[v] ?? 'groups'}`)} sx={{ mb: 3 }}>
        <Tab label="Roles" />
        <Tab label="Groups" />
      </Tabs>
      {safeIndex === 0 && <RolesTab orgHandler={orgHandler} readOnly />}
      {safeIndex === 1 && <GroupsTab orgHandler={orgHandler} readOnly />}
    </PageContent>
  );
}
