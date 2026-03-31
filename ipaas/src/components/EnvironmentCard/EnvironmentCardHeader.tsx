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

import { Button, IconButton, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { RefreshCw, Clock, SlidersHorizontal, GitCommit } from '@wso2/oxygen-ui-icons-react';
import ScheduleButton, { type ScheduleButtonProps } from './ScheduleButton';
import RunButton from './RunButton';

interface EnvironmentCardHeaderProps {
  envName: string;
  envCritical?: boolean | null;
  latestCommit?: { sha: string; message: string } | null;
  isAutomation: boolean;
  hasDeployment?: boolean;
  nextRunLabel: string | null;
  isRefreshing: boolean;
  deployTrackIsPending: boolean;
  scheduleButtonProps?: ScheduleButtonProps;
  onRun: () => void;
  onRunWithArgs: () => void;
  onRefresh: () => void;
  onConfigure?: () => void;
  hasMissingConfigs?: boolean;
}

export default function EnvironmentCardHeader({
  envName,
  envCritical,
  latestCommit,
  isAutomation,
  hasDeployment,
  nextRunLabel,
  isRefreshing,
  deployTrackIsPending,
  scheduleButtonProps,
  onRun,
  onRunWithArgs,
  onRefresh,
  onConfigure,
  hasMissingConfigs,
}: EnvironmentCardHeaderProps) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      {/* Left: env name + commit info + configure */}
      <Stack direction="row" alignItems="center" gap={1.5}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
          {envName}
        </Typography>
        {hasDeployment && latestCommit && (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <GitCommit size={14} style={{ opacity: 0.55, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {latestCommit.sha.substring(0, 7)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {latestCommit.message}
            </Typography>
          </Stack>
        )}
        {hasDeployment && isAutomation && onConfigure && (
          <Button variant="outlined" size="small" color={hasMissingConfigs ? 'error' : 'primary'} startIcon={<SlidersHorizontal size={14} />} onClick={onConfigure}>
            {hasMissingConfigs ? 'Configure to Continue' : 'Configure'}
          </Button>
        )}
      </Stack>

      {/* Right: Next run + Schedule / Test / Refresh */}
      {isAutomation && (
        <Stack direction="row" alignItems="center" gap={1}>
          {nextRunLabel && (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mr: 1 }}>
              <Clock size={14} />
              <Typography variant="body2" color="text.secondary">
                {nextRunLabel}
              </Typography>
            </Stack>
          )}
          {scheduleButtonProps && <ScheduleButton {...scheduleButtonProps} disabled={hasMissingConfigs} />}
          <RunButton envCritical={envCritical} disabled={hasMissingConfigs} pending={deployTrackIsPending} onRun={onRun} onRunWithArgs={onRunWithArgs} />
          <Tooltip title="Refresh">
            <IconButton size="small" disabled={isRefreshing} aria-label="Refresh" onClick={onRefresh}>
              <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none', transformOrigin: 'center' }} />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  );
}
