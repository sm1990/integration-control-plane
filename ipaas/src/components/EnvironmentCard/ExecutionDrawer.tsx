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

import { Alert, Box, Button, CircularProgress, Divider, Drawer, IconButton, Link, Stack, Tab, Tabs, Tooltip, Typography } from '@wso2/oxygen-ui';
import { CheckCircle2, Copy, X, XCircle } from '@wso2/oxygen-ui-icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { TaskExecution } from '../../api/queries';

interface ExecutionDrawerProps {
  execution: TaskExecution | null;
  open: boolean;
  onClose: () => void;
  orgHandler: string;
  projectHandler: string;
  componentHandler: string;
}

function formatTriggeredAt(unixSeconds: string): string {
  if (!unixSeconds) return '—';
  const date = new Date(parseInt(unixSeconds, 10) * 1000);
  const today = new Date();
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Today at ${timeStr}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ` at ${timeStr}`;
}

function formatDuration(startUnix: string, endUnix: string): string {
  if (!startUnix || !endUnix) return '—';
  const diff = parseInt(endUnix, 10) - parseInt(startUnix, 10);
  if (diff < 0) return '—';
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function isTerminal(status: string): boolean {
  const v = status?.toLowerCase();
  return v === 'succeeded' || v === 'success' || v === 'failed' || v === 'failure';
}

function StatusIcon({ status }: { status: string }) {
  const v = status?.toLowerCase();
  if (!isTerminal(status)) return <CircularProgress size={16} />;
  if (v === 'succeeded' || v === 'success') return <CheckCircle2 size={16} color="green" />;
  return <XCircle size={16} color="red" />;
}

export default function ExecutionDrawer({ execution, open, onClose, orgHandler, projectHandler, componentHandler }: ExecutionDrawerProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const logsUrl = `/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandler}/logs`;

  const handleCopy = () => {
    if (!execution?.revisionId) return;
    navigator.clipboard.writeText(execution.revisionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const drawerSx = {
    '& .MuiDrawer-paper': {
      width: 480,
      position: 'fixed',
      top: 64,
      height: 'calc(100% - 64px)',
      display: 'flex',
      flexDirection: 'column',
    },
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} variant="temporary" sx={drawerSx}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {execution ? `Execution: ${execution.id}` : 'Execution'}
        </Typography>
        <IconButton size="small" aria-label="close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </Stack>

      {execution && (
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Info card */}
          <Box sx={{ px: 2, pt: 2 }}>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 2, py: 1.5 }}>
              <Stack direction="row" gap={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Triggered at
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {formatTriggeredAt(execution.startTime)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Revision
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
                    <StatusIcon status={execution.status} />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {execution.revisionId ? execution.revisionId.substring(0, 10) : '—'}
                    </Typography>
                    {execution.revisionId && (
                      <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                        <IconButton size="small" onClick={handleCopy} aria-label="Copy revision ID">
                          <Copy size={12} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ px: 2, mt: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Attempts" />
              <Tab label="Arguments" />
            </Tabs>
            <Divider />
          </Box>

          {/* Attempts tab */}
          {tab === 0 && (
            <Box sx={{ px: 2, py: 2 }}>
              <Stack direction="row" sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, flex: '0 0 100px' }}>
                  ATTEMPT ID
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, flex: '0 0 80px' }}>
                  DURATION
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, flex: 1 }}>
                  TRIGGERED AT
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  ACTIONS
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ flex: '0 0 100px' }}>
                  <StatusIcon status={execution.status} />
                  <Typography variant="body2">#1</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ flex: '0 0 80px' }}>
                  {isTerminal(execution.status) ? formatDuration(execution.startTime, execution.completionTime) : '--'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {isTerminal(execution.status) ? formatTriggeredAt(execution.startTime) : '--'}
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    onClose();
                    navigate(logsUrl);
                  }}>
                  View Logs
                </Button>
              </Stack>
            </Box>
          )}

          {/* Arguments tab */}
          {tab === 1 && (
            <Box sx={{ px: 2, py: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  To learn more about runtime arguments, see the{' '}
                  <Link href="https://wso2.com/ballerina/icp/docs/" target="_blank" rel="noopener noreferrer" variant="body2">
                    WSO2 Integration Platform Documentation
                  </Link>
                  .
                </Typography>
              </Alert>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Arguments
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1, fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{execution.runId ? execution.runId : '[]'}</Box>
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  );
}
