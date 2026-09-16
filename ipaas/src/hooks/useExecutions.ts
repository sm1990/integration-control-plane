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

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchExecutionConfigs, fetchTaskExecutions, fetchRuntimeArguments, fetchExecutionArguments, fetchExecutionLogs, fetchTaskExecutionCount, updateJobConfigs, stopSchedule, triggerTask, triggerComponentRun } from '#api/executions';
import type { StopScheduleInput, ExecutionConfigs, TaskExecution, ExecutionLogEntry, ExecutionLogWindow, UpdateJobConfigsInput, TriggerComponentInput, RuntimeArgument } from '../types/executions';
import type { TriggerTaskInput } from '../types/artifact';
import { IS_CLOUD } from '../features';

// The cloud (OpenChoreo) product scopes schedules + executions per environment, so
// its #api implementation accepts extra positional args (envId/projectId) beyond
// the shared ExecutionsApi contract, which wip keys by releaseId alone. The narrow
// contract function is assignable to the wider signature, and the extra args are
// only ever supplied from the IS_CLOUD branch below (where the cloud build wires
// the wide implementation).
const fetchExecutionConfigsScoped: (componentId: string, releaseId: string, envId: string) => Promise<ExecutionConfigs | null> = fetchExecutionConfigs;
const fetchTaskExecutionsScoped: (releaseId: string, componentId: string, envId: string, projectId: string) => Promise<TaskExecution[]> = fetchTaskExecutions;
const fetchTaskExecutionCountScoped: (releaseId: string, componentId: string, envId: string, projectId: string) => Promise<number | null> = fetchTaskExecutionCount;
const fetchExecutionLogsScoped: (componentId: string, deploymentTrackId: string, executionId: string, environmentId: string, run?: ExecutionLogWindow) => Promise<ExecutionLogEntry[]> = fetchExecutionLogs;

// The cloud product keys schedules per environment and has no systemapis base URL,
// whereas wip keys by releaseId and reaches the observability API through
// systemApisBaseUrl. The cache key, fetcher, and enable guard co-vary per product,
// so each hook selects them as one `wiring` block; the rest of the query config is
// shared.
export function useExecutionConfigs(componentId: string, releaseId: string, envId = '') {
  const wiring = IS_CLOUD
    ? { queryKey: ['executionConfigs', componentId, releaseId, envId], queryFn: () => fetchExecutionConfigsScoped(componentId, releaseId, envId), enabled: !!componentId && !!envId && !!releaseId }
    : { queryKey: ['executionConfigs', componentId, releaseId], queryFn: () => fetchExecutionConfigs(componentId, releaseId), enabled: !!componentId && !!releaseId };
  return useQuery({ ...wiring, retry: false });
}

export function useTaskExecutions(releaseId: string, componentId = '', envId = '', projectId = '', refetchInterval: number | false = false) {
  const baseUrl = window.API_CONFIG?.systemApisBaseUrl ?? '';
  const wiring = IS_CLOUD
    ? { queryKey: ['taskExecutions', releaseId, componentId, envId, projectId], queryFn: () => fetchTaskExecutionsScoped(releaseId, componentId, envId, projectId), enabled: !!componentId && !!envId }
    : { queryKey: ['taskExecutions', releaseId, baseUrl], queryFn: () => fetchTaskExecutions(releaseId), enabled: !!baseUrl && !!releaseId };
  return useQuery({ ...wiring, retry: false, staleTime: 0, placeholderData: keepPreviousData, refetchInterval });
}

/**
 * The automation's runtime-argument schema, keyed by the deployed commit. An empty
 * array means "no declared args" — the Test page then shows a trigger-only form.
 * `retry: false` so a 404 (no schema for this component) surfaces promptly to the
 * caller, which treats it the same as an empty schema.
 */
export function useRuntimeArguments(componentId: string, deploymentTrackId: string, commitHash: string, enabled = true) {
  return useQuery<RuntimeArgument[]>({
    queryKey: ['runtimeArguments', componentId, deploymentTrackId, commitHash],
    queryFn: () => fetchRuntimeArguments(componentId, deploymentTrackId, commitHash),
    enabled: enabled && !!componentId && !!deploymentTrackId && !!commitHash,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExecutionArguments(runId: string, componentId: string, releaseId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['executionArguments', runId, componentId, releaseId],
    queryFn: () => fetchExecutionArguments(runId, componentId, releaseId),
    enabled: enabled && !!runId && !!componentId && !!releaseId,
    retry: false,
    staleTime: 60000,
  });
}

// `run` bounds the query to the execution; cloud needs it because the
// observability proxy filters logs by component and time, not by run.
//
// The cloud branch drops the systemApisBaseUrl and deploymentTrackId guards:
// neither exists in this deployment (SYSTEM_APIS_BASE_URL is empty), so keeping
// them would leave the query permanently disabled. The run's completionTime is
// appended last so it participates in the cache key — a run still in flight
// refetches as it finishes — while leaving the leading key parts intact for
// callers that invalidate by prefix.
export function useExecutionLogs(componentId: string, deploymentTrackId: string, executionId: string, environmentId: string, enabled: boolean, run?: ExecutionLogWindow) {
  const baseUrl = window.API_CONFIG?.systemApisBaseUrl ?? '';
  const wiring = IS_CLOUD
    ? {
        queryKey: ['executionLogs', componentId, deploymentTrackId, executionId, environmentId, run?.completionTime ?? ''],
        queryFn: () => fetchExecutionLogsScoped(componentId, deploymentTrackId, executionId, environmentId, run),
        enabled: enabled && !!componentId && !!executionId && !!environmentId,
      }
    : {
        queryKey: ['executionLogs', componentId, deploymentTrackId, executionId, environmentId, baseUrl],
        queryFn: () => fetchExecutionLogs(componentId, deploymentTrackId, executionId, environmentId),
        enabled: enabled && !!baseUrl && !!componentId && !!deploymentTrackId && !!executionId && !!environmentId,
      };
  return useQuery({
    ...wiring,
    retry: false,
    staleTime: 30000,
  });
}

// `enabled` lets a caller skip the count fetch entirely — the cloud overview
// derives its count from the already-fetched executions list, so it disables this.
export function useTaskExecutionCount(releaseId: string, componentId = '', envId = '', projectId = '', enabled = true) {
  const baseUrl = window.API_CONFIG?.systemApisBaseUrl ?? '';
  const wiring = IS_CLOUD
    ? { queryKey: ['taskExecutionCount', releaseId, componentId, envId, projectId], queryFn: () => fetchTaskExecutionCountScoped(releaseId, componentId, envId, projectId), enabled: enabled && !!componentId && !!envId }
    : { queryKey: ['taskExecutionCount', releaseId, baseUrl], queryFn: () => fetchTaskExecutionCount(releaseId), enabled: enabled && !!baseUrl && !!releaseId };
  return useQuery({ ...wiring, retry: false, staleTime: 30_000, refetchInterval: 30_000 });
}

export function useUpdateJobConfigs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJobConfigsInput) => updateJobConfigs(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['executionConfigs', input.componentId] });
    },
  });
}

export function useStopSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StopScheduleInput) => stopSchedule(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executionConfigs'] }),
  });
}

export function useTriggerTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TriggerTaskInput) => triggerTask(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artifacts', 'Task'] });
    },
  });
}

export function useTriggerComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TriggerComponentInput) => triggerComponentRun(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['taskExecutions', input.releaseId] });
    },
  });
}
