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

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';
import { authenticatedFetch, refreshAccessToken } from '../auth/tokenManager';
import type { GqlArtifact, GqlComponent, GqlEnvironment, GqlProject, SchemaConfigItem } from './queries';
import { toBackendArtifactType } from './artifactToggleMutations';

export interface CreateProjectInput {
  name: string;
  handler: string;
  description: string;
  orgHandler: string;
}

const CREATE_PROJECT = `
  mutation CreateProject($name: String!, $description: String!, $projectHandler: String!, $orgHandler: String!, $orgId: Int!) {
    createProject(project: {
      name: $name,
      description: $description,
      projectHandler: $projectHandler,
      orgId: $orgId,
      orgHandler: $orgHandler,
      version: "1.0.0"
    }) {
      id, orgId, name, version, createdDate, handler, region,
      description, defaultDeploymentPipelineId, deploymentPipelineIds,
      type, updatedAt
    }
  }`;

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      gql<{ createProject: GqlProject }>(CREATE_PROJECT, {
        name: input.name,
        description: input.description,
        projectHandler: input.handler,
        orgHandler: input.orgHandler,
        orgId: window.API_CONFIG.asgardeoOrgNumericId,
      }).then((d) => d.createProject),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

// ── Environment CRUD ──

export interface EnvironmentInput {
  name: string;
  description: string;
  critical: boolean;
}

const CREATE_ENVIRONMENT = `
  mutation CreateEnvironment($name: String!, $description: String!, $critical: Boolean!) {
    createEnvironment(environment: { name: $name, description: $description, critical: $critical }) {
      id, name, description, critical, createdAt
    }
  }`;

const UPDATE_ENVIRONMENT = `
  mutation UpdateEnvironment($environmentId: String!, $name: String!, $description: String!, $critical: Boolean!) {
    updateEnvironment(environmentId: $environmentId, name: $name, description: $description, critical: $critical) {
      id, name, description, critical, createdAt
    }
  }`;

const DELETE_ENVIRONMENT = `
  mutation DeleteEnvironment($environmentId: String!) {
    deleteEnvironment(environmentId: $environmentId)
  }`;

export function useCreateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnvironmentInput) => gql<{ createEnvironment: GqlEnvironment }>(CREATE_ENVIRONMENT, { ...input }).then((d) => d.createEnvironment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}

export function useUpdateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnvironmentInput & { environmentId: string }) => gql<{ updateEnvironment: GqlEnvironment }>(UPDATE_ENVIRONMENT, { ...input }).then((d) => d.updateEnvironment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}

export function useDeleteEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (environmentId: string) => gql<{ deleteEnvironment: string }>(DELETE_ENVIRONMENT, { environmentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}

const DELETE_RUNTIME = `
  mutation DeleteRuntime($runtimeId: String!) {
    deleteRuntime(runtimeId: $runtimeId)
  }`;

export function useDeleteRuntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runtimeId }: { runtimeId: string; envId: string; projectId: string }) => gql<{ deleteRuntime: string }>(DELETE_RUNTIME, { runtimeId }),
    onSuccess: (_, { envId, projectId }) => {
      qc.invalidateQueries({ queryKey: ['runtimes'] });
      qc.invalidateQueries({ queryKey: ['projectRuntimes', envId, projectId] });
    },
  });
}

// ── Artifact status toggle ──

const UPDATE_ARTIFACT_STATUS = `
  mutation UpdateArtifactStatus($input: ArtifactStatusChangeInput!) {
    updateArtifactStatus(input: $input) {
      status, message, successCount, failedCount, details
    }
  }`;

const UPDATE_LISTENER_STATE = `
  mutation UpdateListenerState($input: ListenerControlInput!) {
    updateListenerState(input: $input) {
      success, message, commandIds
    }
  }`;

export interface ArtifactStatusInput {
  envId: string;
  componentId: string;
  artifactType: string;
  artifactName: string;
  status: 'active' | 'inactive';
}

export interface ListenerStateInput {
  runtimeIds: string[];
  listenerName: string;
  action: 'START' | 'STOP';
}

// ── Component CRUD ──

export interface CreateComponentInput {
  displayName: string;
  name: string;
  description: string;
  orgHandler: string;
  projectId: string;
  componentType: 'MI' | 'BI';
}

const CREATE_COMPONENT = `
  mutation CreateComponent($component: ComponentInput!) {
    createComponent(component: $component) {
      id, name, displayName, handler, orgId, projectId, createdAt, updatedAt
    }
  }`;

export function useCreateComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateComponentInput) =>
      gql<{ createComponent: GqlComponent }>(CREATE_COMPONENT, {
        component: {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          orgId: window.API_CONFIG.asgardeoOrgNumericId,
          orgHandler: input.orgHandler,
          projectId: input.projectId,
          componentType: input.componentType,
          technology: 'WSO2MI',
          isPublicRepo: false,
        },
      }).then((d) => d.createComponent),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  });
}

interface DeleteComponentResult {
  status: string;
  canDelete: boolean;
  message: string;
  encodedData: string;
}

const DELETE_COMPONENT_V2 = `
  mutation DeleteComponentV2($orgHandler: String!, $componentId: String!, $projectId: String!) {
    deleteComponentV2(orgHandler: $orgHandler, componentId: $componentId, projectId: $projectId) {
      status, canDelete, message, encodedData
    }
  }`;

export function useDeleteComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orgHandler: string; componentId: string; projectId: string }) => gql<{ deleteComponentV2: DeleteComponentResult }>(DELETE_COMPONENT_V2, input).then((d) => d.deleteComponentV2),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  });
}

export function useUpdateArtifactStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ArtifactStatusInput) =>
      gql<{ updateArtifactStatus: { status: string; message: string } }>(UPDATE_ARTIFACT_STATUS, {
        input: { componentId: input.componentId, artifactType: toBackendArtifactType(input.artifactType), artifactName: input.artifactName, status: input.status },
      }).then((d) => d.updateArtifactStatus),
    onMutate: async (input) => {
      const scope = (q: { queryKey: readonly unknown[] }) => q.queryKey[2] === input.envId && q.queryKey[3] === input.componentId;
      await qc.cancelQueries({ queryKey: ['artifacts', input.artifactType], predicate: scope });
      const previousArtifacts = qc.getQueriesData<GqlArtifact[]>({ queryKey: ['artifacts', input.artifactType], predicate: scope });
      const newState = input.status === 'active' ? 'enabled' : 'disabled';
      qc.setQueriesData<GqlArtifact[]>({ queryKey: ['artifacts', input.artifactType], predicate: scope }, (old) => old?.map((a) => (a.name === input.artifactName ? { ...a, state: newState } : a)));
      return { previousArtifacts, scope };
    },
    onError: (_err, input, context) => {
      if (context?.previousArtifacts) {
        for (const [queryKey, data] of context.previousArtifacts) {
          qc.setQueryData<GqlArtifact[]>(queryKey, data);
        }
      }
    },
    onSettled: (_data, _err, input) => {
      const scope = (q: { queryKey: readonly unknown[] }) => q.queryKey[2] === input.envId && q.queryKey[3] === input.componentId;
      qc.invalidateQueries({ queryKey: ['artifacts', input.artifactType], predicate: scope });
    },
  });
}

export function useUpdateListenerState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ListenerStateInput) =>
      gql<{ updateListenerState: { success: boolean; message: string; commandIds: string[] } }>(UPDATE_LISTENER_STATE, {
        input: {
          runtimeIds: input.runtimeIds,
          listenerName: input.listenerName,
          action: input.action,
        },
      }).then((d) => d.updateListenerState),
    onSuccess: () => {
      // Invalidate all listener queries to refetch the updated state
      qc.invalidateQueries({ queryKey: ['artifacts', 'Listener'] });
    },
  });
}

// ── Logger mutations ──

export interface UpdateLogLevelInput {
  runtimeIds: string[];
  componentName: string;
  logLevel: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
}

const UPDATE_LOG_LEVEL = `
  mutation UpdateLogLevel($input: UpdateLogLevelInput!) {
    updateLogLevel(input: $input) {
      success, message, commandIds
    }
  }`;

export function useUpdateLogLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLogLevelInput) =>
      gql<{ updateLogLevel: { success: boolean; message: string; commandIds: string[] } }>(UPDATE_LOG_LEVEL, {
        input: {
          runtimeIds: input.runtimeIds,
          componentName: input.componentName,
          logLevel: input.logLevel,
        },
      }).then((d) => d.updateLogLevel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loggers'] });
    },
  });
}

// ── Component-Environment JWT Secrets ──

const GET_OR_GENERATE_COMPONENT_ENV_JWT_SECRET = `
  mutation GenerateComponentEnvironmentJwtSecret($componentId: String!, $environmentId: String!) {
    generateComponentEnvironmentJwtSecret(componentId: $componentId, environmentId: $environmentId)
  }`;

const ROTATE_COMPONENT_ENV_JWT_SECRET = `
  mutation RotateComponentEnvironmentJwtSecret($componentId: String!, $environmentId: String!) {
    rotateComponentEnvironmentJwtSecret(componentId: $componentId, environmentId: $environmentId)
  }`;

export function useGenerateComponentEnvironmentJwtSecret() {
  return useMutation({
    mutationFn: ({ componentId, environmentId }: { componentId: string; environmentId: string }) =>
      gql<{ generateComponentEnvironmentJwtSecret: string }>(GET_OR_GENERATE_COMPONENT_ENV_JWT_SECRET, {
        componentId,
        environmentId,
      }).then((d) => d.generateComponentEnvironmentJwtSecret),
  });
}

export function useRotateComponentEnvironmentJwtSecret() {
  return useMutation({
    mutationFn: ({ componentId, environmentId }: { componentId: string; environmentId: string }) =>
      gql<{ rotateComponentEnvironmentJwtSecret: string }>(ROTATE_COMPONENT_ENV_JWT_SECRET, {
        componentId,
        environmentId,
      }).then((d) => d.rotateComponentEnvironmentJwtSecret),
  });
}

// ── Schedule / Job Configs ──

const UPDATE_JOB_CONFIGS = `
  mutation UpdateJobConfigs($input: JobConfigInput!) {
    updateJobConfigs(input: $input)
  }`;

export interface UpdateJobConfigsInput {
  orgHandler: string;
  componentId: string;
  environmentId: string;
  versionId: string;
  cronFrequency?: string;
  cronTimezone?: string;
  jobTimeoutSeconds?: number;
  cronJobAllowConcurrency?: boolean;
  jobRetryCount?: number;
}

export function useUpdateJobConfigs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJobConfigsInput) => gql<{ updateJobConfigs: boolean }>(UPDATE_JOB_CONFIGS, { input }).then((d) => d.updateJobConfigs),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['executionConfigs', input.componentId] });
    },
  });
}

// ── Task trigger ──

const TRIGGER_ARTIFACT = `
  mutation TriggerTask($input: ArtifactTriggerInput!) {
    triggerArtifact(input: $input) {
      status, message, successCount, failedCount, details
    }
  }`;

export interface TriggerTaskInput {
  componentId: string;
  taskName: string;
}

export function useTriggerTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TriggerTaskInput) =>
      gql<{ triggerArtifact: { status: string; message: string; successCount: number; failedCount: number; details: string[] } }>(TRIGGER_ARTIFACT, {
        input: {
          componentId: input.componentId,
          taskName: input.taskName,
        },
      }).then((d) => d.triggerArtifact),
    onSuccess: () => {
      // Invalidate task queries to refetch the updated state
      qc.invalidateQueries({ queryKey: ['artifacts', 'Task'] });
    },
  });
}

// ── Deploy deployment track (triggers automation execution) ──

const DEPLOY_DEPLOYMENT_TRACK = `
  mutation deployDeploymentTrack($input: DeployDeploymentTrackInput!) {
    deployDeploymentTrack(input: $input)
  }`;

export interface DeployDeploymentTrackInput {
  componentId: string;
  id: string;
  imageId: string;
  environmentId: string;
  deploymentPipelineId: string;
  cronTimezone?: string;
  cron?: string;
  jobTimeoutSeconds?: number;
  cronJobAllowConcurrency?: boolean;
}

export function useDeployDeploymentTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeployDeploymentTrackInput) => gql<{ deployDeploymentTrack: string }>(DEPLOY_DEPLOYMENT_TRACK, { input }).then((d) => d.deployDeploymentTrack),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['deploymentStatus', input.componentId, input.id] });
      qc.invalidateQueries({ queryKey: ['executionConfigs', input.componentId] });
      qc.invalidateQueries({ queryKey: ['componentDeployment'] });
    },
  });
}

// ── Promote ──

const PROMOTE_MUTATION = `
  mutation promote($componentId: String!, $promoteSchema: Promote!) {
    promote(componentId: $componentId, promoteSchema: $promoteSchema)
  }`;

export interface PromoteInput {
  componentId: string;
  apiVersionId: string;
  sourceReleaseId: string;
  targetEnvironmentId: string;
  deploymentPipelineId: string;
}

export function usePromote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PromoteInput) =>
      gql<{ promote: string }>(PROMOTE_MUTATION, {
        componentId: input.componentId,
        promoteSchema: {
          apiVersionId: input.apiVersionId,
          sourceReleaseId: input.sourceReleaseId,
          targetEnvironmentId: input.targetEnvironmentId,
          deploymentPipelineId: input.deploymentPipelineId,
          jobRetryCount: 0,
        },
      }).then((d) => d.promote),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['componentDeployment'] });
      qc.invalidateQueries({ queryKey: ['deploymentStatus', input.componentId] });
    },
  });
}

// ── Stop Deployment (clears cron schedule) ──

const STOP_DEPLOYMENT = `
  mutation StopDeployment($orgHandler: String!, $componentId: String!, $releaseId: String!, $type: String!, $clearCron: Boolean!) {
    stopDeployment(orgHandler: $orgHandler, componentId: $componentId, releaseId: $releaseId, type: $type, clearCron: $clearCron)
  }`;

export interface StopDeploymentInput {
  orgHandler: string;
  componentId: string;
  releaseId: string;
}

export function useStopDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StopDeploymentInput) =>
      gql<{ stopDeployment: string }>(STOP_DEPLOYMENT, {
        orgHandler: input.orgHandler,
        componentId: input.componentId,
        releaseId: input.releaseId,
        type: 'scheduledTask',
        clearCron: true,
      }).then((d) => d.stopDeployment),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['executionConfigs', input.componentId] });
      qc.invalidateQueries({ queryKey: ['componentDeployment'] });
    },
  });
}

// ── Update component display name ──

const UPDATE_COMPONENT = `
  mutation UpdateComponent($id: String!, $displayName: String!, $description: String!, $version: String!, $labels: String!) {
    updateComponent(component: {
      id: $id,
      displayName: $displayName,
      description: $description,
      version: $version,
      labels: $labels,
      serviceAccessMode: "null",
    }) {
      id, name, handler, description, displayType, displayName, version, labels, createdAt, updatedAt, projectId
    }
  }`;

export interface UpdateComponentInput {
  id: string;
  displayName: string;
  description: string;
  version: string;
  projectId: string;
  handler: string;
  labels?: string;
}

export function useUpdateComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateComponentInput) =>
      gql<{ updateComponent: GqlComponent }>(UPDATE_COMPONENT, {
        id: input.id,
        displayName: input.displayName,
        description: input.description,
        version: input.version,
        labels: input.labels ?? '',
      }).then((d) => d.updateComponent),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['component', input.projectId, input.handler] });
      qc.invalidateQueries({ queryKey: ['components'] });
    },
  });
}

// ── Run-pod trigger (manual execution with optional arguments) ──

export interface SaveSchemaConfigInput {
  projectId: string;
  componentId: string;
  envId: string;
  deploymentTrackId: string;
  configurations: SchemaConfigItem[];
  mappingId?: string;
  commitHash?: string;
}

export function useSaveSchemaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveSchemaConfigInput) => {
      const base = new URL(window.API_CONFIG.graphqlUrl).origin;
      const url = `${base}/configuration-schema/v1.0/projects/${input.projectId}/components/${input.componentId}/env-template/${input.envId}/deployment-track/${input.deploymentTrackId}/configurations`;
      const res = await authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurations: input.configurations, ...(input.commitHash ? { commitHash: input.commitHash } : {}) }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['schemaConfig', vars.projectId, vars.componentId, vars.envId, vars.deploymentTrackId] });
    },
  });
}

export interface TriggerComponentInput {
  orgHandler: string;
  projectId: string;
  componentId: string;
  releaseId: string;
  args?: { argument_name: string; argument_value: string }[];
}

async function runPod(url: string, args: TriggerComponentInput['args']): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args: args ?? [] }),
  });
}

export function useTriggerComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TriggerComponentInput) => {
      const origin = new URL(window.API_CONFIG.graphqlUrl).origin;
      const url = `${origin}/component-mgt/1.0.0/orgs/${input.orgHandler}/projects/${input.projectId}/components/${input.componentId}/releases/${input.releaseId}/run-pod`;
      let res = await runPod(url, input.args);

      // A 403 with scope validation failure means the cached token was issued before
      // component_trigger was added to STS_SCOPE. Force a refresh and retry once.
      if (res.status === 403) {
        const text = await res.text().catch(() => '');
        let isScopeError = false;
        try {
          const parsed = JSON.parse(text);
          isScopeError = parsed?.code === '900910' || !!parsed?.error_description?.includes('Scope validation');
        } catch {
          /* not JSON */
        }

        if (isScopeError) {
          await refreshAccessToken();
          res = await runPod(url, input.args);
        } else {
          throw new Error('Permission denied (403)');
        }
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 403) {
          throw new Error('You do not have permission to trigger this component');
        }
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['taskExecutions', input.releaseId] });
    },
  });
}
