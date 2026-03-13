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

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, Box, CircularProgress, Link, Typography } from '@wso2/oxygen-ui';
import { useAuthContext } from '@asgardeo/auth-react';
import { useQuery } from '@tanstack/react-query';
import { loginUrl, orgUrl, projectUrl } from '../paths';
import { fetchUserOrganizations, type ChoreoOrganization } from '../api/choreo';
import { gql } from '../api/graphql';
import type { GqlProject } from '../api/queries';

const LAST_ORG_KEY = 'choreo-last-org';
const OVERRIDE_ORG_KEY = 'choreo-override-org';
const LAST_PROJECT_KEY = 'choreo-last-project';
const SYSTEM_ORGS = ['dev', 'stage', 'prod', 'choreocontrolplane'];

const PROJECTS_QUERY = `
  query GetProjects($orgId: Int!) {
    projects(orgId: $orgId) {
      id, orgId, name, handler, description, version,
      createdDate, updatedAt, region, type,
      defaultDeploymentPipelineId, deploymentPipelineIds,
      gitProvider, gitOrganization, repository, branch, secretRef
    }
  }`;

/**
 * Select the best organization to redirect to after login.
 * Priority:
 * 1. Manual override from localStorage (choreo-override-org)
 * 2. URL parameter (?org=...)
 * 3. Last visited organization (from localStorage)
 * 4. First non-system organization
 * 5. Fallback to first available org
 */
function selectOrganization(orgs: ChoreoOrganization[] | undefined, urlParams: URLSearchParams): string | null {
  // Check for manual override
  const override = localStorage.getItem(OVERRIDE_ORG_KEY) || urlParams.get('org');
  if (override) {
    console.log('[OIDCCallback] Using override org:', override);
    return override;
  }
  
  // If API failed or returned empty, return null
  if (!orgs || orgs.length === 0) {
    console.warn('[OIDCCallback] No organizations available');
    return null;
  }
  
  // Try to use last visited org
  const lastOrg = localStorage.getItem(LAST_ORG_KEY);
  if (lastOrg && orgs.some(o => o.handle === lastOrg)) {
    console.log('[OIDCCallback] Using last visited org:', lastOrg);
    return lastOrg;
  }
  
  // Filter out system orgs and pick the first user org
  const userOrgs = orgs.filter(o => !SYSTEM_ORGS.includes(o.handle));
  if (userOrgs.length > 0) {
    console.log('[OIDCCallback] Using first user org:', userOrgs[0].handle);
    return userOrgs[0].handle;
  }
  
  // Fall back to first org
  console.log('[OIDCCallback] Using first available org:', orgs[0].handle);
  return orgs[0].handle;
}

/**
 * Select the best project to redirect to after login.
 * Priority:
 * 1. Last visited project (from localStorage)
 * 2. First project in the organization
 * 3. null (will redirect to organization overview)
 */
function selectProject(projects: GqlProject[] | undefined, orgHandler: string): string | null {
  if (!projects || projects.length === 0) {
    console.log('[OIDCCallback] No projects found for org:', orgHandler);
    return null;
  }
  
  // Try to use last visited project for this org
  const lastProjectKey = `${LAST_PROJECT_KEY}-${orgHandler}`;
  const lastProject = localStorage.getItem(lastProjectKey);
  if (lastProject && projects.some(p => p.handler === lastProject)) {
    console.log('[OIDCCallback] Using last visited project:', lastProject);
    return lastProject;
  }
  
  // Use first project
  console.log('[OIDCCallback] Using first project:', projects[0].handler);
  return projects[0].handler;
}

/**
 * Handles the Asgardeo OIDC callback at /signin.
 *
 * The AsgardeoAuthProvider automatically exchanges the authorization code for tokens
 * when it detects ?code=...&state=... on the signInRedirectURL. This component simply
 * waits for state.isAuthenticated, then fetches the user's Choreo organizations and
 * projects, and redirects to the first project (or organization overview if no projects).
 * Do NOT call signIn() here — the Provider already does it and a second call would
 * consume the URL code a second time.
 */
export default function OIDCCallback(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useAuthContext();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oidcError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Fetch the user's Choreo organizations once authenticated.
  const { data: orgs, isError: orgsFailed, error: orgsError } = useQuery({
    queryKey: ['user-orgs'],
    queryFn: fetchUserOrganizations,
    enabled: state.isAuthenticated,
    retry: 2,
    staleTime: Infinity,
  });

  // Add debug logging
  useEffect(() => {
    console.log('[OIDCCallback] Auth state:', {
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      orgs: orgs?.length,
      orgsFailed,
      orgsError: orgsError?.message,
    });
  }, [state.isAuthenticated, state.isLoading, orgs, orgsFailed, orgsError]);

  // Once we know the org, fetch projects for that org
  const org = orgs?.find(o => o.handle === selectedOrg);
  const { data: projects, isError: projectsFailed, error: projectsError } = useQuery({
    queryKey: ['projects', org?.numericId],
    queryFn: () => gql<{ projects: GqlProject[] }>(PROJECTS_QUERY, { orgId: org!.numericId }).then((d) => d.projects),
    enabled: !!org?.numericId,
    retry: 2,
    staleTime: Infinity,
  });

  // Select the org once we have the orgs list
  useEffect(() => {
    if (!state.isAuthenticated) return;
    if (orgs === undefined && !orgsFailed) return; // still fetching
    if (selectedOrg) return; // already selected

    const handle = selectOrganization(orgs, searchParams);
    if (handle) {
      console.log('[OIDCCallback] Selected org:', handle, {
        totalOrgs: orgs?.length ?? 0,
        orgs: orgs?.map(o => o.handle),
        apiFailed: orgsFailed,
      });
      setSelectedOrg(handle);
    } else {
      console.error('[OIDCCallback] No organization available, cannot proceed');
      setError(orgsFailed ? `Failed to fetch organizations: ${orgsError?.message || 'Unknown error'}` : 'No organizations found');
    }
  }, [state.isAuthenticated, orgs, orgsFailed, searchParams, selectedOrg, orgsError]);

  // Redirect once we know the project (or fall back to org overview).
  useEffect(() => {
    if (!selectedOrg) return;
    if (projects === undefined && !projectsFailed) return; // still fetching projects

    const projectHandler = selectProject(projects, selectedOrg);
    
    if (projectHandler) {
      const url = projectUrl(selectedOrg, projectHandler);
      console.log('[OIDCCallback] Redirecting to project:', url, {
        org: selectedOrg,
        project: projectHandler,
        totalProjects: projects?.length ?? 0,
      });
      navigate(url, { replace: true });
    } else {
      // No projects, redirect to org overview
      const url = orgUrl(selectedOrg);
      console.log('[OIDCCallback] No projects found, redirecting to org overview:', url);
      navigate(url, { replace: true });
    }
  }, [selectedOrg, projects, projectsFailed, navigate]);

  if (oidcError || error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 3 }}>
        <Box sx={{ maxWidth: 480, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {oidcError ? `Authentication failed: ${errorDescription ?? oidcError}` : error}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please check the browser console for more details.
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
