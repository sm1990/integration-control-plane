/**
 * Token Exchange for Choreo API Access
 * 
 * Exchanges the basic Asgardeo token (openid, profile, email, groups scopes)
 * for a privileged token with extensive Choreo scopes needed to access
 * organization management APIs and other Choreo services.
 * 
 * Based on the old Choreo console's TOKEN_EXCHANGE_CONFIG pattern.
 */

interface TokenExchangeConfig {
  tokenEndpoint: string;
  clientId: string;
  grantType: string;
  subjectTokenType: string;
  requestedTokenType: string;
  scope: string;
}

interface TokenExchangeResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let exchangedToken: string | null = null;
let tokenExpiry: number | null = null;

const TOKEN_EXCHANGE_CONFIG: TokenExchangeConfig = {
  tokenEndpoint: 'https://sts.preview-dv.choreo.dev:443/oauth2/token',
  clientId: '62j_4D4MnedSLkZ7ZD02EZoKM2ga',
  grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
  subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
  requestedTokenType: 'urn:ietf:params:oauth:token-type:jwt',
  scope: [
    'apim:api_manage',
    'apim:subscription_manage',
    'apim:tier_manage',
    'apim:admin',
    'apim:publisher_settings',
    'environments:view_prod',
    'environments:view_dev',
    'choreo:user_manage',
    'apim:dcr:app_manage',
    'choreo:deployment_manage',
    'choreo:prod_env_manage',
    'choreo:non_prod_env_manage',
    'choreo:component_manage',
    'choreo:project_manage',
    'apim:api_publish',
    'apim:document_manage',
    'apim:api_settings',
    'apim:subscription_view',
    'apim:environment_manage',
    'choreo:log_view_non_prod',
    'choreo:log_view_prod',
    'urn:choreocontrolplane:usermanagement:role_mapping_manage',
    'urn:choreocontrolplane:usermanagement:role_mapping_view',
    'urn:choreocontrolplane:usermanagement:role_view',
    'urn:choreocontrolplane:usermanagement:role_manage',
    'urn:choreocontrolplane:usermanagement:user_manage',
    'urn:choreocontrolplane:usermanagement:user_view',
    'urn:choreocontrolplane:componentsmanagement:component_trigger',
    'urn:choreocontrolplane:componentsmanagement:component_create',
    'urn:choreocontrolplane:componentsmanagement:component_config_view',
    'urn:choreocontrolplane:componentsmanagement:component_logs_view',
    'urn:choreocontrolplane:componentsmanagement:component_file_view',
    'urn:choreocontrolplane:componentsmanagement:component_manage',
    'urn:choreocontrolplane:configmanagement:config_view',
    'urn:choreocontrolplane:configmanagement:config_manage',
    'urn:choreocontrolplane:organizationapi:org_manage',
    'urn:choreocontrolplane:choreodevopsportalapi:deployment_view',
    'urn:choreocontrolplane:choreodevopsportalapi:deployment_manage',
    'apim:api_view',
    'apim:tier_view',
    'apim:api_generate_key',
    'choreo:log_view',
    'environments:view',
  ].join(' '),
};

/**
 * Exchange the Asgardeo access token for a Choreo-scoped token.
 * Caches the exchanged token and reuses it until expiry.
 */
export async function getExchangedToken(asgardeoToken: string): Promise<string> {
  // Return cached token if still valid
  if (exchangedToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('[TokenExchange] Using cached exchanged token');
    return exchangedToken;
  }

  console.log('[TokenExchange] Exchanging token...');
  console.log('[TokenExchange] Request details:', {
    endpoint: TOKEN_EXCHANGE_CONFIG.tokenEndpoint,
    clientId: TOKEN_EXCHANGE_CONFIG.clientId,
    grantType: TOKEN_EXCHANGE_CONFIG.grantType,
    subjectTokenLength: asgardeoToken.length,
  });

  const formData = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_CONFIG.grantType,
    subject_token: asgardeoToken,
    subject_token_type: TOKEN_EXCHANGE_CONFIG.subjectTokenType,
    requested_token_type: TOKEN_EXCHANGE_CONFIG.requestedTokenType,
    scope: TOKEN_EXCHANGE_CONFIG.scope,
    client_id: TOKEN_EXCHANGE_CONFIG.clientId, // Public client - send as form param, not Basic auth
  });

  try {
    const response = await fetch(TOKEN_EXCHANGE_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    console.log('[TokenExchange] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TokenExchange] Failed:', response.status, errorText);
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as TokenExchangeResponse;
    exchangedToken = data.access_token;
    
    // Set expiry with 5-minute buffer
    const expiresInMs = (data.expires_in - 300) * 1000;
    tokenExpiry = Date.now() + expiresInMs;

    console.log('[TokenExchange] Token exchanged successfully');
    console.log('[TokenExchange] New token length:', exchangedToken.length);
    console.log('[TokenExchange] Expires in:', data.expires_in, 'seconds');
    console.log('[TokenExchange] Token preview:', exchangedToken.substring(0, 50) + '...');
    return exchangedToken;
  } catch (error) {
    console.error('[TokenExchange] Error:', error);
    throw error;
  }
}

/**
 * Clear the cached exchanged token (e.g., on logout or auth failure).
 */
export function clearExchangedToken(): void {
  exchangedToken = null;
  tokenExpiry = null;
  console.log('[TokenExchange] Cached token cleared');
}
