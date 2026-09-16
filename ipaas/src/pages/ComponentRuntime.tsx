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

import { Alert, Box, CircularProgress, MenuItem, PageContent, Select, Snackbar, Typography } from '@wso2/oxygen-ui';
import { useEffect, useMemo, useState, type JSX } from 'react';
import DeploymentTrackBar from '../components/DeploymentTrackBar';
import PodInsightsTable from '../components/Runtime/PodInsightsTable';
import ReplicaRangeControl from '../components/Runtime/ReplicaRangeControl';
import ResourceUsageCards from '../components/Runtime/ResourceUsageCards';
import RuntimeOverview from '../components/Runtime/RuntimeOverview';
import { useAccessControl } from '../contexts/AccessControlContext';
import { useComponentByHandler } from '../hooks/useComponents';
import { useComponentDeployment } from '../hooks/useDeployments';
import { useEnvironments } from '../hooks/useEnvironments';
import { useLoadComponentPermissions } from '../hooks/usePermissionLoader';
import { useOrgUuid } from '../hooks/useOrgUuid';
import { useProjectId } from '../hooks/useProjects';
import { Permissions } from '../constants/permissions';
import { IS_CLOUD } from '../features';
import { useComponentPodMetrics, useComponentPods, useReleaseDetails, useRedeployRelease } from '../hooks/useRuntime';
import { useHpa, useScalingState } from '../hooks/useScaling';
import { DeploymentStatus } from '../types/deployment';
import { calculateAggregateUsage, usageFromComponentLevelMetrics } from '../utils/podMetrics';
import type { ComponentScope } from '../nav';

export default function ComponentRuntime({ org, project, component }: ComponentScope): JSX.Element {
  const orgUuid = useOrgUuid();
  const { projectId, isLoading: loadingProject } = useProjectId(project);
  const { data: comp, isLoading: loadingComponent } = useComponentByHandler(projectId, component);

  const tracks = useMemo(() => comp?.deploymentTracks ?? [], [comp?.deploymentTracks]);
  const [trackId, setTrackId] = useState('');
  useEffect(() => {
    if (tracks.length) setTrackId((prev) => (prev && tracks.some((t) => t.id === prev) ? prev : (tracks.find((t) => t.latest)?.id ?? tracks[0].id)));
  }, [tracks]);

  const { data: environments = [], isLoading: loadingEnvironments, isError: environmentsError } = useEnvironments(orgUuid ?? '', projectId);
  const [envId, setEnvId] = useState('');
  useEffect(() => {
    if (environments.length) setEnvId((prev) => (prev && environments.some((e) => e.id === prev) ? prev : environments[0].id));
  }, [environments]);

  const componentId = comp?.id ?? '';
  const { data: deployment } = useComponentDeployment(org, orgUuid ?? '', componentId, trackId, envId, { refetchInterval: 15_000 });
  const releaseId = deployment?.releaseId ?? '';
  const status = deployment?.deploymentStatusV2 ?? DeploymentStatus.NotDeployed;

  const { data: release } = useReleaseDetails(projectId, componentId, component, releaseId);
  const clusterId = release?.environment?.environment_clusters?.[0]?.cluster_id ?? '';
  const namespace = release?.environment?.namespace ?? '';
  const isDeployed = status !== DeploymentStatus.NotDeployed && !!releaseId && release?.undeployed !== true;

  // Cloud's runtime-details response is the authoritative source for these (OpenChoreo IDs,
  // deployed image) — wip keeps using its existing component/deployment-derived values.
  // Falling back to componentId/releaseId while `release` is still loading would flash a
  // handler-shaped value that then flips to the real OpenChoreo UUID once it arrives —
  // show nothing until the authoritative value is in, rather than a mismatched one first.
  const displayComponentId = IS_CLOUD ? (release?.componentId ?? '') : componentId;
  const displayReleaseId = IS_CLOUD ? (release?.ID ?? '') : releaseId;
  const displayImageUrl = IS_CLOUD ? release?.image : (deployment?.imageUrl ?? undefined);

  const pods = useComponentPods(projectId, component, clusterId, releaseId, namespace);
  const metrics = useComponentPodMetrics(projectId, component, clusterId, releaseId, namespace);

  // release.replicas is a one-shot fetch (invalidated once right when Redeploy is clicked,
  // before the rollout settles) and then never refreshed, so it goes stale — e.g. it can get
  // stuck at 2 after a redeploy's old pod terminates. The live, polled pod count self-corrects.
  const replicaCount = IS_CLOUD ? (pods.data?.length ?? release?.replicas ?? 0) : (release?.replicas ?? 0);
  // cloud has no pod-level metrics source and instead sends a pre-aggregated total; wip's
  // backend only ever gives per-pod metrics, so it's summed against pod resource limits.
  const usage = useMemo(() => (metrics.data?.componentLevelMetrics ? usageFromComponentLevelMetrics(metrics.data.componentLevelMetrics) : calculateAggregateUsage(pods.data ?? [], metrics.data?.podLevelMetrics ?? [])), [pods.data, metrics.data]);
  // cloud sends componentLevelMetrics only when it can resolve one (Observer reachable) —
  // when it's absent but pods are actually running, "0 used" would misreport unknown as zero.
  const usageUnavailable = IS_CLOUD && !metrics.data?.componentLevelMetrics && (pods.data?.length ?? 0) > 0;

  // Min/max replicas above the pod table edit the same HPA the Scaling page owns.
  const { data: hpa, isLoading: loadingHpa, isError: hpaError, refetch: refetchHpa } = useHpa(projectId, componentId, releaseId);
  const { data: scalingState } = useScalingState(projectId, componentId, releaseId);
  const scalingPath = useMemo(() => ({ componentId, releaseId }), [componentId, releaseId]);
  const podScope = useMemo(() => ({ projectId, clusterId, namespace, releaseId, orgHandler: org, projectHandler: project, componentHandler: component }), [projectId, clusterId, namespace, releaseId, org, project, component]);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Landing straight on this page skips the Overview, which is where component-scoped
  // permissions are normally loaded.
  useLoadComponentPermissions(org, projectId, componentId);
  const { hasPermission } = useAccessControl();
  const canManage = hasPermission(Permissions.INTEGRATION_MANAGE, projectId, componentId);

  const redeploy = useRedeployRelease();
  const onRedeploy = () => redeploy.mutate({ projectId, componentId, componentName: component, releaseId });

  const isLoading = loadingProject || loadingComponent || loadingEnvironments;

  if (isLoading) {
    return (
      <PageContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)' }}>
          <CircularProgress />
        </Box>
      </PageContent>
    );
  }

  if (!comp) {
    return (
      <PageContent>
        <Typography color="error">Integration not found.</Typography>
      </PageContent>
    );
  }

  if (environmentsError) {
    return (
      <PageContent>
        <Typography color="error">Failed to load environments. Please try again.</Typography>
      </PageContent>
    );
  }

  const envSelect = !IS_CLOUD && environments.length > 1 && (
    <Select
      size="small"
      value={environments.some((e) => e.id === envId) ? envId : ''}
      onChange={(e) => setEnvId(e.target.value as string)}
      inputProps={{ 'aria-label': 'Environment' }}
      sx={{ fontSize: '0.8125rem', '& .MuiSelect-select': { py: 0.5, px: 1.5 }, minWidth: 140 }}>
      {environments.map((e) => (
        <MenuItem key={e.id} value={e.id}>
          {e.name}
        </MenuItem>
      ))}
    </Select>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {tracks.length > 0 && <DeploymentTrackBar tracks={tracks} selectedId={trackId} onChange={setTrackId} orgHandler={org} projectHandler={project} componentHandler={component} extra={envSelect} />}
      <PageContent>
        <Typography variant="h1" sx={{ mb: 3 }}>
          Runtime
        </Typography>
        <RuntimeOverview
          componentName={comp.displayName || comp.name || component}
          status={status}
          lastDeployedAt={release?.latest_deployment?.deployment_history?.CreatedAt ?? deployment?.build?.deployedAt}
          lastDeployedMessage={release?.latest_deployment?.deployment_history?.change_message}
          componentId={displayComponentId}
          releaseId={displayReleaseId}
          namespace={namespace}
          imageUrl={displayImageUrl}
          isDeployed={isDeployed}
          redeploying={redeploy.isPending}
          canRedeploy={!!releaseId}
          onRedeploy={onRedeploy}
        />

        {isDeployed && (
          <>
            <PodInsightsTable
              pods={pods.data}
              metrics={metrics.data?.podLevelMetrics}
              isLoading={pods.isLoading}
              isError={pods.isError}
              isFetching={pods.isFetching || metrics.isFetching}
              onRefresh={() => {
                pods.refetch();
                metrics.refetch();
              }}
              scope={podScope}
              canManage={canManage}
              replicasControl={
                <ReplicaRangeControl
                  hpa={hpa ?? undefined}
                  isLoading={loadingHpa}
                  isError={hpaError}
                  onRetry={() => refetchHpa()}
                  replicas={replicaCount}
                  orgUuid={orgUuid ?? ''}
                  projectId={projectId}
                  path={scalingPath}
                  version={scalingState?.version ?? ''}
                  canManage={canManage}
                  onSaved={(message) => setAlert({ type: 'success', message })}
                  onError={(message) => setAlert({ type: 'error', message })}
                />
              }
            />
            <Box sx={{ mt: 4 }}>
              <ResourceUsageCards usage={usage} usageUnavailable={usageUnavailable} />
            </Box>
          </>
        )}
      </PageContent>

      <Snackbar open={!!alert} autoHideDuration={6000} onClose={() => setAlert(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={alert?.type ?? 'success'} onClose={() => setAlert(null)} variant="filled">
          {alert?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
