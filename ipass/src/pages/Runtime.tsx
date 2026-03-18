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

import { Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ListingTable, PageContent, PageTitle, TablePagination, Typography } from '@wso2/oxygen-ui';
import { Trash2 } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useState, type JSX } from 'react';
import { useQueries } from '@tanstack/react-query';
import { gql } from '../api/graphql';
import { useProjectByHandler, useEnvironments, useComponentByHandler, RUNTIMES_QUERY, PROJECT_RUNTIMES_QUERY, type GqlRuntime } from '../api/queries';
import { useDeleteRuntime } from '../api/mutations';
import { hasComponent, type ProjectScope, type ComponentScope } from '../nav';

function formatPlatform(r: GqlRuntime): string {
  if (!r.platformVersion) return r.platformName ?? '—';
  return /^\d/.test(r.platformVersion) ? `${r.platformName} ${r.platformVersion}` : r.platformVersion;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

export default function Runtime(scope: ProjectScope | ComponentScope): JSX.Element {
  const { data: project } = useProjectByHandler(scope.project);
  const projectId = project?.id ?? '';
  const { data: component } = useComponentByHandler(projectId, hasComponent(scope) ? scope.component : undefined);
  const componentId = component?.id;
  const { data: environments = [] } = useEnvironments(projectId);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleting, setDeleting] = useState<GqlRuntime | null>(null);
  const deleteMutation = useDeleteRuntime();

  const runtimeQueries = useQueries({
    queries: environments.map((env) => ({
      queryKey: componentId ? ['runtimes', env.id, projectId, componentId] : ['runtimes', env.id, projectId],
      queryFn: () => gql<{ runtimes: GqlRuntime[] }>(componentId ? RUNTIMES_QUERY : PROJECT_RUNTIMES_QUERY, componentId ? { environmentId: env.id, projectId, componentId } : { environmentId: env.id, projectId }).then((d) => d.runtimes),
    })),
  });

  const isLoading = runtimeQueries.some((q) => q.isLoading);
  const allRuntimes = runtimeQueries.flatMap((q) => q.data ?? []);
  const filtered = allRuntimes.filter((r) => !query || r.runtimeId.toLowerCase().includes(query.toLowerCase()) || r.runtimeType.toLowerCase().includes(query.toLowerCase()));
  const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const paged = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Runtime</PageTitle.Header>
      </PageTitle>

      {isLoading ? (
        <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />
      ) : (
        <>
          <ListingTable.Container>
            <ListingTable.Toolbar searchSlot={<SearchField value={query} onChange={setQuery} placeholder="Search..." />} />
            <ListingTable>
              <ListingTable.Head>
                <ListingTable.Row>
                  <ListingTable.Cell>Runtime ID</ListingTable.Cell>
                  <ListingTable.Cell>Type</ListingTable.Cell>
                  <ListingTable.Cell>Status</ListingTable.Cell>
                  <ListingTable.Cell>Version</ListingTable.Cell>
                  <ListingTable.Cell>Platform</ListingTable.Cell>
                  <ListingTable.Cell>OS</ListingTable.Cell>
                  <ListingTable.Cell>Registration Time</ListingTable.Cell>
                  <ListingTable.Cell>Last Heartbeat</ListingTable.Cell>
                  <ListingTable.Cell>Actions</ListingTable.Cell>
                </ListingTable.Row>
              </ListingTable.Head>
              <ListingTable.Body>
                {paged.length === 0 ? (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={9} align="center">
                      No records to display
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ) : (
                  paged.map((r) => (
                    <ListingTable.Row key={r.runtimeId}>
                      <ListingTable.Cell>{r.runtimeId}</ListingTable.Cell>
                      <ListingTable.Cell>{r.runtimeType}</ListingTable.Cell>
                      <ListingTable.Cell>
                        <Chip label={r.status} size="small" color={r.status === 'RUNNING' ? 'success' : 'default'} />
                      </ListingTable.Cell>
                      <ListingTable.Cell>{r.version || '—'}</ListingTable.Cell>
                      <ListingTable.Cell>
                        <Typography variant="body2">{formatPlatform(r)}</Typography>
                        {r.platformHome && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {r.platformHome}
                          </Typography>
                        )}
                      </ListingTable.Cell>
                      <ListingTable.Cell>{[r.osName, r.osVersion].filter(Boolean).join(' ')}</ListingTable.Cell>
                      <ListingTable.Cell>{r.registrationTime ? formatDate(r.registrationTime) : '—'}</ListingTable.Cell>
                      <ListingTable.Cell>{r.lastHeartbeat ? formatDate(r.lastHeartbeat) : '—'}</ListingTable.Cell>
                      <ListingTable.Cell>
                        <IconButton size="small" color="error" aria-label={`Delete runtime ${r.runtimeId}`} disabled={r.status === 'RUNNING'} onClick={() => setDeleting(r)}>
                          <Trash2 size={16} />
                        </IconButton>
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
        </>
      )}

      {deleting && (
        <Dialog open onClose={() => setDeleting(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Runtime</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete runtime <strong>{deleting.runtimeId}</strong>?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting.runtimeId, { onSuccess: () => setDeleting(null) })}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageContent>
  );
}
