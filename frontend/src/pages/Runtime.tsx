import { Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, PageContent, PageTitle, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Typography } from '@wso2/oxygen-ui';
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
  const [rowsPerPage, setRowsPerPage] = useState(5);
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
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Runtime</PageTitle.Header>
      </PageTitle>

      <SearchField value={query} onChange={setQuery} placeholder="Search..." sx={{ mb: 3, maxWidth: 400 }} />

      {isLoading ? (
        <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Runtime ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell>OS</TableCell>
                <TableCell>Registration Time</TableCell>
                <TableCell>Last Heartbeat</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.runtimeId}>
                  <TableCell>{r.runtimeId}</TableCell>
                  <TableCell>{r.runtimeType}</TableCell>
                  <TableCell>
                    <Chip label={r.status} size="small" color={r.status === 'RUNNING' ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>{r.version || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatPlatform(r)}</Typography>
                    {r.platformHome && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {r.platformHome}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{[r.osName, r.osVersion].filter(Boolean).join(' ')}</TableCell>
                  <TableCell>{r.registrationTime ? formatDate(r.registrationTime) : '—'}</TableCell>
                  <TableCell>{r.lastHeartbeat ? formatDate(r.lastHeartbeat) : '—'}</TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" aria-label={`Delete runtime ${r.runtimeId}`} disabled={r.status === 'RUNNING'} onClick={() => setDeleting(r)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
          />
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
