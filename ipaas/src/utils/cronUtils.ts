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

export const INTERVAL_UNITS = ['Minute', 'Hour', 'Day', 'Week', 'Month'] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

export type CronField = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

export const CRON_FIELD_LABELS = [
  { key: 'minute', label: 'minute (0 - 59)', placeholder: '*/1' },
  { key: 'hour', label: 'hour (0 - 23)', placeholder: '*' },
  { key: 'dom', label: 'day of month (1 - 31)', placeholder: '*' },
  { key: 'month', label: 'month (1 - 12)', placeholder: '*' },
  { key: 'dow', label: 'day of week (0 - 6, Sun=0)', placeholder: '*' },
] as const;

export function getTimezoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const normalized = offset.replace(/^GMT$/, 'GMT+00:00').replace(/GMT([+-])(\d):/, 'GMT$10$2:');
    return `(${normalized}) ${tz}`;
  } catch {
    return tz;
  }
}

export const TIMEZONE_OPTIONS: { label: string; value: string }[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone').map((tz) => ({ label: getTimezoneLabel(tz), value: tz }));
  } catch {
    return [{ label: '(GMT+00:00) UTC', value: 'UTC' }];
  }
})();

export function intervalToCron(count: number, unit: IntervalUnit): string {
  const n = Math.max(1, count);
  switch (unit) {
    case 'Minute':
      return `*/${n} * * * *`;
    case 'Hour':
      return `0 */${n} * * *`;
    case 'Day':
      return `0 0 */${n} * *`;
    case 'Week':
      return `0 0 * * ${n % 7}`;
    case 'Month':
      return `0 0 1 */${n} *`;
  }
}

export function cronToInterval(cron: string): { count: number; unit: IntervalUnit } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return { count: parseInt(min.slice(2), 10) || 1, unit: 'Minute' };
  }
  if (min === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    return { count: parseInt(hour.slice(2), 10) || 1, unit: 'Hour' };
  }
  if (min === '0' && hour === '0' && dom.startsWith('*/') && month === '*' && dow === '*') {
    return { count: parseInt(dom.slice(2), 10) || 1, unit: 'Day' };
  }
  if (min === '0' && hour === '0' && dom === '*' && month === '*' && dow !== '*') {
    return { count: parseInt(dow, 10) || 1, unit: 'Week' };
  }
  if (min === '0' && hour === '0' && dom === '1' && month.startsWith('*/') && dow === '*') {
    return { count: parseInt(month.slice(2), 10) || 1, unit: 'Month' };
  }
  return null;
}

export function parseCronParts(cron: string): Record<CronField, string> {
  const parts = cron.trim().split(/\s+/);
  return {
    minute: parts[0] ?? '*',
    hour: parts[1] ?? '*',
    dom: parts[2] ?? '*',
    month: parts[3] ?? '*',
    dow: parts[4] ?? '*',
  };
}

export function buildCronFromParts(fields: Record<CronField, string>): string {
  return `${fields.minute} ${fields.hour} ${fields.dom} ${fields.month} ${fields.dow}`;
}

export function nextCronRunMs(cron: string): number | null {
  const interval = cronToInterval(cron);
  if (!interval) return null;
  const now = new Date();
  const { count, unit } = interval;
  const next = new Date(now);
  switch (unit) {
    case 'Minute': {
      const nextMin = (Math.floor(now.getMinutes() / count) + 1) * count;
      next.setSeconds(0, 0);
      if (nextMin >= 60) {
        next.setMinutes(0);
        next.setHours(now.getHours() + 1);
      } else {
        next.setMinutes(nextMin);
      }
      break;
    }
    case 'Hour': {
      const nextH = (Math.floor(now.getHours() / count) + 1) * count;
      next.setMinutes(0, 0, 0);
      if (nextH >= 24) {
        next.setHours(0);
        next.setDate(now.getDate() + 1);
      } else {
        next.setHours(nextH);
      }
      break;
    }
    case 'Day':
      next.setDate(now.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      break;
    case 'Week':
      next.setDate(now.getDate() + (7 - now.getDay()));
      next.setHours(0, 0, 0, 0);
      break;
    case 'Month':
      next.setMonth(now.getMonth() + 1);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      break;
    default:
      return null;
  }
  return next.getTime();
}

export function formatTimeUntil(ms: number): string {
  const diff = Math.max(0, ms - Date.now());
  const totalSecs = Math.round(diff / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function describeCron(cron: string): string {
  const interval = cronToInterval(cron);
  if (!interval) return '';
  const { count, unit } = interval;
  return `Executes every ${count === 1 ? unit.toLowerCase() : `${count} ${unit.toLowerCase()}s`}`;
}
