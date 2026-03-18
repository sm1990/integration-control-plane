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

/**
 * Centralized API configuration.
 * Configuration is loaded from /config.json at runtime (modifiable after build).
 * Stored on window.API_CONFIG for global access.
 */

interface RuntimeConfig {
  VITE_GRAPHQL_URL?: string;
  VITE_AUTH_BASE_URL?: string;
  VITE_OBSERVABILITY_URL?: string;
  ASGARDEO_CLIENT_ID?: string;
  ASGARDEO_AUTHORIZE_ENDPOINT?: string;
  ASGARDEO_TOKEN_ENDPOINT?: string;
  ASGARDEO_SIGN_IN_REDIRECT_URL?: string;
  ASGARDEO_SCOPE?: string;
  STS_TOKEN_ENDPOINT?: string;
  STS_CLIENT_ID?: string;
  STS_SCOPE?: string;
  CHOREO_ORG_API_URL?: string;
  ASGARDEO_ORG_NUMERIC_ID?: string;
}

export interface ApiConfig {
  graphqlUrl: string;
  authBaseUrl: string;
  observabilityUrl: string;
  asgardeoClientId: string;
  asgardeoAuthorizeEndpoint: string;
  asgardeoTokenEndpoint: string;
  asgardeoSignInRedirectUrl: string;
  asgardeoScope: string;
  stsTokenEndpoint: string;
  stsClientId: string;
  stsScope: string;
  choreoOrgApiUrl: string;
  asgardeoOrgNumericId?: number;
}

// Extend window interface
declare global {
  interface Window {
    API_CONFIG: ApiConfig;
  }
}

// Default configuration (used as fallback if config.json fails to load)
const DEFAULT_CONFIG: ApiConfig = {
  graphqlUrl: 'https://apis.preview-dv.choreo.dev/projects/1.0.0/graphql',
  authBaseUrl: 'https://localhost:9445/auth',
  observabilityUrl: 'https://localhost:9448/icp/observability',
  asgardeoClientId: '',
  asgardeoAuthorizeEndpoint: 'https://dev.api.asgardeo.io/t/a/oauth2/authorize',
  asgardeoTokenEndpoint: 'https://dev.api.asgardeo.io/t/a/oauth2/token',
  asgardeoSignInRedirectUrl: `${window.location.origin}/signin`,
  asgardeoScope: 'openid profile email groups',
  stsTokenEndpoint: '',
  stsClientId: '',
  stsScope: '',
  choreoOrgApiUrl: 'https://apis.preview-dv.choreo.dev/orgs/1.0.0',
};

/**
 * Load configuration from /config.json.
 * This allows modifying URLs after build without rebuilding the app.
 */
export async function loadConfig(): Promise<void> {
  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config.json: ${response.status}`);
    }

    const config: RuntimeConfig = await response.json();

    window.API_CONFIG = {
      graphqlUrl: config.VITE_GRAPHQL_URL || DEFAULT_CONFIG.graphqlUrl,
      authBaseUrl: config.VITE_AUTH_BASE_URL || DEFAULT_CONFIG.authBaseUrl,
      observabilityUrl: config.VITE_OBSERVABILITY_URL || DEFAULT_CONFIG.observabilityUrl,
      asgardeoClientId: config.ASGARDEO_CLIENT_ID || DEFAULT_CONFIG.asgardeoClientId,
      asgardeoAuthorizeEndpoint: config.ASGARDEO_AUTHORIZE_ENDPOINT || DEFAULT_CONFIG.asgardeoAuthorizeEndpoint,
      asgardeoTokenEndpoint: config.ASGARDEO_TOKEN_ENDPOINT || DEFAULT_CONFIG.asgardeoTokenEndpoint,
      asgardeoSignInRedirectUrl: config.ASGARDEO_SIGN_IN_REDIRECT_URL || DEFAULT_CONFIG.asgardeoSignInRedirectUrl,
      asgardeoScope: config.ASGARDEO_SCOPE || DEFAULT_CONFIG.asgardeoScope,
      stsTokenEndpoint: config.STS_TOKEN_ENDPOINT || DEFAULT_CONFIG.stsTokenEndpoint,
      stsClientId: config.STS_CLIENT_ID || DEFAULT_CONFIG.stsClientId,
      stsScope: config.STS_SCOPE || '',
      choreoOrgApiUrl: config.CHOREO_ORG_API_URL || DEFAULT_CONFIG.choreoOrgApiUrl,
      asgardeoOrgNumericId: (() => {
        if (config.ASGARDEO_ORG_NUMERIC_ID) return parseInt(config.ASGARDEO_ORG_NUMERIC_ID, 10);
        const stored = localStorage.getItem('icp_org_numeric_id');
        return stored ? parseInt(stored, 10) : undefined;
      })(),
    };

    console.info('✓ Runtime configuration loaded from config.json');
  } catch (error) {
    console.warn('Failed to load runtime config, using defaults:', error);
    window.API_CONFIG = DEFAULT_CONFIG;
  }
}

// Simple helper functions for derived URLs
export const loginApiUrl = (): string => `${window.API_CONFIG.authBaseUrl}/login`;
export const refreshTokenApiUrl = (): string => `${window.API_CONFIG.authBaseUrl}/refresh-token`;
export const revokeTokenApiUrl = (): string => `${window.API_CONFIG.authBaseUrl}/revoke-token`;
export const oidcAuthorizeApiUrl = (): string => `${window.API_CONFIG.authBaseUrl}/oidc/authorize-url`;
export const oidcCallbackApiUrl = (): string => `${window.API_CONFIG.authBaseUrl}/login/oidc`;
export const changePasswordApiUrl = (): string => `${window.API_CONFIG.authBaseUrl}/change-password`;
export const forceChangePasswordApiUrl = (): string => `${window.API_CONFIG.authBaseUrl}/force-change-password`;
