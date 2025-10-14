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
} from '@mui/material';
import {
    Dashboard as RuntimesIcon,
    CloudQueue as EnvironmentsIcon,
    Extension as ComponentsIcon,
    Folder as ProjectsIcon,
} from '@mui/icons-material';

const ICPLogo: React.FC<{ size?: number }> = ({ size = 100 }) => (
    <img
        src="/favicon.svg"
        alt="WSO2 ICP Logo"
        width={size}
        height={size}
        style={{ display: 'block' }}
    />
);

const HomePage: React.FC = () => {
    const navigate = useNavigate();

    const features = [
        {
            title: 'Environment Control',
            description: 'Organize and manage different deployment environments',
            icon: <EnvironmentsIcon color="primary" />,
            path: '/environments',
        },
        {
            title: 'Project Organization',
            description: 'Structure your integration projects for better organization',
            icon: <ProjectsIcon color="primary" />,
            path: '/projects',
        },
        {
            title: 'Component Management',
            description: 'Track and manage individual integration components',
            icon: <ComponentsIcon color="primary" />,
            path: '/components',
        },
        {
            title: 'Runtime Management',
            description: 'Monitor and manage integration runtimes across your infrastructure',
            icon: <RuntimesIcon color="primary" />,
            path: '/runtimes',
        },
    ];


    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 6, gap: 3 }}>
                <ICPLogo size={100} />
                <Box>
                    <Typography variant="h2" component="h1" gutterBottom color="primary">
                        Integration Control Plane
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ mt: 6 }}>
                <Paper elevation={1} sx={{ p: 4, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
                    <Typography variant="h5" textAlign="left" gutterBottom>
                        Get Started
                    </Typography>
                    <Typography variant="body1" textAlign="left">
                        Navigate through the sidebar to explore different sections of the Integration Control Plane.
                        Start by setting up your environments and projects, then add components and monitor your runtimes.
                    </Typography>
                </Paper>
            </Box>

            <Grid container spacing={3} sx={{ mt: 4 }}>
                {features.map((feature, index) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                        <Card
                            elevation={3}
                            onClick={() => navigate(feature.path)}
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
                            <CardContent sx={{ textAlign: 'center', flexGrow: 1 }}>
                                <Box sx={{ mb: 2, fontSize: '3rem' }}>
                                    {feature.icon}
                                </Box>
                                <Typography variant="h6" component="h3" gutterBottom>
                                    {feature.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {feature.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

        </Container >
    );
};

export default HomePage;