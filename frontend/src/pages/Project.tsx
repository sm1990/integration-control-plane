import { Avatar, Button, Card, CardContent, CircularProgress, Divider, Grid, IconButton, List, ListItem, ListItemText, ListingTable, PageContent, Stack, Typography } from '@wso2/oxygen-ui';
import { Clock, Plus, RefreshCw } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useNavigate } from 'react-router';
import { useState, type JSX } from 'react';
import { useProject, useComponents, type GqlComponent } from '../api/queries';
import NotFound from '../components/NotFound';
import { formatDistanceToNow } from '../utils/time';
import { resourceUrl, narrow, broaden, type ProjectScope } from '../nav';

function IntegrationsTable({ components, isLoading, onSelect }: { components: GqlComponent[]; isLoading: boolean; onSelect: (handler: string) => void }) {
  const [query, setQuery] = useState('');
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
        <Button variant="contained" startIcon={<Plus size={16} />}>
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
                </ListingTable.Row>
              ))}
            </ListingTable.Body>
          </ListingTable>
        </ListingTable.Container>
      )}
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
  const { data: project, isLoading: loadingProject } = useProject(scope.project);
  const { data: components = [], isLoading: loadingComponents } = useComponents(scope.org, scope.project);

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
          <IntegrationsTable components={components} isLoading={loadingComponents} onSelect={(handler) => navigate(resourceUrl(narrow(scope, handler), 'overview'))} />
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
