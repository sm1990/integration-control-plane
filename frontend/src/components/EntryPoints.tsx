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

import { Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, IconButton, InputAdornment, Stack, Switch, TextField, Typography } from '@wso2/oxygen-ui';
import { RefreshCw, ListFilter, LayoutGrid } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useArtifacts, useRefreshEnvironmentArtifacts, type GqlArtifact, type GqlEnvironment } from '../api/queries';
import { useUpdateArtifactTracingStatus, useUpdateArtifactStatisticsStatus } from '../api/artifactToggleMutations';
import { ArtifactApiDefinition, ServiceResources } from './ArtifactTabs';
import { ArtifactTypeSelector } from './ArtifactDetail';
import { ARTIFACT_TABS, DEFAULT_ARTIFACT_TABS, ENTRY_POINT_CONFIG, ENTRY_POINT_DETAIL_TABS, type SelectedArtifact, type TabProps } from './artifact-config';

function EntryPointDetail({ selected, onOpenDrawerTab }: { selected: SelectedArtifact; onOpenDrawerTab: (tab: string) => void }) {
  const [tracingEnabled, setTracingEnabled] = useState(false);
  const [statisticsEnabled, setStatisticsEnabled] = useState(false);
  const { artifact, artifactType, envId, componentId, projectId } = selected;
  const updateTracingStatus = useUpdateArtifactTracingStatus();
  const updateStatisticsStatus = useUpdateArtifactStatisticsStatus();
  const config = ENTRY_POINT_CONFIG[artifactType];
  const tabProps: TabProps = { artifact, artifactType, envId, componentId, projectId };
  const carbonApp = artifact.carbonApp?.toString();
  const drawerTabs = ARTIFACT_TABS[artifactType] ?? DEFAULT_ARTIFACT_TABS;
  const overviewFields = (config?.overviewFields ?? '').split(', ').filter(Boolean);
  const showTracingToggle = ['RestApi', 'ProxyService', 'InboundEndpoint'].includes(artifactType);
  const showStatisticsToggle = ['RestApi', 'ProxyService', 'InboundEndpoint'].includes(artifactType);
  const toEnabled = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    const normalized = (value ?? '').toString().toLowerCase();
    return normalized === 'enabled' || normalized === 'active' || normalized === 'true';
  };

  const artifactKey = `${artifactType}-${artifact.name}`;
  useEffect(() => {
    setTracingEnabled(toEnabled(artifact.tracing));
    setStatisticsEnabled(toEnabled(artifact.statistics));
  }, [artifactKey, artifact.tracing, artifact.statistics]);

  const handleToggleTracing = (checked: boolean) => {
    if (!showTracingToggle) return;
    setTracingEnabled(checked);
    updateTracingStatus.mutate({
      envId,
      componentId,
      artifactType,
      artifactName: artifact.name?.toString() ?? '',
      trace: checked ? 'enable' : 'disable',
    });
  };

  const handleToggleStatistics = (checked: boolean) => {
    if (!showStatisticsToggle) return;
    setStatisticsEnabled(checked);
    updateStatisticsStatus.mutate({
      envId,
      componentId,
      artifactType,
      artifactName: artifact.name?.toString() ?? '',
      statistics: checked ? 'enable' : 'disable',
    });
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Header row */}
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 2, py: 1.5 }}>
        {carbonApp && <Chip label={`C-App: ${carbonApp}`} size="small" variant="outlined" sx={{ bgcolor: '#e8eaf6', color: '#3949ab', fontSize: 11 }} />}
        {carbonApp && <Divider orientation="vertical" flexItem />}
        {showTracingToggle && (
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">
              Tracing
            </Typography>
            <Switch size="small" checked={tracingEnabled} onChange={(e) => handleToggleTracing(e.target.checked)} disabled={updateTracingStatus.isPending} aria-label="Enable tracing" />
          </Stack>
        )}
        {showTracingToggle && showStatisticsToggle && <Divider orientation="vertical" flexItem />}
        {showStatisticsToggle && (
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">
              Statistics
            </Typography>
            <Switch size="small" checked={statisticsEnabled} onChange={(e) => handleToggleStatistics(e.target.checked)} disabled={updateStatisticsStatus.isPending} aria-label="Enable statistics" />
          </Stack>
        )}
        <Stack direction="row" gap={1} sx={{ ml: 'auto' }}>
          {drawerTabs.map((tab) => (
            <Button key={tab} variant="outlined" size="small" onClick={() => onOpenDrawerTab(tab)}>
              View {tab}
            </Button>
          ))}
        </Stack>
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
    </Box>
  );
}

function EntryPointsList({ envId, componentId, projectId, componentType, onOpenDrawer }: { envId: string; componentId: string; projectId: string; componentType: string; onOpenDrawer: (a: GqlArtifact, type: string, envId: string, tab: string) => void }) {
  const [selectedKey, setSelectedKey] = useState('');
  const isMI = componentType === 'MI';

  const { data: apis = [], isLoading: loadingApis } = useArtifacts('RestApi', envId, componentId, { enabled: isMI });
  const { data: proxies = [], isLoading: loadingProxies } = useArtifacts('ProxyService', envId, componentId, { enabled: isMI });
  const { data: inboundEps = [], isLoading: loadingInbound } = useArtifacts('InboundEndpoint', envId, componentId, { enabled: isMI });
  const { data: tasks = [], isLoading: loadingTasks } = useArtifacts('Task', envId, componentId, { enabled: isMI });
  const { data: services = [], isLoading: loadingServices } = useArtifacts('Service', envId, componentId, { enabled: !isMI });
  const { data: listeners = [], isLoading: loadingListeners } = useArtifacts('Listener', envId, componentId, { enabled: !isMI });

  const isLoading = isMI ? loadingApis || loadingProxies || loadingInbound || loadingTasks : loadingServices || loadingListeners;

  const allEntryPoints = useMemo(
    () =>
      isMI
        ? [...apis.map((a) => ({ artifact: a, type: 'RestApi' })), ...proxies.map((a) => ({ artifact: a, type: 'ProxyService' })), ...inboundEps.map((a) => ({ artifact: a, type: 'InboundEndpoint' })), ...tasks.map((a) => ({ artifact: a, type: 'Task' }))]
        : [...services.map((a) => ({ artifact: a, type: 'Service' })), ...listeners.map((a) => ({ artifact: a, type: 'Listener' }))],
    [isMI, apis, proxies, inboundEps, tasks, services, listeners],
  );

  const allKeys = new Set(allEntryPoints.map(({ artifact: a, type }) => `${type}::${a.name}`));
  const firstKey = allEntryPoints.length > 0 ? `${allEntryPoints[0].type}::${allEntryPoints[0].artifact.name}` : '';
  const activeKey = selectedKey && allKeys.has(selectedKey) ? selectedKey : firstKey;
  const selectedEntry = useMemo(() => allEntryPoints.find(({ artifact: a, type }) => `${type}::${a.name}` === activeKey), [allEntryPoints, activeKey]);

  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
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
        onChange={(_, newValue) => setSelectedKey(newValue ? `${newValue.type}::${newValue.artifact.name}` : '')}
        options={allEntryPoints}
        autoHighlight
        fullWidth
        getOptionLabel={(option) => option.artifact.name?.toString() ?? ''}
        isOptionEqualToValue={(a, b) => a.type === b.type && a.artifact.name === b.artifact.name}
        renderOption={(props, { artifact: a, type }) => {
          const { key, ...optionProps } = props;
          const cfg = ENTRY_POINT_CONFIG[type];
          const meta = cfg?.metaField ? a[cfg.metaField]?.toString() : undefined;
          return (
            <Box key={key} component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} {...optionProps}>
              <Chip label={cfg?.label} size="small" sx={{ bgcolor: cfg?.bgColor, color: cfg?.color, fontWeight: 700, fontSize: 11, minWidth: 60, justifyContent: 'center' }} />
              <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                {a.name?.toString()}
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

export default function Environment({
  env,
  componentId,
  projectId,
  componentType,
  onSelectArtifact,
  onOpenDrawerForTab,
}: {
  env: GqlEnvironment;
  componentId: string;
  projectId: string;
  componentType: string;
  onSelectArtifact: (a: GqlArtifact, type: string, envId: string) => void;
  onOpenDrawerForTab: (a: GqlArtifact, type: string, envId: string, tab: string) => void;
}) {
  const refreshEnvironmentArtifacts = useRefreshEnvironmentArtifacts();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'entryPoints' | 'allArtifacts'>('entryPoints');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshEnvironmentArtifacts(env.id, componentId);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {env.name}
          </Typography>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton size="small" onClick={handleRefresh} disabled={isRefreshing} aria-label="Refresh">
              <RefreshCw
                size={16}
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  transformOrigin: 'center',
                }}
              />
            </IconButton>
            <Button variant="contained">Configure Runtime</Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        {componentType === 'MI' && (
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row">
              <Button variant={viewMode === 'entryPoints' ? 'contained' : 'outlined'} size="small" startIcon={<ListFilter size={14} />} onClick={() => setViewMode('entryPoints')} sx={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
                Entry Points
              </Button>
              <Button variant={viewMode === 'allArtifacts' ? 'contained' : 'outlined'} size="small" startIcon={<LayoutGrid size={14} />} onClick={() => setViewMode('allArtifacts')} sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, ml: '-1px' }}>
                Supporting Artifacts
              </Button>
            </Stack>
          </Stack>
        )}
        {(componentType !== 'MI' || viewMode === 'entryPoints') && <EntryPointsList envId={env.id} componentId={componentId} projectId={projectId} componentType={componentType} onOpenDrawer={onOpenDrawerForTab} />}
        {componentType === 'MI' && viewMode === 'allArtifacts' && <ArtifactTypeSelector envId={env.id} componentId={componentId} onSelectArtifact={onSelectArtifact} />}
      </CardContent>
    </Card>
  );
}
