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

import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router';
import SearchField from '../../components/SearchField';
import { useAccessControl } from '../../contexts/AccessControlContext';
import { Permissions } from '../../constants/permissions';
import { orgRoleDetailUrl, projectRoleDetailUrl, componentRoleDetailUrl } from '../../paths';
import { useRoles, useAllPermissions, useCreateRole, useDeleteRole } from '../../api/authQueries';
import { useComponentByHandler } from '../../api/queries';
import type { Permission, Role } from '../../api/auth';
import { Loading, FormDialog } from './shared';
import { useFiltered } from './utils';

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

function CreateRoleDialog({ allPermissions, onClose, onSubmit }: { allPermissions: Record<string, Permission[]>; onClose: () => void; onSubmit: (data: { roleName: string; description: string; permissionIds: string[] }) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const handleCreate = () => {
    onClose();
    onSubmit({ roleName: name.trim(), description: description.trim(), permissionIds: [...selectedIds] });
  };
  return (
    <FormDialog open onClose={onClose} maxWidth="sm" primaryLabel="Create" primaryDisabled={!name.trim()} onPrimary={handleCreate} title="Create Role">
      <TextField label="Role Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
      <PermissionsEditor allPermissions={allPermissions} selectedIds={selectedIds} onChange={setSelectedIds} />
    </FormDialog>
  );
}

export function RolesTab({ orgHandler, projectId, projectHandler, componentHandler, readOnly }: { orgHandler: string; projectId?: string; projectHandler?: string; componentHandler?: string; readOnly?: boolean }): JSX.Element {
  const navigate = useNavigate();
  const { hasOrgPermission } = useAccessControl();
  const canManageRoles = hasOrgPermission(Permissions.USER_MANAGE_ROLES);
  const effectiveReadOnly = readOnly || !canManageRoles;
  const { data: componentData } = useComponentByHandler(projectId ?? '', componentHandler);
  const componentId = componentData?.id;
  const { data: roles, isLoading } = useRoles(orgHandler, projectId, componentId);
  const { data: allPermsData } = useAllPermissions();
  const createMutation = useCreateRole(orgHandler);
  const deleteMutation = useDeleteRole(orgHandler);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [tableAlert, setTableAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((r) => (
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
              <TableCell align="right">
                <IconButton
                  size="small"
                  aria-label={`Edit ${r.roleName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(getRoleDetailUrl(r.roleId));
                  }}>
                  <Pencil size={16} />
                </IconButton>
                {!effectiveReadOnly && (
                  <IconButton
                    size="small"
                    aria-label={`Delete ${r.roleName}`}
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
      {creating && allPermsData && (
        <CreateRoleDialog
          allPermissions={allPermsData.groupedByDomain}
          onClose={() => setCreating(false)}
          onSubmit={(data) =>
            createMutation.mutate(data, {
              onSuccess: () => setTableAlert({ type: 'success', message: `Role '${data.roleName}' created successfully.` }),
              onError: (error) => setTableAlert({ type: 'error', message: error.message ?? 'Failed to create role. Please try again.' }),
            })
          }
        />
      )}
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
