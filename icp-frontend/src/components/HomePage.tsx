import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Container,
    Paper,
    Button,
    Alert,
    CircularProgress,
    CardActions,
} from '@mui/material';
import {
    Folder as ProjectsIcon,
    Add as AddIcon,
    Person as PersonIcon,
    AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useProjects } from '../services/hooks';
import { useAuth } from '../contexts/AuthContext';


const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Get current user to check project author role
    const { loading, error, value: projects, retry } = useProjects();


    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>

            <Box sx={{ mt: 1 }}>
                <Paper elevation={1} sx={{ p: 4, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h5" textAlign="left">
                            All Projects
                        </Typography>
                        {/* Only show Create button for super admins and project authors */}
                        {(user?.isSuperAdmin || user?.isProjectAuthor) && (
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => navigate('/projects')}
                                sx={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                    }
                                }}
                            >
                                Create New Project
                            </Button>
                        )}
                    </Box>
                    <Typography variant="body1" textAlign="left">
                        Manage your integration projects, components, and runtimes from this central dashboard.
                        Click on any project to view its components or use the sidebar navigation to explore other sections.
                    </Typography>
                </Paper>
            </Box>

            {loading && (
                <Box display="flex" justifyContent="center" my={4}>
                    <CircularProgress />
                </Box>
            )}

            {error && (
                <Alert
                    severity="error"
                    action={
                        <Button color="inherit" size="small" onClick={retry}>
                            Retry
                        </Button>
                    }
                    sx={{ mt: 2 }}
                >
                    Error loading projects: {error.message}
                </Alert>
            )}

            {!loading && !error && projects.length === 0 && (
                <Box textAlign="center" py={4}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No projects found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        {(user?.isSuperAdmin || user?.isProjectAuthor)
                            ? 'Create your first project to get started'
                            : 'No projects available. Contact your administrator to get started.'}
                    </Typography>
                    {/* Only show Create button for super admins and project authors */}
                    {(user?.isSuperAdmin || user?.isProjectAuthor) && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/projects')}
                        >
                            Create Project
                        </Button>
                    )}
                </Box>
            )}

            {!loading && !error && projects.length > 0 && (
                <Grid container spacing={3} sx={{ mt: 4 }}>
                    {projects.map((project) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={project.projectId}>
                            <Card
                                elevation={3}
                                onClick={() => navigate(`/components?projectId=${project.projectId}`)}
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'transform 0.2s ease-in-out',
                                    cursor: 'pointer',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 6,
                                    }
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <ProjectsIcon color="primary" sx={{ mr: 1, fontSize: '2rem' }} />
                                        <Typography variant="h6" component="h3" noWrap>
                                            {project.name}
                                        </Typography>
                                    </Box>

                                    {project.description && (
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                mb: 2,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {project.description}
                                        </Typography>
                                    )}

                                    <Box sx={{ mt: 'auto' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <PersonIcon sx={{ fontSize: '0.875rem', mr: 0.5, color: 'text.secondary' }} />
                                            <Typography variant="caption" color="text.secondary">
                                                {project.createdBy}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <TimeIcon sx={{ fontSize: '0.875rem', mr: 0.5, color: 'text.secondary' }} />
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(project.createdAt).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>

                                <CardActions sx={{ p: 2, pt: 0 }}>
                                    <Button
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/components?projectId=${project.projectId}`);
                                        }}
                                    >
                                        View Components
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/projects`);
                                        }}
                                    >
                                        Manage
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Box sx={{ mt: 6 }}>
                <Paper elevation={1} sx={{ p: 4 }}>
                    <Typography variant="h6" textAlign="left" gutterBottom>
                        Get Started
                    </Typography>
                    <Typography variant="body1" textAlign="left">
                        Navigate through the sidebar to explore different sections of the Integration Control Plane.
                        Start by setting up your environments and projects, then add components and monitor your runtimes.
                    </Typography>
                </Paper>
            </Box>

        </Container >
    );
};

export default HomePage;