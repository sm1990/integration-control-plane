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

import { CircularProgress, PageContent } from '@wso2/oxygen-ui';
import { ScrollText } from '@wso2/oxygen-ui-icons-react';
import { useMemo, type JSX } from 'react';
import { useOrgs, useProjectsByOrg, useComponentByHandler, useEnvironments, useAllEnvironments, useCloudDataPlanes } from '../api/queries';
import { useInfiniteComponentLogs, type ComponentLogsRequest } from '../api/logs';
import { choreologgingComponentLogsApiUrl } from '../config/api';
import { AUTO_FETCH_INTERVAL, DEFAULT_DP_REGION, PAGE_SIZE } from '../utils/logs';
import LogsFilters from '../components/Logs/LogsFilters';
import LogsPageLayout from '../components/Logs/LogsPageLayout';
import LogsPanel from '../components/Logs/LogsPanel';
import EmptyListing from '../components/EmptyListing';
import NotFound from '../components/NotFound';
import { useLogsFilters } from '../hooks/useLogsFilters';
import { broaden, resourceUrl, type ComponentScope } from '../nav';

export default function RuntimeLogsIntegration(scope: ComponentScope): JSX.Element {
  const filters = useLogsFilters();
  const { envFilter, levelFilter, sortDir, searchPhrase, autoFetch, startTime, endTime } = filters;

  const { data: orgs, isLoading: loadingOrgs } = useOrgs();
  const { data: projects, isLoading: loadingProjects } = useProjectsByOrg(scope.org);

  const project = projects?.find((p) => p.id === scope.project || p.handler === scope.project);
  const projectId = project?.id ?? '';
  const orgUuid = orgs?.find((o) => o.handle === scope.org)?.uuid ?? '';

  const { data: component, isLoading: loadingComponent } = useComponentByHandler(projectId, scope.component);

  const { data: projectEnvs = [], isLoading: loadingProjectEnvs } = useEnvironments(orgUuid, projectId);
  const { data: globalEnvs = [], isLoading: loadingGlobalEnvs } = useAllEnvironments();
  // Prefer project-scoped environments (needs UUID); fall back to global when UUID unavailable
  const environments = orgUuid ? projectEnvs : globalEnvs;
  const loadingEnvironments = orgUuid ? loadingProjectEnvs : loadingGlobalEnvs;

  const { data: cdps, isLoading: loadingCdps } = useCloudDataPlanes(orgUuid);

  const selectedEnvIds = envFilter.length > 0 ? envFilter : environments.map((e) => e.id);
  const primaryEnv = environments.find((e) => selectedEnvIds.includes(e.id));

  const envIdsKey = selectedEnvIds.join(',');
  const levelFilterKey = levelFilter.join(',');

  const logsApiUrl = useMemo(() => {
    if (!primaryEnv?.dpId || !cdps) return undefined;
    const cdp = cdps.find((c) => c.id.toLowerCase() === primaryEnv.dpId!.toLowerCase());
    return cdp ? choreologgingComponentLogsApiUrl(cdp.external_gateway_virtual_host) : undefined;
  }, [primaryEnv?.dpId, cdps]);

  const logsRequest = useMemo<ComponentLogsRequest | null>(() => {
    if (!component || !primaryEnv || !logsApiUrl) return null;
    return {
      componentId: component.id,
      environmentId: primaryEnv.id,
      versionIdList: [], // Empty list fetches logs for all versions; version filtering is not yet implemented in the UI
      logLevels: levelFilter,
      startTime,
      endTime,
      limit: PAGE_SIZE,
      sort: sortDir,
      region: project?.region || DEFAULT_DP_REGION,
      searchPhrase,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component?.id, envIdsKey, levelFilterKey, startTime, endTime, searchPhrase, sortDir, logsApiUrl, project?.region]);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteComponentLogs(logsRequest, autoFetch ? AUTO_FETCH_INTERVAL : false, logsApiUrl);

  const logs = useMemo(() => data?.pages.flat() ?? [], [data]);

  if (loadingOrgs || loadingProjects || loadingComponent || loadingEnvironments || loadingCdps) {
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  }

  if (!component) {
    return <NotFound message="Integration not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;
  }

  if (environments.length === 0) {
    return (
      <PageContent>
        <EmptyListing icon={<ScrollText size={48} />} title="No environments available" description="No deployment environments were found for this project. Deploy your integration first." />
      </PageContent>
    );
  }

  return (
    <LogsPageLayout
      title="Runtime Logs"
      filtersElement={<LogsFilters filters={filters} environments={environments} logs={logs} logsRequest={logsRequest} onRefetch={refetch} />}
      logPanelElement={<LogsPanel isLoading={isLoading} error={error} logs={logs} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onRefetch={refetch} onFetchNextPage={fetchNextPage} onClearFilters={filters.clearFilters} />}
    />
  );
}
