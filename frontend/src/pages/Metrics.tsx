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
import { Button, Card, CardContent, Checkbox, CircularProgress, Grid, IconButton, ListItemText, MenuItem, PageContent, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@wso2/oxygen-ui';
import { LineChart } from '@wso2/oxygen-ui-charts-react';
import { BarChart3, RefreshCw } from '@wso2/oxygen-ui-icons-react';
import { useMemo, useState, type JSX } from 'react';
import { useComponentByHandler, useComponents, useEnvironments } from '../api/queries';
import { useMetrics, type MetricEntry, type MetricsRequest } from '../api/metrics';
import EmptyListing from '../components/EmptyListing';
import NotFound from '../components/NotFound';
import { resourceUrl, broaden, hasComponent, type ProjectScope, type ComponentScope } from '../nav';

const TIME_RANGES: Record<string, number> = { 'Past 1 hour': 1, 'Past 6 hours': 6, 'Past 24 hours': 24, 'Past 7 days': 168 };
const RESOLUTIONS: Record<string, string> = { '1 Minute': '1m', '5 Minutes': '5m', '15 Minutes': '15m', '1 Hour': '1h' };
const LINE_OPTS = { dot: false, connectNulls: true, type: 'linear' as const };

function sumTimeSeries(ts: Record<string, number>): number {
  let s = 0;
  for (const v of Object.values(ts)) s += v;
  return s;
}

function avgNonZeroTimeSeries(ts: Record<string, number>): number {
  let s = 0,
    c = 0;
  for (const v of Object.values(ts)) {
    if (v > 0) {
      s += v;
      c++;
    }
  }
  return c > 0 ? s / c : 0;
}

interface ApiSummary {
  name: string;
  deployment: string;
  key: string;
  requestCount: number;
  avgResponseTime: number;
  errorRate: number;
  entries: MetricEntry[];
}

// Derive Top APIs from service-resource entries grouped by sublevel+deployment
function deriveApis(metrics: MetricEntry[]): ApiSummary[] {
  const apiMap: Record<string, { successful: MetricEntry[]; failed: MetricEntry[] }> = {};
  for (const m of metrics) {
    if (m.tags.src_service_resource !== 'true') continue;
    const key = `${m.tags.sublevel}\0${m.tags.deployment ?? m.tags.app_name ?? ''}`;
    if (!apiMap[key]) apiMap[key] = { successful: [], failed: [] };
    apiMap[key][m.tags.status === 'failed' ? 'failed' : 'successful'].push(m);
  }
  return Object.entries(apiMap)
    .map(([key, { successful, failed }]) => {
      const [name, deployment] = key.split('\0');
      const allEntries = [...successful, ...failed];
      const successReqs = successful.reduce((s, m) => s + sumTimeSeries(m.requests_total.timeSeriesData), 0);
      const failReqs = failed.reduce((s, m) => s + sumTimeSeries(m.requests_total.timeSeriesData), 0);
      const total = successReqs + failReqs;
      const avgMs = (successful.reduce((s, m) => s + avgNonZeroTimeSeries(m.response_time_seconds_avg.timeSeriesData), 0) / Math.max(successful.length, 1)) * 1000;
      return { name, deployment, key, requestCount: total, avgResponseTime: avgMs, errorRate: total > 0 ? (failReqs / total) * 100 : 0, entries: allEntries };
    })
    .sort((a, b) => b.requestCount - a.requestCount);
}

// Aggregate metrics into chart-ready data
function aggregate(metrics: MetricEntry[]) {
  const requestsByTime: Record<string, { time: string; successful: number; failed: number }> = {};
  const latencyByTime: Record<string, { time: string; avg: number; p50: number; p95: number; p99: number; count: number }> = {};
  let totalRequests = 0;
  let errorCount = 0;
  let latestP95 = 0;

  for (const m of metrics) {
    const isFailed = m.tags.status === 'failed';
    for (const [ts, val] of Object.entries(m.requests_total.timeSeriesData)) {
      if (!requestsByTime[ts]) requestsByTime[ts] = { time: ts, successful: 0, failed: 0 };
      if (isFailed) {
        requestsByTime[ts].failed += val;
        errorCount += val;
      } else {
        requestsByTime[ts].successful += val;
      }
      totalRequests += val;
    }
    for (const [ts, val] of Object.entries(m.response_time_seconds_avg.timeSeriesData)) {
      if (val === 0) continue;
      if (!latencyByTime[ts]) latencyByTime[ts] = { time: ts, avg: 0, p50: 0, p95: 0, p99: 0, count: 0 };
      const e = latencyByTime[ts];
      e.count += 1;
      e.avg += val;
      e.p50 += m.response_time_seconds_percentile_50.timeSeriesData[ts] ?? 0;
      e.p95 += m.response_time_seconds_percentile_95.timeSeriesData[ts] ?? 0;
      e.p99 += m.response_time_seconds_percentile_99.timeSeriesData[ts] ?? 0;
    }
  }

  const timestamps = Object.keys(requestsByTime).sort();
  const latencyData = timestamps.map((ts) => {
    const e = latencyByTime[ts];
    if (!e || e.count === 0) return { time: ts, avg: 0, p50: 0, p95: 0, p99: 0 };
    const c = e.count;
    return { time: ts, avg: (e.avg / c) * 1000, p50: (e.p50 / c) * 1000, p95: (e.p95 / c) * 1000, p99: (e.p99 / c) * 1000 };
  });
  for (let i = latencyData.length - 1; i >= 0; i--) {
    if (latencyData[i].p95 > 0) {
      latestP95 = latencyData[i].p95;
      break;
    }
  }

  const requestsData = timestamps.map((ts) => requestsByTime[ts]);
  const errorPercentage = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  return { requestsData, latencyData, totalRequests, errorCount, errorPercentage, latestP95 };
}

// Build per-API chart data: each selected API becomes a line, keyed by "sublevel (deployment)"
function buildApiChartData(apis: ApiSummary[]) {
  const allTimestamps = new Set<string>();
  for (const api of apis) {
    for (const entry of api.entries) {
      for (const ts of Object.keys(entry.requests_total.timeSeriesData)) allTimestamps.add(ts);
    }
  }
  const sorted = [...allTimestamps].sort();
  const reqData = sorted.map((ts) => {
    const row: Record<string, string | number> = { label: formatTime(ts) };
    for (const api of apis) {
      const key = `${api.name} (${api.deployment})`;
      row[key] = api.entries.reduce((s, e) => s + (e.requests_total.timeSeriesData[ts] ?? 0), 0);
    }
    return row;
  });
  const latData = sorted.map((ts) => {
    const row: Record<string, string | number> = { label: formatTime(ts) };
    for (const api of apis) {
      const key = `${api.name} (${api.deployment})`;
      let sum = 0,
        count = 0;
      for (const e of api.entries) {
        const v = e.response_time_seconds_avg.timeSeriesData[ts] ?? 0;
        if (v > 0) {
          sum += v;
          count++;
        }
      }
      row[key] = count > 0 ? (sum / count) * 1000 : 0;
    }
    return row;
  });
  return { reqData, latData };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const COLORS = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];

function StatCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Metrics(scope: ProjectScope | ComponentScope): JSX.Element {
  const isComponent = hasComponent(scope);
  const { data: singleComponent, isLoading: loadingComponent } = useComponentByHandler(scope.project, isComponent ? scope.component : undefined);
  const { data: allComponents = [], isLoading: loadingComponents } = useComponents(scope.org, scope.project);
  const { data: environments = [], isLoading: loadingEnvironments } = useEnvironments(scope.project);

  const [envFilter, setEnvFilter] = useState('');
  const [timeRange, setTimeRange] = useState('Past 1 hour');
  const [resolution, setResolution] = useState('1 Minute');
  const [integrationFilter, setIntegrationFilter] = useState('all');
  const [selectedApiKeys, setSelectedApiKeys] = useState<string[]>([]);

  const effectiveEnvId = envFilter || environments[0]?.id || '';
  const componentId = isComponent ? (singleComponent?.id ?? '') : '';

  const metricsRequest = useMemo<MetricsRequest | null>(() => {
    if (!effectiveEnvId) return null;
    if (isComponent && !componentId) return null;
    const hours = TIME_RANGES[timeRange] ?? 1;
    const now = new Date();
    const req: MetricsRequest = {
      environmentId: effectiveEnvId,
      startTime: new Date(now.getTime() - hours * 3600_000).toISOString(),
      endTime: now.toISOString(),
      resolutionInterval: RESOLUTIONS[resolution] ?? '1m',
    };
    if (isComponent) req.componentId = componentId;
    return req;
  }, [isComponent, componentId, effectiveEnvId, timeRange, resolution]);

  const { data: metrics = [], isLoading, error, refetch } = useMetrics(metricsRequest);

  // Only show service-resource entries (incoming requests), exclude outgoing client calls
  const serviceMetrics = useMemo(() => metrics.filter((m) => m.tags.src_service_resource === 'true'), [metrics]);

  // Client-side integration filter (project-level only)
  const integrations = useMemo(() => {
    const set = new Set<string>();
    for (const m of serviceMetrics) {
      const i = m.tags.integration;
      if (i) set.add(i);
    }
    return [...set].sort();
  }, [serviceMetrics]);

  const filteredMetrics = useMemo(() => {
    if (integrationFilter === 'all') return serviceMetrics;
    return serviceMetrics.filter((m) => m.tags.integration === integrationFilter);
  }, [serviceMetrics, integrationFilter]);

  const { requestsData, latencyData, totalRequests, errorCount, errorPercentage, latestP95 } = useMemo(() => aggregate(filteredMetrics), [filteredMetrics]);
  const apis = useMemo(() => deriveApis(filteredMetrics), [filteredMetrics]);
  const top5 = apis.slice(0, 5);

  // Auto-select top APIs when data changes
  const effectiveSelectedApis = useMemo(() => {
    const valid = apis.filter((a) => selectedApiKeys.includes(a.key));
    return valid.length > 0 ? valid : top5.slice(0, 1);
  }, [apis, selectedApiKeys, top5]);

  const { reqData: apiReqData, latData: apiLatData } = useMemo(() => buildApiChartData(effectiveSelectedApis), [effectiveSelectedApis]);
  const apiLineKeys = effectiveSelectedApis.map((a) => `${a.name} (${a.deployment})`);

  const requestsChartData = useMemo(() => requestsData.map((d) => ({ ...d, label: formatTime(d.time) })), [requestsData]);
  const latencyChartData = useMemo(() => latencyData.map((d) => ({ ...d, label: formatTime(d.time) })), [latencyData]);

  // Early returns
  const loadingContext = isComponent ? loadingComponent : loadingComponents;
  if (loadingContext || loadingEnvironments) {
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  }
  if (isComponent && !singleComponent) {
    return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;
  }
  if (!isComponent && allComponents.length === 0) {
    return (
      <PageContent>
        <EmptyListing icon={<BarChart3 size={48} />} title="No components" description="Add a component to view metrics." />
      </PageContent>
    );
  }
  if (environments.length === 0) {
    return (
      <PageContent>
        <EmptyListing icon={<BarChart3 size={48} />} title="No environments" description="Configure an environment to view metrics." />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Metrics
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => refetch()} disabled={!metricsRequest}>
            <RefreshCw size={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" gap={2} sx={{ mb: 3 }} flexWrap="wrap" alignItems="center">
        {environments.length > 0 && (
          <Select value={effectiveEnvId} onChange={(e) => setEnvFilter(e.target.value as string)} size="small" sx={{ minWidth: 140 }} aria-label="Environment">
            {environments.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name}
              </MenuItem>
            ))}
          </Select>
        )}
        <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as string)} size="small" sx={{ minWidth: 160 }} aria-label="Time range">
          {Object.keys(TIME_RANGES).map((k) => (
            <MenuItem key={k} value={k}>
              {k}
            </MenuItem>
          ))}
        </Select>
        <Select value={resolution} onChange={(e) => setResolution(e.target.value as string)} size="small" sx={{ minWidth: 140 }} aria-label="Resolution">
          {Object.keys(RESOLUTIONS).map((k) => (
            <MenuItem key={k} value={k}>
              Resolution: {k}
            </MenuItem>
          ))}
        </Select>
        {!isComponent && integrations.length > 0 && (
          <Select value={integrationFilter} onChange={(e) => setIntegrationFilter(e.target.value as string)} size="small" sx={{ minWidth: 160 }} aria-label="Integration">
            <MenuItem value="all">All Integrations</MenuItem>
            {integrations.map((i) => (
              <MenuItem key={i} value={i}>
                {i}
              </MenuItem>
            ))}
          </Select>
        )}
      </Stack>

      {isLoading ? (
        <CircularProgress size={28} sx={{ display: 'block', mx: 'auto', my: 6 }} />
      ) : error ? (
        <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
          <Typography color="error" textAlign="center">
            Failed to fetch metrics: {(error as Error).message ?? 'Service unavailable'}
          </Typography>
          <Button variant="contained" startIcon={<RefreshCw size={16} />} onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      ) : serviceMetrics.length === 0 ? (
        <EmptyListing icon={<BarChart3 size={48} />} title="No metrics data" description="No metrics available for the selected time range." />
      ) : (
        <>
          {/* Summary cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard title="Total Requests" value={totalRequests.toLocaleString()} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard title="Error Count" value={errorCount.toLocaleString()} color="error.main" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard title="Error Percentage" value={`${errorPercentage.toFixed(2)}%`} color="error.main" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard title="95th Percentile (Latest)" value={`${latestP95.toFixed(2)} ms`} />
            </Grid>
          </Grid>

          {/* Overview charts */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Requests Per Minute
                  </Typography>
                  <LineChart
                    data={requestsChartData}
                    xAxisDataKey="label"
                    height={350}
                    legend={{ show: true, align: 'center', verticalAlign: 'bottom' }}
                    grid={{ show: true, strokeDasharray: '3 3' }}
                    lines={[
                      { dataKey: 'successful', name: 'Success', stroke: '#4caf50', ...LINE_OPTS },
                      { dataKey: 'failed', name: 'Failed', stroke: '#d32f2f', ...LINE_OPTS },
                    ]}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Request Latency
                  </Typography>
                  <LineChart
                    data={latencyChartData}
                    xAxisDataKey="label"
                    height={350}
                    legend={{ show: true, align: 'center', verticalAlign: 'bottom' }}
                    grid={{ show: true, strokeDasharray: '3 3' }}
                    lines={[
                      { dataKey: 'avg', name: 'Average', stroke: '#4caf50', ...LINE_OPTS },
                      { dataKey: 'p50', name: '50th Percentile', stroke: '#2196f3', ...LINE_OPTS },
                      { dataKey: 'p95', name: '95th Percentile', stroke: '#ff9800', ...LINE_OPTS },
                      { dataKey: 'p99', name: '99th Percentile', stroke: '#9c27b0', ...LINE_OPTS },
                    ]}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Project-level: Top 5 APIs + Statistics of APIs */}
          {!isComponent && top5.length > 0 && (
            <>
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Top 5 APIs (by Request Count)
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>API Name</TableCell>
                          <TableCell align="right">Request Count</TableCell>
                          <TableCell align="right">Avg Response Time (ms)</TableCell>
                          <TableCell align="right">Error Rate (%)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {top5.map((api, i) => (
                          <TableRow key={api.key}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{api.name}</TableCell>
                            <TableCell align="right">{api.requestCount}</TableCell>
                            <TableCell align="right">{api.avgResponseTime.toFixed(2)}</TableCell>
                            <TableCell align="right">{api.errorRate.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              <Typography variant="h6" sx={{ mb: 1 }}>
                Statistics of APIs
              </Typography>
              <Select
                multiple
                value={effectiveSelectedApis.map((a) => a.key)}
                onChange={(e) => setSelectedApiKeys(e.target.value as string[])}
                size="small"
                sx={{ minWidth: 200, mb: 2 }}
                aria-label="API selection"
                renderValue={(selected) => `APIs: ${(selected as string[]).length} selected`}>
                {apis.map((a) => (
                  <MenuItem key={a.key} value={a.key}>
                    <Checkbox checked={effectiveSelectedApis.some((s) => s.key === a.key)} size="small" />
                    <ListItemText primary={`${a.name} (${a.deployment})`} />
                  </MenuItem>
                ))}
              </Select>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Requests Per Minute
                      </Typography>
                      <LineChart
                        data={apiReqData}
                        xAxisDataKey="label"
                        height={350}
                        legend={{ show: true, align: 'center', verticalAlign: 'bottom' }}
                        grid={{ show: true, strokeDasharray: '3 3' }}
                        lines={apiLineKeys.map((k, i) => ({ dataKey: k, name: k, stroke: COLORS[i % COLORS.length], ...LINE_OPTS }))}
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Average Request Latency
                      </Typography>
                      <LineChart
                        data={apiLatData}
                        xAxisDataKey="label"
                        height={350}
                        legend={{ show: true, align: 'center', verticalAlign: 'bottom' }}
                        grid={{ show: true, strokeDasharray: '3 3' }}
                        lines={apiLineKeys.map((k, i) => ({ dataKey: k, name: k, stroke: COLORS[i % COLORS.length], ...LINE_OPTS }))}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </>
          )}
        </>
      )}
    </PageContent>
  );
}
