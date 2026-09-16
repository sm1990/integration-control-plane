// This component is unused and should be removed.

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

import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  type TabProps,
} from '@wso2/oxygen-ui';
import { Settings, Copy, Check, Play, RefreshCw, ShieldAlert, CalendarClock, ChevronDown, ChevronUp, X, Clock } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useComponentDeployment } from '../hooks/useDeployments';
import { useExecutionConfigs, useTriggerTask } from '../hooks/useExecutions';
import type { Environment } from '../types/environment';
import { useOrgUuid } from '../hooks/useOrgUuid';
import { useDeployDeploymentTrack } from '../hooks/useDeployments';
import { useGenerateComponentEnvironmentJwtSecret, useRotateComponentEnvironmentJwtSecret } from '../hooks/useComponents';
import AutomationExecutions from './AutomationExecutions';
import Authorized from './Authorized';
import { Permissions } from '../constants/permissions';
import { useUpdateArtifactTracingStatus, useUpdateArtifactStatisticsStatus } from '../hooks/useArtifactToggles';
import { useUpdateArtifactStatus, useUpdateListenerState, useArtifacts } from '../hooks/useArtifacts';
import type { Artifact } from '../types/artifact';
import { type SelectedArtifact, ENTRY_POINT_CONFIG, ENTRY_POINT_DETAIL_TABS } from './artifact-config';
import { ArtifactApiDefinition, ServiceResources, ProxyApiReference } from './ArtifactTabs';

import DeploymentNotice from './DeploymentNotice';
function EntryPointDetail({ selected, onOpenDrawerTab }: { selected: SelectedArtifact; onOpenDrawerTab: (tab: string) => void }) {
  const [tracingEnabled, setTracingEnabled] = useState(false);
  const [statisticsEnabled, setStatisticsEnabled] = useState(false);
  const [statusEnabled, setStatusEnabled] = useState(false);
  const [listenerEnabled, setListenerEnabled] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ type: 'tracing' | 'statistics' | 'status'; checked: boolean } | null>(null);
  const [pendingListenerToggle, setPendingListenerToggle] = useState<{ checked: boolean } | null>(null);
  const [triggerConfirmDialogOpen, setTriggerConfirmDialogOpen] = useState(false);
  const [triggerSuccessMessage, setTriggerSuccessMessage] = useState<string | null>(null);
  const { artifact, artifactType, envId, componentId, projectId } = selected;
  const queryClient = useQueryClient();
  const updateTracingStatus = useUpdateArtifactTracingStatus();
  const updateStatisticsStatus = useUpdateArtifactStatisticsStatus();
  const updateArtifactStatus = useUpdateArtifactStatus();
  const updateListenerState = useUpdateListenerState();
  const triggerTask = useTriggerTask();
  const config = ENTRY_POINT_CONFIG[artifactType];
  const tabProps: TabProps = { artifact, artifactType, envId, componentId, projectId };
  const carbonApp = artifact.carbonApp?.toString();
  const overviewFields = (config?.overviewFields ?? '').split(', ').filter(Boolean);
  const showTracingToggle = ['RestApi', 'ProxyService', 'InboundEndpoint'].includes(artifactType);
  const showRuntimesButton = true; // Show View Runtimes button for all entry points
  const showParametersButton = artifactType === 'InboundEndpoint';
  const showSourceButton = ['RestApi', 'ProxyService', 'InboundEndpoint', 'Task'].includes(artifactType);
  const showWsdlButton = artifactType === 'ProxyService';
  const showStatisticsToggle = ['RestApi', 'ProxyService', 'InboundEndpoint'].includes(artifactType);
  const showStatusToggle = artifactType === 'ProxyService';
  const showListenerToggle = artifactType === 'Listener';
  const showTaskToggle = artifactType === 'Task';
  const showTaskTrigger = artifactType === 'Task';
  const hasRuntimes = artifact.runtimes && Array.isArray(artifact.runtimes) && artifact.runtimes.length > 0;

  // Track if any preceding controls are visible for proper divider placement
  const hasPrecedingControls = carbonApp || showStatusToggle || showTracingToggle || showStatisticsToggle || showListenerToggle;
  const toEnabled = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    const normalized = (value ?? '').toString().toLowerCase();
    return normalized === 'enabled' || normalized === 'active' || normalized === 'true';
  };

  const artifactName = artifactType === 'Automation' ? (artifact.packageName?.toString() ?? '') : (artifact.name?.toString() ?? '');
  const artifactKey = `${artifactType}-${artifactName}`;
  useEffect(() => {
    setTracingEnabled(toEnabled(artifact.tracing));
    setStatisticsEnabled(toEnabled(artifact.statistics));
    setStatusEnabled(toEnabled(artifact.state));
    setListenerEnabled(toEnabled(artifact.state));
  }, [artifactKey, artifact.tracing, artifact.statistics, artifact.state]);

  const handleToggleTracing = (checked: boolean) => {
    if (!showTracingToggle) return;
    setPendingToggle({ type: 'tracing', checked });
  };

  const handleToggleStatistics = (checked: boolean) => {
    if (!showStatisticsToggle) return;
    setPendingToggle({ type: 'statistics', checked });
  };

  const handleToggleStatus = (checked: boolean) => {
    if (!showStatusToggle && !showTaskToggle) return;
    setPendingToggle({ type: 'status', checked });
  };

  const handleToggleListener = (checked: boolean) => {
    if (!showListenerToggle) return;
    setPendingListenerToggle({ checked });
  };

  const handleTriggerTask = () => {
    if (!showTaskTrigger) return;
    setTriggerConfirmDialogOpen(true);
  };

  const handleConfirmTrigger = () => {
    setTriggerConfirmDialogOpen(false);
    triggerTask.mutate(
      { componentId, taskName: artifactName },
      {
        onSuccess: () => {
          setTriggerSuccessMessage(`Successfully triggered task ${artifactName}`);
        },
        onSettled: () => {
          const artifactQueryKey = ['artifacts', artifactType, envId, componentId];
          queryClient.invalidateQueries({ queryKey: artifactQueryKey });
        },
      },
    );
  };

  const handleConfirmToggle = () => {
    if (!pendingToggle) return;
    const artifactQueryKey = ['artifacts', artifactType, envId, componentId];
    if (pendingToggle.type === 'tracing') {
      const previousValue = tracingEnabled;
      setTracingEnabled(pendingToggle.checked);
      updateTracingStatus.mutate(
        { envId, componentId, artifactType, artifactName, trace: pendingToggle.checked ? 'enable' : 'disable' },
        {
          onError: () => setTracingEnabled(previousValue),
          onSettled: () => queryClient.invalidateQueries({ queryKey: artifactQueryKey }),
        },
      );
    } else if (pendingToggle.type === 'statistics') {
      const previousValue = statisticsEnabled;
      setStatisticsEnabled(pendingToggle.checked);
      updateStatisticsStatus.mutate(
        { envId, componentId, artifactType, artifactName, statistics: pendingToggle.checked ? 'enable' : 'disable' },
        {
          onError: () => setStatisticsEnabled(previousValue),
          onSettled: () => queryClient.invalidateQueries({ queryKey: artifactQueryKey }),
        },
      );
    } else {
      const previousValue = statusEnabled;
      setStatusEnabled(pendingToggle.checked);
      updateArtifactStatus.mutate(
        { envId, componentId, artifactType, artifactName, status: pendingToggle.checked ? 'active' : 'inactive' },
        {
          onError: () => setStatusEnabled(previousValue),
          onSettled: () => queryClient.invalidateQueries({ queryKey: artifactQueryKey }),
        },
      );
    }
    setPendingToggle(null);
  };

  const handleConfirmListenerToggle = () => {
    if (!pendingListenerToggle) return;

    const runtimes = artifact.runtimes;
    if (!runtimes || !Array.isArray(runtimes) || runtimes.length === 0) {
      console.error('No valid runtimes available for listener toggle');
      setPendingListenerToggle(null);
      return;
    }

    const runtimeIds = runtimes.map((r: { runtimeId: string }) => r.runtimeId);
    const previousValue = listenerEnabled;

    setListenerEnabled(pendingListenerToggle.checked);
    const artifactQueryKey = ['artifacts', artifactType, envId, componentId];

    updateListenerState.mutate(
      {
        runtimeIds,
        listenerName: artifactName,
        action: pendingListenerToggle.checked ? 'START' : 'STOP',
      },
      {
        onError: () => setListenerEnabled(previousValue),
        onSettled: () => queryClient.invalidateQueries({ queryKey: artifactQueryKey }),
      },
    );

    setPendingListenerToggle(null);
  };

  const toggleLabel = pendingToggle?.type ?? 'status';
  const toggleAction = pendingToggle?.checked ? 'enable' : 'disable';
  const listenerAction = pendingListenerToggle?.checked ? 'enable' : 'disable';

  return (
    <>
      <Dialog open={pendingToggle !== null} onClose={() => setPendingToggle(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Confirm {toggleAction === 'enable' ? 'Enable' : 'Disable'} {toggleLabel.charAt(0).toUpperCase() + toggleLabel.slice(1)}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {toggleAction} {toggleLabel} for <strong>{artifactName}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingToggle(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmToggle}>
            {toggleAction === 'enable' ? 'Enable' : 'Disable'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={pendingListenerToggle !== null} onClose={() => setPendingListenerToggle(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{listenerAction === 'enable' ? 'Enable Listener' : 'Disable Listener'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {listenerAction} the listener <strong>{artifactName}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingListenerToggle(null)}>Cancel</Button>
          <Button variant="contained" color={listenerAction === 'disable' ? 'error' : 'primary'} onClick={handleConfirmListenerToggle}>
            {listenerAction === 'enable' ? 'Enable' : 'Disable'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={triggerConfirmDialogOpen} onClose={() => setTriggerConfirmDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Trigger Task</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to trigger task <strong>{artifactName}</strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5, fontSize: 13, color: 'text.secondary' }}>This will send a trigger command to all runtimes associated with this task.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTriggerConfirmDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmTrigger}>
            Trigger
          </Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ mt: 2 }}>
        {/* Header row */}
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 2, py: 1.5 }}>
          {carbonApp && <Chip label={`C-App: ${carbonApp}`} size="small" variant="outlined" sx={{ bgcolor: '#e8eaf6', color: '#3949ab', fontSize: 11 }} />}
          {carbonApp && <Divider orientation="vertical" flexItem />}
          {showStatusToggle && (
            <FormControlLabel
              control={<Switch name="status" size="small" checked={statusEnabled} onChange={(e) => handleToggleStatus(e.target.checked)} disabled={updateArtifactStatus.isPending} />}
              label="Status"
              labelPlacement="start"
              sx={{ m: 0, gap: 1 }}
            />
          )}
          {showStatusToggle && showTracingToggle && <Divider orientation="vertical" flexItem />}
          {showTracingToggle && (
            <FormControlLabel control={<Switch size="small" checked={tracingEnabled} onChange={(e) => handleToggleTracing(e.target.checked)} disabled={updateTracingStatus.isPending} />} label="Tracing" labelPlacement="start" sx={{ m: 0, gap: 1 }} />
          )}
          {showTracingToggle && showStatisticsToggle && <Divider orientation="vertical" flexItem />}
          {showStatisticsToggle && (
            <FormControlLabel
              control={<Switch size="small" checked={statisticsEnabled} onChange={(e) => handleToggleStatistics(e.target.checked)} disabled={updateStatisticsStatus.isPending} />}
              label="Statistics"
              labelPlacement="start"
              sx={{ m: 0, gap: 1 }}
            />
          )}
          {(showTracingToggle || showStatisticsToggle) && showListenerToggle && <Divider orientation="vertical" flexItem />}
          {showListenerToggle && (
            <FormControlLabel control={<Switch size="small" checked={listenerEnabled} onChange={(e) => handleToggleListener(e.target.checked)} disabled={updateListenerState.isPending} />} label="State" labelPlacement="start" sx={{ m: 0, gap: 1 }} />
          )}
          {showTaskToggle && (
            <>
              {hasPrecedingControls && <Divider orientation="vertical" flexItem />}
              <FormControlLabel
                control={<Switch size="small" checked={statusEnabled} onChange={(e) => handleToggleStatus(e.target.checked)} disabled={updateArtifactStatus.isPending || !hasRuntimes} />}
                label="Status"
                labelPlacement="start"
                sx={{ m: 0, gap: 1 }}
              />
            </>
          )}
          {showTaskTrigger && (
            <>
              {(hasPrecedingControls || showTaskToggle) && <Divider orientation="vertical" flexItem />}
              <Tooltip title={!hasRuntimes ? 'No runtimes available' : 'Trigger task'}>
                <Box>
                  <IconButton size="small" onClick={handleTriggerTask} disabled={triggerTask.isPending || !hasRuntimes} aria-label="Trigger task" sx={{ color: hasRuntimes ? 'primary.main' : 'text.disabled' }}>
                    <Play size={16} />
                  </IconButton>
                </Box>
              </Tooltip>
            </>
          )}
          {showSourceButton && (
            <Button variant="outlined" size="small" onClick={() => onOpenDrawerTab('Source')} sx={{ ml: 'auto' }}>
              View Source
            </Button>
          )}
          {showParametersButton && (
            <Button variant="outlined" size="small" onClick={() => onOpenDrawerTab('Parameters')} sx={{ ml: 'auto' }}>
              View Parameters
            </Button>
          )}
          {showWsdlButton && (
            <Button variant="outlined" size="small" onClick={() => onOpenDrawerTab('Endpoints')} sx={{ ml: 'auto' }}>
              View Endpoints
            </Button>
          )}
          {showWsdlButton && (
            <Button variant="outlined" size="small" onClick={() => onOpenDrawerTab('WSDL')}>
              View WSDL
            </Button>
          )}
          {showRuntimesButton && (
            <Button variant="outlined" size="small" onClick={() => onOpenDrawerTab('Runtimes')} sx={{ ml: showSourceButton || showParametersButton || showWsdlButton ? 0 : 'auto' }}>
              View Runtimes
            </Button>
          )}
        </Stack>
        {/* Overview columns */}
        {overviewFields.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${overviewFields.length}, 1fr)` }}>
            {overviewFields.map((f, i) => (
              <Box key={f} sx={{ px: 2, py: 1.5, ...(i < overviewFields.length - 1 && { borderRight: '1px solid', borderColor: 'divider' }) }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600, display: 'block' }}>
                  {f.toUpperCase()}
                </Typography>
                {f === 'state' ? (
                  <Chip
                    label={artifact[f] ? artifact[f].toString().charAt(0).toUpperCase() + artifact[f].toString().slice(1).toLowerCase() : '—'}
                    size="small"
                    variant="outlined"
                    color={artifact[f]?.toString().toLowerCase() === 'enabled' ? 'success' : 'default'}
                    sx={{ mt: 0.5, fontSize: 13 }}
                  />
                ) : (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {artifact[f] ? artifact[f].toString() : '—'}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
        {(ENTRY_POINT_DETAIL_TABS[artifactType] ?? []).includes('Resources') && <Box sx={{ px: 2, py: 1.5 }}>{artifactType === 'RestApi' ? <ArtifactApiDefinition {...tabProps} /> : <ServiceResources {...tabProps} />}</Box>}
        {artifactType === 'ProxyService' && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <ProxyApiReference {...tabProps} />
          </Box>
        )}
        {artifactType === 'Automation' && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <AutomationExecutions {...tabProps} />
          </Box>
        )}
      </Box>
      <Snackbar open={triggerSuccessMessage !== null} autoHideDuration={4000} onClose={() => setTriggerSuccessMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setTriggerSuccessMessage(null)} severity="success" sx={{ width: '100%' }}>
          {triggerSuccessMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EntryPointsList({ envId, componentId, projectId, componentType, onOpenDrawer }: { envId: string; componentId: string; projectId: string; componentType: string; onOpenDrawer: (a: Artifact, type: string, envId: string, tab: string) => void }) {
  const [selectedKey, setSelectedKey] = useState('');
  const isMI = componentType === 'MI';

  const { data: apis = [], isLoading: loadingApis } = useArtifacts('RestApi', envId, componentId, { enabled: isMI });
  const { data: proxies = [], isLoading: loadingProxies } = useArtifacts('ProxyService', envId, componentId, { enabled: isMI });
  const { data: inboundEps = [], isLoading: loadingInbound } = useArtifacts('InboundEndpoint', envId, componentId, { enabled: isMI });
  const { data: tasks = [], isLoading: loadingTasks } = useArtifacts('Task', envId, componentId, { enabled: isMI });
  const { data: services = [], isLoading: loadingServices } = useArtifacts('Service', envId, componentId, { enabled: !isMI });
  const { data: listeners = [], isLoading: loadingListeners } = useArtifacts('Listener', envId, componentId, { enabled: !isMI });
  const { data: automations = [], isLoading: loadingAutomations } = useArtifacts('Automation', envId, componentId, { enabled: !isMI });

  const isLoading = isMI ? loadingApis || loadingProxies || loadingInbound || loadingTasks : loadingServices || loadingListeners || loadingAutomations;

  const allEntryPoints = useMemo(
    () =>
      isMI
        ? [...apis.map((a) => ({ artifact: a, type: 'RestApi' })), ...proxies.map((a) => ({ artifact: a, type: 'ProxyService' })), ...inboundEps.map((a) => ({ artifact: a, type: 'InboundEndpoint' })), ...tasks.map((a) => ({ artifact: a, type: 'Task' }))]
        : [...services.map((a) => ({ artifact: a, type: 'Service' })), ...listeners.map((a) => ({ artifact: a, type: 'Listener' })), ...automations.map((a) => ({ artifact: a, type: 'Automation' }))],
    [isMI, apis, proxies, inboundEps, tasks, services, listeners, automations],
  );

  const allKeys = new Set(
    allEntryPoints.map(({ artifact: a, type }) => {
      const artifactKey = type === 'Automation' ? a.packageName : a.name;
      return `${type}::${artifactKey}`;
    }),
  );
  const firstKey = allEntryPoints.length > 0 ? `${allEntryPoints[0].type}::${allEntryPoints[0].type === 'Automation' ? allEntryPoints[0].artifact.packageName : allEntryPoints[0].artifact.name}` : '';
  const activeKey = selectedKey && allKeys.has(selectedKey) ? selectedKey : firstKey;
  const selectedEntry = useMemo(
    () =>
      allEntryPoints.find(({ artifact: a, type }) => {
        const artifactKey = type === 'Automation' ? a.packageName : a.name;
        return `${type}::${artifactKey}` === activeKey;
      }),
    [allEntryPoints, activeKey],
  );

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  if (allEntryPoints.length === 0)
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No entry points found for this component.
      </Typography>
    );

  return (
    <>
      <Autocomplete
        value={selectedEntry ?? null}
        onChange={(_, newValue) => {
          if (!newValue) {
            setSelectedKey('');
            return;
          }
          const artifactKey = newValue.type === 'Automation' ? newValue.artifact.packageName : newValue.artifact.name;
          setSelectedKey(`${newValue.type}::${artifactKey}`);
        }}
        options={allEntryPoints}
        autoHighlight
        fullWidth
        getOptionLabel={(option) => {
          const displayName = option.type === 'Automation' ? option.artifact.packageName : option.artifact.name;
          return displayName?.toString() ?? '';
        }}
        isOptionEqualToValue={(a, b) => {
          const aName = a.type === 'Automation' ? a.artifact.packageName : a.artifact.name;
          const bName = b.type === 'Automation' ? b.artifact.packageName : b.artifact.name;
          return a.type === b.type && aName === bName;
        }}
        renderOption={(props, { artifact: a, type }) => {
          const { key, ...optionProps } = props;
          const cfg = ENTRY_POINT_CONFIG[type];
          const meta = cfg?.metaField ? a[cfg.metaField]?.toString() : undefined;
          const displayName = type === 'Automation' ? a.packageName?.toString() : a.name?.toString();
          return (
            <Box key={key} component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} {...optionProps}>
              <Chip label={cfg?.label} size="small" sx={{ bgcolor: cfg?.bgColor, color: cfg?.color, fontWeight: 700, fontSize: 11, minWidth: 60, justifyContent: 'center' }} />
              <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                {displayName}
              </Typography>
              {meta && (
                <Typography variant="body2" color="text.secondary">
                  {meta}
                </Typography>
              )}
            </Box>
          );
        }}
        renderInput={(params) => {
          const cfg = selectedEntry ? ENTRY_POINT_CONFIG[selectedEntry.type] : undefined;
          const chipAdornment = cfg ? (
            <InputAdornment position="start">
              <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bgColor, color: cfg.color, fontWeight: 700, fontSize: 11, minWidth: 60, justifyContent: 'center' }} />
            </InputAdornment>
          ) : null;
          return (
            <TextField
              {...params}
              placeholder="Search entry points..."
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    {chipAdornment}
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          );
        }}
      />
      {selectedEntry && <EntryPointDetail selected={{ artifact: selectedEntry.artifact, artifactType: selectedEntry.type, envId, componentId, projectId }} onOpenDrawerTab={(tab) => onOpenDrawer(selectedEntry.artifact, selectedEntry.type, envId, tab)} />}
    </>
  );
}

// ── Interval → cron conversion ──

const INTERVAL_UNITS = ['Minute', 'Hour', 'Day', 'Week', 'Month'] as const;
type IntervalUnit = (typeof INTERVAL_UNITS)[number];

function getTimezoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const normalized = offset.replace(/^GMT$/, 'GMT+00:00').replace(/GMT([+-])(\d):/, 'GMT$10$2:');
    return `(${normalized}) ${tz}`;
  } catch {
    return tz;
  }
}

const TIMEZONE_OPTIONS: { label: string; value: string }[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone').map((tz) => ({ label: getTimezoneLabel(tz), value: tz }));
  } catch {
    return [{ label: '(GMT+00:00) UTC', value: 'UTC' }];
  }
})();

function intervalToCron(count: number, unit: IntervalUnit): string {
  const n = Math.max(1, count);
  switch (unit) {
    case 'Minute':
      return `*/${n} * * * *`;
    case 'Hour':
      return `0 */${n} * * *`;
    case 'Day':
      return `0 0 */${n} * *`;
    case 'Week':
      return `0 0 * * ${n % 7}`;
    case 'Month':
      return `0 0 1 */${n} *`;
  }
}

function cronToInterval(cron: string): { count: number; unit: IntervalUnit } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return { count: parseInt(min.slice(2), 10) || 1, unit: 'Minute' };
  }
  if (min === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    return { count: parseInt(hour.slice(2), 10) || 1, unit: 'Hour' };
  }
  if (min === '0' && hour === '0' && dom.startsWith('*/') && month === '*' && dow === '*') {
    return { count: parseInt(dom.slice(2), 10) || 1, unit: 'Day' };
  }
  if (min === '0' && hour === '0' && dom === '*' && month === '*' && dow !== '*') {
    return { count: parseInt(dow, 10) || 1, unit: 'Week' };
  }
  if (min === '0' && hour === '0' && dom === '1' && month.startsWith('*/') && dow === '*') {
    return { count: parseInt(month.slice(2), 10) || 1, unit: 'Month' };
  }
  return null;
}

const CRON_FIELD_LABELS = [
  { key: 'minute', label: 'minute (0 - 59)', placeholder: '*/1' },
  { key: 'hour', label: 'hour (0 - 23)', placeholder: '*' },
  { key: 'dom', label: 'day of month (1 - 31)', placeholder: '*' },
  { key: 'month', label: 'month (1 - 12)', placeholder: '*' },
  { key: 'dow', label: 'day of week (0 - 6, Sun=0)', placeholder: '*' },
] as const;

type CronField = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

function parseCronParts(cron: string): Record<CronField, string> {
  const parts = cron.trim().split(/\s+/);
  return {
    minute: parts[0] ?? '*',
    hour: parts[1] ?? '*',
    dom: parts[2] ?? '*',
    month: parts[3] ?? '*',
    dow: parts[4] ?? '*',
  };
}

function buildCronFromParts(fields: Record<CronField, string>): string {
  return `${fields.minute} ${fields.hour} ${fields.dom} ${fields.month} ${fields.dow}`;
}

function nextCronRunMs(cron: string): number | null {
  const interval = cronToInterval(cron);
  if (!interval) return null;
  const now = new Date();
  const { count, unit } = interval;
  const next = new Date(now);
  switch (unit) {
    case 'Minute': {
      const nextMin = (Math.floor(now.getMinutes() / count) + 1) * count;
      next.setSeconds(0, 0);
      if (nextMin >= 60) {
        next.setMinutes(0);
        next.setHours(now.getHours() + 1);
      } else {
        next.setMinutes(nextMin);
      }
      break;
    }
    case 'Hour': {
      const nextH = (Math.floor(now.getHours() / count) + 1) * count;
      next.setMinutes(0, 0, 0);
      if (nextH >= 24) {
        next.setHours(0);
        next.setDate(now.getDate() + 1);
      } else {
        next.setHours(nextH);
      }
      break;
    }
    case 'Day':
      next.setDate(now.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      break;
    case 'Week':
      next.setDate(now.getDate() + (7 - now.getDay()));
      next.setHours(0, 0, 0, 0);
      break;
    case 'Month':
      next.setMonth(now.getMonth() + 1);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      break;
    default:
      return null;
  }
  return next.getTime();
}

function formatTimeUntil(ms: number): string {
  const diff = Math.max(0, ms - Date.now());
  const totalSecs = Math.round(diff / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function describeCron(cron: string): string {
  const interval = cronToInterval(cron);
  if (!interval) return '';
  const { count, unit } = interval;
  return `Executes every ${count === 1 ? unit.toLowerCase() : `${count} ${unit.toLowerCase()}s`}`;
}

// ── Schedule Dialog ──

function ScheduleDialog({
  open,
  onClose,
  onSaveSuccess,
  envId,
  envName: _envName,
  componentId,
  orgHandler,
  versionId,
  deploymentPipelineId,
}: {
  open: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
  envId: string;
  envName: string;
  componentId: string;
  orgHandler: string;
  versionId: string;
  deploymentPipelineId: string;
}) {
  const [tab, setTab] = useState(0);
  const [intervalCount, setIntervalCount] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('Minute');
  const [cronFields, setCronFields] = useState<Record<CronField, string>>({ minute: '*/1', hour: '*', dom: '*', month: '*', dow: '*' });
  const [timezone, setTimezone] = useState('UTC');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState<string>('');
  const [allowConcurrency, setAllowConcurrency] = useState(false);
  const [retryCount, setRetryCount] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const orgUuid = useOrgUuid() ?? '';
  const { data: deployment, isLoading: loadingDeployment } = useComponentDeployment(orgHandler, orgUuid, componentId, versionId, envId);
  const releaseId = deployment?.releaseId ?? '';
  const { data: existingConfigs, isLoading: loadingExecConfigs } = useExecutionConfigs(componentId, releaseId);
  const loadingConfigs = loadingDeployment || loadingExecConfigs;
  const deployTrack = useDeployDeploymentTrack();

  // Populate from existing config
  useEffect(() => {
    if (!existingConfigs || !open) return;
    const freq = existingConfigs.cronjobFrequency || '*/1 * * * *';
    const tz = existingConfigs.cronjobTimezone || 'UTC';
    setTimezone(tz);
    if (existingConfigs.timeoutSeconds != null) setTimeoutSeconds(String(existingConfigs.timeoutSeconds));
    if (existingConfigs.cronjobAllowConcurrency != null) setAllowConcurrency(existingConfigs.cronjobAllowConcurrency);
    if (existingConfigs.retryCount != null) setRetryCount(String(existingConfigs.retryCount));
    const parsed = cronToInterval(freq);
    if (parsed) {
      setTab(0);
      setIntervalCount(parsed.count);
      setIntervalUnit(parsed.unit);
    } else {
      setTab(1);
      setCronFields(parseCronParts(freq));
    }
  }, [existingConfigs, open]);

  const cronExpression = tab === 0 ? intervalToCron(intervalCount, intervalUnit) : buildCronFromParts(cronFields);

  const handleSave = () => {
    setSaveError(null);
    deployTrack.mutate(
      {
        componentId,
        id: versionId,
        imageId: deployment?.build?.buildId ?? '',
        environmentId: envId,
        deploymentPipelineId,
        cron: cronExpression,
        cronTimezone: timezone,
        jobTimeoutSeconds: timeoutSeconds ? parseInt(timeoutSeconds, 10) : 300,
        cronJobAllowConcurrency: allowConcurrency,
      },
      {
        onSuccess: () => {
          onClose();
          onSaveSuccess?.();
        },
        onError: (err) => setSaveError(err instanceof Error ? err.message : 'Failed to save schedule'),
      },
    );
  };

  const description = describeCron(cronExpression);

  const drawerSx = {
    '& .MuiDrawer-paper': {
      width: 440,
      position: 'fixed',
      top: 64,
      height: 'calc(100% - 64px)',
      borderLeft: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
    },
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} variant="temporary" sx={drawerSx}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Schedule
        </Typography>
        <IconButton size="small" aria-label="close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </Stack>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
        {loadingConfigs ? (
          <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 4 }} />
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label="BY INTERVAL" />
              <Tab label="BY CRON" />
            </Tabs>

            {tab === 0 && (
              <Stack gap={2}>
                <Typography variant="body2" color="text.secondary">
                  Repeat beginning of every
                </Typography>
                <Stack direction="row" gap={2}>
                  <TextField type="number" value={intervalCount} onChange={(e) => setIntervalCount(Math.max(1, parseInt(e.target.value, 10) || 1))} inputProps={{ min: 1 }} sx={{ width: 120 }} />
                  <Select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)} sx={{ flex: 1 }}>
                    {INTERVAL_UNITS.map((u) => (
                      <MenuItem key={u} value={u}>
                        {u}
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>
                {description && (
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                )}
              </Stack>
            )}

            {tab === 1 && (
              <Stack gap={1.5}>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', textAlign: 'center', py: 0.5 }}>
                  {cronExpression}
                </Typography>
                {description && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {description}
                  </Typography>
                )}
                {CRON_FIELD_LABELS.map(({ key, label, placeholder }) => (
                  <Box key={key}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <TextField fullWidth size="small" placeholder={placeholder} value={cronFields[key as CronField]} onChange={(e) => setCronFields((prev) => ({ ...prev, [key]: e.target.value }))} />
                  </Box>
                ))}
                <Typography variant="caption" color="text.secondary">
                  * any value &nbsp; , separator for multiple values &nbsp; - range of values &nbsp; / step values
                </Typography>
              </Stack>
            )}

            <Box sx={{ mt: 2 }}>
              <Button variant="text" size="small" endIcon={advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} onClick={() => setAdvancedOpen((v) => !v)} sx={{ px: 0 }}>
                Advanced Settings
              </Button>
              <Collapse in={advancedOpen}>
                <Stack gap={2} sx={{ mt: 1.5 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      In Time Zone
                    </Typography>
                    <Autocomplete
                      options={TIMEZONE_OPTIONS}
                      value={TIMEZONE_OPTIONS.find((o) => o.value === timezone) ?? { label: getTimezoneLabel(timezone), value: timezone }}
                      onChange={(_, v) => setTimezone(v?.value ?? 'UTC')}
                      getOptionLabel={(o) => o.label}
                      isOptionEqualToValue={(o, v) => o.value === v.value}
                      renderInput={(params) => <TextField {...params} size="small" />}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
                      Execution Behavior
                    </Typography>
                    <Stack gap={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Job Timeout (in seconds)
                        </Typography>
                        <TextField fullWidth size="small" type="number" value={timeoutSeconds} onChange={(e) => setTimeoutSeconds(e.target.value)} placeholder="No timeout" inputProps={{ min: 0 }} />
                      </Box>
                      <FormControlLabel control={<Checkbox checked={allowConcurrency} onChange={(e) => setAllowConcurrency(e.target.checked)} size="small" />} label="Allow Overlapping Executions" />
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Attempt Count
                        </Typography>
                        <TextField fullWidth size="small" type="number" value={retryCount} onChange={(e) => setRetryCount(e.target.value)} placeholder="0" inputProps={{ min: 0 }} />
                      </Box>
                    </Stack>
                  </Box>
                </Stack>
              </Collapse>
            </Box>

            {saveError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {saveError}
              </Alert>
            )}
          </>
        )}
      </Box>

      {/* Footer */}
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Button onClick={onClose}>Back</Button>
        <Button variant="contained" onClick={handleSave} disabled={deployTrack.isPending || !deployment?.build?.buildId}>
          {deployTrack.isPending ? 'Updating…' : 'Update'}
        </Button>
      </Stack>
    </Drawer>
  );
}

export default function Environment({
  env,
  componentId,
  projectId: _projectId,
  componentType,
  displayType,
  componentHandler,
  projectHandler,
  orgHandler,
  versionId,
  deploymentPipelineId,
  latestCommit,
}: {
  env: Environment;
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
}) {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);

  const isAutomation = (displayType ?? '').toLowerCase() === 'scheduledtask';
  const queryClient = useQueryClient();
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [pendingTriggerTime, setPendingTriggerTime] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const deployTrack = useDeployDeploymentTrack();
  const envOrgUuid = useOrgUuid() ?? '';
  const { data: envDeployment, isLoading: loadingEnvDeployment } = useComponentDeployment(isAutomation ? orgHandler : '', isAutomation ? envOrgUuid : '', isAutomation ? componentId : '', isAutomation ? versionId : '', isAutomation ? env.id : '');
  const envReleaseId = envDeployment?.releaseId ?? '';
  const { data: scheduleConfig } = useExecutionConfigs(isAutomation ? componentId : '', isAutomation ? envReleaseId : '');
  const scheduleDescription = scheduleConfig?.cronjobFrequency ? `${describeCron(scheduleConfig.cronjobFrequency)}, in time zone ${scheduleConfig.cronjobTimezone || 'UTC'}` : null;
  const [scheduleSavedMessage, setScheduleSavedMessage] = useState<string | null>(null);

  // Next run countdown
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
      // When the countdown reaches 0, show a queued sentinel row (same as manual trigger)
      if (diff < 1000 && Date.now() - lastScheduledTriggerRef.current > 30000) {
        lastScheduledTriggerRef.current = Date.now();
        setPendingTriggerTime(Date.now());
        queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
      }
      setNextRunLabel(`Next run in ${formatTimeUntil(ms)}`);
    } else {
      setNextRunLabel(null);
    }
  }, [cronFreq, setPendingTriggerTime, queryClient]);
  useEffect(() => {
    updateNextRun();
    const timer = setInterval(updateNextRun, 1000);
    return () => clearInterval(timer);
  }, [updateNextRun]);

  const generateSecretMutation = useGenerateComponentEnvironmentJwtSecret();
  const rotateSecretMutation = useRotateComponentEnvironmentJwtSecret();

  // The currently displayed secret — updated by both generate and rotate.
  const activeSecret = rotateSecretMutation.data ?? generateSecretMutation.data ?? '';
  const secretLoading = generateSecretMutation.isPending || rotateSecretMutation.isPending;
  const secretError = generateSecretMutation.error?.message ?? rotateSecretMutation.error?.message ?? null;

  const handleOpenConfigDialog = () => {
    setConfigDialogOpen(true);
    // Fetch existing secret (or provision one if this is the first time).
    generateSecretMutation.mutate({ componentId, environmentId: env.id });
  };

  const handleRotateSecret = () => {
    setRotateConfirmOpen(false);
    rotateSecretMutation.mutate({ componentId, environmentId: env.id });
  };

  const generateTomlConfig = (secret: string) => {
    // Runtime ID is not yet known until the runtime first registers.
    const runtimeId = '<Runtime ID>';

    const isBallerinaRuntime = componentType === 'BI' || isAutomation || (displayType ?? '') === 'integrationAsApi';
    if (isBallerinaRuntime) {
      return `[ballerinax.wso2.icp]
runtime="${runtimeId}"
integration="${componentHandler}"
project="${projectHandler}"
environment="${env.name}"
heartbeatInterval=10
secret="${secret || '<generating…>'}"\n# serverUrl="https://localhost:9445"`;
    } else {
      // MI
      return `[icp_config]
enabled = true
runtime = "${runtimeId}"
environment = "${env.name}"
project = "${projectHandler}"
integration = "${componentHandler}"
secret = "${secret || '<generating…>'}"\n# icp_url = "https://icp-server:9443"`;
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateTomlConfig(activeSecret));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {/* Left: env name + commit info + Configure */}
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
              {env.name}
            </Typography>
            {latestCommit && (
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  {latestCommit.sha.substring(0, 7)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {latestCommit.message}
                </Typography>
              </Stack>
            )}
            <Authorized permissions={Permissions.INTEGRATION_MANAGE}>
              <Button variant="outlined" size="small" startIcon={<Settings size={14} />} onClick={handleOpenConfigDialog}>
                Configure
              </Button>
            </Authorized>
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
              <Authorized permissions={Permissions.INTEGRATION_MANAGE}>
                <Button variant="outlined" size="small" startIcon={<CalendarClock size={14} />} onClick={() => setScheduleDialogOpen(true)}>
                  Schedule
                </Button>
              </Authorized>
              <Button
                variant="contained"
                size="small"
                startIcon={<Play size={14} />}
                disabled={!envDeployment?.build?.buildId || deployTrack.isPending}
                onClick={() =>
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
                  )
                }>
                {env.critical ? 'Run' : 'Test'}
              </Button>
              <Tooltip title="Refresh">
                <IconButton
                  size="small"
                  disabled={isRefreshing}
                  aria-label="Refresh"
                  onClick={async () => {
                    setIsRefreshing(true);
                    try {
                      await Promise.all([queryClient.invalidateQueries({ queryKey: ['deploymentStatus', componentId, versionId] }), queryClient.invalidateQueries({ queryKey: ['taskExecutions'] })]);
                    } finally {
                      setTimeout(() => setIsRefreshing(false), 500);
                    }
                  }}>
                  <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none', transformOrigin: 'center' }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>
        <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Configure Runtime - {env.name}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>Add the following configuration to your runtime's {componentType === 'BI' || isAutomation || (displayType ?? '') === 'integrationAsApi' ? 'Config.toml' : 'deployment.toml'} file:</DialogContentText>
            {secretError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {secretError}
              </Alert>
            )}
            <Box
              component="pre"
              sx={{
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100'),
                color: (theme) => theme.palette.text.primary,
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: 13,
                border: '1px solid',
                borderColor: 'divider',
                opacity: secretLoading ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}>
              {secretLoading ? 'Loading configuration…' : generateTomlConfig(activeSecret)}
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ mt: 1 }}>
              <Authorized permissions={Permissions.INTEGRATION_MANAGE}>
                <Tooltip title="Generate a new secret. Existing runtimes must be restarted with the new value.">
                  <span>
                    <Button size="small" color="error" variant="outlined" startIcon={<ShieldAlert size={14} />} disabled={secretLoading} onClick={() => setRotateConfirmOpen(true)}>
                      Rotate Secret
                    </Button>
                  </span>
                </Tooltip>
              </Authorized>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigDialogOpen(false)}>Close</Button>
            <Button variant="contained" startIcon={copySuccess ? <Check size={16} /> : <Copy size={16} />} onClick={handleCopyToClipboard} disabled={secretLoading || !activeSecret}>
              {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Rotate-secret confirmation dialog */}
        <Dialog open={rotateConfirmOpen} onClose={() => setRotateConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Rotate JWT Secret?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will generate a new HMAC secret for <strong>{env.name}</strong>. Any running runtimes will stop authenticating until they are restarted with the new <code>secret</code> value.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRotateConfirmOpen(false)}>Cancel</Button>
            <Authorized permissions={Permissions.INTEGRATION_MANAGE}>
              <Button variant="contained" color="error" startIcon={<ShieldAlert size={16} />} onClick={handleRotateSecret} disabled={rotateSecretMutation.isPending}>
                {rotateSecretMutation.isPending ? 'Rotating…' : 'Rotate'}
              </Button>
            </Authorized>
          </DialogActions>
        </Dialog>
        {isAutomation && (
          <ScheduleDialog
            open={scheduleDialogOpen}
            onClose={() => setScheduleDialogOpen(false)}
            onSaveSuccess={() => setScheduleSavedMessage('Schedule updated successfully')}
            envId={env.id}
            envName={env.name}
            componentId={componentId}
            orgHandler={orgHandler}
            versionId={versionId}
            deploymentPipelineId={deploymentPipelineId}
          />
        )}
        <Divider sx={{ my: 2 }} />
        {isAutomation && envDeployment && scheduleDescription && (
          <Box sx={{ bgcolor: 'action.selected', borderRadius: 1, px: 2, py: 1, mb: 2 }}>
            <Typography variant="body2">{scheduleDescription}</Typography>
          </Box>
        )}
        {isAutomation && !loadingEnvDeployment && envDeployment && (
          <AutomationExecutions
            releaseId={envReleaseId}
            orgHandler={orgHandler}
            projectHandler={projectHandler}
            componentHandler={componentHandler}
            envCritical={env.critical ?? false}
            deploymentStatusV2={envDeployment?.deploymentStatusV2}
            pendingTriggerTime={pendingTriggerTime}
            onTriggerResolved={() => setPendingTriggerTime(null)}
          />
        )}
        {isAutomation && !loadingEnvDeployment && !envDeployment && <DeploymentNotice hasDeployment={false} envCritical={!!env.critical} />}
      </CardContent>
      <Snackbar open={triggerMessage !== null} autoHideDuration={4000} onClose={() => setTriggerMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setTriggerMessage(null)} severity="success" sx={{ width: '100%' }}>
          {triggerMessage}
        </Alert>
      </Snackbar>
      <Snackbar open={scheduleSavedMessage !== null} autoHideDuration={4000} onClose={() => setScheduleSavedMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setScheduleSavedMessage(null)} severity="success" sx={{ width: '100%' }}>
          {scheduleSavedMessage}
        </Alert>
      </Snackbar>
    </Card>
  );
}
