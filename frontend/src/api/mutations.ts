// ── Create Component Input ──
export interface CreateComponentInput {
  displayName: string;
  name: string;
  componentType: string;
  description: string;
  projectId: string;
  orgHandler: string;
}
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GqlArtifact, GqlProject, GqlComponent, GqlEnvironment } from './queries';
import { gql } from './graphql';

// ── Delete Component ──
export interface DeleteComponentInput {
  projectId: string;
  componentId: string;
  orgHandler: string;
}

const DELETE_COMPONENT = `
  mutation DeleteComponentV2($projectId: String!, $componentId: String!, $orgHandler: String!) {
    deleteComponentV2(
      orgHandler: $orgHandler,
      componentId: $componentId,
      projectId: $projectId
    ) {
      status
      canDelete
      message
      encodedData
    }
  }
`;

export function useDeleteComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteComponentInput) =>
      gql<{ deleteComponentV2: { status: string; canDelete: boolean; message: string; encodedData: string } }>(DELETE_COMPONENT, {
        projectId: input.projectId,
        componentId: input.componentId,
        orgHandler: input.orgHandler,
      }).then((d) => d.deleteComponentV2),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['components', variables.orgHandler, variables.projectId] });
    },
  });
}

// ── Create Project ──
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
      id
      orgId
      name
      version
      createdDate
      handler
      region
      description
      defaultDeploymentPipelineId
      deploymentPipelineIds
      type
      updatedAt
    }
  }
`;

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
    mutationFn: (input: EnvironmentInput) =>
      gql<{ createEnvironment: GqlEnvironment }>(CREATE_ENVIRONMENT, { ...input }).then((d: { createEnvironment: GqlEnvironment }) => d.createEnvironment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}

export function useUpdateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnvironmentInput & { environmentId: string }) =>
      gql<{ updateEnvironment: GqlEnvironment }>(UPDATE_ENVIRONMENT, { ...input }).then((d: { updateEnvironment: GqlEnvironment }) => d.updateEnvironment),
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

const CREATE_COMPONENT = `
  mutation CreateComponent(
    $displayName: String!,
    $name: String!,
    $componentType: RuntimeType!,
    $description: String!,
    $projectId: String!,
    $orgHandler: String!
  ) {
    createComponent(component: {
      displayName: $displayName,
      name: $name,
      componentType: $componentType,
      description: $description,
      projectId: $projectId,
      orgHandler: $orgHandler
    }) {
      id
      projectId
      name
      handler
      displayName
      displayType
      description
      status
      componentType
      componentSubType
      version
      createdAt
      lastBuildDate
    }
  }
`;

export function useCreateComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateComponentInput) =>
      gql<{ createComponent: GqlComponent }>(CREATE_COMPONENT, {
        displayName: input.displayName,
        name: input.name,
        componentType: input.componentType,
        description: input.description,
        projectId: input.projectId,
        orgHandler: input.orgHandler,
      }).then((d) => d.createComponent),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['components', variables.orgHandler, variables.projectId] });
    },
  });
}

// ── Artifact status toggle ──
export interface ArtifactStatusInput {
  envId: string;
  componentId: string;
  artifactType: string;
  artifactName: string;
  status: 'active' | 'inactive';
}

const UPDATE_ARTIFACT_STATUS = `
  mutation UpdateArtifactStatus($input: ArtifactStatusChangeInput!) {
    updateArtifactStatus(input: $input) {
      status
      message
      successCount
      failedCount
      details
    }
  }
`;

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
// (No code here; removed merge conflict markers and duplicate code)
