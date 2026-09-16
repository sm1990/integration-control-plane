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

import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import { fetchLogs, fetchComponentLogs } from '#api/logs';
import { IS_CLOUD } from '../features';
import { filterLogRows, type LogRowFilter } from '../utils/logs';
import type { LogsRequest, ComponentLogsRequest, LogRow } from '../types/logs';

// The cloud log source cannot narrow by level, so leaving levels out of its
// request keeps the query key — and the pages already loaded — stable while the
// user retoggles the level control. Sources that do filter server-side must keep
// sending them.
function sourceRequest<T extends { logLevels: string[] }>(req: T | null): T | null {
  return req && IS_CLOUD ? { ...req, logLevels: [] } : req;
}

/**
 * The rows a panel renders: the loaded pages flattened, then narrowed by filters
 * the log source could not apply itself.
 */
export function useVisibleLogs(data: InfiniteData<LogRow[]> | undefined, filter: LogRowFilter = {}): LogRow[] {
  const levelsKey = filter.levels?.join(',') ?? '';
  const componentsKey = filter.componentIds?.join(',') ?? '';
  return useMemo(() => {
    const rows = data?.pages.flat() ?? [];
    return IS_CLOUD ? filterLogRows(rows, filter) : rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, levelsKey, componentsKey]);
}

export function useInfiniteLogs(req: LogsRequest | null, refetchInterval: number | false = false, logsApiUrl?: string) {
  const query = useMemo(() => sourceRequest(req), [req]);
  return useInfiniteQuery({
    queryKey: ['logs', query, logsApiUrl],
    queryFn: async ({ pageParam }) => {
      const pageReq = pageParam ? { ...query!, ...(query!.sort === 'desc' ? { endTime: pageParam } : { startTime: pageParam }) } : query!;
      return fetchLogs(pageReq, logsApiUrl!);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!query || lastPage.length < query.limit) return undefined;
      return lastPage[lastPage.length - 1]?.timestamp;
    },
    enabled: !!query && !!logsApiUrl,
    refetchInterval,
  });
}

export function useInfiniteComponentLogs(req: ComponentLogsRequest | null, refetchInterval: number | false = false, logsApiUrl?: string) {
  const query = useMemo(() => sourceRequest(req), [req]);
  return useInfiniteQuery({
    queryKey: ['component-logs', query, logsApiUrl],
    queryFn: async ({ pageParam }) => {
      const pageReq = pageParam ? { ...query!, ...(query!.sort === 'desc' ? { endTime: pageParam } : { startTime: pageParam }) } : query!;
      return fetchComponentLogs(pageReq, logsApiUrl!);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!query || lastPage.length < query.limit) return undefined;
      return lastPage[lastPage.length - 1]?.timestamp;
    },
    enabled: !!query && !!logsApiUrl,
    refetchInterval,
  });
}
