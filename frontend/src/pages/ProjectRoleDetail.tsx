import {
  Autocomplete,
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
import { ArrowLeft, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { useState, useMemo, useCallback, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router';
import SearchField from '../components/SearchField';
import { useRoleDetail, useRoleGroups, useGroups, useAddRolesToGroup, useRemoveRoleFromGroup } from '../api/authQueries';
import { Permissions, ALL_ROLE_MODIFY_PERMISSIONS } from '../constants/permissions';
import Authorized from '../components/Authorized';
import type { RoleGroupMapping, Group } from '../api/auth';
import { useAllEnvironments, useProjectByHandler } from '../api/queries';
import { projectAccessControlUrl } from '../paths';

function Loading() {
  return <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />;
}

function AssignRoleToGroupsDialog({ orgHandler, projectId, roleId, roleName, existingGroupIds, onClose }: { orgHandler: string; projectId: string; roleId: string; roleName: string; existingGroupIds: string[]; onClose: () => void }) {
  const { data: allGroups = [] } = useGroups(orgHandler, projectId);
  const { data: allEnvironments = [] } = useAllEnvironments();
  const mutation = useAddRolesToGroup(orgHandler, projectId);
  const [selected, setSelected] = useState<Group[]>([]);
  const [envMode, setEnvMode] = useState<'all' | 'selected'>('all');
  const [selectedEnvs, setSelectedEnvs] = useState<string[]>([]);
  const available = allGroups.filter((g) => !existingGroupIds.includes(g.groupId));
  const pending = mutation.isPending;

  const assign = () => {
    if (envMode === 'selected' && selectedEnvs.length === 0) {
      return;
    }
    let remaining = selected.length;
    const envUuid = envMode === 'selected' && selectedEnvs.length > 0 ? selectedEnvs[0] : undefined;
    for (const g of selected) {
      mutation.mutate(
        { groupId: g.groupId, roleIds: [roleId], envUuid },
        {
          onSuccess: () => {
            if (--remaining === 0) onClose();
          },
        },
      );
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Role to Groups</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select groups to assign the role &quot;{roleName}&quot; to
        </Typography>
        <Stack spacing={2}>
          <Autocomplete
            multiple
            options={available}
            getOptionLabel={(g) => g.groupName}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            isOptionEqualToValue={(a, b) => a.groupId === b.groupId}
            renderInput={(params) => <TextField {...params} label="Groups" placeholder="Select groups" />}
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
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const mappingLevel = (m: { projectUuid?: string | null }) => (m.projectUuid ? 'Project' : 'Organization');
const envLabel = (m: { envUuid?: string | null }, environments: { id: string; name: string }[]) => {
  if (!m.envUuid) return 'All';
  const env = environments.find((e) => e.id === m.envUuid);
  return env?.name ?? m.envUuid;
};

export default function ProjectRoleDetail(): JSX.Element {
  const { orgHandler = 'default', projectHandler = '', roleId = '' } = useParams();
  const navigate = useNavigate();
  const { data: projectData, isLoading: loadingProject } = useProjectByHandler(projectHandler);
  const projectId = projectData?.id ?? '';
  const roleModifyPerms = [...ALL_ROLE_MODIFY_PERMISSIONS, Permissions.PROJECT_EDIT, Permissions.PROJECT_MANAGE];

  const { data: role, isLoading: loadingRole } = useRoleDetail(orgHandler, roleId, projectId);
  const { data: roleGroups = [], isLoading: loadingGroups } = useRoleGroups(orgHandler, roleId, projectId);
  const { data: allEnvironments = [] } = useAllEnvironments();
  const removeMutation = useRemoveRoleFromGroup(orgHandler);
  const [search, setSearch] = useState('');
  const [addingGroups, setAddingGroups] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<RoleGroupMapping | null>(null);

  const getSearchStr = useCallback((g: RoleGroupMapping) => (g.groupName ?? '') + (g.groupId ?? ''), []);
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return roleGroups;
    const s = search.toLowerCase();
    return roleGroups.filter((g) => getSearchStr(g).toLowerCase().includes(s));
  }, [roleGroups, search, getSearchStr]);

  const onBack = () => navigate(projectAccessControlUrl(orgHandler, projectHandler, 'roles'));
  const handleDeleteGroup = (group: RoleGroupMapping) => {
    setDeletingGroup(group);
  };
  const confirmDelete = () => {
    if (deletingGroup) {
      removeMutation.mutate({ groupId: deletingGroup.groupId, mappingId: deletingGroup.id }, { onSuccess: () => setDeletingGroup(null) });
    }
  };

  if (loadingProject || loadingRole)
    return (
      <PageContent>
        <Loading />
      </PageContent>
    );
  if (!role)
    return (
      <PageContent>
        <Typography>Role not found</Typography>
      </PageContent>
    );

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Access Control</PageTitle.Header>
      </PageTitle>
      <Tabs value={0} sx={{ mb: 3 }}>
        <Tab label="Roles" />
        <Tab label="Groups" onClick={() => navigate(projectAccessControlUrl(orgHandler, projectHandler, 'groups'))} />
      </Tabs>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onBack} sx={{ mb: 2 }}>
        Back to Role List
      </Button>
      <Typography variant="h6">Role : {role.roleName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Description : {role.description}
      </Typography>

      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 2 }}>
        <SearchField value={search} onChange={setSearch} />
        <Authorized permissions={roleModifyPerms}>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddingGroups(true)}>
            Add Group
          </Button>
        </Authorized>
      </Stack>

      {loadingGroups ? (
        <Loading />
      ) : filteredGroups.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No records to display
        </Typography>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Group Name</TableCell>
              <TableCell>Mapping Level</TableCell>
              <TableCell align="center">Applicable Environment</TableCell>
              <Authorized permissions={roleModifyPerms}>
                <TableCell width={80}>Actions</TableCell>
              </Authorized>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGroups.map((g) => (
              <TableRow key={g.id}>
                <TableCell>{g.groupName ?? g.groupId}</TableCell>
                <TableCell>
                  <Chip label={mappingLevel(g)} size="small" />
                </TableCell>
                <TableCell align="center">
                  <Chip label={envLabel(g, allEnvironments)} size="small" />
                </TableCell>
                <Authorized permissions={roleModifyPerms}>
                  <TableCell>
                    <Tooltip title={!g.projectUuid ? 'Org-level mapping' : ''} placement="right">
                      <span>
                        <IconButton size="small" onClick={() => handleDeleteGroup(g)} disabled={removeMutation.isPending || Boolean(!g.projectUuid)}>
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

      {addingGroups && <AssignRoleToGroupsDialog orgHandler={orgHandler} projectId={projectId} roleId={roleId} roleName={role.roleName} existingGroupIds={roleGroups.map((g) => g.groupId)} onClose={() => setAddingGroups(false)} />}

      {deletingGroup && (
        <Dialog open onClose={() => setDeletingGroup(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Remove Group from Role</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to remove the group <strong>{deletingGroup.groupName ?? deletingGroup.groupId}</strong> from this role?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeletingGroup(null)}>Cancel</Button>
            <Button variant="contained" color="error" disabled={removeMutation.isPending} onClick={confirmDelete}>
              Remove
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageContent>
  );
}
