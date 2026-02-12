import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useSearchParams } from 'react-router';
import { Alert, Box, CircularProgress, Typography } from '@wso2/oxygen-ui';
import { useAuth } from '../auth/AuthContext';
import { validateAndClearOIDCState, getAndClearRedirectUrl } from '../auth/tokenManager';
import { loginUrl, orgUrl } from '../paths';

export default function OIDCCallback(): JSX.Element {
  const [searchParams] = useSearchParams();
  const { handleOIDCCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const oidcError = searchParams.get('error');

      if (oidcError) {
        const description = searchParams.get('error_description') || oidcError;
        setError(`Authentication failed: ${description}`);
        return;
      }

      if (!state) {
        setError('Missing state parameter. Please try logging in again.');
        return;
      }

      if (!validateAndClearOIDCState(state)) {
        setError('Invalid state parameter. This may indicate a CSRF attack. Please try logging in again.');
        return;
      }

      if (!code) {
        setError('Missing authorization code. Please try logging in again.');
        return;
      }

      try {
        await handleOIDCCallback(code, state);

        const redirectUrl = getAndClearRedirectUrl();
        const isLoginPage = redirectUrl && new URL(redirectUrl).pathname === loginUrl();
        window.location.href = (redirectUrl && !isLoginPage) ? redirectUrl : orgUrl('default');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete authentication');
      }
    };

    processCallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 3 }}>
        <Box sx={{ maxWidth: 480, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please try logging in again.
          </Typography>
          <a href={loginUrl()}>Return to Login</a>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Completing sign in...
        </Typography>
      </Box>
    </Box>
  );
}
