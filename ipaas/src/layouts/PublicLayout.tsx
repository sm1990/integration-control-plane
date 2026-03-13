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

import { Navigate, Outlet } from 'react-router';
import { Box, ColorSchemeToggle, Layout, ParticleBackground, Stack } from '@wso2/oxygen-ui';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { orgUrl, projectUrl } from '../paths';
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
 * 2. Last visited organization (from localStorage)
 * 3. First non-system organization
 * 4. Fallback to config organization
 */
function selectOrganization(orgs: ChoreoOrganization[] | undefined, fallback: string): string {
  // Check for manual override
  const override = localStorage.getItem(OVERRIDE_ORG_KEY);
  if (override) {
    console.log('[PublicLayout] Using override org:', override);
    return override;
  }
  
  // If API failed or returned empty, use fallback but warn user
  if (!orgs || orgs.length === 0) {
    console.warn(
      '[PublicLayout] No organizations returned from API. Using fallback:', fallback,
      '\n\nTo manually set your organization, run:\n  localStorage.setItem("choreo-override-org", "your-org-handle");\n  window.location.reload();'
    );
    return fallback;
  }
  
  // Try to use last visited org
  const lastOrg = localStorage.getItem(LAST_ORG_KEY);
  if (lastOrg && orgs.some(o => o.handle === lastOrg)) {
    console.log('[PublicLayout] Using last visited org:', lastOrg);
    return lastOrg;
  }
  
  // Filter out system orgs and pick the first user org
  const userOrgs = orgs.filter(o => !SYSTEM_ORGS.includes(o.handle));
  if (userOrgs.length > 0) {
    console.log('[PublicLayout] Using first user org:', userOrgs[0].handle, 'from', userOrgs.length, 'user orgs');
    return userOrgs[0].handle;
  }
  
  // Fall back to first org or config
  console.warn('[PublicLayout] No user organizations found, using first available or fallback');
  return orgs[0]?.handle ?? fallback;
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
    console.log('[PublicLayout] No projects found for org:', orgHandler);
    return null;
  }
  
  // Try to use last visited project for this org
  const lastProjectKey = `${LAST_PROJECT_KEY}-${orgHandler}`;
  const lastProject = localStorage.getItem(lastProjectKey);
  if (lastProject && projects.some(p => p.handler === lastProject)) {
    console.log('[PublicLayout] Using last visited project:', lastProject);
    return lastProject;
  }
  
  // Use first project
  console.log('[PublicLayout] Using first project:', projects[0].handler, 'from', projects.length, 'projects');
  return projects[0].handler;
}

export default function PublicLayout(): JSX.Element {
  const { isAuthenticated } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  // Fetch user's organizations when authenticated
  const { data: orgs, isError: orgsFailed, error } = useQuery({
    queryKey: ['user-orgs'],
    queryFn: async () => {
      console.log('[PublicLayout] Fetching user organizations...');
      const result = await fetchUserOrganizations();
      console.log('[PublicLayout] Organizations fetched:', result);
      return result;
    },
    enabled: isAuthenticated,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Once we know the org, fetch projects for that org
  const org = orgs?.find(o => o.handle === selectedOrg);
  const { data: projects, isError: projectsFailed } = useQuery({
    queryKey: ['projects', org?.numericId],
    queryFn: () => gql<{ projects: GqlProject[] }>(PROJECTS_QUERY, { orgId: org!.numericId }).then((d) => d.projects),
    enabled: !!org?.numericId,
    retry: 2,
    staleTime: Infinity,
  });

  // Select the org once we have the orgs list
  useEffect(() => {
    if (!isAuthenticated) return;
    if (orgs === undefined && !orgsFailed) return; // still fetching
    if (selectedOrg) return; // already selected

    if (orgsFailed) {
      console.error('[PublicLayout] Failed to fetch orgs:', error);
    }

    const handle = selectOrganization(orgs, window.API_CONFIG.asgardeoOrg);
    console.log('[PublicLayout] Selected org:', handle, {
      totalOrgs: orgs?.length ?? 0,
      orgs: orgs?.map(o => o.handle),
      apiFailed: orgsFailed,
      fallback: window.API_CONFIG.asgardeoOrg,
      hasOverride: !!localStorage.getItem(OVERRIDE_ORG_KEY)
    });
    setSelectedOrg(handle);
  }, [isAuthenticated, orgs, orgsFailed, error, selectedOrg]);

  // Determine redirect URL once we know the project (or fall back to org overview)
  useEffect(() => {
    if (!selectedOrg) return;
    if (projects === undefined && !projectsFailed) return; // still fetching projects

    const projectHandler = selectProject(projects, selectedOrg);
    
    if (projectHandler) {
      const url = projectUrl(selectedOrg, projectHandler);
      console.log('[PublicLayout] Redirecting to project:', url, {
        org: selectedOrg,
        project: projectHandler,
        totalProjects: projects?.length ?? 0,
      });
      setRedirectUrl(url);
    } else {
      // No projects, redirect to org overview
      const url = orgUrl(selectedOrg);
      console.log('[PublicLayout] No projects found, redirecting to org overview:', url);
      setRedirectUrl(url);
    }
  }, [selectedOrg, projects, projectsFailed]);

  if (isAuthenticated) {
    // If we have determined the redirect URL, redirect
    if (redirectUrl) {
      return <Navigate to={redirectUrl} replace />;
    }

    // Still loading organizations or projects
    return (
      <Layout.Content>
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>Redirecting...</Box>
        </Box>
      </Layout.Content>
    );
  }

  return (
    <Layout.Content>
      <ParticleBackground opacity={0.5} />
      <Box sx={{ height: '100%' }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 2,
          }}>
          <ColorSchemeToggle />
        </Stack>
        <Outlet />
      </Box>
    </Layout.Content>
  );
}
