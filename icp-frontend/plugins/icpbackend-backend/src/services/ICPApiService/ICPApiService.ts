import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import {
  ICPApiService,
  Environment,
  Project,
  Component,
  Runtime,
  RuntimeFilters,
} from './types';

export async function createICPApiService({
  logger,
  config,
}: {
  logger: LoggerService;
  config: RootConfigService;
}): Promise<ICPApiService> {
  logger.info('Initializing GraphQL-based ICPApiService');

  // Get GraphQL endpoint URL from configuration
  const getGraphQLUrl = (): string => {
    try {
      const icpBackendUrl = config.getOptionalString('icp.backend.baseUrl') || 'http://localhost:9446';
      const graphqlEndpoint = config.getOptionalString('icp.backend.graphqlEndpoint') || '/graphql';
      return `${icpBackendUrl}${graphqlEndpoint}`;
    } catch (error) {
      logger.warn('Using default ICP backend URL due to config issue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 'http://localhost:9446/graphql';
    }
  };

  const request = async <T>(query: string, variables?: Record<string, any>): Promise<T> => {
    const graphqlUrl = getGraphQLUrl();

    try {
      const requestBody = {
        query,
        variables,
      };

      logger.info('Making GraphQL request', {
        url: graphqlUrl,
        query: query.substring(0, 200) + '...',
        variables
      });

      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('GraphQL HTTP Error', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          requestBody
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      if (json.errors) {
        logger.error('GraphQL Response Error', {
          errors: json.errors,
          requestBody
        });
        throw new Error(`GraphQL Error: ${json.errors[0].message}`);
      }

      return json.data;
    } catch (error) {
      logger.error('GraphQL request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        graphqlUrl,
        query: query.trim().split('\n')[0] // Log first line of query for debugging
      });
      throw error;
    }
  };

  return {
    // Environment operations
    async getEnvironments(): Promise<Environment[]> {
      const query = `
        query GetEnvironments {
          environments {
            environmentId
            name
            description
            createdAt
            updatedAt
            updatedBy
            createdBy
          }
        }
      `;

      const data = await request<{ environments: Environment[] }>(query);
      return data.environments || [];
    },

    async createEnvironment(requestData, _options): Promise<Environment> {
      const query = `
        mutation CreateEnvironment($environment: CreateEnvironmentInput!) {
          createEnvironment(environment: $environment) {
            environmentId
            name
            description
            createdAt
            updatedAt
            updatedBy
            createdBy
          }
        }
      `;

      const data = await request<{ createEnvironment: Environment }>(query, {
        environment: requestData,
      });

      logger.info('Created new environment via GraphQL', {
        environmentId: data.createEnvironment.environmentId,
        name: data.createEnvironment.name,
        createdBy: data.createEnvironment.createdBy
      });

      return data.createEnvironment;
    },

    async updateEnvironment(requestData, _options): Promise<Environment> {
      const query = `
        mutation UpdateEnvironment($environmentId: String!, $name: String!, $description: String!) {
          updateEnvironment(environmentId: $environmentId, name: $name, description: $description) {
            environmentId
            name
            description
            createdAt
            updatedAt
            updatedBy
            createdBy
          }
        }
      `;

      const variables = {
        environmentId: requestData.environmentId,
        name: requestData.name,
        description: requestData.description,
      };

      logger.info('Attempting to update environment via GraphQL', {
        query,
        variables,
        requestDataKeys: Object.keys(requestData)
      });

      const data = await request<{ updateEnvironment: Environment }>(query, variables);

      logger.info('Updated environment via GraphQL', {
        environmentId: data.updateEnvironment.environmentId,
        name: data.updateEnvironment.name
      });

      return data.updateEnvironment;
    },

    async deleteEnvironment(environmentId, _options): Promise<void> {
      const query = `
        mutation DeleteEnvironment($environmentId: String!) {
          deleteEnvironment(environmentId: $environmentId)
        }
      `;

      await request<{ deleteEnvironment: boolean }>(query, { environmentId });

      logger.info('Deleted environment via GraphQL', { environmentId });
    },

    // Project operations
    async getProjects(): Promise<Project[]> {
      const query = `
        query GetProjects {
          projects {
            projectId
            name
            description
            createdBy
            createdAt
            updatedAt
            updatedBy
          }
        }
      `;

      const data = await request<{ projects: Project[] }>(query);
      return data.projects || [];
    },

    async createProject(requestData, _options): Promise<Project> {
      const query = `
        mutation CreateProject($project: CreateProjectInput!) {
          createProject(project: $project) {
            projectId
            name
            description
            createdBy
            createdAt
            updatedAt
            updatedBy
          }
        }
      `;

      const data = await request<{ createProject: Project }>(query, {
        project: requestData,
      });

      logger.info('Created new project via GraphQL', {
        projectId: data.createProject.projectId,
        name: data.createProject.name,
        createdBy: data.createProject.createdBy
      });

      return data.createProject;
    },

    async updateProject(requestData, _options): Promise<Project> {
      const query = `
        mutation UpdateProject($projectId: String!, $name: String!, $description: String!) {
          updateProject(projectId: $projectId, name: $name, description: $description) {
            projectId
            name
            description
            createdBy
            createdAt
            updatedAt
            updatedBy
          }
        }
      `;

      const data = await request<{ updateProject: Project }>(query, {
        projectId: requestData.projectId,
        name: requestData.name,
        description: requestData.description,
      });

      logger.info('Updated project via GraphQL', {
        projectId: data.updateProject.projectId,
        name: data.updateProject.name
      });

      return data.updateProject;
    },

    async deleteProject(projectId, _options): Promise<void> {
      const query = `
        mutation DeleteProject($projectId: String!) {
          deleteProject(projectId: $projectId)
        }
      `;

      await request<{ deleteProject: boolean }>(query, { projectId });

      logger.info('Deleted project via GraphQL', { projectId });
    },

    // Component operations
    async getComponents(projectId?: string): Promise<Component[]> {
      const query = projectId
        ? `
          query GetComponentsByProject($projectId: String!) {
            components(projectId: $projectId) {
              componentId
              name
              description
              createdBy
              createdAt
              updatedAt
              updatedBy
              project {
                projectId
                name
                description
                createdBy
                createdAt
                updatedAt
                updatedBy
              }
            }
          }
        `
        : `
          query GetComponents {
            components {
              componentId
              name
              description
              createdBy
              createdAt
              updatedAt
              updatedBy
              project {
                projectId
                name
                description
                createdBy
                createdAt
                updatedAt
                updatedBy
              }
            }
          }
        `;

      const variables = projectId ? { projectId } : undefined;
      const data = await request<{ components: Component[] }>(query, variables);

      return data.components || [];
    },

    async createComponent(requestData, _options): Promise<Component> {
      const query = `
        mutation CreateComponent($component: CreateComponentInput!) {
          createComponent(component: $component) {
            componentId
            name
            description
            createdBy
            createdAt
            updatedAt
            updatedBy
            project {
              projectId
              name
              description
              createdBy
              createdAt
              updatedAt
              updatedBy
            }
          }
        }
      `;

      const data = await request<{ createComponent: Component }>(query, {
        component: requestData,
      });

      logger.info('Created new component via GraphQL', {
        componentId: data.createComponent.componentId,
        name: data.createComponent.name,
        projectId: data.createComponent.project.projectId,
        createdBy: data.createComponent.createdBy
      });

      return data.createComponent;
    },

    async updateComponent(requestData, _options): Promise<Component> {
      const query = `
        mutation UpdateComponent($componentId: String!, $name: String!, $description: String!) {
          updateComponent(componentId: $componentId, name: $name, description: $description) {
            componentId
            name
            description
            createdBy
            createdAt
            updatedAt
            updatedBy
            project {
              projectId
              name
              description
              createdBy
              createdAt
              updatedAt
              updatedBy
            }
          }
        }
      `;

      const data = await request<{ updateComponent: Component }>(query, {
        componentId: requestData.componentId,
        name: requestData.name,
        description: requestData.description,
      });

      logger.info('Updated component via GraphQL', {
        componentId: data.updateComponent.componentId,
        name: data.updateComponent.name
      });

      return data.updateComponent;
    },

    async deleteComponent(componentId, _options): Promise<void> {
      const query = `
        mutation DeleteComponent($componentId: String!) {
          deleteComponent(componentId: $componentId)
        }
      `;

      await request<{ deleteComponent: boolean }>(query, { componentId });

      logger.info('Deleted component via GraphQL', { componentId });
    },

    // Runtime operations
    async getRuntimes(filters?: RuntimeFilters): Promise<Runtime[]> {
      const query = `
        query GetRuntimes($filters: RuntimeFiltersInput) {
          runtimes(filters: $filters) {
            runtimeId
            runtimeType
            status
            version
            platformName
            platformVersion
            platformHome
            osName
            osVersion
            registrationTime
            lastHeartbeat
            environment {
              environmentId
              name
              description
              createdAt
              updatedAt
              updatedBy
              createdBy
            }
            component {
              componentId
              name
              description
              createdBy
              createdAt
              updatedAt
              updatedBy
              project {
                projectId
                name
                description
                createdBy
                createdAt
                updatedAt
                updatedBy
              }
            }
            artifacts {
              listeners {
                name
                package
                protocol
                state
              }
              services {
                name
                package
                basePath
                state
                resources {
                  methods
                  url
                }
              }
            }
          }
        }
      `;

      const data = await request<{ runtimes: Runtime[] }>(query, filters ? { filters } : undefined);
      return data.runtimes || [];
    },

    async getRuntime(runtimeId: string): Promise<Runtime> {
      const query = `
        query GetRuntime($runtimeId: String!) {
          runtime(runtimeId: $runtimeId) {
            runtimeId
            runtimeType
            status
            version
            platformName
            platformVersion
            platformHome
            osName
            osVersion
            registrationTime
            lastHeartbeat
            environment {
              environmentId
              name
              description
              createdAt
              updatedAt
              updatedBy
              createdBy
            }
            component {
              componentId
              name
              description
              createdBy
              createdAt
              updatedAt
              updatedBy
              project {
                projectId
                name
                description
                createdBy
                createdAt
                updatedAt
                updatedBy
              }
            }
            artifacts {
              listeners {
                name
                package
                protocol
                state
              }
              services {
                name
                package
                basePath
                state
                resources {
                  methods
                  url
                }
              }
            }
          }
        }
      `;

      const data = await request<{ runtime: Runtime | null }>(query, { runtimeId });

      if (!data.runtime) {
        throw new NotFoundError(`No runtime found with id '${runtimeId}'`);
      }

      return data.runtime;
    },
  };
}
