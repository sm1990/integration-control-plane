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

import { Alert, Autocomplete, Avatar, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft, Key, LogOut, Pencil, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { useState, useCallback, useEffect, useRef, type JSX } from 'react';
import SearchField from '../../components/SearchField';
import { useAuth } from '../../auth/AuthContext';
import { useAccessControl } from '../../contexts/AccessControlContext';
import { Permissions } from '../../constants/permissions';
import Authorized from '../../components/Authorized';
import { useUsers, useCreateUser, useDeleteUser, useGroups, useUpdateUserGroups, useRemoveUserFromGroup, useResetPassword, useRevokeUserTokens } from '../../api/authQueries';
import type { User, Group } from '../../api/auth';
import { Loading, FormDialog } from './shared';
import { useFiltered, getUserInitial } from './utils';

function CreateUserDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { username: string; displayName: string; password: string }) => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSubmit = () => {
    let valid = true;
    if (!username.trim()) {
      setUsernameError('Username is required');
      valid = false;
    } else {
      setUsernameError('');
    }
    if (!password.trim()) {
      setPasswordError('Password is required');
      valid = false;
    } else {
      setPasswordError('');
    }
    if (!valid) return;
    onClose();
    onSubmit({ username: username.trim(), displayName: displayName.trim(), password });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create User</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ mt: 1 }}>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError('');
            }}
            fullWidth
            autoFocus
            error={!!usernameError}
            helperText={usernameError || ' '}
          />
          <TextField label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth helperText=" " />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError('');
            }}
            fullWidth
            error={!!passwordError}
            helperText={passwordError || ' '}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignGroupsDialog({ orgHandler, user, onClose }: { orgHandler: string; user: User; onClose: () => void }) {
  const { data: allGroups = [] } = useGroups(orgHandler);
  const mutation = useUpdateUserGroups(orgHandler);
  const [selected, setSelected] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const available = allGroups.filter((g) => !user.groups.some((ug) => ug.groupId === g.groupId));
  return (
    <FormDialog
      open
      onClose={onClose}
      primaryLabel="Assign"
      primaryDisabled={selected.length === 0 || mutation.isPending}
      onPrimary={() =>
        mutation.mutate(
          { userId: user.userId, groupIds: [...user.groups.map((g) => g.groupId), ...selected.map((g) => g.groupId)] },
          {
            onSuccess: onClose,
            onError: (errorObj) => setError(errorObj?.message ?? 'Failed to assign groups. Please try again.'),
          }
        )
      }
      title="Assign Groups">
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
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

function UserDetailView({ orgHandler, user, onBack, setTableAlert }: { orgHandler: string; user: User; onBack: () => void; setTableAlert: (alert: { type: 'success' | 'error'; message: string }) => void }) {
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
                      <IconButton size="small" aria-label={`Remove ${g.groupName} group`} onClick={() => setRemovingGroupId(g.groupId)}>
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
      {assigning && (
        <AssignGroupsDialog orgHandler={orgHandler} user={user} onClose={() => setAssigning(false)} />
      )}
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
            <Button
              variant="contained"
              color="error"
              disabled={removeUserMutation.isPending}
              onClick={() =>
                removeUserMutation.mutate(
                  { groupId: removingGroup.groupId, userId: user.userId },
                  {
                    onSuccess: () => setRemovingGroupId(null),
                    onError: (error) => {
                      setRemovingGroupId(null);
                      setTableAlert({ type: 'error', message: error?.message ?? 'Failed to remove user from group. Please try again.' });
                    },
                  }
                )
              }
            >
              Remove
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

function ResetPasswordDialog({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(
      () => {
        setCopyError(null);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setCopyError('Failed to copy password. Please copy it manually.');
      },
    );
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
        {copyError && (
          <Alert severity="error" onClose={() => setCopyError(null)} sx={{ mt: 1 }}>
            {copyError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UsersTab({ orgHandler }: { orgHandler: string }): JSX.Element {
  const { data: users, isLoading } = useUsers(orgHandler);
  const createMutation = useCreateUser(orgHandler);
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
  const [newUsername, setNewUsername] = useState<string | null>(null);
  const [tableAlert, setTableAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const newRowRef = useRef<HTMLTableRowElement>(null);
  const getSearchStr = useCallback((u: User) => `${u.username} ${u.displayName}`, []);
  const filtered = useFiltered(users ?? [], search, getSearchStr);
  const viewingUser = viewingUserId ? users?.find((u) => u.userId === viewingUserId) : null;

  useEffect(() => {
    if (!newUsername || !newRowRef.current) return;
    newRowRef.current.focus();
  }, [newUsername, users]);

  useEffect(() => {
    if (!newUsername) return;
    const t = setTimeout(() => setNewUsername(null), 2500);
    return () => clearTimeout(t);
  }, [newUsername]);

  if (isLoading) return <Loading />;
  if (viewingUser) {
    return (
      <UserDetailView
        orgHandler={orgHandler}
        user={viewingUser}
        onBack={() => setViewingUserId(null)}
        setTableAlert={setTableAlert}
      />
    );
  }
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
      {tableAlert && (
        <Alert severity={tableAlert.type} role={tableAlert.type === 'success' ? 'status' : 'alert'} aria-live={tableAlert.type === 'success' ? 'polite' : 'assertive'} onClose={() => setTableAlert(null)} sx={{ mb: 2 }}>
          {tableAlert.message}
        </Alert>
      )}
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
            <TableRow
              key={u.userId}
              ref={u.username === newUsername ? newRowRef : undefined}
              tabIndex={u.username === newUsername ? -1 : 0}
              aria-label={`View details for ${u.displayName}`}
              hover
              sx={{
                cursor: 'pointer',
                ...(u.username === newUsername && {
                  '@keyframes rowHighlight': { '0%': { backgroundColor: 'rgba(255, 193, 7, 0.3)' }, '100%': { backgroundColor: 'transparent' } },
                  '@media (prefers-reduced-motion: no-preference)': { animation: 'rowHighlight 2s ease-out forwards' },
                  '@media (prefers-reduced-motion: reduce)': { outline: '2px solid', outlineColor: 'warning.main' },
                }),
              }}
              onClick={() => setViewingUserId(u.userId)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setViewingUserId(u.userId);
                }
              }}>
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
                      <IconButton
                        size="small"
                        aria-label={u.isOidcUser ? 'Cannot reset password of OIDC user' : 'Reset Password'}
                        disabled={u.isOidcUser}
                        onClick={(e) => {
                          e.stopPropagation();
                          setResettingUserId(u.userId);
                        }}>
                        <Key size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Revoke Sessions">
                      <IconButton
                        size="small"
                        aria-label="Revoke Sessions"
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
                          aria-label="Edit user"
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
                          aria-label="Delete user"
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
      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onSubmit={(data) =>
            createMutation.mutate(data, {
              onSuccess: () => {
                setNewUsername(data.username);
                setTableAlert({ type: 'success', message: `User '${data.username}' created successfully.` });
              },
              onError: (error) => setTableAlert({ type: 'error', message: error.message ?? 'Failed to create user. Please try again.' }),
            })
          }
        />
      )}
      {deletingUserId &&
        (() => {
          const u = users?.find((x) => x.userId === deletingUserId);
          return u ? (
            <Dialog open onClose={() => setDeletingUserId(null)} maxWidth="xs" fullWidth>
              <DialogTitle>Delete User</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Are you sure you want to delete the user <strong>{u.displayName}</strong>?
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDeletingUserId(null)}>Cancel</Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => {
                    setDeletingUserId(null);
                    deleteMutation.mutate(u.userId, {
                      onSuccess: () => setTableAlert({ type: 'success', message: `User '${u.displayName}' deleted successfully.` }),
                      onError: (error) => setTableAlert({ type: 'error', message: error.message ?? 'Failed to delete user. Please try again.' }),
                    });
                  }}>
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
                      onError: (error) => {
                        setResettingUserId(null);
                        setTableAlert({ type: 'error', message: error?.message ?? 'Failed to reset password. Please try again.' });
                      },
                    })
                  }
                >
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
                <Button variant="contained" color="error" disabled={revokeTokensMutation.isPending} onClick={() => revokeTokensMutation.mutate(u.userId, {
                  onSuccess: () => setRevokingUserId(null),
                  onError: (error) => {
                    setRevokingUserId(null);
                    setTableAlert({ type: 'error', message: error?.message ?? 'Failed to revoke sessions. Please try again.' });
                  }
                })}>
                  Revoke Sessions
                </Button>
              </DialogActions>
            </Dialog>
          ) : null;
        })()}
      {resetPasswordResult && (
        <ResetPasswordDialog
          username={resetPasswordResult.username}
          password={resetPasswordResult.password}
          onClose={() => setResetPasswordResult(null)}
        />
      )}
    </>
  );
}
