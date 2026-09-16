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
import { executionIdTail, executionPhase, isInProgressStatus, isTerminalStatus } from './executionStatus';

describe('executionPhase', () => {
  it('maps succeeded and success to succeeded', () => {
    expect(executionPhase('succeeded')).toBe('succeeded');
    expect(executionPhase('success')).toBe('succeeded');
  });

  it('maps failed and failure to failed', () => {
    expect(executionPhase('failed')).toBe('failed');
    expect(executionPhase('failure')).toBe('failed');
  });

  it('maps terminated to terminated', () => {
    expect(executionPhase('terminated')).toBe('terminated');
  });

  it('maps inprogress and running to inProgress', () => {
    expect(executionPhase('inprogress')).toBe('inProgress');
    expect(executionPhase('running')).toBe('inProgress');
  });

  it('is case-insensitive', () => {
    expect(executionPhase('SUCCEEDED')).toBe('succeeded');
    expect(executionPhase('Running')).toBe('inProgress');
  });

  it('defaults unrecognized values to queued', () => {
    expect(executionPhase('pending')).toBe('queued');
    expect(executionPhase('')).toBe('queued');
  });

  it('defaults undefined to queued', () => {
    expect(executionPhase(undefined)).toBe('queued');
  });
});

describe('isTerminalStatus', () => {
  it('is true for succeeded, failed and terminated', () => {
    expect(isTerminalStatus('succeeded')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('terminated')).toBe(true);
  });

  it('is false for in-progress and queued statuses', () => {
    expect(isTerminalStatus('running')).toBe(false);
    expect(isTerminalStatus('queued')).toBe(false);
  });

  it('is false for undefined', () => {
    expect(isTerminalStatus(undefined)).toBe(false);
  });
});

describe('isInProgressStatus', () => {
  it('is the inverse of isTerminalStatus for terminal statuses', () => {
    expect(isInProgressStatus('succeeded')).toBe(false);
    expect(isInProgressStatus('failed')).toBe(false);
    expect(isInProgressStatus('terminated')).toBe(false);
  });

  it('is true for non-terminal statuses', () => {
    expect(isInProgressStatus('running')).toBe(true);
    expect(isInProgressStatus('queued')).toBe(true);
  });

  it('is true for undefined', () => {
    expect(isInProgressStatus(undefined)).toBe(true);
  });
});

describe('executionIdTail', () => {
  it('keeps the trailing hash and run segments', () => {
    expect(executionIdTail('scheduled-logger-development-28ec91fb-29812664')).toBe('28ec91fb-29812664');
  });

  it('leaves a name with nothing to trim alone', () => {
    expect(executionIdTail('run-1')).toBe('run-1');
    expect(executionIdTail('run')).toBe('run');
  });
});
