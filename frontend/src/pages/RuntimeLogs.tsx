import { Button, Checkbox, Chip, CircularProgress, FormControlLabel, List, ListItemButton, ListItemText, MenuItem, PageContent, Select, Stack, Typography } from '@wso2/oxygen-ui';
import { RefreshCw, ScrollText } from '@wso2/oxygen-ui-icons-react';
import { useMemo, useState, type JSX } from 'react';
import { useComponentByHandler, useComponents, useEnvironments, useRuntimes } from '../api/queries';
import { useLogs, type LogsRequest } from '../api/logs';
import EmptyListing from '../components/EmptyListing';
import NotFound from '../components/NotFound';
import SearchField from '../components/SearchField';
import { resourceUrl, broaden, hasComponent, type ProjectScope, type ComponentScope } from '../nav';


const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'] as const;
const TIME_RANGES: Record<string, number> = {
  'Past 1 hour': 1,
  'Past 6 hours': 6,
  'Past 24 hours': 24,
  'Past 7 days': 168,
};

function levelColor(level: string): 'info' | 'warning' | 'error' | 'default' {
  if (level === 'ERROR') return 'error';
  if (level === 'WARN') return 'warning';
  if (level === 'INFO') return 'info';
  return 'default';
}

export default function RuntimeLogs(scope: ProjectScope | ComponentScope): JSX.Element {
  const { data: singleComponent, isLoading: loadingComponent } = useComponentByHandler(scope.project, hasComponent(scope) ? scope.component : undefined);
  const { data: allComponents = [], isLoading: loadingComponents } = useComponents(scope.org, scope.project);
  const { data: environments = [], isLoading: loadingEnvironments } = useEnvironments(scope.project);

  const componentIds = hasComponent(scope) ? (singleComponent ? [singleComponent.id] : []) : allComponents.map((c) => c.id);

  const [envFilter, setEnvFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [runtimeFilter, setRuntimeFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('Past 24 hours');
  const [searchPhrase, setSearchPhrase] = useState('');
  const [autoFetch, setAutoFetch] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const effectiveEnvId = envFilter || environments[0]?.id || '';
  const selectedEnv = environments.find((e) => e.id === effectiveEnvId);
  const componentIdsKey = componentIds.join(',');

  const { data: runtimes = [] } = useRuntimes(effectiveEnvId, scope.project, hasComponent(scope) && singleComponent ? singleComponent.id : '');

  const logsRequest = useMemo<LogsRequest | null>(() => {
    if (componentIds.length === 0 || !selectedEnv) return null;
    const hours = TIME_RANGES[timeRange] ?? 24;
    const now = new Date();
    return {
      componentIdList: componentIds,
      environmentId: selectedEnv.id,
      environmentList: [selectedEnv.name],
      logLevels: levelFilter === 'all' ? [] : [levelFilter],
      startTime: new Date(now.getTime() - hours * 3600_000).toISOString(),
      endTime: now.toISOString(),
      limit: 100,
      sort: 'desc',
      region: 'us-west-2',
      searchPhrase,
    };
    // componentIdsKey stabilizes componentIds (array ref changes every render)
  }, [componentIdsKey, selectedEnv, levelFilter, timeRange, searchPhrase]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: logs = [], isLoading, error, refetch } = useLogs(logsRequest);

  const filteredLogs = runtimeFilter === 'all' ? logs : logs.filter((l) => l.entry.includes(runtimeFilter));

  const toggle = (i: number) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const loadingContext = hasComponent(scope) ? loadingComponent : loadingComponents;
  if (loadingContext || loadingEnvironments) {
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  }
  if (hasComponent(scope) && !singleComponent) {
    return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;
  }
  if (!hasComponent(scope) && allComponents.length === 0) {
    return (
      <PageContent>
        <EmptyListing icon={<ScrollText size={48} />} title="No components" description="Add a component to view runtime logs." />
      </PageContent>
    );
  }
  if (componentIds.length > 0 && environments.length === 0) {
    return (
      <PageContent>
        <EmptyListing icon={<ScrollText size={48} />} title="No environments" description="Configure an environment to view runtime logs." />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Runtime Logs
        </Typography>
        <Chip label={timeRange} size="small" aria-label="Time range" />
      </Stack>

      <Stack direction="row" gap={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
        <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as string)} size="small" sx={{ minWidth: 120 }} aria-label="Log level">
          <MenuItem value="all">All Levels</MenuItem>
          {LOG_LEVELS.map((l) => (
            <MenuItem key={l} value={l}>
              {l}
            </MenuItem>
          ))}
        </Select>

        {environments.length > 0 && (
          <Select value={effectiveEnvId} onChange={(e) => setEnvFilter(e.target.value as string)} size="small" sx={{ minWidth: 140 }} aria-label="Environment">
            {environments.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name}
              </MenuItem>
            ))}
          </Select>
        )}

        <Select value={runtimeFilter} onChange={(e) => setRuntimeFilter(e.target.value as string)} size="small" sx={{ minWidth: 140 }} aria-label="Runtime">
          <MenuItem value="all">All Runtimes</MenuItem>
          {runtimes.map((r) => (
            <MenuItem key={r.runtimeId} value={r.runtimeId}>
              {r.runtimeId.slice(0, 12)}...
            </MenuItem>
          ))}
        </Select>

        <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as string)} size="small" sx={{ minWidth: 160 }} aria-label="Time range selector">
          {Object.keys(TIME_RANGES).map((k) => (
            <MenuItem key={k} value={k}>
              {k}
            </MenuItem>
          ))}
        </Select>

        <SearchField value={searchPhrase} onChange={setSearchPhrase} placeholder="Search logs..." sx={{ minWidth: 200, flex: 1 }} />
      </Stack>

      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <FormControlLabel control={<Checkbox checked={autoFetch} onChange={(_, v) => setAutoFetch(v)} size="small" />} label="Auto Fetch" />
        <Button variant="outlined" size="small" onClick={() => refetch()} disabled={!logsRequest} startIcon={<RefreshCw size={14} />}>
          Load latest logs
        </Button>
      </Stack>

      {isLoading ? (
        <CircularProgress size={28} sx={{ display: 'block', mx: 'auto', my: 6 }} />
      ) : error ? (
        <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
          <Typography color="error" textAlign="center">
            Failed to fetch logs: {(error as Error).message ?? 'Service unavailable'}
          </Typography>
          <Button variant="contained" startIcon={<RefreshCw size={16} />} onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      ) : filteredLogs.length === 0 ? (
        <EmptyListing icon={<ScrollText size={48} />} title="No logs found" description="Try a different time range or filters." />
      ) : (
        <List disablePadding sx={{ fontFamily: 'monospace', fontSize: 13 }}>
          {filteredLogs.map((log, i) => (
            <ListItemButton key={i} onClick={() => toggle(i)} aria-label={`Log entry ${i}`} sx={{ borderBottom: '1px solid', borderColor: 'divider', flexDirection: 'column', alignItems: 'stretch' }}>
              <Stack direction="row" gap={2} alignItems="center">
                <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </Typography>
                <Chip label={log.level} size="small" color={levelColor(log.level)} sx={{ fontFamily: 'monospace', height: 20, fontSize: 11 }} />
                <Typography variant="caption" color="text.secondary">
                  {selectedEnv!.name}
                </Typography>
                <ListItemText primary={log.entry} primaryTypographyProps={{ variant: 'caption', sx: { fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }} sx={{ flex: 1, minWidth: 0 }} />
              </Stack>
              {expanded.has(i) && (
                <Typography component="pre" variant="body2" sx={{ mt: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
                  {log.entry}
                  {log.context != null ? `\n\nContext: ${JSON.stringify(log.context, null, 2)}` : ''}
                </Typography>
              )}
            </ListItemButton>
          ))}
        </List>
      )}
    </PageContent>
  );
}
