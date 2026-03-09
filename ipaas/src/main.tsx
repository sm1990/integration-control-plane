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
loadConfig().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <OxygenUIThemeProvider themes={[{ key: 'acrylicOrange', label: 'Acrylic Orange Theme', theme: AcrylicOrangeTheme }]} initialTheme="acrylicOrange">
        <QueryClientProvider client={queryClient}>
          <AsgardeoAuthProvider
            config={{
              signInRedirectURL: window.API_CONFIG.asgardeoSignInRedirectUrl,
              signOutRedirectURL: window.API_CONFIG.asgardeoSignOutRedirectUrl,
              clientID: window.API_CONFIG.asgardeoClientId,
              baseUrl: window.API_CONFIG.asgardeoBaseUrl,
              scope: ['openid', 'profile', 'email'],
              resourceServerURLs: window.API_CONFIG.asgardeoResourceServerUrls,
            }}>
            <BrowserRouter>
              <AuthProvider>
                <AccessControlProvider>
                  <App />
                </AccessControlProvider>
              </AuthProvider>
            </BrowserRouter>
          </AsgardeoAuthProvider>
        </QueryClientProvider>
      </OxygenUIThemeProvider>
    </StrictMode>,
  );
});
