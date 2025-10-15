import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    Container,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { icpApiClient } from '../services/ICPApiClient';
import { LoginResponse } from '../types';

const OIDCCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            // Extract code and error from URL
            const code = searchParams.get('code');
            const errorParam = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            // Check if OIDC provider returned an error
            if (errorParam) {
                const errorMessage = errorDescription || errorParam || 'Authentication failed';
                setError(errorMessage);
                return;
            }

            // Check if authorization code is present
            if (!code) {
                setError('No authorization code received. Please try logging in again.');
                return;
            }

            try {
                // Exchange code for token
                const response: LoginResponse = await icpApiClient.loginWithOIDC(code);

                // Calculate token expiration time
                const expiresAt = Date.now() + (response.expiresIn * 1000);

                // Create auth user object (using isSuperAdmin from backend response)
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
                setError(err.message || 'Login failed. Please try again.');
            }
        };

        handleCallback();
    }, [searchParams, login, navigate]);

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
                    {error ? (
                        <>
                            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                                {error}
                            </Alert>
                            <Typography variant="body2" color="text.secondary">
                                <a href="/login" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    Return to login page
                                </a>
                            </Typography>
                        </>
                    ) : (
                        <>
                            <CircularProgress size={48} sx={{ mb: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                Completing your login...
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Please wait while we authenticate you.
                            </Typography>
                        </>
                    )}
                </Paper>
            </Container>
        </Box>
    );
};

export default OIDCCallbackPage;

