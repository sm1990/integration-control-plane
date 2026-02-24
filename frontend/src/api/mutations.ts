import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';
import type { GqlArtifact, GqlComponent, GqlEnvironment, GqlProject } from './queries';
import { toBackendArtifactType } from './artifactToggleMutations';

export interface CreateProjectInput {
  name: string;
  handler: string;
  description: string;
  orgHandler: string;
}

const CREATE_PROJECT = `
  mutation CreateProject($name: String!, $description: String!, $projectHandler: String!, $orgHandler: String!) {
    createProject(project: {
      name: $name,
      description: $description,
      projectHandler: $projectHandler,
      orgId: 1,
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
    mutationFn: (runtimeId: string) => gql<{ deleteRuntime: string }>(DELETE_RUNTIME, { runtimeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runtimes'] }),
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
          orgId: 1,
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
      const newState = input.status === 'active' ? 'enabled' : 'disabled';
      qc.setQueriesData<GqlArtifact[]>({ queryKey: ['artifacts', input.artifactType], predicate: scope }, (old) => old?.map((a) => (a.name === input.artifactName ? { ...a, state: newState } : a)));
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
