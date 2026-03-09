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
  /** Asgardeo organization slug used in subdomain, e.g. "stage" */
  ASGARDEO_ORG?: string;
  /** Asgardeo org dot-prefix for the hostname, e.g. "stage." */
  ASGARDEO_ORG_DOT?: string;
  /** Asgardeo regional dot-prefix for the hostname, e.g. "" or "us-east." */
  ASGARDEO_ORG_REGION_DOT?: string;
  ASGARDEO_CLIENT_ID?: string;
  ASGARDEO_SIGN_IN_REDIRECT_URL?: string;
  ASGARDEO_SIGN_OUT_REDIRECT_URL?: string;
  /** When "true", the app will log out automatically if token refresh fails */
  ASGARDEO_AUTO_LOGOUT_ON_TOKEN_REFRESH_ERROR?: string;
  /** Pipe-separated list of resource server URLs the SDK should attach the token to */
  ASGARDEO_SDK_RESOURCE_SERVER_URLS?: string;
  /** Additional domain appended to the resource server URL list */
  ASGARDEO_DOMAIN?: string;
  AUTHENTICATOR_MICROSOFT?: string;
}

export interface ApiConfig {
  graphqlUrl: string;
  authBaseUrl: string;
  observabilityUrl: string;
  /** Derived: https://{orgDot}api{regionDot}.asgardeo.io/t/a */
  asgardeoBaseUrl: string;
  asgardeoClientId: string;
  asgardeoSignInRedirectUrl: string;
  asgardeoSignOutRedirectUrl: string;
  asgardeoAutoLogoutOnTokenRefreshError: boolean;
  /** Parsed resource server URL list for the Asgardeo SDK */
  asgardeoResourceServerUrls: string[];
}

// Extend window interface
declare global {
  interface Window {
    API_CONFIG: ApiConfig;
  }
}

function buildAsgardeoBaseUrl(orgDot: string, regionDot: string): string {
  return `https://${orgDot}api${regionDot}.asgardeo.io/t/a`;
}

function parseResourceServerUrls(raw: string, domain: string): string[] {
  const urls = raw
    .split('|')
    .map((u) => u.trim())
    .filter(Boolean);
  if (domain) urls.push(`https://${domain}`);
  return urls;
}

const DEFAULT_ORG_DOT = 'stage.';
const DEFAULT_REGION_DOT = '';

// Default configuration (used as fallback if config.json fails to load)
const DEFAULT_CONFIG: ApiConfig = {
  graphqlUrl: 'https://localhost:9446/graphql',
  authBaseUrl: 'https://localhost:9445/auth',
  observabilityUrl: 'https://localhost:9448/icp/observability',
  asgardeoBaseUrl: buildAsgardeoBaseUrl(DEFAULT_ORG_DOT, DEFAULT_REGION_DOT),
  asgardeoClientId: '',
  asgardeoSignInRedirectUrl: `${window.location.origin}/signin`,
  asgardeoSignOutRedirectUrl: `${window.location.origin}/login?state=sign_out_success`,
  asgardeoAutoLogoutOnTokenRefreshError: false,
  asgardeoResourceServerUrls: [],
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

    const orgDot = config.ASGARDEO_ORG_DOT ?? DEFAULT_ORG_DOT;
    const regionDot = config.ASGARDEO_ORG_REGION_DOT ?? DEFAULT_REGION_DOT;

    window.API_CONFIG = {
      graphqlUrl: config.VITE_GRAPHQL_URL || DEFAULT_CONFIG.graphqlUrl,
      authBaseUrl: config.VITE_AUTH_BASE_URL || DEFAULT_CONFIG.authBaseUrl,
      observabilityUrl: config.VITE_OBSERVABILITY_URL || DEFAULT_CONFIG.observabilityUrl,
      asgardeoBaseUrl: buildAsgardeoBaseUrl(orgDot, regionDot),
      asgardeoClientId: config.ASGARDEO_CLIENT_ID || DEFAULT_CONFIG.asgardeoClientId,
      asgardeoSignInRedirectUrl: config.ASGARDEO_SIGN_IN_REDIRECT_URL || DEFAULT_CONFIG.asgardeoSignInRedirectUrl,
      asgardeoSignOutRedirectUrl: config.ASGARDEO_SIGN_OUT_REDIRECT_URL || DEFAULT_CONFIG.asgardeoSignOutRedirectUrl,
      asgardeoAutoLogoutOnTokenRefreshError: config.ASGARDEO_AUTO_LOGOUT_ON_TOKEN_REFRESH_ERROR === 'true',
      asgardeoResourceServerUrls: parseResourceServerUrls(config.ASGARDEO_SDK_RESOURCE_SERVER_URLS ?? '', config.ASGARDEO_DOMAIN ?? ''),
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
