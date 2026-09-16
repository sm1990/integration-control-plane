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

export type ExecutionPhase = 'queued' | 'inProgress' | 'succeeded' | 'failed' | 'terminated';

/** Collapse the backend's status casings/synonyms into one canonical phase. */
/** Identifying tail of an execution name: "…-development-28ec91fb-29812664" → "28ec91fb-29812664". */
export function executionIdTail(id: string): string {
  const parts = id.split('-');
  return parts.length > 2 ? parts.slice(-2).join('-') : id;
}

export function executionPhase(status: string | undefined): ExecutionPhase {
  const val = (status ?? '').toLowerCase();
  if (val === 'succeeded' || val === 'success') return 'succeeded';
  if (val === 'failed' || val === 'failure') return 'failed';
  if (val === 'terminated') return 'terminated';
  if (val === 'inprogress' || val === 'running') return 'inProgress';
  return 'queued';
}

export function isTerminalStatus(status: string | undefined): boolean {
  const phase = executionPhase(status);
  return phase === 'succeeded' || phase === 'failed' || phase === 'terminated';
}

export function isInProgressStatus(status: string | undefined): boolean {
  return !isTerminalStatus(status);
}
