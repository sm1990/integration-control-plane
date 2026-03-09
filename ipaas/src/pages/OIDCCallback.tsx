/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
        window.location.href = redirectUrl && !isLoginPage ? redirectUrl : orgUrl('default');
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
