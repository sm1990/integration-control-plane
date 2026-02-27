/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@wso2/oxygen-ui';
import { ArrowLeft, Lock, Pencil, Plus, Trash2, Users } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useState, type JSX } from 'react';
import SearchField from '../../components/SearchField';
import { useAccessControl } from '../../contexts/AccessControlContext';
import { Permissions, ALL_ROLE_MODIFY_PERMISSIONS } from '../../constants/permissions';
import Authorized from '../../components/Authorized';
import { useGroups, useCreateGroup, useDeleteGroup, useGroupRoles, useGroupUsers, useAddRolesToGroup, useRemoveRoleFromGroup, useAddUsersToGroup, useRemoveUserFromGroup, useUsers, useRoles } from '../../api/authQueries';
import { useAllEnvironments, useComponentByHandler } from '../../api/queries';
import type { Group, Role } from '../../api/auth';
import { Loading, FormDialog } from './shared';
import { useFiltered, mappingLevel, envLabel, getUserInitial } from './utils';

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
  errorMessage,
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
  errorMessage?: string | null;
}) {
  const [selected, setSelected] = useState<T[]>([]);
  const [errorVisible, setErrorVisible] = useState(!!errorMessage);
  // Sync errorVisible with errorMessage
  useEffect(() => {
    setErrorVisible(!!errorMessage);
  }, [errorMessage]);
  const available = options.filter((o) => !existingIds.includes(String((o as Record<string, unknown>)[idKey as string])));
  return (
    <FormDialog open onClose={onClose} primaryLabel="Add" primaryDisabled={selected.length === 0 || isPending} onPrimary={() => mutate(getPayload(selected))} title={title}>
      {errorMessage && errorVisible && (
        <Alert severity="error" onClose={() => setErrorVisible(false)} sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
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

function AddRolesToGroupDialog({
  orgHandler,
  projectId,
  componentId,
  groupId,
  existingRoleIds,
  onClose,
  onAdded,
}: {
  orgHandler: string;
  projectId?: string;
  componentId?: string;
  groupId: string;
  existingRoleIds: string[];
  onClose: () => void;
  onAdded?: () => void;
}) {
  const { data: allRoles = [] } = useRoles(orgHandler, projectId, componentId);
  const { data: allEnvironments = [] } = useAllEnvironments();
  const mutation = useAddRolesToGroup(orgHandler, projectId, componentId);
  const [selected, setSelected] = useState<Role[]>([]);
  const [envMode, setEnvMode] = useState<'all' | 'selected'>('all');
  const [selectedEnvs, setSelectedEnvs] = useState<string[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const available = allRoles.filter((r) => !existingRoleIds.includes(r.roleId));
  const pending = mutation.isPending;

  const assign = () => {
    if (envMode === 'selected' && selectedEnvs.length === 0) {
      return;
    }
    setAssignError(null);
    const envUuid = envMode === 'selected' && selectedEnvs.length > 0 ? selectedEnvs[0] : undefined;
    const roleIds = selected.map((r) => r.roleId);
    mutation.mutate(
      { groupId, roleIds, envUuid },
      {
        onSuccess: () => {
          onAdded?.();
          onClose();
        },
        onError: (error) => setAssignError(error.message ?? 'Failed to add roles to group. Please try again.'),
      },
    );
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Roles to Group</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {assignError && (
            <Alert severity="error" onClose={() => setAssignError(null)}>
              {assignError}
            </Alert>
          )}
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

function AddUsersToGroupDialog({ orgHandler, groupId, existingUserIds, onClose, onAdded }: { orgHandler: string; groupId: string; existingUserIds: string[]; onClose: () => void; onAdded?: () => void }) {
  const { data: allUsers = [] } = useUsers(orgHandler);
  const mutation = useAddUsersToGroup(orgHandler);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      mutate={(payload) =>
        mutation.mutate(payload as { groupId: string; userIds: string[] }, {
          onSuccess: () => {
            onAdded?.();
            onClose();
          },
          onError: (error) => setErrorMessage(error?.message ?? 'Failed to add users to group. Please try again.'),
        })
      }
      getPayload={(selected) => ({ groupId, userIds: selected.map((u) => u.userId) })}
      isPending={mutation.isPending}
      errorMessage={errorMessage}
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
  const [subTab, setSubTab] = useState<'users' | 'roles'>(showUsers ? 'users' : 'roles');
  const [search, setSearch] = useState('');
  const [addingRoles, setAddingRoles] = useState(false);
  const [addingUsers, setAddingUsers] = useState(false);
  const [removingUser, setRemovingUser] = useState<{ userId: string; displayName: string; username: string } | null>(null);
  const [removingRole, setRemovingRole] = useState<{ id: number; roleName: string } | null>(null);
  const [viewAlert, setViewAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const filteredUsers = useFiltered(groupUsers, search, (u) => `${u.displayName} ${u.username}`);
  const filteredRoles = useFiltered(groupRoles, search, (r) => `${r.roleName} ${r.roleDescription}`);

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onBack} sx={{ mb: 2 }}>
        Back to Group List
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Stack>
          <Typography variant="h6">Group : {group.groupName}</Typography>
          <Typography variant="body2" color="text.secondary">
            Description : {group.description}
          </Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          <SearchField value={search} onChange={setSearch} />
          {subTab === 'users' && showUsers && (
            <Authorized permissions={Permissions.USER_MANAGE_GROUPS}>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingUsers(true)}>
                Add Users
              </Button>
            </Authorized>
          )}
          {(subTab === 'roles' || !showUsers) && (
            <Authorized permissions={roleModifyPerms}>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingRoles(true)}>
                Add Roles
              </Button>
            </Authorized>
          )}
        </Stack>
      </Stack>
      {showUsers && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={subTab}
          onChange={(_, v) => {
            if (v !== null) {
              setSubTab(v);
              setSearch('');
              setViewAlert(null);
            }
          }}
          sx={{ mb: 2 }}>
          <ToggleButton value="users">
            <Users size={16} style={{ marginRight: 8 }} />
            Users
          </ToggleButton>
          <ToggleButton value="roles">
            <Lock size={16} style={{ marginRight: 8 }} />
            Roles
          </ToggleButton>
        </ToggleButtonGroup>
      )}
      {viewAlert && (
        <Alert severity={viewAlert.type} onClose={() => setViewAlert(null)} sx={{ mb: 2 }}>
          {viewAlert.message}
        </Alert>
      )}
      {subTab === 'users' && showUsers && (
        <>
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
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Loading />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    No records to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{getUserInitial(u)}</Avatar>
                        {u.displayName}
                      </Stack>
                    </TableCell>
                    <TableCell>{u.username}</TableCell>
                    <Authorized permissions={Permissions.USER_MANAGE_GROUPS}>
                      <TableCell align="right">
                        <Tooltip title="Remove">
                          <IconButton size="small" aria-label={`Remove ${u.displayName} from group`} onClick={() => setRemovingUser(u)}>
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </Authorized>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {addingUsers && (
            <AddUsersToGroupDialog
              orgHandler={orgHandler}
              groupId={group.groupId}
              existingUserIds={groupUsers.map((u) => u.userId)}
              onClose={() => setAddingUsers(false)}
              onAdded={() => setViewAlert({ type: 'success', message: 'Users added to group successfully.' })}
            />
          )}
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
                <Button
                  variant="contained"
                  color="error"
                  disabled={removeUserMutation.isPending}
                  onClick={() =>
                    removeUserMutation.mutate(
                      { groupId: group.groupId, userId: removingUser.userId },
                      {
                        onSuccess: () => {
                          setRemovingUser(null);
                          setViewAlert({ type: 'success', message: 'User removed from group successfully.' });
                        },
                        onError: (error) => {
                          setRemovingUser(null);
                          setViewAlert({ type: 'error', message: error?.message ?? 'Failed to remove user from group. Please try again.' });
                        },
                      },
                    )
                  }>
                  Remove
                </Button>
              </DialogActions>
            </Dialog>
          )}
        </>
      )}
      {(subTab === 'roles' || !showUsers) && (
        <>
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
              {loadingRoles ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Loading />
                  </TableCell>
                </TableRow>
              ) : filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No records to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((r) => (
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
                        <Tooltip title={componentId ? (!r.integrationUuid ? 'Org/Project-level mapping' : 'Remove') : projectId && !r.projectUuid ? 'Org-level mapping' : 'Remove'} >
                          <span style={{ display: 'inline-flex' }}>
                            <IconButton
                              size="small"
                              aria-label={(componentId ? !r.integrationUuid : Boolean(projectId && !r.projectUuid)) ? 'Org/Project-level mapping — cannot remove' : `Remove ${r.roleName} from group`}
                              onClick={() => setRemovingRole({ id: r.id, roleName: r.roleName })}
                              disabled={componentId ? !r.integrationUuid : Boolean(projectId && !r.projectUuid)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </Authorized>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {addingRoles && (
            <AddRolesToGroupDialog
              orgHandler={orgHandler}
              projectId={projectId}
              componentId={componentId}
              groupId={group.groupId}
              existingRoleIds={groupRoles.map((r) => r.roleId)}
              onClose={() => setAddingRoles(false)}
              onAdded={() => setViewAlert({ type: 'success', message: 'Role added to group successfully.' })}
            />
          )}
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
                <Button
                  variant="contained"
                  color="error"
                  disabled={removeRoleMutation.isPending}
                  onClick={() =>
                    removeRoleMutation.mutate(
                      { groupId: group.groupId, mappingId: removingRole.id },
                      {
                        onSuccess: () => {
                          setRemovingRole(null);
                          setViewAlert({ type: 'success', message: 'Role removed from group successfully.' });
                        },
                        onError: (error) => {
                          setRemovingRole(null);
                          setViewAlert({ type: 'error', message: error?.message ?? 'Failed to remove role from group. Please try again.' });
                        },
                      },
                    )
                  }>
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

function CreateGroupDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { groupName: string; description: string }) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const handleCreate = () => {
    onClose();
    onSubmit({ groupName: name.trim(), description: description.trim() });
  };
  return (
    <FormDialog open onClose={onClose} primaryLabel="Create" primaryDisabled={!name.trim()} onPrimary={handleCreate} title="Create Group">
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
    </FormDialog>
  );
}

function GroupUserCount({ orgHandler, groupId }: { orgHandler: string; groupId: string }) {
  const { data: users = [], isLoading } = useGroupUsers(orgHandler, groupId);
  if (isLoading) return <>—</>;
  return <>{users.length}</>;
}

function GroupRoleCount({ orgHandler, groupId, projectId, componentId }: { orgHandler: string; groupId: string; projectId?: string; componentId?: string }) {
  const { data: roles = [], isLoading } = useGroupRoles(orgHandler, groupId, projectId, componentId);
  if (isLoading) return <>—</>;
  return <>{roles.length}</>;
}

export function GroupsTab({ orgHandler, projectId, componentHandler, readOnly }: { orgHandler: string; projectId?: string; projectHandler?: string; componentHandler?: string; readOnly?: boolean }): JSX.Element {
  const { hasOrgPermission } = useAccessControl();
  const canManageGroups = hasOrgPermission(Permissions.USER_MANAGE_GROUPS);
  const effectiveReadOnly = readOnly || !canManageGroups;
  const { data: componentData } = useComponentByHandler(projectId ?? '', componentHandler);
  const componentId = componentData?.id;
  const { data: groups, isLoading } = useGroups(orgHandler, projectId, componentId);
  const createMutation = useCreateGroup(orgHandler);
  const deleteMutation = useDeleteGroup(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [tableAlert, setTableAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const filtered = useFiltered(groups ?? [], search, (g) => `${g.groupName} ${g.description ?? ''}`);

  if (isLoading) return <Loading />;
  if (viewingGroup) {
    return <GroupDetailView orgHandler={orgHandler} projectId={projectId} componentId={componentId} group={viewingGroup} onBack={() => setViewingGroup(null)} showUsers={!projectId && !effectiveReadOnly} />;
  }
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
      {tableAlert && (
        <Alert severity={tableAlert.type} role={tableAlert.type === 'success' ? 'status' : 'alert'} aria-live={tableAlert.type === 'success' ? 'polite' : 'assertive'} onClose={() => setTableAlert(null)} sx={{ mb: 2 }}>
          {tableAlert.message}
        </Alert>
      )}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Users</TableCell>
            <TableCell>Roles</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center">
                No records to display
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((g) => (
              <TableRow
                key={g.groupId}
                hover
                sx={{ cursor: 'pointer' }}
                tabIndex={0}
                aria-label={`View details for ${g.groupName}`}
                onClick={() => {
                  setTableAlert(null);
                  setViewingGroup(g);
                }}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    if (e.key === ' ') e.preventDefault();
                    setTableAlert(null);
                    setViewingGroup(g);
                  }
                }}>
                <TableCell>{g.groupName}</TableCell>
                <TableCell>{g.description}</TableCell>
                <TableCell>
                  <GroupUserCount orgHandler={orgHandler} groupId={g.groupId} />
                </TableCell>
                <TableCell>
                  <GroupRoleCount orgHandler={orgHandler} groupId={g.groupId} projectId={projectId} componentId={componentId} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      aria-label={`Edit ${g.groupName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTableAlert(null);
                        setViewingGroup(g);
                      }}>
                      <Pencil size={16} />
                    </IconButton>
                  </Tooltip>
                  {!effectiveReadOnly && (
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        aria-label={`Delete ${g.groupName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingGroup(g);
                        }}>
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {creating && (
        <CreateGroupDialog
          onClose={() => setCreating(false)}
          onSubmit={(data) =>
            createMutation.mutate(data, {
              onSuccess: () => setTableAlert({ type: 'success', message: `Group '${data.groupName}' created successfully.` }),
              onError: (error) => setTableAlert({ type: 'error', message: error.message ?? 'Failed to create group. Please try again.' }),
            })
          }
        />
      )}
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
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setDeletingGroup(null);
                deleteMutation.mutate(deletingGroup.groupId, {
                  onSuccess: () => setTableAlert({ type: 'success', message: `Group '${deletingGroup.groupName}' deleted successfully.` }),
                  onError: (error) => setTableAlert({ type: 'error', message: error.message ?? 'Failed to delete group. Please try again.' }),
                });
              }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
