import { Avatar, Button, Card, CardContent, Grid, IconButton, PageContent, PageTitle, Stack, ToggleButton, ToggleButtonGroup, Typography, CircularProgress } from '@wso2/oxygen-ui';
import { Clock, Folder, LayoutGrid, List, Plus, RefreshCw, Settings } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useNavigate } from 'react-router';
import { useState, type JSX } from 'react';
import { useProjects, type GqlProject } from '../api/queries';
import EmptyListing from '../components/EmptyListing';
import { formatDistanceToNow } from '../utils/time';
import { resourceUrl, narrow, newProjectUrl, type OrgScope } from '../nav';
import { useAccessControl } from '../contexts/AccessControlContext';
import { Permissions } from '../constants/permissions';
import Authorized from '../components/Authorized';

function ProjectCard({ project, onClick }: { project: GqlProject; onClick: () => void }) {
  return (
    <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }} onClick={onClick}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
        <Avatar sx={{ bgcolor: 'action.hover', color: 'text.secondary', width: 48, height: 48 }}>{project.name[0].toUpperCase()}</Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
          {project.name}
        </Typography>
      </CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, pb: 2 }}>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
          <Clock size={14} />
          {formatDistanceToNow(project.updatedAt)}
        </Typography>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
          }}>
          <Settings size={16} />
        </IconButton>
      </Stack>
    </Card>
  );
}

export default function Projects(scope: OrgScope): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { hasOrgPermission } = useAccessControl();
  const canCreateProject = hasOrgPermission(Permissions.PROJECT_MANAGE);
  const { data: projects, isLoading, refetch } = useProjects();

  const filtered = (projects ?? []).filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>
          <Stack direction="row" alignItems="center" gap={1}>
            All Projects
            <IconButton size="small" onClick={() => refetch()}>
              <RefreshCw size={18} />
            </IconButton>
          </Stack>
        </PageTitle.Header>
        <PageTitle.Actions>
          <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
            <ToggleButton value="grid">
              <LayoutGrid size={18} />
            </ToggleButton>
            <ToggleButton value="list">
              <List size={18} />
            </ToggleButton>
          </ToggleButtonGroup>
        </PageTitle.Actions>
      </PageTitle>

      <Stack direction="row" gap={2} alignItems="center" sx={{ mb: 3 }}>
        <SearchField value={query} onChange={setQuery} placeholder="Search projects" fullWidth />
        <Authorized permissions={Permissions.PROJECT_MANAGE}>
          <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => navigate(newProjectUrl(scope))} sx={{ whiteSpace: 'nowrap' }}>
            Create
          </Button>
        </Authorized>
      </Stack>

      {isLoading ? (
        <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />
      ) : filtered.length === 0 ? (
        <EmptyListing
          icon={<Folder size={48} />}
          title="No projects found"
          description={query ? 'Try adjusting your search' : canCreateProject ? 'Create your first project to get started' : 'Ask your administrator for access'}
          showAction={!query && canCreateProject}
          actionLabel="Create Project"
          onAction={() => navigate(newProjectUrl(scope))}
        />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p} onClick={() => navigate(resourceUrl(narrow(scope, p.handler), 'overview'))} />
            </Grid>
          ))}
        </Grid>
      )}
    </PageContent>
  );
}
