import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListingTable,
  PageContent,
  Stack,
  TextField,
  Typography,
} from '@wso2/oxygen-ui';
import { Clock, Plus, RefreshCw, Trash2 } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useNavigate } from 'react-router';
import { useState, type JSX } from 'react';
import { useProjectByHandler, useComponents, type GqlComponent } from '../api/queries';
import { useDeleteComponent } from '../api/mutations';
import NotFound from '../components/NotFound';
import { formatDistanceToNow } from '../utils/time';
import { resourceUrl, narrow, broaden, newComponentUrl, type ProjectScope } from '../nav';
import { Permissions } from '../constants/permissions';
import Authorized from '../components/Authorized';
import { useLoadProjectPermissions } from '../hooks/usePermissionLoader';

function DeleteDialog({ component, scope, projectId, onClose }: { component: GqlComponent; scope: ProjectScope; projectId: string; onClose: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  const mutation = useDeleteComponent();
  const confirmed = confirmation === component.displayName;

  const handleDelete = () => {
    mutation.mutate({ orgHandler: scope.org, componentId: component.id, projectId }, { onSuccess: onClose });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Are you sure you want to remove the integration &lsquo;<strong>{component.displayName}</strong>&rsquo; ?
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>This action will be irreversible and all related details will be lost. Please type in the integration name below to confirm.</DialogContentText>
        {mutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {mutation.error.message || 'Failed to delete integration. Please try again.'}
          </Alert>
        )}
        <TextField autoFocus fullWidth placeholder="Enter integration name to confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={!confirmed || mutation.isPending} onClick={handleDelete}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function IntegrationsTable({ components, isLoading, scope, projectId, onSelect }: { components: GqlComponent[]; isLoading: boolean; scope: ProjectScope; projectId: string; onSelect: (handler: string) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<GqlComponent | null>(null);
  const filtered = components.filter((c) => !query || c.displayName.toLowerCase().includes(query.toLowerCase()));

  return (
    <section>
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Integrations
        </Typography>
        <IconButton size="small">
          <RefreshCw size={16} />
        </IconButton>
        <SearchField value={query} onChange={setQuery} placeholder="Search" sx={{ flex: 1 }} />
        <Authorized permissions={Permissions.INTEGRATION_MANAGE}>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => navigate(newComponentUrl(scope))}>
            Create
          </Button>
        </Authorized>
      </Stack>

      {isLoading ? (
        <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />
      ) : (
        <ListingTable.Container disablePaper>
          <ListingTable variant="card" density="compact">
            <ListingTable.Head>
              <ListingTable.Row>
                <ListingTable.Cell>Name</ListingTable.Cell>
                <ListingTable.Cell>Description</ListingTable.Cell>
                <ListingTable.Cell>Type</ListingTable.Cell>
                <ListingTable.Cell>Last Updated</ListingTable.Cell>
                <Authorized permissions={Permissions.INTEGRATION_MANAGE}>
                  <ListingTable.Cell width={60} />
                </Authorized>
              </ListingTable.Row>
            </ListingTable.Head>
            <ListingTable.Body>
              {filtered.map((c) => (
                <ListingTable.Row key={c.id} variant="card" sx={{ cursor: 'pointer' }} onClick={() => onSelect(c.handler)}>
                  <ListingTable.Cell>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'action.hover', color: 'text.primary' }}>{c.displayName[0].toUpperCase()}</Avatar>
                      {c.displayName}
                    </Stack>
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                      {c.description || ''}
                    </Typography>
                  </ListingTable.Cell>
                  <ListingTable.Cell>{c.componentType}</ListingTable.Cell>
                  <ListingTable.Cell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDistanceToNow(c.lastBuildDate)}
                    </Typography>
                  </ListingTable.Cell>
                  <Authorized permissions={Permissions.INTEGRATION_MANAGE}>
                    <ListingTable.Cell>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(c);
                        }}>
                        <Trash2 size={16} />
                      </IconButton>
                    </ListingTable.Cell>
                  </Authorized>
                </ListingTable.Row>
              ))}
            </ListingTable.Body>
          </ListingTable>
        </ListingTable.Container>
      )}

      {deleting && <DeleteDialog component={deleting} scope={scope} projectId={projectId} onClose={() => setDeleting(null)} />}
    </section>
  );
}

function IntegrationTypesCard({ components }: { components: GqlComponent[] }) {
  const counts = components.reduce<Record<string, number>>((acc, c) => {
    acc[c.componentType] = (acc[c.componentType] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Clock size={20} />
          Integration Types
        </Typography>
        <List disablePadding>
          {Object.entries(counts).map(([type, count]) => (
            <ListItem key={type} sx={{ px: 0, py: 0.5 }}>
              <ListItemText primary={type} />
              <Typography variant="body2">{count}</Typography>
            </ListItem>
          ))}
          <Divider />
          <ListItem sx={{ px: 0, py: 0.5 }}>
            <ListItemText primary={<Typography sx={{ fontWeight: 600 }}>Total</Typography>} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {components.length}
            </Typography>
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
}

export default function Project(scope: ProjectScope): JSX.Element {
  const navigate = useNavigate();
  const { data: project, isLoading: loadingProject } = useProjectByHandler(scope.project);
  const projectId = project?.id ?? '';
  useLoadProjectPermissions(scope.org, projectId);
  const { data: components = [], isLoading: loadingComponents } = useComponents(scope.org, projectId);

  if (loadingProject) {
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  }
  if (!project) {
    return <NotFound message="Project not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Projects" />;
  }

  return (
    <PageContent>
      <Stack component="header" direction="row" alignItems="center" gap={2} sx={{ mb: 4 }}>
        <Avatar sx={{ width: 56, height: 56, fontSize: 24, bgcolor: 'text.primary', color: 'background.paper' }}>{project?.name?.[0]?.toUpperCase() ?? 'P'}</Avatar>
        <div>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {project.description}
          </Typography>
        </div>
      </Stack>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <IntegrationsTable components={components} isLoading={loadingComponents} scope={scope} projectId={projectId} onSelect={(handler) => navigate(resourceUrl(narrow(scope, handler), 'overview'))} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack gap={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Architecture
                  </Typography>
                  <IconButton size="small">
                    <RefreshCw size={16} />
                  </IconButton>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    height: 250,
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    color: 'text.secondary',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  Architecture diagram
                </Typography>
              </CardContent>
            </Card>

            <IntegrationTypesCard components={components} />
          </Stack>
        </Grid>
      </Grid>
    </PageContent>
  );
}
