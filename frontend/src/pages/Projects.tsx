import { Avatar, Button, Card, CardContent, Grid, IconButton, PageContent, PageTitle, Stack, TextField, InputAdornment, Typography, CircularProgress } from '@wso2/oxygen-ui';
import { Clock, Folder, Plus, Search, Settings } from '@wso2/oxygen-ui-icons-react';
import { useNavigate, useParams } from 'react-router';
import { useState, type JSX } from 'react';
import { useProjects, type GqlProject } from '../api/queries';
import EmptyListing from '../components/EmptyListing';
import { formatDistanceToNow } from '../utils/time';

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

export default function Projects(): JSX.Element {
  const navigate = useNavigate();
  const { orgHandler = 'default' } = useParams();
  const [query, setQuery] = useState('');
  const { data: projects, isLoading } = useProjects();

  const filtered = (projects ?? []).filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Projects</PageTitle.Header>
        <PageTitle.SubHeader>Manage your projects and workflows</PageTitle.SubHeader>
        <PageTitle.Actions>
          <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => navigate(`/organizations/${orgHandler}/projects/new`)}>
            New Project
          </Button>
        </PageTitle.Actions>
      </PageTitle>

      <TextField
        fullWidth
        placeholder="Search projects"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="small"
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            ),
          },
        }}
      />

      {isLoading ? (
        <CircularProgress sx={{ display: 'block', mx: 'auto', py: 8 }} />
      ) : filtered.length === 0 ? (
        <EmptyListing
          icon={<Folder size={48} />}
          title="No projects found"
          description={query ? 'Try adjusting your search' : 'Create your first project to get started'}
          showAction={!query}
          actionLabel="Create Project"
          onAction={() => navigate(`/organizations/${orgHandler}/projects/new`)}
        />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p} onClick={() => navigate(`/organizations/${orgHandler}/projects/${p.id}/home`)} />
            </Grid>
          ))}
        </Grid>
      )}
    </PageContent>
  );
}
