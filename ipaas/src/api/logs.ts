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
import { authenticatedFetch } from '../auth/tokenManager';

export interface LogsRequest {
  projectId: string;
  componentIdList: string[];
  environmentId: string;
  environmentList: string;
  logLevels: string[];
  startTime: string;
  endTime: string;
  limit: number;
  sort: 'asc' | 'desc';
  region: string;
  searchPhrase: string;
}

export interface ComponentLogsRequest {
  componentId: string;
  environmentId: string;
  versionIdList: string[];
  logLevels: string[];
  startTime: string;
  endTime: string;
  limit: number;
  sort: 'asc' | 'desc';
  region: string;
  searchPhrase: string;
}

export interface LogRow {
  timestamp: string;
  level: string;
  logLine: string;
  class: string | null;
  logFilePath: string | null;
  appName: string | null;
  module: string | null;
  serviceType: string | null;
  app: string | null;
  deployment: string | null;
  artifactContainer: string | null;
  product: string | null;
  icpRuntimeId: string | null;
  logContext: unknown;
  componentVersion: string;
  componentVersionId: string;
}

interface Column {
  name: string;
  type: string;
}

const COLUMN_MAP: Record<string, keyof LogRow> = {
  TimeGenerated: 'timestamp',
  LogLevel: 'level',
  LogEntry: 'logLine',
  Class: 'class',
  LogFilePath: 'logFilePath',
  AppName: 'appName',
  Module: 'module',
  ServiceType: 'serviceType',
  App: 'app',
  Deployment: 'deployment',
  ArtifactContainer: 'artifactContainer',
  Product: 'product',
  IcpRuntimeId: 'icpRuntimeId',
  LogContext: 'logContext',
  ComponentVersion: 'componentVersion',
  ComponentVersionId: 'componentVersionId',
};

async function postLogs(url: string, body: unknown): Promise<LogRow[]> {
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  const json: { columns: Column[]; rows: (string | null)[][] } = await res.json();
  const indexMap: Record<number, keyof LogRow> = {};
  (json.columns ?? []).forEach((col, i) => {
    const key = COLUMN_MAP[col.name];
    if (key) indexMap[i] = key;
  });
  return (json.rows ?? []).map((row) => {
    const entry = {} as Record<string, unknown>;
    row.forEach((val, i) => {
      const key = indexMap[i];
      if (key) entry[key] = val;
    });
    return entry as unknown as LogRow;
  });
}

export async function fetchLogs(req: LogsRequest, logsApiUrl: string): Promise<LogRow[]> {
  return postLogs(logsApiUrl, req);
}

export async function fetchComponentLogs(req: ComponentLogsRequest, logsApiUrl: string): Promise<LogRow[]> {
  return postLogs(logsApiUrl, req);
}

export function useInfiniteLogs(req: LogsRequest | null, refetchInterval: number | false = false, logsApiUrl?: string) {
  return useInfiniteQuery({
    queryKey: ['logs', req, logsApiUrl],
    queryFn: async ({ pageParam }) => {
      const pageReq = pageParam ? { ...req!, ...(req!.sort === 'desc' ? { endTime: pageParam } : { startTime: pageParam }) } : req!;
      return fetchLogs(pageReq, logsApiUrl!);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!req || lastPage.length < req.limit) return undefined;
      return lastPage[lastPage.length - 1]?.timestamp;
    },
    enabled: !!req && !!logsApiUrl,
    refetchInterval,
  });
}

export function useInfiniteComponentLogs(req: ComponentLogsRequest | null, refetchInterval: number | false = false, logsApiUrl?: string) {
  return useInfiniteQuery({
    queryKey: ['component-logs', req, logsApiUrl],
    queryFn: async ({ pageParam }) => {
      const pageReq = pageParam ? { ...req!, ...(req!.sort === 'desc' ? { endTime: pageParam } : { startTime: pageParam }) } : req!;
      return fetchComponentLogs(pageReq, logsApiUrl!);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!req || lastPage.length < req.limit) return undefined;
      return lastPage[lastPage.length - 1]?.timestamp;
    },
    enabled: !!req && !!logsApiUrl,
    refetchInterval,
  });
}
