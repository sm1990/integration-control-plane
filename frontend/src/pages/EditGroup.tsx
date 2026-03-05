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
import { ArrowLeft, Lock, Plus, Trash2, Users } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useNavigate, useParams } from 'react-router';
import SearchField from '../components/SearchField';
import { Permissions, ALL_ROLE_MODIFY_PERMISSIONS } from '../constants/permissions';
import Authorized from '../components/Authorized';
import { useAccessControl } from '../contexts/AccessControlContext';
import { useGroups, useGroupRoles, useGroupUsers, useAddRolesToGroup, useRemoveRoleFromGroup, useAddUsersToGroup, useRemoveUserFromGroup, useUsers, useRoles } from '../api/authQueries';
import { useAllEnvironments } from '../api/queries';
import type { Group, Role } from '../api/auth';
import { orgAccessControlUrl } from '../paths';
import { FormDialog } from './access-control/shared';
import { useFiltered, mappingLevel, envLabel, getUserInitial } from './access-control/utils';

function AddRolesToGroupDialog({ orgHandler, groupId, existingRoleIds, onClose, onAdded }: { orgHandler: string; groupId: string; existingRoleIds: string[]; onClose: () => void; onAdded?: () => void }) {
  const { data: allRoles = [] } = useRoles(orgHandler);
  const { data: allEnvironments = [] } = useAllEnvironments();
  const mutation = useAddRolesToGroup(orgHandler);
  const [selected, setSelected] = useState<Role[]>([]);
  const [envMode, setEnvMode] = useState<'all' | 'selected'>('all');
  const [selectedEnvs, setSelectedEnvs] = useState<string[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const available = allRoles.filter((r) => !existingRoleIds.includes(r.roleId));
  const pending = mutation.isPending;

  const assign = () => {
    if (envMode === 'selected' && selectedEnvs.length === 0) return;
    setAssignError(null);
    const envUuid = envMode === 'selected' && selectedEnvs.length > 0 ? selectedEnvs[0] : undefined;
    mutation.mutate(
      { groupId, roleIds: selected.map((r) => r.roleId), envUuid },
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
  const [selected, setSelected] = useState([] as (typeof allUsers)[number][]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const available = allUsers.filter((u) => !existingUserIds.includes(u.userId));
  return (
    <FormDialog
      open
      onClose={onClose}
      primaryLabel="Add"
      primaryDisabled={selected.length === 0 || mutation.isPending}
      onPrimary={() =>
        mutation.mutate(
          { groupId, userIds: selected.map((u) => u.userId) },
          {
            onSuccess: () => {
              onAdded?.();
              onClose();
            },
            onError: (error) => setErrorMessage(error?.message ?? 'Failed to add users to group. Please try again.'),
          },
        )
      }
      title="Add Users to Group">
      {errorMessage && (
        <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      <Autocomplete
        multiple
        options={available}
        getOptionLabel={(u) => `${u.displayName} (${u.username})`}
        value={selected}
        onChange={(_, v) => setSelected(v)}
        isOptionEqualToValue={(a, b) => a.userId === b.userId}
        renderInput={(params) => <TextField {...params} label="Users" placeholder="Select users to add" />}
      />
    </FormDialog>
  );
}

function GroupDetailView({ orgHandler, group, onBack }: { orgHandler: string; group: Group; onBack: () => void }) {
  const roleModifyPerms: string[] = [...ALL_ROLE_MODIFY_PERMISSIONS];
  const { hasAnyPermission } = useAccessControl();
  const canManageGroups = hasAnyPermission([Permissions.USER_MANAGE_GROUPS]);
  const canModifyRoles = hasAnyPermission(roleModifyPerms);
  const { data: groupRoles = [], isLoading: loadingRoles, isError: rolesError } = useGroupRoles(orgHandler, group.groupId);
  const { data: groupUsers = [], isLoading: loadingUsers, isError: usersError } = useGroupUsers(orgHandler, group.groupId);
  const { data: allEnvironments = [] } = useAllEnvironments();
  const removeRoleMutation = useRemoveRoleFromGroup(orgHandler);
  const removeUserMutation = useRemoveUserFromGroup(orgHandler);
  const [subTab, setSubTab] = useState<'users' | 'roles'>('users');
  const [search, setSearch] = useState('');
  const [addingRoles, setAddingRoles] = useState(false);
  const [addingUsers, setAddingUsers] = useState(false);
  const [removingUser, setRemovingUser] = useState<{ userId: string; displayName: string; username: string } | null>(null);
  const [removingRole, setRemovingRole] = useState<{ id: number; roleName: string } | null>(null);
  const [viewAlert, setViewAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const filteredUsers = useFiltered(groupUsers, search, (u) => `${u.displayName} ${u.username}`);
  const filteredRoles = useFiltered(groupRoles, search, (r) => `${r.roleName} ${r.roleDescription ?? ''}`);

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onBack} sx={{ mb: 2 }}>
        Back to Group List
      </Button>
      <Typography variant="h1" sx={{ mb: 4 }}>
        Manage Group
      </Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Stack>
          <Typography variant="h6">Group : {group.groupName}</Typography>
          <Typography variant="body2" color="text.secondary">
            Description : {group.description}
          </Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          <SearchField value={search} onChange={setSearch} />
          {subTab === 'users' && (
            <Authorized permissions={Permissions.USER_MANAGE_GROUPS}>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingUsers(true)}>
                Add Users
              </Button>
            </Authorized>
          )}
          {subTab === 'roles' && (
            <Authorized permissions={roleModifyPerms}>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingRoles(true)}>
                Add Roles
              </Button>
            </Authorized>
          )}
        </Stack>
      </Stack>
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
      {viewAlert && (
        <Alert severity={viewAlert.type} onClose={() => setViewAlert(null)} sx={{ mb: 2 }}>
          {viewAlert.message}
        </Alert>
      )}
      {subTab === 'users' && (
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
                  <TableCell colSpan={canManageGroups ? 3 : 2} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : usersError ? (
                <TableRow>
                  <TableCell colSpan={canManageGroups ? 3 : 2} align="center">
                    Failed to load users
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageGroups ? 3 : 2} align="center">
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
              onAdded={() => setViewAlert({ type: 'success', message: 'User(s) added to group successfully.' })}
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
      {subTab === 'roles' && (
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
                  <TableCell colSpan={canModifyRoles ? 4 : 3} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : rolesError ? (
                <TableRow>
                  <TableCell colSpan={canModifyRoles ? 4 : 3} align="center">
                    Failed to load roles
                  </TableCell>
                </TableRow>
              ) : filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canModifyRoles ? 4 : 3} align="center">
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
                        <Tooltip title="Remove">
                          <span style={{ display: 'inline-flex' }}>
                            <IconButton size="small" aria-label={`Remove ${r.roleName} from group`} onClick={() => setRemovingRole({ id: r.id, roleName: r.roleName })} disabled={false}>
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
              groupId={group.groupId}
              existingRoleIds={groupRoles.map((r) => r.roleId)}
              onClose={() => setAddingRoles(false)}
              onAdded={() => setViewAlert({ type: 'success', message: 'Role(s) added to group successfully.' })}
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

export default function EditGroup(): JSX.Element {
  const { orgHandler = 'default', groupId = '' } = useParams();
  const navigate = useNavigate();
  const { data: groups, isLoading, isError } = useGroups(orgHandler);
  const backUrl = orgAccessControlUrl(orgHandler, 'groups');

  if (isLoading)
    return (
      <PageContent>
        <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />
      </PageContent>
    );
  if (isError)
    return (
      <PageContent>
        <Typography>Failed to load groups</Typography>
      </PageContent>
    );

  const group = groups?.find((g) => g.groupId === groupId);
  if (!group)
    return (
      <PageContent>
        <Typography>Group not found</Typography>
      </PageContent>
    );

  return (
    <PageContent>
      <GroupDetailView orgHandler={orgHandler} group={group} onBack={() => navigate(backUrl)} />
    </PageContent>
  );
}
