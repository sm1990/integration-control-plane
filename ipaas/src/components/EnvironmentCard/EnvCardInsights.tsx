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

import { Avatar, Box, CircularProgress, Divider, Stack, Typography } from '@wso2/oxygen-ui';
import { Activity, AlertTriangle, Clock, TrendingUp } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useRef, useState } from 'react';
import { getOrgUuidFromToken } from '../../auth/tokenManager';
import { fetchComponentInsights, fetchInsightsEnvironments, type ComponentInsights, type InsightsEnvironment } from '../../api/insights';

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  unit?: string;
  loading: boolean;
}

function MetricTile({ icon, label, value, unit, loading }: MetricTileProps) {
  return (
    <Stack direction="row" alignItems="center" gap={1.5} sx={{ flex: 1, minWidth: 0 }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', flexShrink: 0 }}>{icon}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
        {loading ? (
          <CircularProgress size={16} />
        ) : (
          <Stack direction="row" alignItems="baseline" gap={0.5}>
            <Typography variant="body1" fontWeight={600}>
              {value ?? '—'}
            </Typography>
            {unit && value !== null && (
              <Typography variant="caption" color="text.secondary">
                {unit}
              </Typography>
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

interface EnvCardInsightsProps {
  envName: string;
  envId: string;
  projectId: string;
  apiId: string;
}

export default function EnvCardInsights({ envName, envId, projectId, apiId }: EnvCardInsightsProps) {
  const orgUuid = getOrgUuidFromToken() ?? '';
  const [insights, setInsights] = useState<ComponentInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsEnv, setInsightsEnv] = useState<InsightsEnvironment | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Fetch and match insights environment once
  useEffect(() => {
    if (!orgUuid || !projectId) {
      setLoading(false);
      return;
    }
    fetchInsightsEnvironments(orgUuid, projectId).then((envs) => {
      if (!mounted.current) return;
      const match = envs.find((e) => e.externalEnvId === envId || e.name?.toLowerCase() === envName?.toLowerCase());
      if (match) {
        setInsightsEnv(match);
      } else {
        setLoading(false);
      }
    });
  }, [orgUuid, projectId, envId, envName]);

  // Fetch metrics once env is found, then poll every 10s
  useEffect(() => {
    if (!insightsEnv || !apiId) return;

    const fetchData = async () => {
      const data = await fetchComponentInsights(orgUuid, insightsEnv, apiId);
      if (!mounted.current) return;
      setInsights(data);
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [insightsEnv, apiId, orgUuid]);

  return (
    <>
      <Divider sx={{ mt: 2, mb: 1.5 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Last 6 months
      </Typography>
      <Stack direction="row" gap={2} flexWrap="wrap">
        <MetricTile icon={<TrendingUp size={16} />} label="Total Traffic" value={insights?.requestCount ?? null} loading={loading} />
        <MetricTile icon={<AlertTriangle size={16} />} label="Error Count" value={insights?.errorCount ?? null} loading={loading} />
        <MetricTile icon={<Activity size={16} />} label="Avg Error Rate" value={insights?.errorRate ?? null} unit="%" loading={loading} />
        <MetricTile icon={<Clock size={16} />} label="P99 Latency" value={insights?.latency ?? null} unit="ms" loading={loading} />
      </Stack>
    </>
  );
}
