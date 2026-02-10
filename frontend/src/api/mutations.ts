import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';
import type { GqlProject } from './queries';

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
