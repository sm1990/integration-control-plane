import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';
import type { GqlArtifact, GqlEnvironment, GqlProject } from './queries';

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
    mutationFn: (input: EnvironmentInput) => gql<{ createEnvironment: GqlEnvironment }>(CREATE_ENVIRONMENT, input).then((d) => d.createEnvironment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}

export function useUpdateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnvironmentInput & { environmentId: string }) => gql<{ updateEnvironment: GqlEnvironment }>(UPDATE_ENVIRONMENT, input).then((d) => d.updateEnvironment),
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

export interface ArtifactStatusInput {
  envId: string;
  componentId: string;
  artifactType: string;
  artifactName: string;
  status: 'active' | 'inactive';
}

/** PascalCase → kebab-case: "ProxyService" → "proxy-service" */
function toKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function useUpdateArtifactStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ArtifactStatusInput) =>
      gql<{ updateArtifactStatus: { status: string; message: string } }>(UPDATE_ARTIFACT_STATUS, {
        input: { componentId: input.componentId, artifactType: toKebab(input.artifactType), artifactName: input.artifactName, status: input.status },
      }).then((d) => d.updateArtifactStatus),
    onMutate: async (input) => {
      const scope = (q: { queryKey: readonly unknown[] }) => q.queryKey[2] === input.envId && q.queryKey[3] === input.componentId;
      await qc.cancelQueries({ queryKey: ['artifacts', input.artifactType], predicate: scope });
      const newState = input.status === 'active' ? 'enabled' : 'disabled';
      qc.setQueriesData<GqlArtifact[]>({ queryKey: ['artifacts', input.artifactType], predicate: scope }, (old) => old?.map((a) => (a.name === input.artifactName ? { ...a, state: newState } : a)));
    },
  });
}
