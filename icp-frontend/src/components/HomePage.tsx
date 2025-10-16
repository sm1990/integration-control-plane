import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Chip,
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
        <Box sx={{ p: 3 }}>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="h4" gutterBottom>
                    All Projects
                </Typography>
                <Chip
                    label={`${projects.length}`}
                    color="primary"
                    variant="outlined"
                />
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
                <Box py={4}>
                    <Typography variant="h6" color="text.secondary" gutterBottom textAlign="center">
                        No projects found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={4} textAlign="center">
                        {(user?.isSuperAdmin || user?.isProjectAuthor)
                            ? 'Create your first project to get started'
                            : 'No projects available. Contact your administrator to get started.'}
                    </Typography>
                    {/* Only show Create card for super admins and project authors */}
                    {(user?.isSuperAdmin || user?.isProjectAuthor) && (
                        <Grid container spacing={3} justifyContent="center">
                            <Grid item xs={12} sm={6} md={4} lg={3}>
                                <Card
                                    elevation={3}
                                    onClick={() => navigate('/projects?create=true')}
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'transform 0.2s ease-in-out',
                                        cursor: 'pointer',
                                        border: '2px dashed',
                                        borderColor: 'primary.main',
                                        backgroundColor: 'action.hover',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: 6,
                                            backgroundColor: 'action.selected',
                                        }
                                    }}
                                >
                                    <CardContent sx={{
                                        flexGrow: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 200
                                    }}>
                                        <AddIcon sx={{ fontSize: '4rem', color: 'primary.main', mb: 2 }} />
                                        <Typography variant="h6" component="h3" color="primary" textAlign="center">
                                            Create New Project
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
                                            Click to add a new project
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </Box>
            )}

            {!loading && !error && projects.length > 0 && (
                <Grid container spacing={3} sx={{ mt: 4 }}>
                    {/* Create New Project Card - Only for super admins and project authors */}
                    {(user?.isSuperAdmin || user?.isProjectAuthor) && (
                        <Grid item xs={12} sm={6} md={4} lg={3}>
                            <Card
                                elevation={3}
                                onClick={() => navigate('/projects?create=true')}
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'transform 0.2s ease-in-out',
                                    cursor: 'pointer',
                                    border: '2px dashed',
                                    borderColor: 'primary.main',
                                    backgroundColor: 'action.hover',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 6,
                                        backgroundColor: 'action.selected',
                                    }
                                }}
                            >
                                <CardContent sx={{
                                    flexGrow: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 200
                                }}>
                                    <AddIcon sx={{ fontSize: '4rem', color: 'primary.main', mb: 2 }} />
                                    <Typography variant="h6" component="h3" color="primary" textAlign="center">
                                        Create New Project
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
                                        Click to add a new project
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}

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
                                            navigate(`/projects?edit=${project.projectId}`);
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



        </Box >
    );
};

export default HomePage;