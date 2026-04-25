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

import { Card, CardContent } from '@wso2/oxygen-ui';
import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useComponentDeployment, useEnvEndpoints, useExecutionConfigs, useSchemaConfig, type GqlEnvironment, type GqlEnvEndpoint } from '../../api/queries';
import { getOrgUuidFromToken } from '../../auth/tokenManager';
import { useTriggerComponent, useStopDeployment, useRedeployDeployment } from '../../api/mutations';
import { GENERIC_SERVICE_TYPES } from '../../constants/integrations';
import { nextCronRunMs, formatTimeUntil, describeCron } from '../../utils/cronUtils';
import EnvironmentCardHeader from './EnvironmentCardHeader';
import EnvironmentCardBody from './EnvironmentCardBody';
import RunWithArgsDialog from './RunWithArgsDialog';
import ConfigureDrawer from './ConfigureDrawer';
import ServiceLogsDrawer from './ServiceLogsDrawer';

interface EnvironmentProps {
  env: GqlEnvironment;
  prevEnv?: GqlEnvironment;
  componentId: string;
  projectId: string;
  componentType: string;
  displayType?: string;
  componentHandler: string;
  projectHandler: string;
  orgHandler: string;
  versionId: string;
  deploymentPipelineId: string;
  latestCommit?: { sha: string; message: string } | null;
  apiId?: string;
}

export default function Environment({ env, prevEnv, componentId, projectId, componentType: _componentType, displayType, componentHandler, projectHandler, orgHandler, versionId, deploymentPipelineId, latestCommit, apiId }: EnvironmentProps) {
  const isAutomation = (displayType ?? '').toLowerCase() === 'scheduledtask';
  const isGenericService = GENERIC_SERVICE_TYPES.has(displayType ?? '');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [configureOpen, setConfigureOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [notification, setNotification] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [pendingTriggerTime, setPendingTriggerTime] = useState<number | null>(null);
  const [pendingTriggerArgs, setPendingTriggerArgs] = useState<string[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runWithArgsOpen, setRunWithArgsOpen] = useState(false);
  const trigger = useTriggerComponent();
  const stopMutation = useStopDeployment();
  const redeployMutation = useRedeployDeployment();
  const envOrgUuid = getOrgUuidFromToken() ?? '';

  const fetchDeployment = isAutomation || isGenericService;
  // Poll for transitional states or briefly after explicit stop/redeploy actions
  const [serviceRefetchInterval, setServiceRefetchInterval] = useState<number | false>(false);
  const [shouldPollOnce, setShouldPollOnce] = useState(false);
  // Poll for automation deployment right after a build (dev env only, stops when found or after 3 min)
  const [pollAutomationDeployment, setPollAutomationDeployment] = useState(isAutomation && !env.critical);
  const { data: envDeployment, isLoading: loadingEnvDeployment } = useComponentDeployment(
    fetchDeployment ? orgHandler : '',
    fetchDeployment ? envOrgUuid : '',
    fetchDeployment ? componentId : '',
    fetchDeployment ? versionId : '',
    fetchDeployment ? env.id : '',
    { refetchInterval: isGenericService ? serviceRefetchInterval : (pollAutomationDeployment ? 8000 : undefined) },
  );

  // Stop polling once deployment is found, or after 3 minutes to avoid indefinite requests
  useEffect(() => {
    if (!pollAutomationDeployment) return;
    if (envDeployment) { setPollAutomationDeployment(false); return; }
    const timer = setTimeout(() => setPollAutomationDeployment(false), 3 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [envDeployment, pollAutomationDeployment]);

  const deploymentStatusV2 = envDeployment?.deploymentStatusV2 ?? null;

  // Poll only while transitional (IN_PROGRESS) or briefly after explicit user actions
  useEffect(() => {
    if (!isGenericService) return;
    const isTransitional = deploymentStatusV2 === 'IN_PROGRESS';
    setServiceRefetchInterval(isTransitional || shouldPollOnce ? 8000 : false);
    // Clear the once-flag when status has settled to a stable state
    if (shouldPollOnce && !isTransitional) {
      setShouldPollOnce(false);
    }
  }, [isGenericService, deploymentStatusV2, shouldPollOnce]);

  const envReleaseId = envDeployment?.releaseId ?? '';

  // Per-env endpoint URLs for generic services, filtered by releaseId
  const { data: envEndpoints = [] } = useEnvEndpoints(isGenericService ? componentId : '', isGenericService ? versionId : '', isGenericService ? envReleaseId : '');

  // Previous env deployment + endpoints (for swagger comparison)
  const prevEnvEnabled = isGenericService && !!prevEnv;
  const { data: prevEnvDeployment } = useComponentDeployment(prevEnvEnabled ? orgHandler : '', prevEnvEnabled ? envOrgUuid : '', prevEnvEnabled ? componentId : '', prevEnvEnabled ? versionId : '', prevEnvEnabled ? prevEnv!.id : '');
  const prevEnvReleaseId = prevEnvDeployment?.releaseId ?? '';
  const { data: prevEnvEndpoints = [] } = useEnvEndpoints(prevEnvEnabled && !!prevEnvReleaseId ? componentId : '', prevEnvEnabled && !!prevEnvReleaseId ? versionId : '', prevEnvEnabled && !!prevEnvReleaseId ? prevEnvReleaseId : '');

  const { data: scheduleConfig } = useExecutionConfigs(isAutomation ? componentId : '', isAutomation ? envReleaseId : '');
  const scheduleDescription = scheduleConfig?.cronjobFrequency ? `${describeCron(scheduleConfig.cronjobFrequency)}, in time zone ${scheduleConfig.cronjobTimezone || 'UTC'}` : null;

  const envTemplateId = env.templateId ?? env.id;
  const { data: schemaConfig, isLoading: schemaConfigLoading } = useSchemaConfig(
    isAutomation && !!envDeployment ? projectId : '',
    isAutomation && !!envDeployment ? componentId : '',
    isAutomation && !!envDeployment ? envTemplateId : '',
    isAutomation && !!envDeployment ? versionId : '',
    latestCommit?.sha,
  );

  const hasMissingConfigs = useMemo(() => {
    if (!schemaConfig?.jsonSchema) return false;
    try {
      const schema = JSON.parse(atob(schemaConfig.jsonSchema));
      // Recursively collect all required leaf keys using dot notation (mirrors ConfigureDrawer flattenSchema)
      function collectRequired(props: Record<string, unknown>, req: string[], prefix = ''): string[] {
        const result: string[] = [];
        for (const [name, prop] of Object.entries(props)) {
          const p = prop as Record<string, unknown>;
          const key = prefix ? `${prefix}.${name}` : name;
          if (p.type === 'object' && p.properties) {
            result.push(...collectRequired(p.properties as Record<string, unknown>, (p.required as string[]) ?? [], key));
          } else if (req.includes(name)) {
            result.push(key);
          }
        }
        return result;
      }
      const allRequired = collectRequired(schema.properties ?? {}, schema.required ?? []);
      if (allRequired.length === 0) return false;
      const filledKeys = new Set((schemaConfig.configurations ?? []).filter((c) => c.values?.[0]?.value).map((c) => c.key));
      return allRequired.some((k) => !filledKeys.has(k));
    } catch {
      return false;
    }
  }, [schemaConfig]);

  const [nextRunLabel, setNextRunLabel] = useState<string | null>(null);
  const cronFreq = scheduleConfig?.cronjobFrequency ?? null;
  const lastScheduledTriggerRef = useRef<number>(0);
  const updateNextRun = useCallback(() => {
    if (!cronFreq) {
      setNextRunLabel(null);
      return;
    }
    const ms = nextCronRunMs(cronFreq);
    if (ms !== null) {
      const diff = ms - Date.now();
      if (diff < 1000 && Date.now() - lastScheduledTriggerRef.current > 30000) {
        lastScheduledTriggerRef.current = Date.now();
        setPendingTriggerTime(Date.now());
        queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
      }
      setNextRunLabel(`Next run in ${formatTimeUntil(ms)}`);
    } else {
      setNextRunLabel(null);
    }
  }, [cronFreq, queryClient]);
  useEffect(() => {
    updateNextRun();
    const timer = setInterval(updateNextRun, 1000);
    return () => clearInterval(timer);
  }, [updateNextRun]);

  useEffect(() => {
    if (!notification) return;
    const timeout = notification.severity === 'error' ? 6000 : 4000;
    const timer = setTimeout(() => setNotification(null), timeout);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleRun = () => {
    trigger.mutate(
      { orgHandler, projectId, componentId, releaseId: envReleaseId, args: [] },
      {
        onSuccess: () => {
          setNotification({ text: 'Execution triggered successfully', severity: 'success' });
          setPendingTriggerTime(Date.now());
          queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Failed to trigger execution';
          setNotification({ text: msg, severity: 'error' });
        },
      },
    );
  };

  const handleStop = () => {
    stopMutation.mutate(
      { orgHandler, componentId, releaseId: envReleaseId, type: displayType ?? '', clearCron: false },
      {
        onSuccess: () => {
          setShouldPollOnce(true);
          setNotification({ text: 'Deployment stopped successfully', severity: 'success' });
        },
        onError: (err) => setNotification({ text: err instanceof Error ? err.message : 'Failed to stop deployment', severity: 'error' }),
      },
    );
  };

  const handleRedeploy = () => {
    redeployMutation.mutate(
      {
        orgHandler,
        componentId,
        releaseId: envReleaseId,
        type: displayType ?? '',
        releaseMgtReleaseId: envDeployment?.releaseMgtDeployment?.releaseMgtReleaseId,
        releaseMgtDeploymentId: envDeployment?.releaseMgtDeployment?.releaseMgtDeploymentId,
      },
      {
        onSuccess: () => {
          setShouldPollOnce(true);
          setNotification({ text: 'Deployment started successfully', severity: 'success' });
        },
        onError: (err) => setNotification({ text: err instanceof Error ? err.message : 'Failed to start deployment', severity: 'error' }),
      },
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['componentDeployment'] }),
        queryClient.invalidateQueries({ queryKey: ['envEndpoints'] }),
        queryClient.invalidateQueries({ queryKey: ['executionConfigs'] }),
        queryClient.invalidateQueries({ queryKey: ['taskExecutions'] }),
        queryClient.invalidateQueries({ queryKey: ['schemaConfig'] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent sx={{ pb: (theme) => `${theme.spacing(2)} !important` }}>
        <EnvironmentCardHeader
          envName={env.name}
          envCritical={env.critical}
          latestCommit={latestCommit}
          isAutomation={isAutomation}
          isGenericService={isGenericService}
          deploymentStatusV2={deploymentStatusV2}
          isActionPending={stopMutation.isPending || redeployMutation.isPending}
          onStop={handleStop}
          onRedeploy={handleRedeploy}
          nextRunLabel={nextRunLabel}
          isRefreshing={isRefreshing}
          deployTrackIsPending={trigger.isPending || !!pendingTriggerTime}
          schemaConfigChecking={isAutomation && schemaConfigLoading}
          hasDeployment={!!envDeployment}
          scheduleButtonProps={
            isAutomation
              ? {
                  envId: env.id,
                  envName: env.name,
                  componentId,
                  orgHandler,
                  releaseId: envReleaseId,
                  versionId,
                  deploymentPipelineId,
                  hasSchedule: !!scheduleConfig?.cronjobFrequency,
                  onSaveSuccess: () => setNotification({ text: 'Schedule updated successfully', severity: 'success' }),
                  onSaveError: () => setNotification({ text: 'Failed to save schedule. Please try again.', severity: 'error' }),
                  onStopSuccess: () => setNotification({ text: 'Schedule stopped successfully', severity: 'success' }),
                }
              : undefined
          }
          onRun={handleRun}
          onRunWithArgs={() => setRunWithArgsOpen(true)}
          onRefresh={handleRefresh}
          onConfigure={() => setConfigureOpen(true)}
          onViewLogs={isGenericService ? () => setLogsOpen(true) : undefined}
          onTest={isGenericService ? () => navigate(`/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandler}/test/console`) : undefined}
          hasMissingConfigs={hasMissingConfigs}
        />

        <EnvironmentCardBody
          isAutomation={isAutomation}
          isGenericService={isGenericService}
          loadingEnvDeployment={loadingEnvDeployment}
          hasDeployment={!!envDeployment}
          deploymentStatusV2={deploymentStatusV2}
          envEndpoints={envEndpoints}
          scheduleDescription={scheduleDescription}
          releaseId={envReleaseId}
          projectId={projectId}
          componentId={componentId}
          deploymentTrackId={versionId}
          environmentId={env.id}
          orgHandler={orgHandler}
          projectHandler={projectHandler}
          componentHandler={componentHandler}
          envCritical={env.critical ?? false}
          pendingTriggerTime={pendingTriggerTime}
          pendingTriggerArgs={pendingTriggerArgs}
          onTriggerResolved={() => {
            setPendingTriggerTime(null);
            setPendingTriggerArgs(null);
          }}
          onRunSuccess={() => {
            setNotification({ text: 'Execution triggered successfully', severity: 'success' });
            setPendingTriggerTime(Date.now());
            queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
          }}
          envId={env.id}
          envName={env.name}
          apimEnvId={env.apimEnvId}
          apiId={apiId ?? componentId}
          prevEnvEndpoints={prevEnvEndpoints as GqlEnvEndpoint[]}
          prevEnvName={prevEnv?.name}
          notification={notification}
        />
      </CardContent>

      <RunWithArgsDialog
        open={runWithArgsOpen}
        onClose={() => setRunWithArgsOpen(false)}
        onRunSuccess={(args) => {
          setNotification({ text: 'Execution triggered successfully', severity: 'success' });
          setPendingTriggerTime(Date.now());
          setPendingTriggerArgs(args.length > 0 ? args : null);
          queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
        }}
        envCritical={env.critical}
        orgHandler={orgHandler}
        projectId={projectId}
        componentId={componentId}
        releaseId={envReleaseId}
      />

      <ConfigureDrawer
        open={configureOpen}
        onClose={() => setConfigureOpen(false)}
        orgHandler={orgHandler}
        projectId={projectId}
        componentId={componentId}
        envId={env.id}
        versionId={versionId}
        componentName={componentHandler}
        projectHandler={projectHandler}
        commitHash={latestCommit?.sha}
        releaseId={envReleaseId}
        displayType={displayType}
        releaseMgtReleaseId={envDeployment?.releaseMgtDeployment?.releaseMgtReleaseId}
        releaseMgtDeploymentId={envDeployment?.releaseMgtDeployment?.releaseMgtDeploymentId}
        isAutomation={isAutomation}
        envTemplateId={envTemplateId}
      />

      {isGenericService && <ServiceLogsDrawer open={logsOpen} onClose={() => setLogsOpen(false)} componentId={componentId} environmentId={env.id} envName={env.name} versionId={versionId} />}
    </Card>
  );
}
