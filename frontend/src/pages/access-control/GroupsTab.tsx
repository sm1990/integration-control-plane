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

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@wso2/oxygen-ui';
import { Pencil, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useState, type JSX } from 'react';
import { useNavigate, useLocation } from 'react-router';
import SearchField from '../../components/SearchField';
import { useAccessControl } from '../../contexts/AccessControlContext';
import { Permissions } from '../../constants/permissions';
import { useGroups, useDeleteGroup, useGroupRoles, useGroupUsers } from '../../api/authQueries';
import { useComponentByHandler } from '../../api/queries';
import type { Group } from '../../api/auth';
import { newOrgGroupUrl, editOrgGroupUrl } from '../../paths';
import { Loading } from './shared';
import { useFiltered } from './utils';

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
  const navigate = useNavigate();
  const location = useLocation();
  const { hasOrgPermission } = useAccessControl();
  const canManageGroups = hasOrgPermission(Permissions.USER_MANAGE_GROUPS);
  const effectiveReadOnly = readOnly || !canManageGroups;
  const { data: componentData } = useComponentByHandler(projectId ?? '', componentHandler);
  const componentId = componentData?.id;
  const { data: groups, isLoading } = useGroups(orgHandler, projectId, componentId);
  const deleteMutation = useDeleteGroup(orgHandler);
  const [search, setSearch] = useState('');
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [tableAlert, setTableAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const filtered = useFiltered(groups ?? [], search, (g) => `${g.groupName} ${g.description ?? ''}`);

  useEffect(() => {
    const state = location.state as { created?: boolean; name?: string } | null;
    if (state?.created) {
      setTableAlert({ type: 'success', message: `Group '${state.name}' created successfully.` });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  if (isLoading) return <Loading />;
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        {!effectiveReadOnly && (
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate(newOrgGroupUrl(orgHandler))}>
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
                onClick={() => navigate(editOrgGroupUrl(orgHandler, g.groupId))}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    if (e.key === ' ') e.preventDefault();
                    navigate(editOrgGroupUrl(orgHandler, g.groupId));
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
                        navigate(editOrgGroupUrl(orgHandler, g.groupId));
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
