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

import { choreoClient, systemClient, withScopeRetry } from './httpClients';
import { gql } from './graphql';
import type { StopScheduleInput, ExecutionConfigs, TaskExecution, ExecutionLogEntry, UpdateJobConfigsInput, TriggerComponentInput, TriggerRunResult, ExecutionArgument, RuntimeArgument } from '../../types/executions';
import { stopDeployment } from './deployments';
import type { TriggerTaskInput } from '../../types/artifact';

const EXECUTION_CONFIGS_QUERY = `
  query GetExecutionConfigs($componentId: String!, $releaseId: String!) {
    executionConfigs(componentId: $componentId, releaseId: $releaseId) {
      cronjobFrequency, cronjobTimezone, cronjobAllowConcurrency, timeoutSeconds, retryCount
    }
  }`;

const EXECUTION_ARGUMENTS_QUERY = `
  query GetExecutionArguments($id: String!, $componentId: String!, $releaseId: String!) {
    execution(input: { id: $id, componentId: $componentId, releaseId: $releaseId }) {
      arguments { argumentName, argumentValue }
    }
  }`;

const RUNTIME_ARGUMENTS_QUERY = `
  query GetRuntimeArguments($componentId: String!, $deploymentTrackId: String!, $commitHash: String!) {
    runtimeArguments(componentId: $componentId, deploymentTrackId: $deploymentTrackId, commitHash: $commitHash) {
      name, type, prefix, displayName, description, delimiter, values, repeat, required
    }
  }`;

const UPDATE_JOB_CONFIGS = `
  mutation UpdateJobConfigs($input: JobConfigInput!) {
    updateJobConfigs(input: $input)
  }`;

const TRIGGER_ARTIFACT = `
  mutation TriggerTask($input: ArtifactTriggerInput!) {
    triggerArtifact(input: $input) {
      status, message, successCount, failedCount, details
    }
  }`;

export async function fetchExecutionConfigs(componentId: string, releaseId: string): Promise<ExecutionConfigs | null> {
  return gql<{ executionConfigs: ExecutionConfigs }>(EXECUTION_CONFIGS_QUERY, { componentId, releaseId })
    .then((d) => d.executionConfigs)
    .catch(() => null);
}

// 100 (up from a prior hardcoded 10) so the Automation Insights view's
// scatter/heatmap/trend charts have enough real history to be meaningful —
// existing callers (the Overview executions table) already paginate this
// client-side (5/10/25 rows/page), so a larger server-side fetch just gives
// them more rows to page through, not a behavior change.
export async function fetchTaskExecutions(releaseId: string): Promise<TaskExecution[]> {
  return systemClient.get<TaskExecution[]>(`/systemapis/choreoobsapi/0.3.0/tasks/executions?releaseId=${encodeURIComponent(releaseId)}&limit=100&verbose=true`);
}

/**
 * The automation's declared runtime arguments (entrypoint signature for Ballerina,
 * user-declared CLI args for image components). Drives the Test form. Resolves to
 * `[]` when none are declared — the caller then renders a trigger-only form.
 */
export async function fetchRuntimeArguments(componentId: string, deploymentTrackId: string, commitHash: string): Promise<RuntimeArgument[]> {
  return gql<{ runtimeArguments: RuntimeArgument[] }>(RUNTIME_ARGUMENTS_QUERY, { componentId, deploymentTrackId, commitHash }).then((d) => d.runtimeArguments ?? []);
}

export async function fetchExecutionArguments(runId: string, componentId: string, releaseId: string): Promise<ExecutionArgument[]> {
  return gql<{ execution: { arguments: ExecutionArgument[] } }>(EXECUTION_ARGUMENTS_QUERY, { id: runId, componentId, releaseId })
    .then((d) => d.execution?.arguments ?? [])
    .catch(() => []);
}

export async function fetchExecutionLogs(componentId: string, deploymentTrackId: string, executionId: string, environmentId: string): Promise<ExecutionLogEntry[]> {
  const data = await systemClient.get<{ columns: { name: string }[]; rows: string[][] }>(
    `/systemapis/choreologgingapi/0.2.0/components/${componentId}/deployment-tracks/${deploymentTrackId}/executions/${executionId}/logs?environmentId=${environmentId}&offset=0&limit=10000`,
  );
  const logIdx = data.columns?.findIndex((c) => c.name === 'LogEntry') ?? -1;
  const timeIdx = data.columns?.findIndex((c) => c.name === 'TimeGenerated') ?? -1;
  return (data.rows ?? []).map((row) => ({
    timestamp: timeIdx >= 0 ? row[timeIdx] : '',
    message: logIdx >= 0 ? row[logIdx] : (row[0] ?? ''),
  }));
}

export async function fetchTaskExecutionCount(releaseId: string): Promise<number | null> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  const data = await systemClient.get<{ count: number }>(`/systemapis/choreoobsapi/0.3.0/tasks/executions/count?releaseId=${encodeURIComponent(releaseId)}&from=${from.toISOString()}&to=${to.toISOString()}`);
  return data.count ?? null;
}

// wip has no schedule-only endpoint: clearCron on the stop mutation is how a schedule is stopped there.
export async function stopSchedule(input: StopScheduleInput): Promise<void> {
  await stopDeployment({ orgHandler: input.orgHandler, componentId: input.componentId, releaseId: input.releaseId, type: 'scheduledTask', clearCron: true });
}

export async function updateJobConfigs(input: UpdateJobConfigsInput): Promise<boolean> {
  return gql<{ updateJobConfigs: boolean }>(UPDATE_JOB_CONFIGS, { input }).then((d) => d.updateJobConfigs);
}

export async function triggerTask(input: TriggerTaskInput): Promise<{ status: string; message: string; successCount: number; failedCount: number; details: string[] }> {
  return gql<{ triggerArtifact: { status: string; message: string; successCount: number; failedCount: number; details: string[] } }>(TRIGGER_ARTIFACT, {
    input: { componentId: input.componentId, taskName: input.taskName },
  }).then((d) => d.triggerArtifact);
}

export async function triggerComponentRun(input: TriggerComponentInput): Promise<TriggerRunResult> {
  const path = `/component-mgt/1.0.0/orgs/${input.orgHandler}/projects/${input.projectId}/components/${input.componentId}/releases/${input.releaseId}/run-pod`;
  const res = await withScopeRetry(() => choreoClient.post<{ data?: { runId?: string } }>(path, { args: input.args ?? [] }));
  return { runId: res?.data?.runId ?? null };
}
