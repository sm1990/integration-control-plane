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

import type { LogRow } from '../types/logs';
import type { ExecutionLogEntry } from '../types/executions';

export const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'] as const;

export const TIME_PRESETS: { label: string; hours: number }[] = [
  { label: 'Past 10 minutes', hours: 1 / 6 },
  { label: 'Past 30 minutes', hours: 0.5 },
  { label: 'Past 1 hour', hours: 1 },
  { label: 'Past 24 hours', hours: 24 },
  { label: 'Past 7 days', hours: 168 },
  { label: 'Past 30 days', hours: 720 },
];

export const DEFAULT_HOURS = 720;
export const AUTO_FETCH_INTERVAL = 10_000;
export const PAGE_SIZE = 100;
export const DEFAULT_DP_REGION = 'US';

export const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  ERROR: { bg: '#ffebee', text: '#b71c1c' },
  WARN: { bg: '#fff3e0', text: '#e65100' },
  INFO: { bg: '#e3f2fd', text: '#0d47a1' },
  DEBUG: { bg: '#eceff1', text: '#37474f' },
};

export const DISPLAY_FIELDS: { key: keyof LogRow; label: string }[] = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'level', label: 'Log Level' },
  { key: 'gatewayCode', label: 'Gateway Code' },
  { key: 'statusCode', label: 'Status Code' },
  { key: 'logLine', label: 'Log Entry' },
  { key: 'class', label: 'Class' },
  { key: 'logFilePath', label: 'Log File Path' },
  { key: 'appName', label: 'App Name' },
  { key: 'module', label: 'Module' },
  { key: 'serviceType', label: 'Service Type' },
  { key: 'app', label: 'App' },
  { key: 'deployment', label: 'Deployment' },
  { key: 'artifactContainer', label: 'Artifact Container' },
  { key: 'product', label: 'Product' },
  { key: 'icpRuntimeId', label: 'Runtime ID' },
  { key: 'logContext', label: 'Log Context' },
  { key: 'componentVersion', label: 'Component Version' },
  { key: 'componentVersionId', label: 'Component Version ID' },
  { key: 'componentName', label: 'Integration' },
  { key: 'containerName', label: 'Container' },
  { key: 'podName', label: 'Pod' },
];

export function levelColor(level: string): { bg: string; text: string } {
  return LEVEL_COLORS[level] ?? { bg: '#eceff1', text: '#37474f' };
}

export function statusCodeColor(code: string | null): { bg: string; text: string } {
  const n = parseInt(code ?? '', 10);
  if (n >= 200 && n < 300) return { bg: '#e3f2fd', text: '#0d47a1' };
  if (n >= 300 && n < 400) return { bg: '#fff3e0', text: '#e65100' };
  if (n >= 400 && n < 600) return { bg: '#ffebee', text: '#b71c1c' };
  return { bg: '#eceff1', text: '#37474f' };
}

export function formatValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function copyLog(log: LogRow) {
  const meta: Record<string, unknown> = {};
  if (log.appName) meta.appName = log.appName;
  if (log.componentVersion) meta.componentVersion = log.componentVersion;
  if (log.componentVersionId) meta.componentVersionId = log.componentVersionId;
  if (log.level) meta.level = log.level;
  if (log.logContext) meta.logContext = log.logContext;
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  navigator.clipboard.writeText(`${log.timestamp} ${log.logLine}${metaStr}`);
}

export function downloadLogs(logs: LogRow[]) {
  const text = logs.map((l) => `${new Date(l.timestamp).toLocaleString()} [${l.level}] ${l.logLine}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Splits a raw container log into lines, optionally keeping only those matching `keyword`. */
export function filterLogLines(logs: string, keyword: string, filterMode: boolean): string[] {
  const lines = logs ? logs.split(/\r?\n/) : [];
  if (!filterMode || !keyword.trim()) return lines;
  const lower = keyword.toLowerCase();
  return lines.filter((line) => line.toLowerCase().includes(lower));
}

/**
 * True when the entries come from more than one container, which is what makes
 * a per-line container tag worth showing — an init container's output is
 * otherwise indistinguishable from the task's own.
 */
export function spansMultipleContainers(entries: ExecutionLogEntry[]): boolean {
  const first = entries.find((e) => e.container)?.container;
  if (!first) return false;
  return entries.some((e) => e.container && e.container !== first);
}

/** Renders one execution log entry as the single line the drawers display and search over. */
export function formatExecutionLogLine(entry: ExecutionLogEntry, showContainer: boolean): string {
  const parts: string[] = [];
  if (entry.timestamp) parts.push(entry.timestamp);
  if (showContainer && entry.container) parts.push(`[${entry.container}]`);
  if (entry.level) parts.push(entry.level);
  parts.push(entry.message);
  return parts.join(' ');
}

/** Which rows a log list should show, for narrowing a source cannot do itself. */
export interface LogRowFilter {
  /** Display levels to keep. Absent or empty keeps every row. */
  levels?: string[];
  /** Component ids whose rows belong in this list. Absent or empty keeps every row. */
  componentIds?: string[];
}

/**
 * Narrows fetched rows to what the filters admit.
 */
export function filterLogRows(rows: LogRow[], { levels, componentIds }: LogRowFilter): LogRow[] {
  const wantedLevels = levels?.length ? new Set(levels.map((l) => l.toUpperCase())) : null;
  const ownedComponents = componentIds?.length ? new Set(componentIds) : null;
  // Returning the same array keeps a caller's memoized identity stable.
  if (!wantedLevels && !ownedComponents) return rows;
  return rows.filter((r) => {
    if (wantedLevels && !wantedLevels.has((r.level ?? '').toUpperCase())) return false;
    if (ownedComponents && r.componentName && !ownedComponents.has(r.componentName)) return false;
    return true;
  });
}
