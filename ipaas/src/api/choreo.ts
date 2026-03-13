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

import { getExchangedToken } from '../auth/tokenExchange';

let tokenProvider: (() => Promise<string>) | null = null;

/**
 * Set the token provider for Choreo API calls.
 * This is wired in AuthContext to provide the base Asgardeo token.
 */
export function setChoreoTokenProvider(fn: () => Promise<string>): void {
  tokenProvider = fn;
}

/**
 * Fetch with exchanged token instead of basic Asgardeo token.
 * The exchanged token has the necessary Choreo scopes to access org APIs.
 */
async function choreoAuthenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!tokenProvider) {
    throw new Error('Token provider not set. Call setChoreoTokenProvider first.');
  }

  // Get base Asgardeo token
  const asgardeoToken = await tokenProvider();
  console.log('[Choreo API] Asgardeo token length:', asgardeoToken?.length || 0);
  
  // Exchange for Choreo-scoped token
  const exchangedToken = await getExchangedToken(asgardeoToken);
  console.log('[Choreo API] Using exchanged token, length:', exchangedToken?.length || 0);

  // Make request with exchanged token
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${exchangedToken}`);

  console.log('[Choreo API] Fetching:', url);
  const response = await fetch(url, {
    ...options,
    headers,
  });
  console.log('[Choreo API] Response:', response.status, response.statusText);
  
  return response;
}

export interface ChoreoOrganization {
  id?: string;
  uuid?: string;
  name: string;
  handle: string;
  status?: string;
  /** Numeric organization ID used by GraphQL API */
  numericId?: number;
}

interface ChoreoOrgResponse {
  organization: ChoreoOrganization;
  isAdmin: boolean;
  allowedPermissions?: Record<string, string[]>;
}

async function choreoGet<T>(url: string): Promise<T> {
  const res = await choreoAuthenticatedFetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Choreo API error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * Returns the Choreo API base URL (origin of the graphQL endpoint).
 * e.g. "https://apis.preview-dv.choreo.dev"
 */
function choreoApiBase(): string {
  return new URL(window.API_CONFIG.graphqlUrl).origin;
}

/**
 * Fetch a single organization by handle.
 * If ASGARDEO_ORG_NUMERIC_ID is set in config.json, uses it directly without an API call
 * (needed when the token's client doesn't have the org management API subscription).
 * Otherwise calls GET /orgs/1.0.0/orgs/:handle.
 */
export async function fetchOrganizationByHandle(handle: string): Promise<ChoreoOrganization | null> {
  const configNumericId = window.API_CONFIG.asgardeoOrgNumericId;
  if (configNumericId) {
    return { name: handle, handle, numericId: configNumericId };
  }

  const url = `${choreoApiBase()}/orgs/1.0.0/orgs/${handle}`;
  try {
    const result = await choreoGet<ChoreoOrganization | ChoreoOrgResponse>(url);
    if ('organization' in result) {
      const org = result.organization;
      return { ...org, numericId: org.id ? parseInt(org.id, 10) : undefined };
    }
    const org = result as ChoreoOrganization;
    return { ...org, numericId: org.id ? parseInt(org.id, 10) : undefined };
  } catch {
    return null;
  }
}

/**
 * Fetch the organizations the currently authenticated user belongs to.
 * Calls GET /orgs/1.0.0/orgs — handles various response formats:
 * - Array of organizations: [{ handle: "...", name: "..." }, ...]
 * - Wrapper with list: { list: [...] }
 * - Wrapper with organization: { organization: {...} }
 * Falls back to /org-mgt/1.0.0/orgs if the primary endpoint fails.
 */
export async function fetchUserOrganizations(): Promise<ChoreoOrganization[]> {
  const primary = `${choreoApiBase()}/orgs/1.0.0/orgs`;
  console.log('[Choreo API] Fetching user organizations from:', primary);
  
  try {
    const result = await choreoGet<ChoreoOrganization[] | { list: ChoreoOrganization[] } | ChoreoOrgResponse | ChoreoOrgResponse[]>(primary);
    console.log('[Choreo API] Raw response from /orgs/1.0.0/orgs:', result);
    
    let orgs: ChoreoOrganization[];
    
    // Handle different response formats
    if (Array.isArray(result)) {
      // If it's an array, check if elements have 'organization' property
      if (result.length > 0 && 'organization' in result[0]) {
        orgs = (result as ChoreoOrgResponse[]).map(r => ({
          ...r.organization,
          numericId: r.organization.id ? parseInt(r.organization.id, 10) : undefined
        }));
      } else {
        orgs = (result as ChoreoOrganization[]).map(o => ({
          ...o,
          numericId: o.id ? parseInt(o.id, 10) : undefined
        }));
      }
    } else if ('list' in result) {
      orgs = (result.list ?? []).map(o => ({
        ...o,
        numericId: o.id ? parseInt(o.id, 10) : undefined
      }));
    } else if ('organization' in result) {
      const org = result.organization;
      orgs = [{
        ...org,
        numericId: org.id ? parseInt(org.id, 10) : undefined
      }];
    } else {
      orgs = [];
    }
    
    console.log('[Choreo API] Parsed organizations:', orgs);
    return orgs;
  } catch (primaryErr) {
    console.warn('[Choreo API] /orgs/1.0.0/orgs failed, falling back to /org-mgt/1.0.0/orgs', primaryErr);
    const fallback = `${choreoApiBase()}/org-mgt/1.0.0/orgs`;
    
    try {
      const result = await choreoGet<ChoreoOrganization[] | { list: ChoreoOrganization[] }>(fallback);
      console.log('[Choreo API] Raw response from /org-mgt/1.0.0/orgs:', result);
      
      const orgs = (Array.isArray(result) ? result : (result.list ?? [])).map(o => ({
        ...o,
        numericId: o.id ? parseInt(o.id, 10) : undefined
      }));
      console.log('[Choreo API] Parsed organizations from fallback:', orgs);
      return orgs;
    } catch (fallbackErr) {
      console.error('[Choreo API] Both endpoints failed:', fallbackErr);
      
      // Final fallback: use configured organizations if available
      const fallbackOrgs = window.API_CONFIG.fallbackOrganizations;
      if (fallbackOrgs && fallbackOrgs.length > 0) {
        console.warn('[Choreo API] Using fallback organizations from config.json:', fallbackOrgs);
        return fallbackOrgs.map(org => ({
          handle: org.handle,
          name: org.name,
          id: org.id,
          numericId: parseInt(org.id, 10)
        }));
      }
      
      throw fallbackErr;
    }
  }
}
