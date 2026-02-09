import { Avatar, Badge, Button, Card, CardContent, Chip, CircularProgress, Grid, IconButton, List, ListItemButton, ListItemText, ListingTable, PageContent, Stack, Tab, Tabs, Typography } from '@wso2/oxygen-ui';
import { ChevronRight, RefreshCw } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useParams } from 'react-router';
import { useState, type JSX } from 'react';
import { useComponentByHandler, useEnvironments, useRuntimes, useArtifactTypes, useArtifacts, type GqlEnvironment, type GqlRuntime, type GqlArtifact, ARTIFACT_QUERY_MAP } from '../api/queries';
import NotFound from '../components/NotFound';
import { projectUrl } from '../paths';

function RuntimesTable({ envId, projectId, componentId }: { envId: string; projectId: string; componentId: string }) {
  const { data: runtimes = [], isLoading } = useRuntimes(envId, projectId, componentId);
  const [query, setQuery] = useState('');

  const filtered = runtimes.filter((r) => !query || r.runtimeId.toLowerCase().includes(query.toLowerCase()) || r.runtimeType.toLowerCase().includes(query.toLowerCase()) || r.status.toLowerCase().includes(query.toLowerCase()));

  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (runtimes.length === 0)
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No runtimes found for this environment.
      </Typography>
    );

  return (
    <section>
      <SearchField value={query} onChange={setQuery} placeholder="Search by Runtime ID, Type, Status..." sx={{ mb: 2, maxWidth: 400 }} />
      <ListingTable.Container disablePaper>
        <ListingTable density="compact">
          <ListingTable.Head>
            <ListingTable.Row>
              <ListingTable.Cell>Runtime ID</ListingTable.Cell>
              <ListingTable.Cell>Type</ListingTable.Cell>
              <ListingTable.Cell>Status</ListingTable.Cell>
              <ListingTable.Cell>Version</ListingTable.Cell>
              <ListingTable.Cell>Platform</ListingTable.Cell>
              <ListingTable.Cell>OS</ListingTable.Cell>
              <ListingTable.Cell>Registration Time</ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {filtered.map((r: GqlRuntime) => (
              <ListingTable.Row key={r.runtimeId}>
                <ListingTable.Cell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {r.runtimeId}
                  </Typography>
                </ListingTable.Cell>
                <ListingTable.Cell>{r.runtimeType}</ListingTable.Cell>
                <ListingTable.Cell>
                  <Chip label={r.status} size="small" color={r.status === 'RUNNING' ? 'success' : 'default'} />
                </ListingTable.Cell>
                <ListingTable.Cell>{r.version}</ListingTable.Cell>
                <ListingTable.Cell>
                  <Typography variant="body2">
                    {r.platformName} {r.platformVersion}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.platformHome}
                  </Typography>
                </ListingTable.Cell>
                <ListingTable.Cell>
                  {r.osName} {r.osVersion}
                </ListingTable.Cell>
                <ListingTable.Cell>{new Date(r.registrationTime).toLocaleString()}</ListingTable.Cell>
              </ListingTable.Row>
            ))}
          </ListingTable.Body>
        </ListingTable>
      </ListingTable.Container>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
        1 – {filtered.length} of {filtered.length}
      </Typography>
    </section>
  );
}

function ArtifactDetail({ artifacts, artifactType, query }: { artifacts: GqlArtifact[]; artifactType: string; query: string }) {
  const mapping = ARTIFACT_QUERY_MAP[artifactType];
  if (!mapping) return null;

  const columns = mapping.fields.split(', ').filter((f) => f !== 'state');
  const filtered = artifacts.filter((a) => !query || a.name?.toString().toLowerCase().includes(query.toLowerCase()));

  return (
    <Stack gap={1.5}>
      {filtered.map((a, i) => (
        <Card key={i} variant="outlined" sx={{ '&:hover': { boxShadow: 1 } }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Grid container spacing={2} sx={{ flex: 1 }}>
              {columns.map((col) => (
                <Grid key={col} size={{ xs: 12 / columns.length }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {col}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {String(a[col] ?? '—')}
                  </Typography>
                </Grid>
              ))}
            </Grid>
            <ChevronRight size={18} style={{ color: 'var(--oxygen-palette-text-secondary)' }} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function ArtifactsPanel({ envId, componentId }: { envId: string; componentId: string }) {
  const { data: types = [], isLoading } = useArtifactTypes(componentId, envId);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const activeType = selectedType ?? types[0]?.artifactType ?? '';
  const { data: artifacts = [], isLoading: loadingArtifacts } = useArtifacts(activeType, envId, componentId);

  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (types.length === 0)
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No artifacts found for this environment.
      </Typography>
    );

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 3 }}>
        <List disablePadding>
          {types.map((t) => (
            <ListItemButton
              key={t.artifactType}
              selected={t.artifactType === activeType}
              onClick={() => {
                setSelectedType(t.artifactType);
                setQuery('');
              }}
              sx={{ borderRadius: 1, mb: 0.5 }}>
              <ListItemText primary={t.artifactType} />
              <Badge badgeContent={t.artifactCount} color="primary" sx={{ mr: 1 }} />
            </ListItemButton>
          ))}
        </List>
      </Grid>
      <Grid size={{ xs: 12, sm: 9 }}>
        <Typography variant="overline" sx={{ mb: 1, display: 'block' }}>
          {activeType}s
        </Typography>
        <SearchField value={query} onChange={setQuery} placeholder={`Search ${activeType}s by name, context, or version`} fullWidth sx={{ mb: 2 }} />
        {loadingArtifacts ? <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} /> : <ArtifactDetail artifacts={artifacts} artifactType={activeType} query={query} />}
      </Grid>
    </Grid>
  );
}

function EnvironmentCard({ env, projectId, componentId }: { env: GqlEnvironment; projectId: string; componentId: string }) {
  const [tab, setTab] = useState(0);

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {env.name}
          </Typography>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton size="small">
              <RefreshCw size={16} />
            </IconButton>
            <Button variant="contained">Configure Runtime</Button>
          </Stack>
        </Stack>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Runtimes" />
          <Tab label="Artifacts" />
        </Tabs>
        {tab === 0 && <RuntimesTable envId={env.id} projectId={projectId} componentId={componentId} />}
        {tab === 1 && <ArtifactsPanel envId={env.id} componentId={componentId} />}
      </CardContent>
    </Card>
  );
}

export default function Component(): JSX.Element {
  const { orgHandler = 'default', projectId = '', componentHandler = '' } = useParams();
  const { data: component, isLoading } = useComponentByHandler(projectId, componentHandler);
  const { data: environments = [] } = useEnvironments(projectId);

  if (isLoading) {
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  }
  if (!component) {
    return <NotFound message="Component not found" backTo={projectUrl(orgHandler, projectId)} backLabel="Back to Project" />;
  }

  return (
    <PageContent>
      <Stack component="header" direction="row" alignItems="center" gap={2} sx={{ mb: 1 }}>
        <Avatar sx={{ width: 56, height: 56, fontSize: 24, bgcolor: 'text.primary', color: 'background.paper' }}>{component?.displayName?.[0]?.toUpperCase() ?? 'C'}</Avatar>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {component?.displayName ?? componentHandler}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, ml: 9 }}>
        {component?.description || '+ Add Description'}
      </Typography>

      {environments.map((env) => (
        <EnvironmentCard key={env.id} env={env} projectId={projectId} componentId={component?.id ?? ''} />
      ))}
    </PageContent>
  );
}
