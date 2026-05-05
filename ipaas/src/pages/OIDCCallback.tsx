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
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, Box, Typography } from '@wso2/oxygen-ui';
import { useAuth } from '../auth/AuthContext';
import { validateAndClearOIDCState, getAndClearRedirectUrl } from '../auth/tokenManager';
<<<<<<< Updated upstream
import { gql } from '../api/graphql';
import { loginUrl, projectHomeUrl, projectsRedirectUrl, registerOrgUrl } from '../paths';
=======
import { authenticatedFetch } from '../auth/tokenManager';
import CenteredLoader from '../components/CenteredLoader';
import { loginUrl, orgHomeUrl, projectHomeUrl } from '../paths';

async function resolvePostLoginUrl(): Promise<string> {
  try {
    const res = await authenticatedFetch(`${window.API_CONFIG.choreoOrgApiUrl}/orgs`);
    if (res.ok) {
      const data = await res.json();
      const orgs: Array<{ handle?: string; orgHandle?: string; org_handle?: string; id?: number; orgId?: number }> = data.list ?? data.organizations ?? (Array.isArray(data) ? data : []);
      for (const org of orgs) {
        const handle = org.handle ?? org.orgHandle ?? org.org_handle;
        if (!handle) continue;
        const rawOrgId = org.id ?? org.orgId;
        const orgId = rawOrgId !== undefined ? (typeof rawOrgId === 'string' ? parseInt(rawOrgId, 10) : rawOrgId) : undefined;
        if (orgId) {
          // Try to navigate to first project's home page
          try {
            const gqlRes = await authenticatedFetch(window.API_CONFIG.graphqlUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: `{ projects(orgId: ${orgId}) { id } }` }),
            });
            if (gqlRes.ok) {
              const gqlData = await gqlRes.json();
              const projects: Array<{ id: string }> = gqlData.data?.projects ?? [];
              if (projects.length > 0) return projectHomeUrl(handle, projects[0].id);
            }
          } catch {
            /* fall through to org page */
          }
        }
        return orgHomeUrl(handle);
      }
    }
  } catch {
    /* ignore — fall through to default */
  }
  return orgHomeUrl('default');
}
>>>>>>> Stashed changes

export default function OIDCCallback(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
        setError(`Authentication failed: ${searchParams.get('error_description') || oidcError}`);
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
        const { isNewUser } = await handleOIDCCallback(code, state);

        if (isNewUser) {
          // First-time user — no org yet; send to org registration
          navigate(registerOrgUrl(), { replace: true });
          return;
        }

        // Determine where to navigate post-login
        const savedUrl = getAndClearRedirectUrl();
        const isLoginPage = savedUrl ? new URL(savedUrl).pathname === loginUrl() : true;

        if (savedUrl && !isLoginPage) {
          // User was trying to access a specific page — go back there
          window.location.href = savedUrl;
        } else {
          const orgHandle = localStorage.getItem('icp_org_handle');

          // Try to navigate to the last visited project (for existing users)
          let navigatedToLastProject = false;
          try {
            const stored = localStorage.getItem('icp_user');
            const userId: string | undefined = stored ? (JSON.parse(stored) as { userId?: string })?.userId : undefined;

            if (userId && orgHandle) {
              // 1. Try the last-visited project stored by AppLayout
              const lastProjectRaw = localStorage.getItem(`icp_last_project:${userId}`);
              if (lastProjectRaw) {
                const { org, project } = JSON.parse(lastProjectRaw) as { org: string; project: string };
                if (org === orgHandle && project) {
                  // Mark ToS accepted — this user has already been through onboarding
                  localStorage.setItem(`icp_tos_accepted:${userId}:${orgHandle}`, 'true');
                  navigate(projectHomeUrl(orgHandle, project), { replace: true });
                  navigatedToLastProject = true;
                }
              }

              // 2. No stored last project — fetch from API and use the most recently updated one
              if (!navigatedToLastProject) {
                const numericId = window.API_CONFIG.asgardeoOrgNumericId ?? parseInt(localStorage.getItem('icp_org_numeric_id') ?? '0', 10);
                if (numericId > 0) {
                  const data = await gql<{ projects: Array<{ handler: string; updatedAt: string }> }>(`query GetProjects($orgId: Int!) { projects(orgId: $orgId) { handler updatedAt } }`, { orgId: numericId });
                  const projects = (data.projects ?? []).filter((p) => p.handler);
                  if (projects.length > 0) {
                    const recent = projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
                    // Mark ToS accepted — this user already has projects, they've been through onboarding
                    localStorage.setItem(`icp_tos_accepted:${userId}:${orgHandle}`, 'true');
                    navigate(projectHomeUrl(orgHandle, recent.handler), { replace: true });
                    navigatedToLastProject = true;
                  }
                }
              }
            }
          } catch {
            // ignore — fall through to default
          }

          if (!navigatedToLastProject) {
            // Redirect to the projects/redirect route which shows the ToS welcome dialog
            navigate(orgHandle ? projectsRedirectUrl(orgHandle) : registerOrgUrl(), { replace: true });
          }
        }
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
        <CenteredLoader />
        <Typography variant="body1" color="text.secondary">
          Completing sign in...
        </Typography>
      </Box>
    </Box>
  );
}
