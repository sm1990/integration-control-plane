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

import { useMemo, useState } from 'react';
import { DEFAULT_HOURS, TIME_PRESETS, toLocalInput } from '../utils/logs';

export interface LogsFiltersState {
  envFilter: string[];
  setEnvFilter: (v: string[]) => void;
  levelFilter: string[];
  setLevelFilter: (v: string[]) => void;
  timePreset: string;
  setTimePreset: (v: string) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  searchPhrase: string;
  setSearchPhrase: (v: string) => void;
  sortDir: 'asc' | 'desc';
  setSortDir: (v: 'asc' | 'desc') => void;
  autoFetch: boolean;
  setAutoFetch: (v: boolean) => void;
  startTime: string;
  endTime: string;
  clearFilters: () => void;
}

export function useLogsFilters(): LogsFiltersState {
  const [envFilter, setEnvFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [timePreset, setTimePreset] = useState<string>('Past 24 hours');
  const [customStart, setCustomStart] = useState(() => toLocalInput(new Date(Date.now() - 24 * 3600_000)));
  const [customEnd, setCustomEnd] = useState(() => toLocalInput(new Date()));
  const [searchPhrase, setSearchPhrase] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [autoFetch, setAutoFetch] = useState(true);

  const { startTime, endTime } = useMemo(() => {
    if (timePreset === 'custom') {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { startTime: start.toISOString(), endTime: end.toISOString() };
      }
    }
    const preset = TIME_PRESETS.find((p) => p.label === timePreset);
    const hours = preset?.hours ?? DEFAULT_HOURS;
    const now = new Date();
    return {
      startTime: new Date(now.getTime() - hours * 3600_000).toISOString(),
      endTime: now.toISOString(),
    };
  }, [timePreset, customStart, customEnd]);

  const clearFilters = () => {
    setEnvFilter([]);
    setLevelFilter([]);
    setSearchPhrase('');
    setTimePreset('Past 24 hours');
  };

  return {
    envFilter,
    setEnvFilter,
    levelFilter,
    setLevelFilter,
    timePreset,
    setTimePreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    searchPhrase,
    setSearchPhrase,
    sortDir,
    setSortDir,
    autoFetch,
    setAutoFetch,
    startTime,
    endTime,
    clearFilters,
  };
}
