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

import { describe, expect, it } from 'vitest';
import { PENDING_EXPIRY_MS, unclaimedDueTimes } from './pendingExecutions';
import type { TaskExecution } from '../types/executions';

const NOW = 1_700_000_000_000;

function execution(startMs: number, status = 'InProgress'): TaskExecution {
  return { id: `e-${startMs}`, startTime: String(Math.floor(startMs / 1000)), completionTime: '', runId: '', revisionId: '', failedReason: '', status };
}

describe('unclaimedDueTimes', () => {
  it('keeps a due time no execution has reached yet', () => {
    expect(unclaimedDueTimes([NOW - 2000], [], NOW)).toEqual([NOW - 2000]);
  });

  it('drops a due time once an execution starts at or after it', () => {
    expect(unclaimedDueTimes([NOW - 10_000], [execution(NOW - 9000)], NOW)).toEqual([]);
  });

  it('matches an execution that started just before its due time', () => {
    expect(unclaimedDueTimes([NOW - 10_000], [execution(NOW - 13_000)], NOW)).toEqual([]);
  });

  it('ignores an execution that predates the due time beyond the tolerance', () => {
    const dueTime = NOW - 10_000;
    expect(unclaimedDueTimes([dueTime], [execution(NOW - 60_000)], NOW)).toEqual([dueTime]);
  });

  it('gives each due time its own execution', () => {
    const first = NOW - 120_000;
    const second = NOW - 60_000;
    expect(unclaimedDueTimes([first, second], [execution(first + 1000), execution(second + 1000)], NOW)).toEqual([]);
  });

  it('attributes a lone late execution to the newest due time it could have come from', () => {
    const older = NOW - 70_000;
    const newer = NOW - 10_000;
    expect(unclaimedDueTimes([older, newer], [execution(newer + 1000)], NOW)).toEqual([older]);
  });

  it('still matches an execution that started well after its due time', () => {
    // A slow image pull can delay the job by far more than the match tolerance.
    expect(unclaimedDueTimes([NOW - 90_000], [execution(NOW - 30_000)], NOW)).toEqual([]);
  });

  it('returns due times newest first', () => {
    const older = NOW - 40_000;
    const newer = NOW - 10_000;
    expect(unclaimedDueTimes([older, newer], [], NOW)).toEqual([newer, older]);
  });

  it('expires a due time that no execution ever claimed', () => {
    expect(unclaimedDueTimes([NOW - PENDING_EXPIRY_MS - 1], [], NOW)).toEqual([]);
  });

  it('expires each due time independently', () => {
    const stale = NOW - PENDING_EXPIRY_MS - 1;
    const fresh = NOW - 5000;
    expect(unclaimedDueTimes([stale, fresh], [], NOW)).toEqual([fresh]);
  });

  it('skips executions with no start time', () => {
    const dueTime = NOW - 5000;
    const queued: TaskExecution = { ...execution(NOW), startTime: '' };
    expect(unclaimedDueTimes([dueTime], [queued], NOW)).toEqual([dueTime]);
  });
});
