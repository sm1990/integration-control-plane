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
import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useComponentDeployment, useExecutionConfigs, type GqlEnvironment } from '../../api/queries';
import { getOrgUuidFromToken } from '../../auth/tokenManager';
import { useDeployDeploymentTrack } from '../../api/mutations';
import { nextCronRunMs, formatTimeUntil, describeCron } from '../../utils/cronUtils';
import EnvironmentCardHeader from './EnvironmentCardHeader';
import EnvironmentCardBody from './EnvironmentCardBody';
import EnvironmentCardFooter from './EnvironmentCardFooter';

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
}

export default function Environment({ env, componentId, projectId: _projectId, componentType: _componentType, displayType, componentHandler, projectHandler, orgHandler, versionId, deploymentPipelineId, latestCommit }: EnvironmentProps) {
  const isAutomation = (displayType ?? '').toLowerCase() === 'scheduledtask';
  const queryClient = useQueryClient();
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [pendingTriggerTime, setPendingTriggerTime] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const deployTrack = useDeployDeploymentTrack();
  const envOrgUuid = getOrgUuidFromToken() ?? '';
  const { data: envDeployment, isLoading: loadingEnvDeployment } = useComponentDeployment(isAutomation ? orgHandler : '', isAutomation ? envOrgUuid : '', isAutomation ? componentId : '', isAutomation ? versionId : '', isAutomation ? env.id : '');
  const envReleaseId = envDeployment?.releaseId ?? '';
  const { data: scheduleConfig } = useExecutionConfigs(isAutomation ? componentId : '', isAutomation ? envReleaseId : '');
  const scheduleDescription = scheduleConfig?.cronjobFrequency ? `${describeCron(scheduleConfig.cronjobFrequency)}, in time zone ${scheduleConfig.cronjobTimezone || 'UTC'}` : null;
  const [scheduleSavedMessage, setScheduleSavedMessage] = useState<string | null>(null);

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

  const handleRun = () => {
    deployTrack.mutate(
      {
        componentId,
        id: versionId,
        imageId: envDeployment?.build?.buildId ?? '',
        environmentId: env.id,
        deploymentPipelineId,
        cronTimezone: scheduleConfig?.cronjobTimezone ?? envDeployment?.cronTimezone ?? 'UTC',
        cron: scheduleConfig?.cronjobFrequency ?? envDeployment?.cron ?? '',
        jobTimeoutSeconds: scheduleConfig?.timeoutSeconds ?? 300,
        cronJobAllowConcurrency: scheduleConfig?.cronjobAllowConcurrency ?? false,
      },
      {
        onSuccess: () => {
          setTriggerMessage('Execution triggered successfully');
          setPendingTriggerTime(Date.now());
          queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
        },
      },
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['deploymentStatus', componentId, versionId] }), queryClient.invalidateQueries({ queryKey: ['taskExecutions'] })]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <EnvironmentCardHeader
          envName={env.name}
          envCritical={env.critical}
          latestCommit={latestCommit}
          isAutomation={isAutomation}
          nextRunLabel={nextRunLabel}
          isRefreshing={isRefreshing}
          deployTrackIsPending={deployTrack.isPending}
          deploymentBuildId={envDeployment?.build?.buildId}
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
                  onSaveSuccess: () => setScheduleSavedMessage('Schedule updated successfully'),
                  onStopSuccess: () => setScheduleSavedMessage('Schedule stopped successfully'),
                }
              : undefined
          }
          onRun={handleRun}
          onRefresh={handleRefresh}
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
        />
      </CardContent>

      <EnvironmentCardFooter triggerMessage={triggerMessage} scheduleSavedMessage={scheduleSavedMessage} onTriggerMessageClose={() => setTriggerMessage(null)} onScheduleSavedMessageClose={() => setScheduleSavedMessage(null)} />
    </Card>
  );
}
