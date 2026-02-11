import { useQuery } from '@tanstack/react-query';
import { observabilityLogsApiUrl } from '../paths';
import { getToken } from '../auth/AuthContext';

export interface LogsRequest {
  componentIdList: string[];
  environmentId: string;
  environmentList: string[];
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
  entry: string;
  context: unknown;
  version: string;
  versionId: string;
}

async function fetchLogs(req: LogsRequest): Promise<LogRow[]> {
  const res = await fetch(observabilityLogsApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  const json: { rows: [string, string, string, unknown, string, string][] } = await res.json();
  return (json.rows ?? []).map((r) => ({
    timestamp: r[0],
    level: r[1],
    entry: r[2],
    context: r[3],
    version: r[4],
    versionId: r[5],
  }));
}

export function useLogs(req: LogsRequest | null) {
  return useQuery({
    queryKey: ['logs', req],
    queryFn: () => fetchLogs(req!),
    enabled: !!req,
    refetchInterval: false,
  });
}
