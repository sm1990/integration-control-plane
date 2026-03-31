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

import { Alert, Box, Divider, Typography } from '@wso2/oxygen-ui';
import AutomationExecutions from '../AutomationExecutions';
import EnvCardInsights from './EnvCardInsights';
import EnvCardAutomationInsights from './EnvCardAutomationInsights';

interface EnvironmentCardBodyProps {
  isAutomation: boolean;
  loadingEnvDeployment: boolean;
  hasDeployment: boolean;
  scheduleDescription: string | null;
  releaseId: string;
  orgHandler: string;
  projectHandler: string;
  componentHandler: string;
  envCritical: boolean;
  pendingTriggerTime: number | null;
  onTriggerResolved: () => void;
  envId?: string;
  envName?: string;
  projectId?: string;
  apiId?: string;
  notification?: { text: string; severity: 'success' | 'error' } | null;
}

export default function EnvironmentCardBody({
  isAutomation,
  loadingEnvDeployment,
  hasDeployment,
  scheduleDescription,
  releaseId,
  orgHandler,
  projectHandler,
  componentHandler,
  envCritical,
  pendingTriggerTime,
  onTriggerResolved,
  envId,
  envName,
  projectId,
  apiId,
  notification,
}: EnvironmentCardBodyProps) {
  const showServiceInsights = !isAutomation && envCritical && !!apiId && !!envId && !!envName && !!projectId;
  const showAutomationInsights = isAutomation && envCritical && !!releaseId;

  return (
    <>
      <Divider sx={{ my: 2 }} />
      {notification ? (
        <Alert severity={notification.severity} sx={{ mb: 2 }}>
          {notification.text}
        </Alert>
      ) : (
        isAutomation &&
        hasDeployment &&
        scheduleDescription && (
          <Box sx={{ bgcolor: 'action.selected', borderRadius: 1, px: 2, py: 1, mb: 2 }}>
            <Typography variant="body2">{scheduleDescription}</Typography>
          </Box>
        )
      )}
      {isAutomation && !loadingEnvDeployment && hasDeployment && (
        <AutomationExecutions releaseId={releaseId} orgHandler={orgHandler} projectHandler={projectHandler} componentHandler={componentHandler} envCritical={envCritical} pendingTriggerTime={pendingTriggerTime} onTriggerResolved={onTriggerResolved} />
      )}
      {isAutomation && !loadingEnvDeployment && !hasDeployment && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No deployments yet. Click &apos;{envCritical ? 'Run' : 'Test'}&apos; or use &apos;Schedule&apos; to trigger an execution.
        </Typography>
      )}
      {showServiceInsights && <EnvCardInsights envName={envName!} envId={envId!} projectId={projectId!} apiId={apiId!} />}
      {showAutomationInsights && <EnvCardAutomationInsights releaseId={releaseId} />}
    </>
  );
}
