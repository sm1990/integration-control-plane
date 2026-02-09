import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';
import type { GqlProject } from './queries';

export interface CreateProjectInput {
  name: string;
  handler: string;
  description: string;
  orgHandler: string;
}

const CREATE_PROJECT = (input: CreateProjectInput) => `
  mutation {
    createProject(project: {
      name: "${input.name}",
      description: "${input.description}",
      projectHandler: "${input.handler}",
      orgId: 1,
      orgHandler: "${input.orgHandler}",
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
      gql<{ createProject: GqlProject }>(CREATE_PROJECT(input)).then((d) => d.createProject),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
