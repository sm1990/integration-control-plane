import { useQuery } from '@tanstack/react-query';
import { observabilityMetricsApiUrl } from '../paths';
import { authenticatedFetch } from '../auth/tokenManager';

export interface MetricsRequest {
  componentId?: string;
  environmentId: string;
  startTime: string;
  endTime: string;
  resolutionInterval: string;
}

export interface TimeSeriesData {
  name: string;
  timeSeriesData: Record<string, number>;
}

export interface MetricEntry {
  tags: Record<string, string>;
  requests_total: TimeSeriesData;
  response_time_seconds_avg: TimeSeriesData;
  response_time_seconds_min: TimeSeriesData;
  response_time_seconds_max: TimeSeriesData;
  response_time_seconds_percentile_33: TimeSeriesData;
  response_time_seconds_percentile_50: TimeSeriesData;
  response_time_seconds_percentile_66: TimeSeriesData;
  response_time_seconds_percentile_95: TimeSeriesData;
  response_time_seconds_percentile_99: TimeSeriesData;
}

export interface MetricsResponse {
  metrics: MetricEntry[];
}

async function fetchMetrics(req: MetricsRequest): Promise<MetricEntry[]> {
  const res = await authenticatedFetch(observabilityMetricsApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  const json: MetricsResponse = await res.json();
  return json.metrics ?? [];
}

export function useMetrics(req: MetricsRequest | null) {
  return useQuery({
    queryKey: ['metrics', req],
    queryFn: () => fetchMetrics(req!),
    enabled: !!req,
    refetchInterval: false,
  });
}
