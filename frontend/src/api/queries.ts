import { useQuery } from '@tanstack/react-query';
import { gql } from './graphql';

export interface GqlProject {
  id: string;
  orgId: number;
  name: string;
  handler: string;
  description: string;
  version: string;
  createdDate: string;
  updatedAt: string;
  region: string;
  type: string;
}

export interface GqlComponent {
  projectId: string;
  id: string;
  name: string;
  handler: string;
  displayName: string;
  displayType: string;
  description: string;
  status: string;
  componentType: string;
  componentSubType: string | null;
  version: string;
  createdAt: string;
  lastBuildDate: string;
}

const PROJECTS_QUERY = `{
  projects(orgId: 1) {
    id, orgId, name, handler, description, version,
    createdDate, updatedAt, region, type
  }
}`;

const PROJECT_QUERY = (projectId: string) => `{
  project(orgId: 1, projectId: "${projectId}") {
    id, orgId, name, handler, description, version,
    createdDate, updatedAt, region, type
  }
}`;

const COMPONENTS_QUERY = (orgHandler: string, projectId: string) => `{
  components(orgHandler: "${orgHandler}", projectId: "${projectId}") {
    projectId, id, name, handler, displayName, displayType,
    description, status, componentType, componentSubType,
    version, createdAt, lastBuildDate
  }
}`;

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => gql<{ projects: GqlProject[] }>(PROJECTS_QUERY).then((d) => d.projects),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => gql<{ project: GqlProject }>(PROJECT_QUERY(projectId)).then((d) => d.project),
    enabled: !!projectId,
  });
}

export function useComponents(orgHandler: string, projectId: string) {
  return useQuery({
    queryKey: ['components', orgHandler, projectId],
    queryFn: () => gql<{ components: GqlComponent[] }>(COMPONENTS_QUERY(orgHandler, projectId)).then((d) => d.components),
    enabled: !!orgHandler && !!projectId,
  });
}

export interface GqlComponentDetail extends GqlComponent {
  orgHandler: string;
}

const COMPONENT_BY_HANDLER_QUERY = (projectId: string, handler: string) => `{
  component(projectId: "${projectId}", componentHandler: "${handler}") {
    projectId, id, name, handler, displayName, displayType,
    description, status, componentType, componentSubType,
    version, createdAt, lastBuildDate, orgHandler
  }
}`;

export function useComponentByHandler(projectId: string, handler: string) {
  return useQuery({
    queryKey: ['component', projectId, handler],
    queryFn: () => gql<{ component: GqlComponentDetail }>(COMPONENT_BY_HANDLER_QUERY(projectId, handler)).then((d) => d.component),
    enabled: !!projectId && !!handler,
  });
}

export interface GqlEnvironment {
  id: string;
  name: string;
  choreoEnv: string;
  critical: boolean;
}

const ENVIRONMENTS_QUERY = (projectId: string) => `{
  environments(orgUuid: "default-org-uuid", type: "external", projectId: "${projectId}") {
    id, name, choreoEnv, critical
  }
}`;

export function useEnvironments(projectId: string) {
  return useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => gql<{ environments: GqlEnvironment[] }>(ENVIRONMENTS_QUERY(projectId)).then((d) => d.environments),
    enabled: !!projectId,
  });
}

export interface GqlRuntime {
  runtimeId: string;
  runtimeType: string;
  status: string;
  version: string;
  platformName: string;
  platformVersion: string;
  platformHome: string;
  osName: string;
  osVersion: string;
  registrationTime: string;
  lastHeartbeat: string;
}

const RUNTIMES_QUERY = (envId: string, projectId: string, componentId: string) => `{
  runtimes(environmentId: "${envId}", projectId: "${projectId}", componentId: "${componentId}") {
    runtimeId, runtimeType, status, version,
    platformName, platformVersion, platformHome,
    osName, osVersion, registrationTime, lastHeartbeat
  }
}`;

export function useRuntimes(envId: string, projectId: string, componentId: string) {
  return useQuery({
    queryKey: ['runtimes', envId, projectId, componentId],
    queryFn: () => gql<{ runtimes: GqlRuntime[] }>(RUNTIMES_QUERY(envId, projectId, componentId)).then((d) => d.runtimes),
    enabled: !!envId && !!projectId && !!componentId,
  });
}

export interface GqlArtifactType {
  artifactType: string;
  artifactCount: number;
}

export function useArtifactTypes(componentId: string, envId: string) {
  return useQuery({
    queryKey: ['artifactTypes', componentId, envId],
    queryFn: () =>
      gql<{ componentArtifactTypes: GqlArtifactType[] }>(
        `query ComponentArtifactTypes {
        componentArtifactTypes(componentId: "${componentId}", environmentId: "${envId}") {
          artifactType, artifactCount
        }
      }`,
      ).then((d) => d.componentArtifactTypes),
    enabled: !!componentId && !!envId,
  });
}

// Backend uses camelCase query name: e.g. RestApi → restApisByEnvironmentAndComponent

export interface GqlArtifact {
  name: string;
  [key: string]: unknown;
}

// Maps artifactType to its GraphQL query field name and useful display fields
const ARTIFACT_QUERY_MAP: Record<string, { queryName: string; field: string; fields: string }> = {
  RestApi: { queryName: 'restApisByEnvironmentAndComponent', field: 'restApisByEnvironmentAndComponent', fields: 'name, context, version, state' },
  ProxyService: { queryName: 'proxyServicesByEnvironmentAndComponent', field: 'proxyServicesByEnvironmentAndComponent', fields: 'name, wsdlUrl' },
  Endpoint: { queryName: 'endpointsByEnvironmentAndComponent', field: 'endpointsByEnvironmentAndComponent', fields: 'name, type, method, uriTemplate' },
  InboundEndpoint: { queryName: 'inboundEndpointsByEnvironmentAndComponent', field: 'inboundEndpointsByEnvironmentAndComponent', fields: 'name, protocol, type' },
  Sequence: { queryName: 'sequencesByEnvironmentAndComponent', field: 'sequencesByEnvironmentAndComponent', fields: 'name, mediator' },
  Task: { queryName: 'tasksByEnvironmentAndComponent', field: 'tasksByEnvironmentAndComponent', fields: 'name, triggerType, triggerInterval' },
  LocalEntry: { queryName: 'localEntriesByEnvironmentAndComponent', field: 'localEntriesByEnvironmentAndComponent', fields: 'name, type' },
  CarbonApp: { queryName: 'carbonAppsByEnvironmentAndComponent', field: 'carbonAppsByEnvironmentAndComponent', fields: 'name, version' },
  Connector: { queryName: 'connectorsByEnvironmentAndComponent', field: 'connectorsByEnvironmentAndComponent', fields: 'name, version, status' },
  RegistryResource: { queryName: 'registryResourcesByEnvironmentAndComponent', field: 'registryResourcesByEnvironmentAndComponent', fields: 'name, mediaType' },
};

export function useArtifacts(artifactType: string, envId: string, componentId: string) {
  const mapping = ARTIFACT_QUERY_MAP[artifactType];
  return useQuery({
    queryKey: ['artifacts', artifactType, envId, componentId],
    queryFn: async () => {
      if (!mapping) return [];
      const data = await gql<Record<string, GqlArtifact[]>>(`query { ${mapping.field}(environmentId: "${envId}", componentId: "${componentId}") { ${mapping.fields} } }`);
      return data[mapping.field] ?? [];
    },
    enabled: !!artifactType && !!envId && !!componentId && !!mapping,
  });
}

export { ARTIFACT_QUERY_MAP };
