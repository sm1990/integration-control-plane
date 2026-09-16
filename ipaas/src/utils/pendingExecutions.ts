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

import type { TaskExecution } from '../types/executions';

/** A job's own start lags the moment it was due, so matching absorbs the gap. */
export const PENDING_MATCH_TOLERANCE_MS = 5_000;

/** A due run the backend never reports is dropped rather than spinning forever. */
export const PENDING_EXPIRY_MS = 120_000;

function startedAtMs(execution: TaskExecution): number {
  const seconds = parseInt(execution.startTime, 10);
  return Number.isNaN(seconds) ? NaN : seconds * 1000;
}

/**
 * Due times the backend has not accounted for yet, newest first.
 *
 * Each execution is claimed by at most one due time, newest first. That ordering is what stops
 * a single late execution from settling an older due time whose job never appeared: the run
 * belongs to the most recent due time it could have come from. Expired entries are dropped —
 * a due time says a run was owed, not that one started.
 */
export function unclaimedDueTimes(dueTimes: number[], executions: TaskExecution[], nowMs: number): number[] {
  const starts = executions
    .map(startedAtMs)
    .filter((ms) => !Number.isNaN(ms))
    .sort((a, b) => a - b);
  const claimed = new Set<number>();
  const unclaimed: number[] = [];

  for (const dueTime of [...dueTimes].sort((a, b) => b - a)) {
    const index = starts.findIndex((start, i) => !claimed.has(i) && start >= dueTime - PENDING_MATCH_TOLERANCE_MS);
    if (index === -1) {
      if (nowMs - dueTime < PENDING_EXPIRY_MS) unclaimed.push(dueTime);
      continue;
    }
    claimed.add(index);
  }
  return unclaimed;
}
