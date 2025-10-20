import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, AppBar, Toolbar, Typography, Box, IconButton, Button } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';

// Import ICP components
import HomePage from './components/HomePage';
import RuntimesPage from './components/RuntimesPage';
import EnvironmentsPage from './components/EnvironmentsPage';
import EnvironmentOverview from './components/EnvironmentOverview';
import ComponentsPage from './components/ComponentsPage';
import ProjectsPage from './components/ProjectsPage';
import LogsPage from './components/LogsPage';
import MetricsPage from './components/MetricsPage';
import UsersPage from './components/UsersPage';
import ProfilePage from './components/ProfilePage';
import LoginPage from './components/LoginPage';
import OIDCCallbackPage from './components/OIDCCallbackPage';
import Navigation, { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from './components/Navigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { icpApiClient } from './services/ICPApiClient';

const ICPLogo: React.FC<{ size?: number }> = ({ size = 100 }) => (
    <img
        src="/favicon.svg"
        alt="WSO2 ICP Logo"
        width={size}
        height={size}
        style={{ display: 'block' }}
    />
);

const createAppTheme = (mode: 'light' | 'dark') => createTheme({
    palette: {
        mode,
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

function AppContent({ darkMode, onThemeToggle }: { darkMode: boolean; onThemeToggle: () => void }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const { isAuthenticated, logout, user } = useAuth();

    // Set token in API client when user changes
    useEffect(() => {
        if (user?.token) {
            icpApiClient.setToken(user.token);
        } else {
            icpApiClient.setToken(null);
        }
    }, [user]);

    const handleSidebarToggle = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleTitleClick = () => {
        navigate('/');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // If not authenticated, show only login page and callback
    if (!isAuthenticated) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<OIDCCallbackPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                sx={{
                    zIndex: (theme) => theme.zIndex.drawer + 1,
                    ml: sidebarOpen ? `${DRAWER_WIDTH}px` : `${DRAWER_WIDTH_COLLAPSED}px`,
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="toggle sidebar"
                        edge="start"
                        onClick={handleSidebarToggle}
                        sx={{ mr: 2 }}
                    >
                        <ICPLogo size={50} />
                    </IconButton>
                    <Typography
                        variant="h6"
                        sx={{
                            flexGrow: 1,
                            cursor: 'pointer',
                            '&:hover': {
                                opacity: 0.8,
                            },
                        }}
                        onClick={handleTitleClick}
                    >
                        WSO2 Integrator: ICP
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {user && (
                            <Button
                                color="inherit"
                                onClick={() => navigate('/profile')}
                                sx={{
                                    textTransform: 'none',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    },
                                }}
                            >
                                <Typography variant="body2">
                                    {user.displayName || user.username}
                                </Typography>
                            </Button>
                        )}
                        <IconButton
                            color="inherit"
                            onClick={onThemeToggle}
                            aria-label="toggle theme"
                        >
                            {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
                        </IconButton>
                        <Button
                            color="inherit"
                            onClick={handleLogout}
                            startIcon={<LogoutIcon />}
                            sx={{ ml: 1 }}
                        >
                            Logout
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>

            <Navigation open={sidebarOpen} onToggle={handleSidebarToggle} />

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    transition: (theme) =>
                        theme.transitions.create('margin', {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                    mt: '64px', // Height of AppBar
                    minHeight: 'calc(100vh - 64px)',
                    backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                            ? theme.palette.grey[900]
                            : theme.palette.grey[50],
                }}
            >
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/runtimes" element={<RuntimesPage />} />
                    <Route path="/environments" element={<EnvironmentsPage />} />
                    <Route path="/environment-overview" element={<EnvironmentOverview />} />
                    <Route path="/observability/metrics" element={<MetricsPage />} />
                    <Route path="/observability/logs" element={<LogsPage />} />
                    <Route path="/components" element={<ComponentsPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Box>
        </Box>
    );
}

function App() {
    // Initialize theme from localStorage or default to false (light mode)
    const [darkMode, setDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('icp-theme-mode');
        return savedTheme === 'dark';
    });

    const theme = createAppTheme(darkMode ? 'dark' : 'light');

    const handleThemeToggle = () => {
        const newDarkMode = !darkMode;
        setDarkMode(newDarkMode);
        // Persist theme preference to localStorage
        localStorage.setItem('icp-theme-mode', newDarkMode ? 'dark' : 'light');
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <AuthProvider>
                    <AppContent darkMode={darkMode} onThemeToggle={handleThemeToggle} />
                </AuthProvider>
            </Router>
        </ThemeProvider>
    );
}

export default App;
