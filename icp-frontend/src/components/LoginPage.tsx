import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    Container,
    Divider,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../contexts/AuthContext';
import { icpApiClient } from '../services/ICPApiClient';
import { LoginResponse } from '../types';


const ICPLogo: React.FC<{ size?: number }> = ({ size = 100 }) => (
    <img
        src="/favicon.svg"
        alt="WSO2 ICP Logo"
        width={size}
        height={size}
        style={{ display: 'block' }}
    />
);

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [ssoLoading, setSsoLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response: LoginResponse = await icpApiClient.login(username, password);

            // Calculate token expiration time
            const expiresAt = Date.now() + (response.expiresIn * 1000);

            // Use server-provided user information (including isSuperAdmin and isProjectAuthor from backend)
            const authUser = {
                username: response.username,
                token: response.token,
                roles: response.roles,
                expiresAt,
                isSuperAdmin: response.isSuperAdmin,
                isProjectAuthor: response.isProjectAuthor,
            };

            // Set token in API client
            icpApiClient.setToken(response.token);

            // Update auth context
            login(authUser);

            // Navigate to home page
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleSSOLogin = async () => {
        setError('');
        setSsoLoading(true);

        try {
            // Get the authorization URL from backend
            const { authorizationUrl } = await icpApiClient.getOIDCAuthorizationUrl();

            // Redirect to the OIDC provider
            window.location.href = authorizationUrl;
        } catch (err: any) {
            setError(err.message || 'SSO login failed. Please try again.');
            setSsoLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                        ? theme.palette.grey[900]
                        : theme.palette.grey[50],
            }}
        >
            <Container maxWidth="sm">
                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderRadius: 2,
                    }}
                >
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            backgroundColor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 2,
                        }}
                    >
                        <ICPLogo size={32} />
                    </Box>
                    <Typography component="h1" variant="h5" gutterBottom color="primary">
                        Integration Control Plane
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Sign in to your account
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="username"
                            label="Username"
                            name="username"
                            autoComplete="username"
                            autoFocus
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2, py: 1.5 }}
                            disabled={loading || ssoLoading}
                        >
                            {loading ? (
                                <>
                                    <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </Button>

                        <Divider sx={{ my: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                OR
                            </Typography>
                        </Divider>

                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={handleSSOLogin}
                            disabled={loading || ssoLoading}
                            startIcon={ssoLoading ? <CircularProgress size={20} /> : <LoginIcon />}
                            sx={{ py: 1.5 }}
                        >
                            {ssoLoading ? 'Redirecting...' : 'Login with SSO'}
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default LoginPage;
