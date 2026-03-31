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

import { authenticatedFetch } from '../auth/tokenManager';

function getInsightsQueryUrl(): string | null {
  const match = (window.API_CONFIG?.choreoOrgApiUrl ?? '').match(/\/\/apis\.([^.]+)\.choreo\.dev/);
  return match ? `https://choreocontrolplane.${match[1]}.choreo.dev/insights/1.0.0/query-api` : null;
}

async function postInsightsQuery<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const url = getInsightsQueryUrl();
  if (!url) return null;
  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export interface InsightsEnvironment {
  id: string;
  externalEnvId: string;
  internalEnvId: string;
  sandboxEnvId: string;
  name: string;
  region: string;
  type: string;
}

export interface ComponentInsights {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  latency: number;
}

export async function fetchInsightsEnvironments(orgUuid: string, projectId: string): Promise<InsightsEnvironment[]> {
  const result = await postInsightsQuery<{ data?: { listEnvironments: InsightsEnvironment[] } }>(
    `query environments($org: OrgFilter!, $projectId: String) {
      listEnvironments(org: $org, projectId: $projectId) {
        externalEnvId id internalEnvId sandboxEnvId name region type
      }
    }`,
    { org: { orgId: orgUuid }, projectId },
  );
  return result?.data?.listEnvironments ?? [];
}

function getEnvironmentIds(env: InsightsEnvironment): string[] {
  const { id, externalEnvId, sandboxEnvId, internalEnvId, type, name, region } = env;
  const ids = [id, externalEnvId, sandboxEnvId, internalEnvId].filter(Boolean) as string[];
  if (type === 'CHOREO') {
    if (name === 'Development' && region === 'US') ids.push('dev-us-east-azure', 'Dev-Internal', 'sandbox-dev');
    else if (name === 'Development' && region === 'EU') ids.push('dev-eu-north-azure', 'Dev-Internal-EU-North', 'sandbox-dev-eu-north');
    else if (name === 'Production' && region === 'US') ids.push('Production and Sandbox', 'Prod-Internal', 'sandbox-prod');
    else if (name === 'Production' && region === 'EU') ids.push('prod-eu-north-azure', 'Prod-Internal-EU-North', 'sandbox-prod-eu-north');
  }
  return [...new Set(ids)];
}

function formatForInsights(date: Date): string {
  // Format: "YYYY-MM-DD HH:mm:ss" in UTC
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function fetchComponentInsights(orgUuid: string, insightsEnv: InsightsEnvironment, apiId: string): Promise<ComponentInsights | null> {
  const now = new Date();
  const from = new Date(now);
  from.setUTCMonth(now.getUTCMonth() - 6);

  const result = await postInsightsQuery<{
    data?: {
      getTotalTrafficByAPI: number;
      getOverallLatencyByAPI?: { response: number };
      getTotalErrorsByAPI?: { proxy: number };
    };
  }>(
    `query componentInsights($dataFilter: DataFilter!, $filter: TimeFilter!, $apiId: ID!) {
      getTotalTrafficByAPI(filter: $filter, dataFilter: $dataFilter, apiId: $apiId)
      getOverallLatencyByAPI(filter: $filter, dataFilter: $dataFilter, apiId: $apiId) { response }
      getTotalErrorsByAPI(filter: $filter, dataFilter: $dataFilter, apiId: $apiId) { proxy }
    }`,
    {
      filter: { from: formatForInsights(from), to: formatForInsights(now) },
      dataFilter: { orgId: orgUuid, environmentIds: getEnvironmentIds(insightsEnv), tenant: 'carbon.super' },
      apiId,
    },
  );

  const data = result?.data;
  if (!data) return null;

  const total = data.getTotalTrafficByAPI || 0;
  const errors = data.getTotalErrorsByAPI?.proxy || 0;
  const latency = data.getOverallLatencyByAPI?.response || 0;

  return {
    requestCount: total,
    errorCount: errors,
    errorRate: total > 0 ? Math.round((errors / total) * 100) : 0,
    latency,
  };
}
