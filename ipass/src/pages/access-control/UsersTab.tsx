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

import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ListingTable, Stack, TablePagination, Tooltip, Typography } from '@wso2/oxygen-ui';
import { Key, LockOpen, LogOut, Pencil, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { useState, useCallback, useEffect, type JSX } from 'react';
import { useNavigate, useLocation } from 'react-router';
import SearchField from '../../components/SearchField';
import { Permissions } from '../../constants/permissions';
import Authorized from '../../components/Authorized';
import { useUsers, useDeleteUser, useResetPassword, useRevokeUserTokens, useUnlockAccount } from '../../api/authQueries';
import type { User } from '../../api/auth';
import { newOrgUserUrl, editOrgUserUrl } from '../../paths';
import { Loading } from './shared';
import { useFiltered } from './utils';

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
  const navigate = useNavigate();
  const location = useLocation();
  const { data: users, isLoading } = useUsers(orgHandler);
  const deleteMutation = useDeleteUser(orgHandler);
  const resetPasswordMutation = useResetPassword(orgHandler);
  const revokeTokensMutation = useRevokeUserTokens(orgHandler);
  const unlockMutation = useUnlockAccount(orgHandler);
  const [search, setSearch] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ username: string; password: string } | null>(null);
  const [tableAlert, setTableAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const getSearchStr = useCallback((u: User) => `${u.username} ${u.displayName}`, []);
  const filtered = useFiltered(users ?? [], search, getSearchStr);
  const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const paginated = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  useEffect(() => {
    const state = location.state as { created?: boolean; name?: string } | null;
    if (state?.created) {
      setTableAlert({ type: 'success', message: `User '${state.name}' created successfully.` });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  if (isLoading) return <Loading />;
  return (
    <>
      {tableAlert && (
        <Alert severity={tableAlert.type} role={tableAlert.type === 'success' ? 'status' : 'alert'} aria-live={tableAlert.type === 'success' ? 'polite' : 'assertive'} onClose={() => setTableAlert(null)} sx={{ mb: 2 }}>
          {tableAlert.message}
        </Alert>
      )}
      <ListingTable.Container>
        <ListingTable.Toolbar
          searchSlot={<SearchField value={search} onChange={setSearch} />}
          actions={
            <Authorized permissions={Permissions.USER_MANAGE_USERS}>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate(newOrgUserUrl(orgHandler))}>
                Create User
              </Button>
            </Authorized>
          }
        />
        <ListingTable>
          <ListingTable.Head>
            <ListingTable.Row>
              <ListingTable.Cell>User</ListingTable.Cell>
              <ListingTable.Cell>Username</ListingTable.Cell>
              <ListingTable.Cell>Groups</ListingTable.Cell>
              <ListingTable.Cell align="right">Action</ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {filtered.length === 0 ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={4} align="center">
                  No records to display
                </ListingTable.Cell>
              </ListingTable.Row>
            ) : (
              paginated.map((u) => (
                <ListingTable.Row
                  key={u.userId}
                  clickable
                  tabIndex={0}
                  aria-label={`View details for ${u.displayName}`}
                  hover
                  onClick={() => navigate(editOrgUserUrl(orgHandler, u.userId))}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      navigate(editOrgUserUrl(orgHandler, u.userId));
                    }
                  }}>
                  <ListingTable.Cell>
                    <Stack direction="row" alignItems="center" gap={1}>
                      {u.displayName}
                      {u.isOidcUser && <Chip label="OIDC" size="small" color="info" />}
                    </Stack>
                  </ListingTable.Cell>
                  <ListingTable.Cell>{u.username}</ListingTable.Cell>
                  <ListingTable.Cell>{u.groupCount > 0 ? u.groups.map((g) => <Chip key={g.groupId} label={g.groupName} size="small" sx={{ mr: 0.5 }} />) : <>—</>}</ListingTable.Cell>
                  <ListingTable.Cell align="right">
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
                        {/* Unlock is credential-store only; hide for OIDC users */}
                        {!u.isOidcUser && (
                          <Tooltip title="Unlock Account">
                            <IconButton
                              size="small"
                              aria-label="Unlock Account"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnlockingUserId(u.userId);
                              }}>
                              <LockOpen size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            aria-label="Edit user"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(editOrgUserUrl(orgHandler, u.userId));
                            }}>
                            <Pencil size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
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
                  </ListingTable.Cell>
                </ListingTable.Row>
              ))
            )}
          </ListingTable.Body>
        </ListingTable>
        <TablePagination
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          component="div"
          count={filtered.length}
          page={safePage}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </ListingTable.Container>
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
                <Button
                  variant="contained"
                  color="error"
                  disabled={revokeTokensMutation.isPending}
                  onClick={() =>
                    revokeTokensMutation.mutate(u.userId, {
                      onSuccess: () => setRevokingUserId(null),
                      onError: (error) => {
                        setRevokingUserId(null);
                        setTableAlert({ type: 'error', message: error?.message ?? 'Failed to revoke sessions. Please try again.' });
                      },
                    })
                  }>
                  Revoke Sessions
                </Button>
              </DialogActions>
            </Dialog>
          ) : null;
        })()}
      {unlockingUserId &&
        (() => {
          const u = users?.find((x) => x.userId === unlockingUserId);
          return u ? (
            <Dialog open onClose={() => setUnlockingUserId(null)} maxWidth="xs" fullWidth>
              <DialogTitle>Unlock Account</DialogTitle>
              <DialogContent>
                <Typography>
                  Unlock the account for <strong>{u.displayName}</strong> ({u.username})? This will clear any active lockout and allow the user to log in immediately.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setUnlockingUserId(null)}>Cancel</Button>
                <Button
                  variant="contained"
                  disabled={unlockMutation.isPending}
                  onClick={() =>
                    unlockMutation.mutate(u.userId, {
                      onSuccess: () => setUnlockingUserId(null),
                      onError: (error) => {
                        setUnlockingUserId(null);
                        setTableAlert({ type: 'error', message: error?.message ?? 'Failed to unlock account. Please try again.' });
                      },
                    })
                  }>
                  Unlock
                </Button>
              </DialogActions>
            </Dialog>
          ) : null;
        })()}
      {resetPasswordResult && <ResetPasswordDialog username={resetPasswordResult.username} password={resetPasswordResult.password} onClose={() => setResetPasswordResult(null)} />}
    </>
  );
}
