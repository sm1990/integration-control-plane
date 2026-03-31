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

import { Box, Button, CircularProgress, Collapse, Divider, IconButton, Stack, Step, StepLabel, Stepper, Tooltip, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronUp, GitCommit, List } from '@wso2/oxygen-ui-icons-react';
import { InProgressIcon, SuccessIcon, QueuedIcon, FailedIcon } from './StatusIcons';
import React, { useEffect, useRef, useState } from 'react';
import { fetchBuildRunLogs, type BuildRunLogs } from '../api/builds';
import { useDeploymentStatus, type GqlCommit } from '../api/queries';

interface BuildCardProps {
  componentId: string;
  versionId: string;
  orgHandler: string;
  projectId: string;
  latestCommit?: GqlCommit | null;
}

const STAGES = [
  { key: 'init' as const, label: 'Initialization' },
  { key: 'build' as const, label: 'Build Source & Test' },
  { key: 'deploy' as const, label: 'Finalization' },
];

function getStepStatus(logs: BuildRunLogs | null, key: 'init' | 'build' | 'deploy'): 'success' | 'error' | 'active' | 'pending' {
  const stage = logs?.[key];
  if (!stage) return 'pending';
  if (stage.status === 'in_progress') return 'active';
  if (stage.status === 'completed') {
    const hasFailed = stage.steps.some((s) => s.conclusion === 'failure' || s.conclusion === 'failed');
    return hasFailed ? 'error' : 'success';
  }
  return 'pending';
}

function activeStepIndex(logs: BuildRunLogs | null): number {
  if (!logs) return 0;
  const init = getStepStatus(logs, 'init');
  const build = getStepStatus(logs, 'build');
  if (init === 'active') return 0;
  if (build === 'active') return 1;
  if (getStepStatus(logs, 'deploy') === 'active') return 2;
  if (init === 'success' && build === 'success') return 3;
  if (init === 'success') return 1;
  return 0;
}

function safeAtob(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return '';
  }
}

// Returns null = no logs available (expired), '' = still loading, string = actual content
function buildLogText(logs: BuildRunLogs | null): string | null {
  if (!logs) return '';

  const parts: string[] = [];
  let anyLogFieldPresent = false;

  for (const { key, label } of STAGES) {
    const stage = logs[key];
    if (!stage) continue;
    if (stage.log !== null) anyLogFieldPresent = true;
    const decoded = stage.log ? safeAtob(stage.log).trim() : '';
    if (decoded && decoded !== 'No log data available') {
      parts.push(`\u25b6 ${label}\n${decoded}`);
    }
  }

  if (parts.length > 0) return parts.join('\n\n');

  // All log fields present but all say "No log data available" → logs expired
  if (anyLogFieldPresent) return null;

  // log fields are null → build in progress, show step names as live progress
  const lines: string[] = [];
  for (const { key, label } of STAGES) {
    const stage = logs[key];
    if (!stage || stage.steps.length === 0) continue;
    lines.push(`\u25b6 ${label}`);
    for (const step of stage.steps) {
      let icon = '○';
      if (step.conclusion === 'success') icon = '✓';
      else if (step.conclusion === 'failure' || step.conclusion === 'failed') icon = '✗';
      else if (step.conclusion === 'skipped') icon = '-';
      else if (step.status === 'in_progress') icon = '⟳';
      lines.push(`  ${icon} ${step.name}`);
    }
    lines.push('');
  }
  return lines.join('\n') || '';
}

export default function BuildCard({ componentId, versionId, orgHandler, projectId, latestCommit }: BuildCardProps) {
  const { data: deployments = [] } = useDeploymentStatus(componentId, versionId);
  const lastBuild = deployments[0] ?? null;

  const [expanded, setExpanded] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<BuildRunLogs | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const logsRef = useRef<HTMLPreElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset log view when build changes
  useEffect(() => {
    setShowLogs(false);
    setLogs(null);
  }, [lastBuild?.id]);

  const runId = lastBuild?.buildRef ?? String(lastBuild?.id ?? '');
  const isInProgress = lastBuild?.status === 'in_progress';

  // Fetch logs when expanded (for stepper + log view), poll every 5s while in progress
  useEffect(() => {
    if (!expanded || !runId || !orgHandler || !projectId || !componentId) return;

    let cancelled = false;
    if (showLogs && !logs) setLogsLoading(true);

    const load = async () => {
      const data = await fetchBuildRunLogs(orgHandler, projectId, componentId, runId);
      if (cancelled || !mountedRef.current) return;
      setLogs(data);
      setLogsLoading(false);
    };

    load();
    if (!isInProgress) return;
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, runId, orgHandler, projectId, componentId, isInProgress]);

  // Scroll logs to bottom on update
  useEffect(() => {
    if (showLogs && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, showLogs]);

  if (!lastBuild) {
    return (
      <Box sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, textTransform: 'capitalize', mb: 1 }}>
          Latest Build
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No builds yet.
        </Typography>
      </Box>
    );
  }

  const commitSha = latestCommit?.sha?.slice(0, 7) ?? lastBuild.sourceCommitId?.slice(0, 7) ?? '';
  const commitMessage = latestCommit?.message ?? '';
  const commitTooltip = commitMessage ? `"${commitMessage}"${latestCommit?.author?.name ? ` by ${latestCommit.author.name}` : ''}` : commitSha;

  const status = lastBuild.status;
  const conclusion = lastBuild.conclusion ?? '';

  let statusLabel = 'Unknown';
  let statusDotColor = 'text.disabled';
  if (status === 'queued') {
    statusLabel = 'Queued';
    statusDotColor = 'text.secondary';
  } else if (status === 'in_progress') {
    statusLabel = 'In Progress';
    statusDotColor = 'warning.main';
  } else if (status === 'completed' && conclusion === 'success') {
    statusLabel = 'Completed';
    statusDotColor = 'success.main';
  } else if (status === 'completed' && (conclusion === 'failure' || conclusion === 'failed')) {
    statusLabel = 'Failed';
    statusDotColor = 'error.main';
  }

  const logText = buildLogText(logs);

  return (
    <Box sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: expanded ? 1.5 : 0 }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, textTransform: 'capitalize', flexShrink: 0 }}>
            Latest Build
          </Typography>

          {commitSha && (
            <Tooltip title={commitTooltip} placement="bottom">
              <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0, cursor: 'default' }}>
                <GitCommit size={14} style={{ opacity: 0.55, flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', flexShrink: 0 }}>
                  {commitSha}
                </Typography>
                {commitMessage && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 260,
                    }}>
                    {commitMessage}
                  </Typography>
                )}
              </Stack>
            </Tooltip>
          )}

          <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexShrink: 0 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusDotColor, flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              {statusLabel}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
          <Button
            variant="text"
            size="small"
            startIcon={<List size={14} />}
            onClick={() => {
              if (!expanded) setExpanded(true);
              setShowLogs((v) => !v);
            }}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
            {showLogs ? 'Hide Logs' : 'View Logs'}
          </Button>
          <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
            <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Collapsible body */}
      <Collapse in={expanded}>
        <Divider sx={{ mb: 2 }} />

        {/* Horizontal stepper */}
        <Stepper activeStep={activeStepIndex(logs)} alternativeLabel nonLinear sx={{ mb: showLogs ? 2 : 0 }}>
          {STAGES.map(({ key, label }) => {
            const stepStatus = getStepStatus(logs, key);
            let icon: React.ReactNode;
            if (stepStatus === 'active') icon = <InProgressIcon size={24} />;
            else if (stepStatus === 'success') icon = <SuccessIcon size={24} />;
            else if (stepStatus === 'error') icon = <FailedIcon size={24} />;
            else icon = <QueuedIcon size={24} />;
            return (
              <Step key={key} active={stepStatus === 'active'} completed={stepStatus === 'success'}>
                <StepLabel error={stepStatus === 'error'} icon={icon}>
                  {label}
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>

        {/* Log viewer */}
        {showLogs && (
          <>
            <Divider sx={{ mb: 1.5 }} />
            {logsLoading && !logs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Box
                component="pre"
                ref={logsRef}
                sx={{
                  m: 0,
                  p: 2,
                  bgcolor: '#1a1a1a',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  lineHeight: 1.6,
                  overflowY: 'auto',
                  maxHeight: 360,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: '#e0e0e0',
                }}>
                {logText === null ? 'No log data available' : logText || 'Waiting for build logs...'}
              </Box>
            )}
          </>
        )}
      </Collapse>
    </Box>
  );
}
