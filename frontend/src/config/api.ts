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
}

export interface ApiConfig {
  graphqlUrl: string;
  authBaseUrl: string;
  observabilityUrl: string;
}

// Extend window interface
declare global {
  interface Window {
    API_CONFIG: ApiConfig;
  }
}

// Default configuration (used as fallback if config.json fails to load)
const DEFAULT_CONFIG: ApiConfig = {
  graphqlUrl: 'https://localhost:9446/graphql',
  authBaseUrl: 'https://localhost:9445/auth',
  observabilityUrl: 'https://localhost:9448/icp/observability',
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
    };

    console.info('✓ Runtime configuration loaded from config.json');
    validateConfig(window.API_CONFIG);
  } catch (error) {
    console.warn('Failed to load runtime config, using defaults:', error);
    window.API_CONFIG = DEFAULT_CONFIG;
  }
}

// Validation: ensure critical URLs are configured
function validateConfig(config: ApiConfig): void {
  const missing: string[] = [];

  if (!config.graphqlUrl) missing.push('VITE_GRAPHQL_URL');
  if (!config.authBaseUrl) missing.push('VITE_AUTH_BASE_URL');
  if (!config.observabilityUrl) missing.push('VITE_OBSERVABILITY_URL');

  if (missing.length > 0) {
    console.warn(`Warning: The following configuration values are not set: ${missing.join(', ')}. ` + 'Using default values.');
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
