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

import { CircularProgress, MenuItem, PageContent, Select } from '@wso2/oxygen-ui';
import { ScrollText } from '@wso2/oxygen-ui-icons-react';
import { useMemo, useState, type JSX } from 'react';
import { useOrgs, useProjectsByOrg, useComponents, useEnvironments, useAllEnvironments, useCloudDataPlanes } from '../api/queries';
import { useInfiniteLogs, type LogsRequest } from '../api/logs';
import { choreologgingProjectLogsApiUrl } from '../config/api';
import { AUTO_FETCH_INTERVAL, DEFAULT_DP_REGION, PAGE_SIZE } from '../utils/logs';
import LogsFilters from '../components/Logs/LogsFilters';
import LogsPageLayout from '../components/Logs/LogsPageLayout';
import LogsPanel from '../components/Logs/LogsPanel';
import EmptyListing from '../components/EmptyListing';
import { useLogsFilters } from '../hooks/useLogsFilters';
import type { ProjectScope } from '../nav';

export default function RuntimeLogsProject(scope: ProjectScope): JSX.Element {
  const filters = useLogsFilters();
  const { envFilter, levelFilter, sortDir, searchPhrase, autoFetch, startTime, endTime } = filters;

  const { data: orgs, isLoading: loadingOrgs } = useOrgs();
  const { data: projects, isLoading: loadingProjects } = useProjectsByOrg(scope.org);

  const loadingProject = loadingOrgs || loadingProjects;
  const project = projects?.find((p) => p.id === scope.project || p.handler === scope.project);
  const projectId = project?.id ?? '';
  const orgUuid = orgs?.find((o) => o.handle === scope.org)?.uuid ?? '';

  const { data: allComponents = [], isLoading: loadingComponents } = useComponents(scope.org, projectId);
  const { data: projectEnvs = [], isLoading: loadingProjectEnvs } = useEnvironments(orgUuid, projectId);
  const { data: globalEnvs = [], isLoading: loadingGlobalEnvs } = useAllEnvironments();
  // Prefer project-scoped environments (needs UUID); fall back to global when UUID unavailable
  const environments = orgUuid ? projectEnvs : globalEnvs;
  const loadingEnvironments = orgUuid ? loadingProjectEnvs : loadingGlobalEnvs;

  const { data: cdps, isLoading: loadingCdps } = useCloudDataPlanes(orgUuid);

  const [integrationFilter, setIntegrationFilter] = useState('all');

  const componentIds = integrationFilter !== 'all' ? [integrationFilter] : allComponents.map((c) => c.id);
  const selectedEnvIds = envFilter.length > 0 ? envFilter : environments.map((e) => e.id);
  const primaryEnv = environments.find((e) => selectedEnvIds.includes(e.id));

  const componentIdsKey = componentIds.join(',');
  const envIdsKey = selectedEnvIds.join(',');
  const levelFilterKey = levelFilter.join(',');

  const logsApiUrl = useMemo(() => {
    if (!primaryEnv?.dpId || !cdps) return undefined;
    const cdp = cdps.find((c) => c.id.toLowerCase() === primaryEnv.dpId!.toLowerCase());
    return cdp ? choreologgingProjectLogsApiUrl(cdp.external_gateway_virtual_host) : undefined;
  }, [primaryEnv?.dpId, cdps]);

  const logsRequest = useMemo<LogsRequest | null>(() => {
    if (componentIds.length === 0 || !primaryEnv || !logsApiUrl) return null;
    return {
      projectId,
      componentIdList: componentIds,
      environmentId: primaryEnv.id,
      environmentList: primaryEnv.name,
      logLevels: levelFilter,
      startTime,
      endTime,
      limit: PAGE_SIZE,
      sort: sortDir,
      region: project?.region || DEFAULT_DP_REGION,
      searchPhrase,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentIdsKey, envIdsKey, levelFilterKey, startTime, endTime, searchPhrase, sortDir, projectId, logsApiUrl]);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteLogs(logsRequest, autoFetch ? AUTO_FETCH_INTERVAL : false, logsApiUrl);

  const logs = useMemo(() => data?.pages.flat() ?? [], [data]);

  if (loadingProject || loadingComponents || loadingEnvironments || loadingCdps) {
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  }

  if (allComponents.length === 0) {
    return (
      <PageContent>
        <EmptyListing icon={<ScrollText size={48} />} title="No integrations found" description="Add an integration to this project before viewing runtime logs." />
      </PageContent>
    );
  }

  if (environments.length === 0) {
    return (
      <PageContent>
        <EmptyListing icon={<ScrollText size={48} />} title="No environments available" description="No deployment environments were found for this project. Deploy your integration first." />
      </PageContent>
    );
  }

  const integrationSelect = (
    <Select value={integrationFilter} onChange={(e) => setIntegrationFilter(e.target.value as string)} size="small" sx={{ minWidth: 200 }} inputProps={{ 'aria-label': 'Integration' }}>
      <MenuItem value="all">All Integrations</MenuItem>
      {allComponents.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          {c.displayName || c.name}
        </MenuItem>
      ))}
    </Select>
  );

  return (
    <LogsPageLayout
      title="Runtime Logs"
      headerAction={integrationSelect}
      filtersElement={<LogsFilters filters={filters} environments={environments} logs={logs} logsRequest={logsRequest} onRefetch={refetch} />}
      logPanelElement={<LogsPanel isLoading={isLoading} error={error} logs={logs} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onRefetch={refetch} onFetchNextPage={fetchNextPage} onClearFilters={filters.clearFilters} />}
    />
  );
}
