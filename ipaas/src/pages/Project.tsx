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

import { Alert, Avatar, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, IconButton, ListingTable, PageContent, Stack, TablePagination, TextField, Tooltip, Typography } from '@wso2/oxygen-ui';
import { Plus, PlugZap, RefreshCw, Trash2 } from '@wso2/oxygen-ui-icons-react';
import EmptyListing from '../components/EmptyListing';
import IntegrationTypesCard from '../components/IntegrationTypesCard';
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

function IntegrationsTable({
  components,
  isLoading,
  isRefreshing,
  onRefresh,
  scope,
  projectId,
  onSelect,
}: {
  components: GqlComponent[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  scope: ProjectScope;
  projectId: string;
  onSelect: (handler: string) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleting, setDeleting] = useState<GqlComponent | null>(null);
  const q = query.trim().toLowerCase();
  const filtered = components.filter((c) => !q || c.displayName.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.componentType?.toLowerCase().includes(q));
  const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const paginated = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  return (
    <section>
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Integrations
        </Typography>
        <IconButton
          size="small"
          aria-label="Refresh integrations"
          onClick={onRefresh}
          disabled={isRefreshing}
          sx={isRefreshing ? { '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } }, '& svg': { animation: 'spin 1s linear infinite' } } : undefined}>
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
      ) : filtered.length === 0 ? (
        <EmptyListing icon={<PlugZap size={48} />} title="No integrations found" description={query ? 'Try adjusting your search' : 'Create your first integration to get started'} />
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
                  <ListingTable.Cell width={60}>Action</ListingTable.Cell>
                </Authorized>
              </ListingTable.Row>
            </ListingTable.Head>
            <ListingTable.Body>
              {paginated.map((c) => (
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
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Delete ${c.displayName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(c);
                          }}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </ListingTable.Cell>
                  </Authorized>
                </ListingTable.Row>
              ))}
            </ListingTable.Body>
          </ListingTable>
        </ListingTable.Container>
      )}
      {filtered.length > 10 && (
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
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ mt: 1 }}
        />
      )}

      {deleting && <DeleteDialog component={deleting} scope={scope} projectId={projectId} onClose={() => setDeleting(null)} />}
    </section>
  );
}

export default function Project(scope: ProjectScope): JSX.Element {
  const navigate = useNavigate();
  const { data: project, isLoading: loadingProject } = useProjectByHandler(scope.project);
  const projectId = project?.id ?? '';
  useLoadProjectPermissions(scope.org, projectId);
  const { data: components = [], isLoading: loadingComponents, isFetching: fetchingComponents, refetch: refetchComponents } = useComponents(scope.org, projectId);

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
          <Typography variant="h1">{project.name}</Typography>
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
            isRefreshing={fetchingComponents && !loadingComponents}
            onRefresh={refetchComponents}
            scope={scope}
            projectId={projectId}
            onSelect={(handler) => navigate(resourceUrl(narrow(scope, handler), 'overview'))}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack gap={3}>
            <IntegrationTypesCard components={components} />
          </Stack>
        </Grid>
      </Grid>
    </PageContent>
  );
}
