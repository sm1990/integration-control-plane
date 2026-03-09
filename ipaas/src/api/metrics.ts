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
  inboundMetrics: MetricEntry[];
  outboundMetrics: MetricEntry[];
}

async function fetchMetrics(req: MetricsRequest): Promise<MetricsResponse> {
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
  return json;
}

export function useMetrics(req: MetricsRequest | null) {
  return useQuery<MetricsResponse>({
    queryKey: ['metrics', req],
    queryFn: () => fetchMetrics(req!),
    enabled: !!req,
    refetchInterval: false,
  });
}
