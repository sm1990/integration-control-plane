import { Button, Checkbox, Chip, CircularProgress, FormControlLabel, List, ListItemButton, IconButton, ListItemText, MenuItem, PageContent, Select, Stack, TextField, Tooltip, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronRight, Copy, Download, RefreshCw, ScrollText, X } from '@wso2/oxygen-ui-icons-react';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useProjectByHandler, useComponentByHandler, useComponents, useEnvironments, useRuntimes } from '../api/queries';
import { useLogs, type LogRow, type LogsRequest } from '../api/logs';
import EmptyListing from '../components/EmptyListing';
import NotFound from '../components/NotFound';
import SearchField from '../components/SearchField';
import { resourceUrl, broaden, hasComponent, type ProjectScope, type ComponentScope } from '../nav';

const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'] as const;

// value in hours; 'custom' handled separately
const TIME_PRESETS: { label: string; hours: number }[] = [
  { label: 'Past 10 minutes', hours: 1 / 6 },
  { label: 'Past 30 minutes', hours: 0.5 },
  { label: 'Past 1 hour', hours: 1 },
  { label: 'Past 24 hours', hours: 24 },
  { label: 'Past 7 days', hours: 168 },
  { label: 'Past 30 days', hours: 720 },
];
const DEFAULT_HOURS = 720; // 30 days fallback when filter cleared
const AUTO_FETCH_INTERVAL = 10_000;
const PAGE_SIZE = 100;

const LEVEL_COLORS: Record<string, string> = { ERROR: '#e53935', WARN: '#f9a825', INFO: '#1e88e5', DEBUG: '#78909c' };

const DISPLAY_FIELDS: { key: keyof LogRow; label: string }[] = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'level', label: 'Log Level' },
  { key: 'logLine', label: 'Log Entry' },
  { key: 'class', label: 'Class' },
  { key: 'logFilePath', label: 'Log File Path' },
  { key: 'appName', label: 'App Name' },
  { key: 'module', label: 'Module' },
  { key: 'serviceType', label: 'Service Type' },
  { key: 'app', label: 'App' },
  { key: 'deployment', label: 'Deployment' },
  { key: 'artifactContainer', label: 'Artifact Container' },
  { key: 'product', label: 'Product' },
  { key: 'icpRuntimeId', label: 'Runtime ID' },
  { key: 'logContext', label: 'Log Context' },
  { key: 'componentVersion', label: 'Component Version' },
  { key: 'componentVersionId', label: 'Component Version ID' },
];

function levelColor(level: string): string {
  return LEVEL_COLORS[level] ?? '#78909c';
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function copyLog(log: LogRow) {
  const text = `${new Date(log.timestamp).toLocaleString()} [${log.level}] ${log.logLine}`;
  navigator.clipboard.writeText(text);
}

function downloadLogs(logs: LogRow[]) {
  const text = logs.map((l) => `${new Date(l.timestamp).toLocaleString()} [${l.level}] ${l.logLine}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convert a Date to a datetime-local input value (YYYY-MM-DDTHH:MM) */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LogEntry({ log, expanded, onToggle }: { log: LogRow; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        onClick={onToggle}
        sx={{
          fontFamily: 'monospace',
          fontSize: 12,
          px: 0.5,
          py: 0.25,
          cursor: 'pointer',
          borderRadius: 1,
          minHeight: 32,
          '&:hover': { bgcolor: 'action.hover' },
          '&:hover .log-actions': { visibility: 'visible' },
        }}>
        <IconButton size="small" sx={{ p: 0, mr: 0.5 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </IconButton>
        <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, color: levelColor(log.level), whiteSpace: 'nowrap', mr: 1 }}>
          {new Date(log.timestamp).toLocaleString()}
        </Typography>
        <Chip label={log.level} size="small" sx={{ fontFamily: 'monospace', fontSize: 10, height: 18, mr: 1, bgcolor: levelColor(log.level), color: '#fff', fontWeight: 700 }} />
        {log.serviceType && (
          <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', mr: 1 }}>
            {log.serviceType}
          </Typography>
        )}
        <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {log.logLine}
        </Typography>
        <Stack direction="row" className="log-actions" sx={{ visibility: 'hidden', ml: 1, flexShrink: 0 }}>
          <Tooltip title="Copy">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                copyLog(log);
              }}>
              <Copy size={14} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      {expanded && (
        <Stack sx={{ pl: 5, pb: 1, fontFamily: 'monospace', fontSize: 12, bgcolor: 'background.default', borderRadius: 1, mx: 0.5, mb: 0.5 }}>
          {DISPLAY_FIELDS.map(({ key, label }) => {
            const val = formatValue(log[key]);
            if (!val) return null;
            return (
              <Stack key={key} direction="row" sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 0.5, gap: 2 }}>
                <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, minWidth: 160, flexShrink: 0 }}>
                  {label}
                </Typography>
                <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {key === 'timestamp' ? new Date(val).toLocaleString() : val}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </>
  );
}

export default function RuntimeLogs(scope: ProjectScope | ComponentScope): JSX.Element {
  const { data: project, isLoading: loadingProject } = useProjectByHandler(scope.project);
  const projectId = project?.id ?? '';
  const { data: singleComponent, isLoading: loadingComponent } = useComponentByHandler(projectId, hasComponent(scope) ? scope.component : undefined);
  const { data: allComponents = [], isLoading: loadingComponents } = useComponents(scope.org, projectId);
  const { data: environments = [], isLoading: loadingEnvironments } = useEnvironments(projectId);

  const allComponentIds = hasComponent(scope) ? (singleComponent ? [singleComponent.id] : []) : allComponents.map((c) => c.id);

  const [integrationFilter, setIntegrationFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [timePreset, setTimePreset] = useState<string>('Past 24 hours');
  const [customStart, setCustomStart] = useState(() => toLocalInput(new Date(Date.now() - 24 * 3600_000)));
  const [customEnd, setCustomEnd] = useState(() => toLocalInput(new Date()));
  const [searchPhrase, setSearchPhrase] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [autoFetch, setAutoFetch] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const componentIds = !hasComponent(scope) && integrationFilter !== 'all' ? [integrationFilter] : allComponentIds;

  const selectedEnvIds = envFilter.length > 0 ? envFilter : environments.map((e) => e.id);
  const selectedEnvs = environments.filter((e) => selectedEnvIds.includes(e.id));
  const primaryEnv = selectedEnvs[0];
  const componentIdsKey = componentIds.join(',');
  const envIdsKey = selectedEnvIds.join(',');
  const levelFilterKey = levelFilter.join(',');

  const { data: runtimes = [] } = useRuntimes(effectiveEnvId, projectId, hasComponent(scope) && singleComponent ? singleComponent.id : '');

  const logsRequest = useMemo<LogsRequest | null>(() => {
    if (componentIds.length === 0 || !primaryEnv) return null;
    const envNames = environments.filter((e) => selectedEnvIds.includes(e.id)).map((e) => e.name);
    let startTime: string;
    let endTime: string;
    if (timePreset === 'custom') {
      startTime = new Date(customStart).toISOString();
      endTime = new Date(customEnd).toISOString();
    } else {
      const preset = TIME_PRESETS.find((p) => p.label === timePreset);
      const hours = preset?.hours ?? DEFAULT_HOURS;
      const now = new Date();
      startTime = new Date(now.getTime() - hours * 3600_000).toISOString();
      endTime = now.toISOString();
    }
    return {
      componentIdList: componentIds,
      environmentId: primaryEnv.id,
      environmentList: envNames,
      logLevels: levelFilter,
      startTime,
      endTime,
      limit: PAGE_SIZE,
      sort: sortDir,
      region: 'US',
      searchPhrase,
    };
    // componentIdsKey / envIdsKey / levelFilterKey stabilize array refs (new array every render)
  }, [componentIdsKey, envIdsKey, levelFilterKey, timePreset, customStart, customEnd, searchPhrase, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteLogs(logsRequest, autoFetch ? AUTO_FETCH_INTERVAL : false);

  const logs = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filteredLogs = logs;

  const toggle = (i: number) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // Infinite scroll: observe the sentinel at the bottom of the list
  const sentinelRef = useRef<HTMLDivElement>(null);
  const handleScroll = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 200) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const loadingContext = hasComponent(scope) ? loadingComponent : loadingComponents;
  if (loadingProject || loadingContext || loadingEnvironments) {
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
        {!hasComponent(scope) && (
          <Select value={integrationFilter} onChange={(e) => setIntegrationFilter(e.target.value as string)} size="small" sx={{ minWidth: 200 }} aria-label="Integration">
            <MenuItem value="all">All Integrations</MenuItem>
            {allComponents.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.displayName || c.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Stack>

      <Stack direction="row" gap={1.5} sx={{ mb: 1 }} flexWrap="wrap" alignItems="center">
        {environments.length > 0 && (
          <Select
            multiple
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value as string[])}
            displayEmpty
            renderValue={(selected) => {
              const sel = selected as string[];
              if (sel.length === 0) return 'All Environments';
              return environments
                .filter((env) => sel.includes(env.id))
                .map((env) => env.name)
                .join(', ');
            }}
            size="small"
            sx={{ minWidth: 160 }}
            aria-label="Environment">
            {environments.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                <Checkbox checked={envFilter.includes(e.id)} size="small" sx={{ p: 0, mr: 1 }} />
                <ListItemText primary={e.name} />
              </MenuItem>
            ))}
          </Select>
        )}

        <Select
          multiple
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as string[])}
          displayEmpty
          renderValue={(selected) => {
            const sel = selected as string[];
            if (sel.length === 0) return 'All Levels';
            return sel.join(', ');
          }}
          size="small"
          sx={{ minWidth: 120 }}
          aria-label="Log level">
          {LOG_LEVELS.map((l) => (
            <MenuItem key={l} value={l}>
              <Checkbox checked={levelFilter.includes(l)} size="small" sx={{ p: 0, mr: 1 }} />
              <ListItemText primary={l} />
            </MenuItem>
          ))}
        </Select>

        <Stack direction="row" alignItems="center" gap={0.5}>
          <Select
            value={timePreset}
            onChange={(e) => {
              const v = e.target.value as string;
              setTimePreset(v);
              if (v === 'custom') {
                setCustomEnd(toLocalInput(new Date()));
                setCustomStart(toLocalInput(new Date(Date.now() - 24 * 3600_000)));
              }
            }}
            size="small"
            sx={{ minWidth: 160 }}
            aria-label="Time range">
            {TIME_PRESETS.map((p) => (
              <MenuItem key={p.label} value={p.label}>
                {p.label}
              </MenuItem>
            ))}
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
          {timePreset !== '' && (
            <Tooltip title="Clear time filter (defaults to 30 days)">
              <IconButton size="small" onClick={() => setTimePreset('')}>
                <X size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <Select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')} size="small" sx={{ minWidth: 120 }} aria-label="Sort direction">
          <MenuItem value="desc">Newest first</MenuItem>
          <MenuItem value="asc">Oldest first</MenuItem>
        </Select>

        <SearchField value={searchPhrase} onChange={setSearchPhrase} placeholder="Search logs..." sx={{ minWidth: 200, flex: 1 }} />

        <FormControlLabel control={<Checkbox checked={autoFetch} onChange={(_, c) => setAutoFetch(c)} size="small" />} label="Auto Fetch" sx={{ mr: 0, whiteSpace: 'nowrap' }} slotProps={{ typography: { variant: 'body2' } }} />
        <Tooltip title="Download logs">
          <span>
            <IconButton size="small" onClick={() => downloadLogs(filteredLogs)} disabled={filteredLogs.length === 0}>
              <Download size={18} />
            </IconButton>
          </span>
        </Tooltip>
        <Button variant="outlined" size="small" onClick={() => refetch()} disabled={!logsRequest} startIcon={<RefreshCw size={14} />}>
          Refresh
        </Button>
      </Stack>

      {timePreset === 'custom' && (
        <Stack direction="row" gap={1.5} sx={{ mb: 2 }} alignItems="center">
          <TextField type="datetime-local" size="small" label="Start" value={customStart} onChange={(e) => setCustomStart(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="datetime-local" size="small" label="End" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant="contained" size="small" onClick={() => refetch()}>
            Apply
          </Button>
        </Stack>
      )}

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
        <Stack ref={scrollContainerRef} sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
          {filteredLogs.map((log, i) => (
            <LogEntry key={i} log={log} expanded={expanded.has(i)} onToggle={() => toggle(i)} />
          ))}
          <div ref={sentinelRef} />
          {isFetchingNextPage && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 1 }} />}
          {!hasNextPage && filteredLogs.length > 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 1 }}>
              End of logs
            </Typography>
          )}
        </Stack>
      )}
    </PageContent>
  );
}
