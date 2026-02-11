import {
  Alert,
  Avatar,
  Button,
  Checkbox,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@wso2/oxygen-ui';
import { Clock, Layers, Pencil, Plus, Trash2, AlertTriangle } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAllEnvironments, type GqlEnvironment } from '../api/queries';
import { useUpdateEnvironment, useDeleteEnvironment } from '../api/mutations';
import EmptyListing from '../components/EmptyListing';
import { formatDistanceToNow } from '../utils/time';
import { newEnvironmentUrl } from '../paths';

function EditDialog({ env, onClose }: { env: GqlEnvironment; onClose: () => void }) {
  const [name, setName] = useState(env.name);
  const [description, setDescription] = useState(env.description ?? '');
  const [critical, setCritical] = useState(env.critical);
  const mutation = useUpdateEnvironment();

  const save = () => mutation.mutate({ environmentId: env.id, name, description, critical }, { onSuccess: onClose });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Environment</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
          <FormControlLabel control={<Checkbox checked={critical} onChange={(_, v) => setCritical(v)} />} label="Critical Environment" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!name.trim() || mutation.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteDialog({ env, onClose }: { env: GqlEnvironment; onClose: () => void }) {
  const [confirm, setConfirm] = useState('');
  const mutation = useDeleteEnvironment();

  const doDelete = () => mutation.mutate(env.id, { onSuccess: onClose });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          Are you sure you want to delete the environment '{env.name}'?
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This action is irreversible and will permanently remove all active integrations from this environment (including other configurations and data associated with this environment).
        </Typography>
        <Alert severity="warning" icon={<AlertTriangle size={20} />} sx={{ mb: 2 }}>
          Deleting the environment will remove control plane data and may cause data inconsistencies.
        </Alert>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Type the environment name to confirm
        </Typography>
        <TextField placeholder="Enter environment name" value={confirm} onChange={(e) => setConfirm(e.target.value)} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={doDelete} disabled={confirm !== env.name || mutation.isPending}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Environments(): JSX.Element {
  const navigate = useNavigate();
  const { orgHandler = 'default' } = useParams();
  const { data: environments, isLoading } = useAllEnvironments();
  const [editing, setEditing] = useState<GqlEnvironment | null>(null);
  const [deleting, setDeleting] = useState<GqlEnvironment | null>(null);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Environments</PageTitle.Header>
        <PageTitle.Actions>
          <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => navigate(newEnvironmentUrl(orgHandler))}>
            Create
          </Button>
        </PageTitle.Actions>
      </PageTitle>

      {isLoading ? (
        <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />
      ) : !environments?.length ? (
        <EmptyListing
          icon={<Layers size={48} />}
          title="No environments found"
          description="Create your first environment to get started"
          showAction
          actionLabel="Create Environment"
          onAction={() => navigate(newEnvironmentUrl(orgHandler))}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Created</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {environments.map((env) => (
              <TableRow key={env.id}>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={1.5}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'action.hover', color: 'text.secondary' }}>{env.name[0]?.toUpperCase()}</Avatar>
                    {env.name}
                  </Stack>
                </TableCell>
                <TableCell>{env.description}</TableCell>
                <TableCell>{env.critical ? 'Critical Environment' : 'Non-Critical Environment'}</TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Clock size={14} />
                    {env.createdAt ? formatDistanceToNow(env.createdAt) : '—'}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setEditing(env)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleting(env)}>
                    <Trash2 size={16} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && <EditDialog env={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteDialog env={deleting} onClose={() => setDeleting(null)} />}
    </PageContent>
  );
}
