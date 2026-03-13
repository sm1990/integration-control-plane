/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
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

import { OxygenUIThemeProvider, AcrylicOrangeTheme } from '@wso2/oxygen-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider as AsgardeoAuthProvider } from '@asgardeo/auth-react';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { loadConfig } from './config/api';
import { AccessControlProvider } from './contexts/AccessControlContext';
import './index.css';

const queryClient = new QueryClient();

// Load runtime configuration before rendering the app.
// Asgardeo AuthProvider is placed outside BrowserRouter so the SDK can
// read window.location directly when processing the /signin callback.
// AsgardeoAuthProvider is intentionally outside StrictMode.
// React StrictMode double-mounts components in development, which causes the
// SDK's cleanup effect to delete the PKCE code_verifier from sessionStorage
// before the /signin callback can exchange the authorization code for tokens.
// The result is a silent failure: the POST /oauth2/token call is never made and
// the app gets stuck on "Completing sign in..." forever.
loadConfig().then(() => {
  const base = window.API_CONFIG.asgardeoBaseUrl;
  const asgardeoConfig = {
    signInRedirectURL: window.API_CONFIG.asgardeoSignInRedirectUrl,
    signOutRedirectURL: window.API_CONFIG.asgardeoSignOutRedirectUrl,
    clientID: window.API_CONFIG.asgardeoClientId,
    baseUrl: base,
    scope: ['openid', 'profile', 'email', 'groups'],
    resourceServerURLs: window.API_CONFIG.asgardeoResourceServerUrls,
    disableTrySignInSilently: true,
    // Explicit endpoints prevent the SDK from fetching the well-known discovery,
    // which redirects and causes the SDK to fall back to incorrect defaults.
    // authorize/token/logout use /t/a/ tenant path; jwks/revoke do not.
    endpoints: {
      authorizationEndpoint: `${base}/t/a/oauth2/authorize`,
      tokenEndpoint: `${base}/t/a/oauth2/token`,
      endSessionEndpoint: `${base}/t/a/oidc/logout`,
      jwksUri: `${base}/oauth2/jwks`,
      revocationEndpoint: `${base}/oauth2/revoke`,
    },
  };

  createRoot(document.getElementById('root')!).render(
    <AsgardeoAuthProvider config={asgardeoConfig}>
      <StrictMode>
        <OxygenUIThemeProvider themes={[{ key: 'acrylicOrange', label: 'Acrylic Orange Theme', theme: AcrylicOrangeTheme }]} initialTheme="acrylicOrange">
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AuthProvider>
                <AccessControlProvider>
                  <App />
                </AccessControlProvider>
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </OxygenUIThemeProvider>
      </StrictMode>
    </AsgardeoAuthProvider>,
  );
});
