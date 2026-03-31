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

import type { LogRow } from '../api/logs';

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
  WARN:  { bg: '#fff3e0', text: '#e65100' },
  INFO:  { bg: '#e3f2fd', text: '#0d47a1' },
  DEBUG: { bg: '#eceff1', text: '#37474f' },
};

export const DISPLAY_FIELDS: { key: keyof LogRow; label: string }[] = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'level', label: 'Log Level' },
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
];

export function levelColor(level: string): { bg: string; text: string } {
  return LEVEL_COLORS[level] ?? { bg: '#eceff1', text: '#37474f' };
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
