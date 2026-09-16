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

import { describe, expect, it, vi } from 'vitest';
import { copyLog, DISPLAY_FIELDS, downloadLogs, filterLogLines, filterLogRows, formatValue, LEVEL_COLORS, levelColor, statusCodeColor, toLocalInput } from './logs';
import type { LogRow } from '../types/logs';

const makeLogRow = (overrides: Partial<LogRow> = {}): LogRow => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  level: 'INFO',
  logLine: 'hello world',
  class: null,
  logFilePath: null,
  appName: null,
  module: null,
  serviceType: null,
  app: null,
  deployment: null,
  artifactContainer: null,
  product: null,
  icpRuntimeId: null,
  logContext: null,
  componentVersion: 'v1',
  componentVersionId: 'cv1',
  gatewayCode: null,
  statusCode: null,
  componentName: null,
  containerName: null,
  podName: null,
  ...overrides,
});

describe('levelColor', () => {
  it('returns the color for each known level', () => {
    Object.keys(LEVEL_COLORS).forEach((level) => {
      expect(levelColor(level)).toEqual(LEVEL_COLORS[level]);
    });
  });

  it('falls back to the default color for an unknown level', () => {
    expect(levelColor('TRACE')).toEqual({ bg: '#eceff1', text: '#37474f' });
  });
});

describe('statusCodeColor', () => {
  it('returns blue for 2xx codes', () => {
    expect(statusCodeColor('200')).toEqual({ bg: '#e3f2fd', text: '#0d47a1' });
    expect(statusCodeColor('299')).toEqual({ bg: '#e3f2fd', text: '#0d47a1' });
  });

  it('returns orange for 3xx codes', () => {
    expect(statusCodeColor('301')).toEqual({ bg: '#fff3e0', text: '#e65100' });
  });

  it('returns red for 4xx and 5xx codes', () => {
    expect(statusCodeColor('404')).toEqual({ bg: '#ffebee', text: '#b71c1c' });
    expect(statusCodeColor('500')).toEqual({ bg: '#ffebee', text: '#b71c1c' });
  });

  it('falls back to the default color for codes outside known ranges', () => {
    expect(statusCodeColor('100')).toEqual({ bg: '#eceff1', text: '#37474f' });
  });

  it('falls back to the default color for null', () => {
    expect(statusCodeColor(null)).toEqual({ bg: '#eceff1', text: '#37474f' });
  });
});

describe('formatValue', () => {
  it('returns an empty string for null, undefined and empty string', () => {
    expect(formatValue(null)).toBe('');
    expect(formatValue(undefined)).toBe('');
    expect(formatValue('')).toBe('');
  });

  it('stringifies objects with indentation', () => {
    expect(formatValue({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it('converts primitives to strings', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(true)).toBe('true');
    expect(formatValue('hello')).toBe('hello');
  });
});

describe('toLocalInput', () => {
  it('formats a date as a zero-padded local datetime string', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(toLocalInput(d)).toBe('2026-01-05T09:07');
  });

  it('zero-pads single-digit month, day, hour and minute', () => {
    const d = new Date(2026, 8, 1, 0, 0);
    expect(toLocalInput(d)).toBe('2026-09-01T00:00');
  });
});

describe('copyLog', () => {
  const stubClipboard = () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    return writeText;
  };

  it('copies timestamp and log line with only the always-present metadata fields', () => {
    const writeText = stubClipboard();
    const log = makeLogRow();
    copyLog(log);
    const expectedMeta = JSON.stringify({ componentVersion: 'v1', componentVersionId: 'cv1', level: 'INFO' });
    expect(writeText).toHaveBeenCalledWith(`2026-01-01T00:00:00.000Z hello world ${expectedMeta}`);
  });

  it('appends metadata for populated optional fields', () => {
    const writeText = stubClipboard();
    const log = makeLogRow({ appName: 'my-app', componentVersion: 'v2', level: 'ERROR', logContext: 'ctx1' });
    copyLog(log);
    const expectedMeta = JSON.stringify({
      appName: 'my-app',
      componentVersion: 'v2',
      componentVersionId: 'cv1',
      level: 'ERROR',
      logContext: 'ctx1',
    });
    expect(writeText).toHaveBeenCalledWith(`2026-01-01T00:00:00.000Z hello world ${expectedMeta}`);
  });
});

describe('downloadLogs', () => {
  it('triggers a text file download built from the log rows', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const logs = [makeLogRow({ timestamp: '2026-01-01T00:00:00.000Z', level: 'INFO', logLine: 'first' })];
    downloadLogs(logs);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
  });

  it('handles an empty log list', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    expect(() => downloadLogs([])).not.toThrow();

    clickSpy.mockRestore();
  });
});

describe('filterLogLines', () => {
  it('splits on both newline styles and returns every line when not filtering', () => {
    expect(filterLogLines('a\r\nb\nc', '', false)).toEqual(['a', 'b', 'c']);
    expect(filterLogLines('', 'x', true)).toEqual([]);
  });

  it('keeps only matching lines, case-insensitively, when filtering', () => {
    expect(filterLogLines('INFO ready\nERROR boom', 'error', true)).toEqual(['ERROR boom']);
    expect(filterLogLines('INFO ready\nERROR boom', '   ', true)).toEqual(['INFO ready', 'ERROR boom']);
  });
});

describe('filterLogRows', () => {
  const info = makeLogRow({ level: 'INFO', componentName: 'scheduled-logger' });
  const error = makeLogRow({ level: 'ERROR', componentName: 'scheduled-logger' });
  const editor = makeLogRow({ level: 'INFO', componentName: 'code-server-c904c59240' });
  const unattributed = makeLogRow({ level: 'INFO', componentName: null });

  // The default state of the Runtime Logs pages: no level picked, everything shown.
  it('keeps every row when neither filter is set', () => {
    const rows = [info, error, editor];
    expect(filterLogRows(rows, {})).toBe(rows);
    expect(filterLogRows(rows, { levels: [], componentIds: [] })).toBe(rows);
  });

  it('keeps only the selected levels', () => {
    expect(filterLogRows([info, error], { levels: ['ERROR'] })).toEqual([error]);
  });

  // Level values come from a backend, so their casing is not ours to trust.
  it('matches levels case-insensitively', () => {
    expect(filterLogRows([makeLogRow({ level: 'info' })], { levels: ['INFO'] })).toHaveLength(1);
  });

  it('drops a row with no level once a level is selected', () => {
    const blank = makeLogRow({ level: '' });
    expect(filterLogRows([blank], {})).toEqual([blank]);
    expect(filterLogRows([blank], { levels: ['INFO'] })).toEqual([]);
  });

  // A project-scoped query returns the project's editor pods too; those are
  // workloads the console does not list.
  it('drops rows from components outside the allowlist', () => {
    expect(filterLogRows([info, editor], { componentIds: ['scheduled-logger'] })).toEqual([info]);
  });

  // An unplaceable row must not be silently discarded.
  it('keeps a row that reports no component', () => {
    expect(filterLogRows([unattributed], { componentIds: ['scheduled-logger'] })).toEqual([unattributed]);
  });

  it('applies both filters together', () => {
    expect(filterLogRows([info, error, editor], { levels: ['INFO'], componentIds: ['scheduled-logger'] })).toEqual([info]);
  });
});

describe('DISPLAY_FIELDS', () => {
  // A new LogRow field is invisible in the expanded row until it is listed here.
  it('exposes the Kubernetes provenance fields', () => {
    const keys = DISPLAY_FIELDS.map((f) => f.key);
    expect(keys).toContain('componentName');
    expect(keys).toContain('containerName');
    expect(keys).toContain('podName');
  });
});
