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
import { useComponentDeployment, useExecutionConfigs, useSchemaConfig, type GqlEnvironment } from '../../api/queries';
import { getOrgUuidFromToken } from '../../auth/tokenManager';
import { useTriggerComponent } from '../../api/mutations';
import { nextCronRunMs, formatTimeUntil, describeCron } from '../../utils/cronUtils';
import EnvironmentCardHeader from './EnvironmentCardHeader';
import EnvironmentCardBody from './EnvironmentCardBody';
import RunWithArgsDialog from './RunWithArgsDialog';
import ConfigureDrawer from './ConfigureDrawer';

interface EnvironmentProps {
  env: GqlEnvironment;
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

export default function Environment({ env, componentId, projectId, componentType: _componentType, displayType, componentHandler, projectHandler, orgHandler, versionId, deploymentPipelineId, latestCommit, apiId }: EnvironmentProps) {
  const isAutomation = (displayType ?? '').toLowerCase() === 'scheduledtask';
  const queryClient = useQueryClient();
  const [configureOpen, setConfigureOpen] = useState(false);
  const [notification, setNotification] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [pendingTriggerTime, setPendingTriggerTime] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runWithArgsOpen, setRunWithArgsOpen] = useState(false);
  const trigger = useTriggerComponent();
  const envOrgUuid = getOrgUuidFromToken() ?? '';
  const { data: envDeployment, isLoading: loadingEnvDeployment } = useComponentDeployment(isAutomation ? orgHandler : '', isAutomation ? envOrgUuid : '', isAutomation ? componentId : '', isAutomation ? versionId : '', isAutomation ? env.id : '');
  const envReleaseId = envDeployment?.releaseId ?? '';
  const { data: scheduleConfig } = useExecutionConfigs(isAutomation ? componentId : '', isAutomation ? envReleaseId : '');
  const scheduleDescription = scheduleConfig?.cronjobFrequency ? `${describeCron(scheduleConfig.cronjobFrequency)}, in time zone ${scheduleConfig.cronjobTimezone || 'UTC'}` : null;

  const envTemplateId = env.templateId ?? env.id;
  const { data: schemaConfig } = useSchemaConfig(isAutomation ? projectId : '', isAutomation ? componentId : '', isAutomation ? envTemplateId : '', isAutomation ? versionId : '', latestCommit?.sha);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['componentDeployment'] }),
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
          nextRunLabel={nextRunLabel}
          isRefreshing={isRefreshing}
          deployTrackIsPending={trigger.isPending}
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
          hasMissingConfigs={hasMissingConfigs}
        />

        <EnvironmentCardBody
          isAutomation={isAutomation}
          loadingEnvDeployment={loadingEnvDeployment}
          hasDeployment={!!envDeployment}
          scheduleDescription={scheduleDescription}
          releaseId={envReleaseId}
          orgHandler={orgHandler}
          projectHandler={projectHandler}
          componentHandler={componentHandler}
          envCritical={env.critical ?? false}
          pendingTriggerTime={pendingTriggerTime}
          onTriggerResolved={() => setPendingTriggerTime(null)}
          envId={env.id}
          envName={env.name}
          projectId={projectId}
          apiId={apiId ?? componentId}
          notification={notification}
        />
      </CardContent>

      <RunWithArgsDialog
        open={runWithArgsOpen}
        onClose={() => setRunWithArgsOpen(false)}
        onRunSuccess={() => {
          setNotification({ text: 'Execution triggered successfully', severity: 'success' });
          setPendingTriggerTime(Date.now());
          queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
        }}
        envCritical={env.critical}
        orgHandler={orgHandler}
        projectId={projectId}
        componentId={componentId}
        releaseId={envReleaseId}
      />

      <ConfigureDrawer open={configureOpen} onClose={() => setConfigureOpen(false)} projectId={projectId} componentId={componentId} envId={envTemplateId} deploymentTrackId={versionId} commitHash={latestCommit?.sha} />
    </Card>
  );
}
