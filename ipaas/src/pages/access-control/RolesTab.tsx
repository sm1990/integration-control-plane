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

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Tooltip } from '@wso2/oxygen-ui';
import { Pencil, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { useState, useEffect, type JSX } from 'react';
import { useNavigate, useLocation } from 'react-router';
import SearchField from '../../components/SearchField';
import { useAccessControl } from '../../contexts/AccessControlContext';
import { Permissions } from '../../constants/permissions';
import { orgRoleDetailUrl, projectRoleDetailUrl, componentRoleDetailUrl, newOrgRoleUrl } from '../../paths';
import { useRoles, useDeleteRole, useRoleGroups, useUsers } from '../../api/authQueries';
import { useComponentByHandler } from '../../api/queries';
import type { Role } from '../../api/auth';
import { Loading } from './shared';
import { useFiltered } from './utils';

function RoleUserCount({ orgHandler, roleId, projectId, componentId }: { orgHandler: string; roleId: string; projectId?: string; componentId?: string }) {
  const { data: roleGroups = [], isLoading: loadingGroups } = useRoleGroups(orgHandler, roleId, projectId, componentId);
  const { data: users = [], isLoading: loadingUsers } = useUsers(orgHandler);
  if (loadingGroups || loadingUsers) return <>—</>;
  const roleGroupIds = new Set(roleGroups.map((g) => g.groupId));
  return <>{users.filter((u) => u.groups.some((g) => roleGroupIds.has(g.groupId))).length}</>;
}

export function RolesTab({ orgHandler, projectId, projectHandler, componentHandler, readOnly }: { orgHandler: string; projectId?: string; projectHandler?: string; componentHandler?: string; readOnly?: boolean }): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasOrgPermission } = useAccessControl();
  const canManageRoles = hasOrgPermission(Permissions.USER_MANAGE_ROLES);
  const effectiveReadOnly = readOnly || !canManageRoles;
  const { data: componentData } = useComponentByHandler(projectId ?? '', componentHandler);
  const componentId = componentData?.id;
  const { data: roles, isLoading } = useRoles(orgHandler, projectId, componentId);
  const deleteMutation = useDeleteRole(orgHandler);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [tableAlert, setTableAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const filtered = useFiltered(roles ?? [], search, (r) => `${r.roleName} ${r.description}`);
  const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const paginated = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  useEffect(() => {
    const state = location.state as { created?: boolean; name?: string } | null;
    if (state?.created) {
      setTableAlert({ type: 'success', message: `Role '${state.name}' created successfully.` });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

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
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate(newOrgRoleUrl(orgHandler))}>
            Create Role
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
            <TableCell>Role Name</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Assigned Users</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center">
                No records to display
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((r) => (
              <TableRow
                key={r.roleId}
                hover
                sx={{ cursor: 'pointer' }}
                tabIndex={0}
                aria-label={`View details for ${r.roleName}`}
                onClick={() => navigate(getRoleDetailUrl(r.roleId))}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    if (e.key === ' ') e.preventDefault();
                    navigate(getRoleDetailUrl(r.roleId));
                  }
                }}>
                <TableCell>{r.roleName}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell>
                  <RoleUserCount orgHandler={orgHandler} roleId={r.roleId} projectId={projectId} componentId={componentId} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      aria-label={`Edit ${r.roleName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(getRoleDetailUrl(r.roleId));
                      }}>
                      <Pencil size={16} />
                    </IconButton>
                  </Tooltip>
                  {!effectiveReadOnly && (
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        aria-label={`Delete ${r.roleName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingRole(r);
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
      <TablePagination
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
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setDeletingRole(null);
                deleteMutation.mutate(deletingRole.roleId, {
                  onSuccess: () => setTableAlert({ type: 'success', message: `Role '${deletingRole.roleName}' deleted successfully.` }),
                  onError: (error) => setTableAlert({ type: 'error', message: error.message ?? 'Failed to delete role. Please try again.' }),
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
