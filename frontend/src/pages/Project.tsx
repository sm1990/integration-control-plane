import { Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, Divider, Grid, IconButton, List, ListItem, ListItemText, ListingTable, Modal, PageContent, Snackbar, Stack, TextField, Tooltip, Typography } from '@wso2/oxygen-ui';
import { Clock, Plus, RefreshCw, Rocket, Trash2 } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useNavigate, useParams } from 'react-router';
import { useState, type JSX } from 'react';
import { useProject, useComponents, type GqlComponent } from '../api/queries';
import { useDeleteComponent } from '../api/mutations';
import NotFound from '../components/NotFound';
import { formatDistanceToNow } from '../utils/time';
import { componentUrl, orgUrl, newComponentUrl } from '../paths';
import EmptyListing from '../components/EmptyListing';

function IntegrationsTable({ components, isLoading, onSelect, onCreate, onDeleteResult }: { components: GqlComponent[]; isLoading: boolean; onSelect: (handler: string) => void; onCreate: () => void; onDeleteResult: (result: { success: boolean; message: string }) => void }) {
  const [query, setQuery] = useState('');
  const filtered = components.filter((c) => !query || c.displayName.toLowerCase().includes(query.toLowerCase()));
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; displayName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { projectId, orgHandler } = useParams();
  const deleteComponent = useDeleteComponent();

  const handleDeleteClick = (id: string, displayName: string) => {
    setDeleteTarget({ id, displayName });
    setDeleteConfirm('');
    setDeleteModalOpen(true);
  };
  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeleteConfirm('');
  };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteComponent.mutateAsync({
        projectId: String(projectId ?? ''),
        componentId: deleteTarget.id,
        orgHandler: String(orgHandler ?? 'default'),
      });
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      setDeleteConfirm('');
      let successMsg = result?.message || 'Integration deleted successfully.';
      // Replace any legacy 'Component deleted successfully.' with 'Integration deleted successfully.'
      if (successMsg === 'Component deleted successfully.') {
        successMsg = 'Integration deleted successfully.';
      }
      onDeleteResult({ success: true, message: successMsg });
    } catch (error: unknown) {
      let message = 'Failed to delete integration.';
      if (error && typeof error === 'object' && 'message' in error && typeof (error as Record<string, unknown>).message === 'string') {
        message = (error as { message: string }).message;
      }
      onDeleteResult({ success: false, message });
    } finally {
      setDeleting(false);
    }
  };

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
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={onCreate}>
          Create
        </Button>
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
                <ListingTable.Cell></ListingTable.Cell>
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
                  <ListingTable.Cell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" sx={{ ml: 1 }} onClick={(e) => { e.stopPropagation(); handleDeleteClick(c.id, c.displayName); }}>
                        <Trash2 size={20} />
                      </IconButton>
                    </Tooltip>
                  </ListingTable.Cell>
                </ListingTable.Row>
              ))}
            </ListingTable.Body>
          </ListingTable>
        </ListingTable.Container>
      )}
      <Modal open={deleteModalOpen} onClose={handleDeleteCancel} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ bgcolor: 'background.paper', p: 4, borderRadius: 2, boxShadow: 24, minWidth: 480, position: 'relative' }}>
          {deleting && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Are you sure you want to remove the integration '{deleteTarget?.displayName}' ?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This action will be irreversible and all related details will be lost. Please type in the integration name below to confirm.
          </Typography>
          <TextField
            fullWidth
            placeholder="Enter integration name to confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            sx={{ mb: 3 }}
            disabled={deleting}
          />
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={handleDeleteCancel} disabled={deleting}>Cancel</Button>
            <Button variant="contained" color="error" disabled={deleteConfirm !== deleteTarget?.displayName || deleting} onClick={handleDeleteConfirm}>Delete</Button>
          </Stack>
        </Box>
      </Modal>
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

export default function Project(): JSX.Element {
  // Snackbar state for deletion result
  const [snackbar, setSnackbar] = useState<{ open: boolean; success: boolean; message: string }>({ open: false, success: true, message: '' });

  const handleDeleteResult = (result: { success: boolean; message: string }) => {
    setSnackbar({ open: true, success: result.success, message: result.message });
  };
  const navigate = useNavigate();
  const { orgHandler = 'default', projectId = '' } = useParams();
  const { data: project, isLoading: loadingProject } = useProject(projectId);
  const { data: components = [], isLoading: loadingComponents } = useComponents(orgHandler, projectId);

  if (loadingProject) {
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  }
  if (!project) {
    return <NotFound message="Project not found" backTo={orgUrl(orgHandler)} backLabel="Back to Projects" />;
  }


  // Snackbar JSX (always rendered)
  const snackbarNode = (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={4000}
      onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        severity={snackbar.success ? 'success' : 'error'}
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );

  // Show empty state if no components
  if (!loadingComponents && components.length === 0) {
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

        <EmptyListing
          icon={<Rocket size={80} />}
          title="Ready to Deploy Your First Integration?"
          description="An integration represents a backend service or task you want to deploy with ICP."
          showAction
          actionLabel="Create Integration"
          onAction={() => navigate(newComponentUrl(orgHandler, projectId))}
        />
        {snackbarNode}
      </PageContent>
    );
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
          <IntegrationsTable 
            components={components} 
            isLoading={loadingComponents} 
            onSelect={(handler) => navigate(componentUrl(orgHandler, projectId!, handler))}
            onCreate={() => navigate(newComponentUrl(orgHandler, projectId))}
            onDeleteResult={handleDeleteResult}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack gap={3}>
            <IntegrationTypesCard components={components} />
          </Stack>
        </Grid>
      </Grid>
      {snackbarNode}
    </PageContent>
  );
}
