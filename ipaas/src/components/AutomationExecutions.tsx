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

import { Button, CircularProgress, IconButton, ListingTable, TablePagination, Typography } from '@wso2/oxygen-ui';
import { CheckCircle2, ChevronRight, XCircle } from '@wso2/oxygen-ui-icons-react';
import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskExecutions, type TaskExecution } from '../api/queries';
import ExecutionDrawer from './EnvironmentCard/ExecutionDrawer';

interface AutomationExecutionsProps {
  releaseId: string;
  orgHandler: string;
  projectHandler: string;
  componentHandler: string;
  envCritical: boolean;
  pendingTriggerTime?: number | null;
  onTriggerResolved?: () => void;
}

const QUEUED_SENTINEL = '__queued__';

function formatTriggeredAt(unixSeconds: string): string {
  if (!unixSeconds) return '—';
  const date = new Date(parseInt(unixSeconds, 10) * 1000);
  const today = new Date();
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Today at ${timeStr}`;
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

function isInProgress(status: string, _completionTime: string): boolean {
  const val = status?.toLowerCase();
  if (val === 'succeeded' || val === 'success' || val === 'failed' || val === 'failure') return false;
  return true; // InProgress, Queued, or any non-terminal status
}

function StatusIcon({ status, inProgress }: { status: string; inProgress: boolean }) {
  if (inProgress) return <CircularProgress size={18} />;
  const val = status?.toLowerCase();
  if (val === 'succeeded' || val === 'success') return <CheckCircle2 size={18} color="green" />;
  if (val === 'failed' || val === 'failure') return <XCircle size={18} color="red" />;
  return <CircularProgress size={18} />;
}

// Synthetic "queued" execution shown immediately after triggering, before the API returns
const QUEUED_EXECUTION: TaskExecution = {
  id: QUEUED_SENTINEL,
  startTime: '',
  completionTime: '',
  runId: '',
  revisionId: '',
  failedReason: '',
  status: 'Queued',
};

export default function AutomationExecutions({ releaseId, orgHandler, projectHandler, componentHandler, envCritical, pendingTriggerTime, onTriggerResolved }: AutomationExecutionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selectedExecution, setSelectedExecution] = useState<TaskExecution | null>(null);

  const { data: executions = [], isLoading } = useTaskExecutions(releaseId);

  // Only poll while there is something to wait for: a pending trigger or an in-progress execution.
  // Once all executions reach a terminal state and no trigger is pending, stop polling.
  const hasInProgress = executions.some((e) => isInProgress(e.status, e.completionTime));
  const shouldPoll = !!pendingTriggerTime || hasInProgress;

  useEffect(() => {
    if (!releaseId || !shouldPoll) return;
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['taskExecutions', releaseId] });
    }, 3000);
    return () => clearInterval(timer);
  }, [releaseId, shouldPoll, queryClient]);

  // Detect when the real new execution arrives and clear the queued sentinel
  useEffect(() => {
    if (!pendingTriggerTime || executions.length === 0) return;
    const latestStartMs = parseInt(executions[0].startTime, 10) * 1000;
    // The latest execution started after (or within 5s before) the trigger → it's the new one
    if (latestStartMs >= pendingTriggerTime - 5000) {
      onTriggerResolved?.();
    }
  }, [executions, pendingTriggerTime, onTriggerResolved]);

  // Auto-clear sentinel after 60s in case the API never returns the new execution
  useEffect(() => {
    if (!pendingTriggerTime) return;
    const timer = setTimeout(() => onTriggerResolved?.(), 60000);
    return () => clearTimeout(timer);
  }, [pendingTriggerTime, onTriggerResolved]);

  // Show the queued sentinel row at position 0 while pendingTriggerTime is set and no new exec arrived
  const showQueued = !!pendingTriggerTime && (executions.length === 0 || parseInt(executions[0].startTime, 10) * 1000 < pendingTriggerTime - 5000);
  const allExecutions = showQueued ? [QUEUED_EXECUTION, ...executions] : executions;

  const maxPage = Math.max(0, Math.ceil(allExecutions.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const paged = allExecutions.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  const logsUrl = `/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandler}/logs`;

  if (isLoading) {
    return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  }

  if (allExecutions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        No execution data available. Click &apos;{envCritical ? 'Run' : 'Test'}&apos; or use &apos;Schedule&apos; to trigger an execution.
      </Typography>
    );
  }

  return (
    <Fragment>
      <ListingTable.Container>
        <ListingTable density="compact">
          <ListingTable.Head>
            <ListingTable.Row>
              <ListingTable.Cell>Status</ListingTable.Cell>
              <ListingTable.Cell>Triggered At</ListingTable.Cell>
              <ListingTable.Cell>Duration</ListingTable.Cell>
              <ListingTable.Cell>Commit ID</ListingTable.Cell>
              <ListingTable.Cell>Latest Logs</ListingTable.Cell>
              <ListingTable.Cell></ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {paged.map((e) => {
              const inProgress = isInProgress(e.status, e.completionTime);
              return (
                <ListingTable.Row key={e.id}>
                  <ListingTable.Cell>
                    <StatusIcon status={e.status} inProgress={inProgress} />
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    <Typography variant="body2">{inProgress ? '--' : formatTriggeredAt(e.startTime)}</Typography>
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    <Typography variant="body2">{inProgress ? '--' : formatDuration(e.startTime, e.completionTime)}</Typography>
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {inProgress ? '--' : e.revisionId ? e.revisionId.substring(0, 7) : '—'}
                    </Typography>
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    {inProgress ? (
                      <Typography variant="body2" color="text.secondary">
                        --
                      </Typography>
                    ) : (
                      <Button variant="text" size="small" onClick={() => navigate(logsUrl)}>
                        View Logs
                      </Button>
                    )}
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    {e.id !== QUEUED_SENTINEL && (
                      <IconButton size="small" aria-label="View execution details" onClick={() => setSelectedExecution(e)}>
                        <ChevronRight size={16} />
                      </IconButton>
                    )}
                  </ListingTable.Cell>
                </ListingTable.Row>
              );
            })}
          </ListingTable.Body>
        </ListingTable>
        <TablePagination
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          component="div"
          count={allExecutions.length}
          page={safePage}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </ListingTable.Container>

      <ExecutionDrawer open={!!selectedExecution} execution={selectedExecution} onClose={() => setSelectedExecution(null)} orgHandler={orgHandler} projectHandler={projectHandler} componentHandler={componentHandler} />
    </Fragment>
  );
}
