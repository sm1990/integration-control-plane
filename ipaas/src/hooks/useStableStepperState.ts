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

import { useRef } from 'react';
import { isFailedConclusion, mergeForward, type StepperState } from '../utils/buildProgress';

interface PersistedState {
  activeIndex: number;
  isError: boolean;
  skippedStages: number[];
  failedStages: number[];
  passedStages?: number[];
}

interface RefState {
  buildId: number | null;
  state: StepperState;
  hasRealData: boolean;
  /** Signature of what is already in storage, so identical state is not rewritten. */
  persisted: string | null;
}

const STORAGE_KEY_PREFIX = 'integration-platform-build-stepper-';

function copyState(s: StepperState): StepperState {
  return { activeIndex: s.activeIndex, isError: s.isError, skippedStages: new Set(s.skippedStages), failedStages: new Set(s.failedStages), passedStages: new Set(s.passedStages) };
}

function readFromStorage(buildId: number): StepperState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PREFIX + buildId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      activeIndex: parsed.activeIndex,
      isError: parsed.isError,
      skippedStages: new Set(parsed.skippedStages),
      failedStages: new Set(parsed.failedStages),
      passedStages: new Set(parsed.passedStages),
    };
  } catch {
    // Malformed entry or storage unavailable — treat as a cache miss.
    return null;
  }
}

function stateSignature(s: StepperState): string {
  const set = (v: Set<number>) => [...v].sort((a, b) => a - b).join('.');
  return [s.activeIndex, s.isError ? 1 : 0, set(s.skippedStages), set(s.failedStages), set(s.passedStages)].join('|');
}

function writeToStorage(buildId: number, state: StepperState): void {
  try {
    const toStore: PersistedState = {
      activeIndex: state.activeIndex,
      isError: state.isError,
      skippedStages: [...state.skippedStages],
      failedStages: [...state.failedStages],
      passedStages: [...state.passedStages],
    };
    sessionStorage.setItem(STORAGE_KEY_PREFIX + buildId, JSON.stringify(toStore));
  } catch {
    // sessionStorage unavailable — the in-memory ref still prevents
    // oscillation for the life of this mount.
  }
}

/**
 * Mirror the state to storage only when it actually changed. The stepper renders
 * many times per build — polls, parent re-renders — and a completed build would
 * otherwise re-serialise the same object on every one of them.
 */
function persist(ref: RefState, buildId: number | null, state: StepperState): void {
  if (buildId === null) return;
  const signature = stateSignature(state);
  if (ref.persisted === signature) return;
  writeToStorage(buildId, state);
  ref.persisted = signature;
}

export interface StableStepperResult {
  state: StepperState;
  /** `false` while a finished build's real state is still unknown — render a placeholder, not a guess. */
  isReadyToShow: boolean;
}

/**
 * Keeps the build stepper monotonic. Build logs are polled, and a poll can come
 * back partial, stale, or empty; feeding that straight to the stepper makes it
 * jump backwards or flash "not started" mid-build. So while a build runs we only
 * ever merge forward — max of the active index, union of the skipped/failed sets,
 * error latched once set — and mirror the result into sessionStorage keyed by
 * build id so a reload or a navigation away and back resumes where it was
 * instead of restarting at stage 0.
 *
 * A finished build is authoritative when it succeeded. A failure keeps merging
 * forward instead, because the final log snapshot often still shows the breaking
 * step as running — and if its logs never arrived at all, the last known stable
 * state plus `isError` beats an all-red guess.
 */
export function useStableStepperState(buildId: number | null, rawState: StepperState, buildStatus: string | undefined, buildConclusion: string | null | undefined, logsAvailable: boolean): StableStepperResult {
  const stableRef = useRef<RefState>({ buildId: null, state: copyState(rawState), hasRealData: false, persisted: null });

  const isInProgress = buildStatus === 'in_progress';
  const isCompleted = buildStatus === 'completed';
  const isSuccess = buildConclusion === 'success';
  const isFailure = isFailedConclusion(buildConclusion);

  // A new build (or the first mount, where the ref's id is still null) resets
  // the ratchet. Done during render on purpose: deferring to an effect would
  // show one frame of the previous build's progress.
  if (stableRef.current.buildId !== buildId) {
    const stored = buildId !== null ? readFromStorage(buildId) : null;
    stableRef.current = { buildId, state: stored ?? copyState(rawState), hasRealData: stored !== null, persisted: stored ? stateSignature(stored) : null };
  }

  if (isCompleted) {
    if (isSuccess || logsAvailable) {
      // A success is fully authoritative — take it as-is, so a transient failed
      // step recorded mid-run cannot leave a red stage on a green build. A
      // failure still merges forward: the run's last log snapshot often has the
      // breaking step unresolved, and raw alone would drag the stepper back to
      // an earlier stage and mark that one failed.
      const settled = isSuccess ? rawState : mergeForward(stableRef.current.state, rawState);
      persist(stableRef.current, buildId, settled);
      stableRef.current.state = copyState(settled);
      stableRef.current.hasRealData = true;
      return { state: settled, isReadyToShow: true };
    }
    if (isFailure && stableRef.current.hasRealData) {
      // Failed with no logs, but we watched it run — freeze where it got to.
      return { state: { ...stableRef.current.state, isError: true }, isReadyToShow: true };
    }
    return { state: rawState, isReadyToShow: false };
  }

  if (!isInProgress) {
    return { state: rawState, isReadyToShow: true };
  }

  const stable = stableRef.current.state;
  const next = mergeForward(stable, rawState);

  const hasAdvanced =
    next.activeIndex !== stable.activeIndex || next.isError !== stable.isError || next.skippedStages.size !== stable.skippedStages.size || next.failedStages.size !== stable.failedStages.size || next.passedStages.size !== stable.passedStages.size;

  if (hasAdvanced) {
    stableRef.current.state = next;
    stableRef.current.hasRealData = true;
    persist(stableRef.current, buildId, next);
  }

  return { state: stableRef.current.state, isReadyToShow: true };
}
