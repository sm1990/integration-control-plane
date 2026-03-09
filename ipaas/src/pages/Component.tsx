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

import { Avatar, Box, CircularProgress, PageContent, Stack, Typography } from '@wso2/oxygen-ui';
import { useState, type JSX } from 'react';
import { useProjectByHandler, useComponentByHandler, useEnvironments } from '../api/queries';
import NotFound from '../components/NotFound';
import { ArtifactDetail } from '../components/ArtifactDetail';
import Environment from '../components/EntryPoints';
import type { SelectedArtifact } from '../components/artifact-config';
import { resourceUrl, broaden, type ComponentScope } from '../nav';
import { useLoadComponentPermissions } from '../hooks/usePermissionLoader';

export default function Component(scope: ComponentScope): JSX.Element {
  const { data: project, isLoading: loadingProject } = useProjectByHandler(scope.project);
  const projectId = project?.id ?? '';
  const { data: component, isLoading: loadingComponent } = useComponentByHandler(projectId, scope.component);
  const { data: environments = [] } = useEnvironments(projectId);
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);

  // Load component permissions using the UUID - only when component is loaded
  useLoadComponentPermissions(scope.org, projectId, component?.id || '');

  const isLoading = loadingProject || loadingComponent;
  if (isLoading)
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  if (!component) return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <Box sx={{ position: 'relative', overflow: 'hidden', flex: 1 }}>
        <PageContent>
          <Stack component="header" direction="row" alignItems="center" gap={2} sx={{ mb: 1 }}>
            <Avatar sx={{ width: 56, height: 56, fontSize: 24, bgcolor: 'text.primary', color: 'background.paper' }}>{component.displayName?.[0]?.toUpperCase() ?? 'C'}</Avatar>
            <Typography variant="h1">{component.displayName ?? scope.component}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, ml: 9 }}>
            {component.description || '+ Add Description'}
          </Typography>
          {environments.map((env) => (
            <Environment
              key={env.id}
              env={env}
              componentId={component.id}
              projectId={projectId}
              componentType={component.componentType}
              componentHandler={component.handler}
              projectHandler={project?.handler ?? ''}
              onSelectArtifact={(a, type, envId) => setSelectedArtifact({ artifact: a, artifactType: type, envId, componentId: component.id, projectId })}
              onOpenDrawerForTab={(a, type, envId, tab) => setSelectedArtifact({ artifact: a, artifactType: type, envId, componentId: component.id, projectId, initialTab: tab })}
            />
          ))}
        </PageContent>
        <ArtifactDetail selected={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
      </Box>
    </>
  );
}
