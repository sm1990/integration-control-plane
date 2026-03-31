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

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { JSX, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { loginApiUrl, loginUrl } from '../paths';
import { saveTokens, clearTokens, getAccessToken, revokeToken, setOnAuthFailure, generateAndSaveOIDCState, generatePKCE, saveCodeVerifier, getAndClearCodeVerifier, saveAsgardeoToken, getAsgardeoToken, getOrRefreshAsgardeoToken } from './tokenManager';

const USER_KEY = 'icp_user';

interface UserInfo {
  userId: string;
  username: string;
  displayName: string;
  isOidcUser: boolean;
  requirePasswordChange: boolean;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  userId: string;
  username: string;
  displayName: string;
  isOidcUser: boolean;
  requirePasswordChange: boolean;
  clearRequirePasswordChange: () => void;
  login: (username: string, password: string) => Promise<void>;
  loginWithOIDC: (fidp?: string) => Promise<void>;
  handleOIDCCallback: (code: string, state: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUserInfo(): UserInfo | null {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAccessToken());
  const [userInfo, setUserInfo] = useState<UserInfo | null>(() => loadUserInfo());

  useEffect(() => {
    setOnAuthFailure(() => {
      localStorage.removeItem(USER_KEY);
      setUserInfo(null);
      setIsAuthenticated(false);
      queryClient.clear();
      navigate(loginUrl());
    });
  }, [navigate, queryClient]);

  // Bootstrap the Asgardeo token for existing sessions that pre-date saveAsgardeoToken.
  // Runs once on mount; no-ops if already cached or if not an OIDC session.
  useEffect(() => {
    if (isAuthenticated && !getAsgardeoToken()) {
      getOrRefreshAsgardeoToken().catch(() => {
        /* best-effort */
      });
    }
  }, [isAuthenticated]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(loginApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      const err: Error & { status?: number; retryAfterSeconds?: number } = new Error(body || `Login failed (${res.status})`);
      err.status = res.status;
      if (res.status === 429) {
        try {
          err.retryAfterSeconds = JSON.parse(body).retryAfterSeconds;
        } catch {
          /* ignore */
        }
      }
      throw err;
    }
    const data: { userId: string; token: string; expiresIn: number; refreshToken: string; refreshTokenExpiresIn: number; username: string; displayName: string; permissions: string[]; isOidcUser: boolean; requirePasswordChange?: boolean } = await res.json();
    saveTokens({ token: data.token, expiresIn: data.expiresIn, refreshToken: data.refreshToken, refreshTokenExpiresIn: data.refreshTokenExpiresIn });

    const user: UserInfo = { userId: data.userId, username: data.username, displayName: data.displayName, isOidcUser: data.isOidcUser, requirePasswordChange: data.requirePasswordChange ?? false };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setUserInfo(user);
    setIsAuthenticated(true);
  }, []);

  const loginWithOIDC = useCallback(async (fidp?: string) => {
    const { asgardeoClientId, asgardeoAuthorizeEndpoint, asgardeoSignInRedirectUrl, asgardeoScope } = window.API_CONFIG;
    const state = generateAndSaveOIDCState();
    const { verifier, challenge } = await generatePKCE();
    saveCodeVerifier(verifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: asgardeoClientId,
      redirect_uri: asgardeoSignInRedirectUrl,
      scope: asgardeoScope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    if (fidp) params.set('fidp', fidp);
    window.location.href = `${asgardeoAuthorizeEndpoint}?${params}`;
  }, []);

  const handleOIDCCallback = useCallback(async (code: string, _state: string | null) => {
    const { asgardeoClientId, asgardeoTokenEndpoint, asgardeoSignInRedirectUrl, stsTokenEndpoint, stsClientId, stsScope, choreoOrgApiUrl } = window.API_CONFIG;

    const codeVerifier = getAndClearCodeVerifier();
    if (!codeVerifier) throw new Error('Missing PKCE code verifier. Please try logging in again.');

    // Step 1: Exchange auth code for Asgardeo tokens
    const tokenRes = await fetch(asgardeoTokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: asgardeoSignInRedirectUrl,
        client_id: asgardeoClientId,
        code_verifier: codeVerifier,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
    }
    const tokenData: { access_token: string; id_token?: string; refresh_token?: string; expires_in?: number } = await tokenRes.json();

    const asgardeoToken = tokenData.access_token;
    saveAsgardeoToken(asgardeoToken);
    let finalToken = asgardeoToken;
    let finalExpiresIn = tokenData.expires_in ?? 3600;

    if (stsTokenEndpoint && stsClientId) {
      const stsBaseParams = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        client_id: stsClientId,
        subject_token: asgardeoToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        requested_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        ...(stsScope ? { scope: stsScope } : {}),
      };

      // Step 2: Initial STS exchange without orgHandle — gets a base token to call the Choreo orgs API.
      // The orgs API rejects the raw Asgardeo token (401), so we need at least a base STS token first.
      let baseStsToken: string | undefined;
      try {
        const baseStsRes = await fetch(stsTokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(stsBaseParams).toString(),
        });
        if (baseStsRes.ok) {
          const baseStsData: { access_token: string } = await baseStsRes.json();
          baseStsToken = baseStsData.access_token;
        } else {
          throw new Error(`Initial STS exchange failed (${baseStsRes.status}): ${await baseStsRes.text()}`);
        }
      } catch (err) {
        throw new Error(`STS token exchange error: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Step 3: Fetch user's org handle using the base STS token
      let orgHandle: string | undefined;
      try {
        const orgsRes = await fetch(`${choreoOrgApiUrl}/orgs`, {
          headers: { Authorization: `Bearer ${baseStsToken}` },
        });
        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          const orgs: Array<{ handle?: string; orgHandle?: string; org_handle?: string; id?: number; orgId?: number }> = orgsData.list ?? orgsData.organizations ?? (Array.isArray(orgsData) ? orgsData : []);
          for (const org of orgs) {
            const h = org.handle ?? org.orgHandle ?? org.org_handle;
            if (h) {
              orgHandle = h;
              localStorage.setItem('icp_org_handle', h);
              const numericId = org.id ?? org.orgId;
              if (numericId) {
                const parsedId = typeof numericId === 'string' ? parseInt(numericId, 10) : numericId;
                window.API_CONFIG.asgardeoOrgNumericId = parsedId;
                localStorage.setItem('icp_org_numeric_id', String(parsedId));
              }
              break;
            }
          }
        } else {
          throw new Error(`Orgs API returned ${orgsRes.status}: ${await orgsRes.text()}`);
        }
      } catch (err) {
        throw new Error(`Failed to fetch org handle: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (!orgHandle) {
        throw new Error('No organization found for this account. Please contact your administrator.');
      }

      // Step 4: Final STS exchange WITH orgHandle — gets the org-scoped token for all Choreo API access.
      // Always use the original Asgardeo token as the subject (same pattern as devant's useOrgTokenExchange).
      try {
        const orgStsRes = await fetch(stsTokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ...stsBaseParams, orgHandle }).toString(),
        });
        if (orgStsRes.ok) {
          const orgStsData: { access_token: string; expires_in?: number } = await orgStsRes.json();
          finalToken = orgStsData.access_token;
          finalExpiresIn = orgStsData.expires_in ?? 3600;
        } else {
          throw new Error(`Org-scoped STS exchange failed (${orgStsRes.status}): ${await orgStsRes.text()}`);
        }
      } catch (err) {
        throw new Error(`Org-scoped STS exchange error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Step 4: Decode ID token for user info
    let userId = crypto.randomUUID();
    let username = '';
    let displayName = '';
    if (tokenData.id_token) {
      try {
        const payload = JSON.parse(atob(tokenData.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        userId = payload.sub ?? userId;
        username = payload.username ?? payload.preferred_username ?? payload.email ?? payload.sub ?? '';
        displayName = payload.name ?? payload.given_name ?? username;
      } catch {
        /* use defaults */
      }
    }

    saveTokens({ token: finalToken, expiresIn: finalExpiresIn, refreshToken: tokenData.refresh_token ?? '', refreshTokenExpiresIn: 86400 });
    const user: UserInfo = { userId, username, displayName, isOidcUser: true, requirePasswordChange: false };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setUserInfo(user);
    setIsAuthenticated(true);
  }, []);

  const clearRequirePasswordChange = useCallback(() => {
    setUserInfo((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, requirePasswordChange: false };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(async () => {
    await revokeToken();
    clearTokens();
    localStorage.removeItem(USER_KEY);
    setUserInfo(null);
    setIsAuthenticated(false);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      userId: userInfo?.userId ?? '',
      username: userInfo?.username ?? '',
      displayName: userInfo?.displayName ?? '',
      isOidcUser: userInfo?.isOidcUser ?? false,
      requirePasswordChange: userInfo?.requirePasswordChange ?? false,
      clearRequirePasswordChange,
      login,
      loginWithOIDC,
      handleOIDCCallback,
      logout,
    }),
    [isAuthenticated, userInfo, clearRequirePasswordChange, login, loginWithOIDC, handleOIDCCallback, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
