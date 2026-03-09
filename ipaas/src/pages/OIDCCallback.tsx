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

import { useEffect } from 'react';
import type { JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, Box, CircularProgress, Link, Typography } from '@wso2/oxygen-ui';
import { useAuthContext } from '@asgardeo/auth-react';
import { loginUrl, orgUrl } from '../paths';

/**
 * Handles the Asgardeo OIDC callback at /signin.
 *
 * @asgardeo/auth-react automatically exchanges the authorization code for tokens
 * when it detects ?code=...&state=... in the URL. This component simply waits
 * for the SDK to finish (state.isLoading → false) and then redirects.
 */
export default function OIDCCallback(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, signIn } = useAuthContext();

  const oidcError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Trigger the SDK's code exchange when we land here with ?code=...
  // Re-runs when isLoading changes so that if the SDK initialises with isLoading:true
  // we still call signIn() once it settles to false without an active session.
  useEffect(() => {
    if (!oidcError && !state.isAuthenticated && !state.isLoading) {
      signIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isLoading]);

  // Redirect to the main app once authenticated.
  useEffect(() => {
    if (state.isAuthenticated) {
      navigate(orgUrl('default'), { replace: true });
    }
  }, [state.isAuthenticated, navigate]);

  if (oidcError) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 3 }}>
        <Box sx={{ maxWidth: 480, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            Authentication failed: {errorDescription ?? oidcError}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please try logging in again.
          </Typography>
          <Link href={loginUrl()}>Return to Login</Link>
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
