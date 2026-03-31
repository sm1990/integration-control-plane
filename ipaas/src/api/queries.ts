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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';
import { authenticatedFetch, getOrgUuidFromToken } from '../auth/tokenManager';
import { choreoDevopsApiUrl } from '../config/api';

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
  defaultDeploymentPipelineId: string;
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
  componentType?: string;
  componentSubType: string | null;
  version: string;
  createdAt: string;
  lastBuildDate: string;
  labels?: string | string[];
  apiId?: string;
}

const PROJECT_FIELDS = 'id, orgId, name, handler, description, version, createdDate, updatedAt, region, type, defaultDeploymentPipelineId';

const PROJECTS_QUERY = `
  query GetProjects($orgId: Int!) {
    projects(orgId: $orgId) { ${PROJECT_FIELDS} }
  }`;

const PROJECT_QUERY = `
  query GetProject($orgId: Int!, $projectId: String!) {
    project(orgId: $orgId, projectId: $projectId) { ${PROJECT_FIELDS} }
  }`;

const PROJECT_BY_HANDLER_QUERY = `
  query GetProjectByHandler($orgId: Int!, $projectHandler: String!) {
    projectByHandler(orgId: $orgId, projectHandler: $projectHandler) { ${PROJECT_FIELDS} }
  }`;

// componentType excluded as it is not in the schema
const COMPONENTS_QUERY = `
  query GetComponents($orgHandler: String!, $projectId: String!) {
    components(orgHandler: $orgHandler, projectId: $projectId) {
      projectId, id, name, handler, displayName, displayType, description, status, componentSubType, version, createdAt, lastBuildDate
    }
  }`;

function orgId(): number {
  return window.API_CONFIG.asgardeoOrgNumericId ?? 0;
}

export function useProjects() {
  const id = orgId();
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => gql<{ projects: GqlProject[] }>(PROJECTS_QUERY, { orgId: id }).then((d) => d.projects),
    enabled: id > 0,
  });
}

interface OrgEntry {
  handle?: string;
  orgHandle?: string;
  id?: string | number;
  orgId?: string | number;
  // The org UUID may be returned under any of these field names depending on API version
  uuid?: string;
  orgUuid?: string;
  org_uuid?: string;
}

export function useOrgs() {
  return useQuery({
    queryKey: ['orgs'],
    queryFn: async () => {
      const res = await authenticatedFetch(`${window.API_CONFIG.choreoOrgApiUrl}/orgs`);
      if (!res.ok) throw new Error('Failed to fetch orgs');
      const data = await res.json();
      const list: OrgEntry[] = Array.isArray(data) ? data : (data.list ?? data.organizations ?? []);
      return list
        .map((o) => ({
          handle: o.handle ?? o.orgHandle ?? '',
          numericId: parseInt(String(o.id ?? o.orgId ?? '0'), 10),
          uuid: o.uuid ?? o.orgUuid ?? o.org_uuid ?? '',
        }))
        .filter((o) => o.handle && o.numericId > 0);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectsByOrg(orgHandle: string) {
  const { data: orgs } = useOrgs();
  const numericId = orgs?.find((o) => o.handle === orgHandle)?.numericId ?? 0;
  return useQuery({
    queryKey: ['projects', numericId],
    queryFn: () => gql<{ projects: GqlProject[] }>(PROJECTS_QUERY, { orgId: numericId }).then((d) => d.projects),
    enabled: numericId > 0,
  });
}

export function useProject(projectId: string) {
  const id = orgId();
  return useQuery({
    queryKey: ['project', projectId, id],
    queryFn: () => gql<{ project: GqlProject }>(PROJECT_QUERY, { orgId: id, projectId }).then((d) => d.project),
    enabled: !!projectId && id > 0,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useProjectByHandler(handler: string) {
  const id = orgId();
  return useQuery({
    queryKey: ['project', 'handler', handler, id],
    queryFn: () => gql<{ projectByHandler: GqlProject }>(PROJECT_BY_HANDLER_QUERY, { orgId: id, projectHandler: handler }).then((d) => d.projectByHandler),
    // Guard: never call if handler is empty or looks like a UUID (should use useProject instead)
    enabled: !!handler && id > 0 && !UUID_RE.test(handler),
  });
}

export function useComponents(orgHandler: string, projectId: string) {
  return useQuery({
    queryKey: ['components', orgHandler, projectId],
    queryFn: () => gql<{ components: GqlComponent[] }>(COMPONENTS_QUERY, { orgHandler, projectId }).then((d) => d.components),
    enabled: !!orgHandler && !!projectId,
  });
}

export interface GqlComponentDetail extends GqlComponent {
  orgHandler: string;
  deploymentTracks?: { id: string }[];
}

const COMPONENT_BY_HANDLER_QUERY = `
  query GetComponent($projectId: String!, $componentHandler: String!) {
    component(projectId: $projectId, componentHandler: $componentHandler) {
      projectId, id, name, handler, displayName, displayType,
      description, status, componentSubType,
      version, createdAt, lastBuildDate, orgHandler, labels, apiId,
      deploymentTracks { id }
    }
  }`;

export function useComponentByHandler(projectId: string, handler: string | undefined) {
  return useQuery({
    queryKey: ['component', projectId, handler],
    queryFn: () => gql<{ component: GqlComponentDetail }>(COMPONENT_BY_HANDLER_QUERY, { projectId, componentHandler: handler }).then((d) => d.component),
    enabled: !!projectId && !!handler,
  });
}

const PROJECT_COMPONENT_LABELS_QUERY = `
  query GetProjectComponentLabels($projectId: String!, $orgId: Int!) {
    projectComponentLabels(projectId: $projectId, orgId: $orgId)
  }`;

export function useProjectComponentLabels(projectId: string) {
  const id = orgId();
  return useQuery({
    queryKey: ['projectComponentLabels', projectId],
    queryFn: () => gql<{ projectComponentLabels: string[] }>(PROJECT_COMPONENT_LABELS_QUERY, { projectId, orgId: id }).then((d) => d.projectComponentLabels ?? []),
    enabled: !!projectId && id > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export interface GqlEnvironment {
  id: string;
  name: string;
  critical: boolean;
  templateId?: string;
  dpId?: string;
  description?: string;
  createdAt?: string;
}

const ENVIRONMENTS_QUERY = `
  query GetEnvironments($orgUuid: String!, $projectId: String!) {
    environments(orgUuid: $orgUuid, type: "external", projectId: $projectId) {
      id, name, critical, templateId, dpId
    }
  }`;

export function useEnvironments(orgUuid: string, projectId: string) {
  return useQuery({
    queryKey: ['environments', orgUuid, projectId],
    queryFn: () => {
      const uuid = getOrgUuidFromToken() ?? orgUuid;
      return gql<{ environments: GqlEnvironment[] }>(ENVIRONMENTS_QUERY, { orgUuid: uuid, projectId }).then((d) => d.environments);
    },
    enabled: !!orgUuid && !!projectId,
  });
}

const ALL_ENVIRONMENTS_QUERY = `{
  environments { id, name, description, critical, dpId, createdAt }
}`;

export function useAllEnvironments() {
  return useQuery({
    queryKey: ['environments'],
    queryFn: () => gql<{ environments: GqlEnvironment[] }>(ALL_ENVIRONMENTS_QUERY).then((d) => d.environments),
    retry: false,
  });
}

export interface CloudDataPlane {
  id: string;
  external_gateway_virtual_host: string;
  internal_gateway_virtual_host: string;
  region: string;
  is_cilium?: boolean;
}

export function useCloudDataPlanes(orgUuid: string) {
  return useQuery({
    queryKey: ['cloud-data-planes', orgUuid],
    queryFn: async () => {
      const res = await authenticatedFetch(`${choreoDevopsApiUrl()}/api/v1/clusters/clouddataplanes?org_uuid=${encodeURIComponent(orgUuid)}`);
      if (!res.ok) throw new Error(`Failed to fetch cloud data planes: ${res.status}`);
      return res.json() as Promise<CloudDataPlane[]>;
    },
    enabled: !!orgUuid,
    staleTime: 5 * 60 * 1000,
  });
}

export interface GqlLogger {
  componentName: string;
  logLevel: string;
  runtimeIds: string[];
}

const LOGGERS_BY_ENV_AND_COMPONENT_QUERY = `
  query GetLoggers($environmentId: String!, $componentId: String!) {
    loggersByEnvironmentAndComponent(environmentId: $environmentId, componentId: $componentId) {
      componentName, logLevel, runtimeIds
    }
  }`;

export function useLoggers(environmentId: string, componentId: string) {
  return useQuery({
    queryKey: ['loggers', environmentId, componentId],
    queryFn: () => gql<{ loggersByEnvironmentAndComponent: GqlLogger[] }>(LOGGERS_BY_ENV_AND_COMPONENT_QUERY, { environmentId, componentId }).then((d) => d.loggersByEnvironmentAndComponent),
    enabled: !!environmentId && !!componentId,
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
  component?: { displayName: string };
}

const RUNTIMES_QUERY = `
  query GetRuntimes($environmentId: String!, $projectId: String!, $componentId: String!) {
    runtimes(environmentId: $environmentId, projectId: $projectId, componentId: $componentId) {
      runtimeId, runtimeType, status, version,
      platformName, platformVersion, platformHome,
      osName, osVersion, registrationTime, lastHeartbeat
    }
  }`;

export function useRuntimes(envId: string, projectId: string, componentId: string) {
  return useQuery({
    queryKey: ['runtimes', envId, projectId, componentId],
    queryFn: () => gql<{ runtimes: GqlRuntime[] }>(RUNTIMES_QUERY, { environmentId: envId, projectId, componentId }).then((d) => d.runtimes),
    enabled: !!envId && !!projectId && !!componentId,
  });
}

const PROJECT_RUNTIMES_QUERY = `
  query GetProjectRuntimes($environmentId: String!, $projectId: String!) {
    runtimes(environmentId: $environmentId, projectId: $projectId) {
      runtimeId, runtimeType, status, version,
      platformName, platformVersion, platformHome,
      osName, osVersion, registrationTime, lastHeartbeat,
      component { displayName }
    }
  }`;

export function useProjectRuntimes(envId: string, projectId: string) {
  return useQuery({
    queryKey: ['projectRuntimes', envId, projectId],
    queryFn: () => gql<{ runtimes: GqlRuntime[] }>(PROJECT_RUNTIMES_QUERY, { environmentId: envId, projectId }).then((d) => d.runtimes),
    enabled: !!envId && !!projectId,
  });
}

export { RUNTIMES_QUERY, PROJECT_RUNTIMES_QUERY };

export interface GqlArtifactType {
  artifactType: string;
  artifactCount: number;
}

export function useArtifactTypes(componentId: string, envId: string) {
  return useQuery({
    queryKey: ['artifactTypes', componentId, envId],
    queryFn: () =>
      gql<{ componentArtifactTypes: GqlArtifactType[] }>(
        `query ComponentArtifactTypes($componentId: String!, $environmentId: String!) {
          componentArtifactTypes(componentId: $componentId, environmentId: $environmentId) {
            artifactType, artifactCount
          }
        }`,
        { componentId, environmentId: envId },
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
// `fields` = flat scalar fields, `gqlFields` = full GraphQL selection (including nested)
// fields = card columns, gqlFields = full GraphQL selection (including nested)
const ARTIFACT_QUERY_MAP: Record<string, { queryName: string; field: string; fields: string; gqlFields: string }> = {
  RestApi: {
    queryName: 'restApisByEnvironmentAndComponent',
    field: 'restApisByEnvironmentAndComponent',
    fields: 'name, context, version, state',
    gqlFields: 'name, context, version, state, tracing, statistics, carbonApp, url, runtimes { runtimeId, status }, resources { path, methods }',
  },
  ProxyService: { queryName: 'proxyServicesByEnvironmentAndComponent', field: 'proxyServicesByEnvironmentAndComponent', fields: 'name, state', gqlFields: 'name, state, tracing, statistics, carbonApp, endpoints, runtimes { runtimeId, status }' },
  Endpoint: { queryName: 'endpointsByEnvironmentAndComponent', field: 'endpointsByEnvironmentAndComponent', fields: 'name, type, state', gqlFields: 'name, type, state, tracing, statistics, attributes { name, value }, runtimes { runtimeId, status }' },
  InboundEndpoint: {
    queryName: 'inboundEndpointsByEnvironmentAndComponent',
    field: 'inboundEndpointsByEnvironmentAndComponent',
    fields: 'name, protocol',
    gqlFields: 'name, protocol, sequence, onError, state, tracing, statistics, carbonApp, runtimes { runtimeId, status }',
  },
  Sequence: { queryName: 'sequencesByEnvironmentAndComponent', field: 'sequencesByEnvironmentAndComponent', fields: 'name, type, container, state', gqlFields: 'name, type, container, state, tracing, statistics, runtimes { runtimeId, status }' },
  Task: { queryName: 'tasksByEnvironmentAndComponent', field: 'tasksByEnvironmentAndComponent', fields: 'name, group, state', gqlFields: 'name, class, group, state, carbonApp, runtimes { runtimeId, status }' },
  LocalEntry: { queryName: 'localEntriesByEnvironmentAndComponent', field: 'localEntriesByEnvironmentAndComponent', fields: 'name, type', gqlFields: 'name, type, value, state, runtimes { runtimeId, status }' },
  CarbonApp: { queryName: 'carbonAppsByEnvironmentAndComponent', field: 'carbonAppsByEnvironmentAndComponent', fields: 'name, version', gqlFields: 'name, version, state, artifacts { name, type }, runtimes { runtimeId, status }' },
  Connector: { queryName: 'connectorsByEnvironmentAndComponent', field: 'connectorsByEnvironmentAndComponent', fields: 'name, package, state', gqlFields: 'name, package, version, state, runtimes { runtimeId, status }' },
  RegistryResource: { queryName: 'registryResourcesByEnvironmentAndComponent', field: 'registryResourcesByEnvironmentAndComponent', fields: 'name, type', gqlFields: 'name, type, runtimes { runtimeId, status }' },
  Listener: { queryName: 'listenersByEnvironmentAndComponent', field: 'listenersByEnvironmentAndComponent', fields: 'name, package, protocol, host, port, state', gqlFields: 'name, package, protocol, host, port, state, runtimes { runtimeId, status }' },
  Service: {
    queryName: 'servicesByEnvironmentAndComponent',
    field: 'servicesByEnvironmentAndComponent',
    fields: 'name, package, basePath, type',
    gqlFields: 'name, package, basePath, type, runtimes { runtimeId, status }, resources { path, method, url, methods }',
  },
  Automation: {
    queryName: 'automationsByEnvironmentAndComponent',
    field: 'automationsByEnvironmentAndComponent',
    fields: 'packageOrg, packageName, packageVersion',
    gqlFields: 'packageOrg, packageName, packageVersion, runtimeIds, runtimes { runtimeId, status }, executionTimestamp',
  },
  MessageStore: {
    queryName: 'messageStoresByEnvironmentAndComponent',
    field: 'messageStoresByEnvironmentAndComponent',
    fields: 'name, type, size',
    gqlFields: 'name, type, size, carbonApp, runtimes { runtimeId, status }',
  },
  MessageProcessor: {
    queryName: 'messageProcessorsByEnvironmentAndComponent',
    field: 'messageProcessorsByEnvironmentAndComponent',
    fields: 'name, type, state',
    gqlFields: 'name, type, state, tracing, carbonApp, runtimes { runtimeId, status }',
  },
  Template: {
    queryName: 'templatesByEnvironmentAndComponent',
    field: 'templatesByEnvironmentAndComponent',
    fields: 'name, type',
    gqlFields: 'name, type, tracing, statistics, carbonApp, runtimes { runtimeId, status }',
  },
  DataService: {
    queryName: 'dataServicesByEnvironmentAndComponent',
    field: 'dataServicesByEnvironmentAndComponent',
    fields: 'name, state',
    gqlFields: 'name, description, state, carbonApp, runtimes { runtimeId, status }',
  },
  DataSource: {
    queryName: 'dataSourcesByEnvironmentAndComponent',
    field: 'dataSourcesByEnvironmentAndComponent',
    fields: 'name, type, state',
    gqlFields: 'name, type, driver, url, username, state, runtimes { runtimeId, status }',
  },
};

export function useArtifacts(artifactType: string, envId: string, componentId: string, options?: { enabled?: boolean }) {
  const mapping = ARTIFACT_QUERY_MAP[artifactType];
  return useQuery({
    queryKey: ['artifacts', artifactType, envId, componentId],
    queryFn: async () => {
      if (!mapping) return [];
      const data = await gql<Record<string, GqlArtifact[]>>(`query ArtifactQuery($environmentId: String!, $componentId: String!) { ${mapping.field}(environmentId: $environmentId, componentId: $componentId) { ${mapping.gqlFields} } }`, {
        environmentId: envId,
        componentId,
      }).catch(() => ({}) as Record<string, GqlArtifact[]>);
      return data[mapping.field] ?? [];
    },
    enabled: !!artifactType && !!envId && !!componentId && !!mapping && (options?.enabled ?? true),
    retry: false,
  });
}

export { ARTIFACT_QUERY_MAP };

// ── Artifact detail panel queries ──

const ARTIFACT_SOURCE_QUERY = `
  query GetArtifactSource($environmentId: String!, $componentId: String!, $artifactType: String!, $artifactName: String!) {
    artifactSourceByComponent(environmentId: $environmentId, componentId: $componentId, artifactType: $artifactType, artifactName: $artifactName)
  }`;

export function useArtifactSource(envId: string, componentId: string, artifactType: string, artifactName: string) {
  return useQuery({
    queryKey: ['artifactSource', envId, componentId, artifactType, artifactName],
    queryFn: () =>
      gql<{ artifactSourceByComponent: string }>(ARTIFACT_SOURCE_QUERY, {
        environmentId: envId,
        componentId,
        artifactType,
        artifactName,
      }).then((d) => d.artifactSourceByComponent),
    enabled: !!envId && !!componentId && !!artifactType && !!artifactName,
  });
}

const LOCAL_ENTRY_VALUE_QUERY = `
  query LocalEntryValue($componentId: String!, $entryName: String!, $environmentId: String) {
    localEntryValueByComponent(componentId: $componentId, entryName: $entryName, environmentId: $environmentId)
  }`;

export function useLocalEntryValue(componentId: string, entryName: string, envId: string) {
  return useQuery({
    queryKey: ['localEntryValue', componentId, entryName, envId],
    queryFn: () =>
      gql<{ localEntryValueByComponent: string }>(LOCAL_ENTRY_VALUE_QUERY, {
        componentId,
        entryName,
        environmentId: envId,
      }).then((d) => d.localEntryValueByComponent),
    enabled: !!componentId && !!entryName && !!envId,
  });
}

// Maps display artifactType to the backend "type" param used in artifactSourceByComponent
export const ARTIFACT_TYPE_TO_SOURCE_TYPE: Record<string, string> = {
  RestApi: 'api',
  ProxyService: 'proxy-service',
  Endpoint: 'endpoint',
  InboundEndpoint: 'inbound-endpoint',
  Sequence: 'sequence',
  Task: 'task',
  LocalEntry: 'local-entry',
  CarbonApp: 'carbon-app',
  Connector: 'connector',
  RegistryResource: 'registry-resource',
  Listener: 'listener',
  Service: 'service',
  Automation: 'automation',
};

export interface GqlArtifactParam {
  name: string;
  value: string;
}

const ARTIFACT_PARAMS_QUERY = `
  query ArtifactParams($componentId: String!, $artifactType: String!, $artifactName: String!, $environmentId: String, $runtimeId: String) {
    artifactParametersByComponent(
      componentId: $componentId,
      artifactType: $artifactType,
      artifactName: $artifactName,
      environmentId: $environmentId,
      runtimeId: $runtimeId
    ) {
      name
      value
    }
  }`;

export function useArtifactParams(componentId: string, artifactType: string, artifactName: string, envId: string, runtimeId?: string) {
  return useQuery({
    queryKey: ['artifactParams', componentId, artifactType, artifactName, envId, runtimeId],
    queryFn: () =>
      gql<{ artifactParametersByComponent: GqlArtifactParam[] }>(ARTIFACT_PARAMS_QUERY, {
        componentId,
        artifactType,
        artifactName,
        environmentId: envId,
        runtimeId,
      }).then((d) => d.artifactParametersByComponent),
    enabled: !!componentId && !!artifactType && !!artifactName && !!envId,
  });
}

const ARTIFACT_WSDL_QUERY = `
  query ArtifactWsdl($componentId: String!, $artifactType: String!, $artifactName: String!, $environmentId: String, $runtimeId: String) {
    artifactWsdlByComponent(
      componentId: $componentId,
      artifactType: $artifactType,
      artifactName: $artifactName,
      environmentId: $environmentId,
      runtimeId: $runtimeId
    )
  }`;

export function useArtifactWsdl(componentId: string, artifactType: string, artifactName: string, envId: string, runtimeId?: string) {
  return useQuery({
    queryKey: ['artifactWsdl', componentId, artifactType, artifactName, envId, runtimeId],
    queryFn: () =>
      gql<{ artifactWsdlByComponent: string }>(ARTIFACT_WSDL_QUERY, {
        componentId,
        artifactType,
        artifactName,
        environmentId: envId,
        runtimeId,
      }).then((d) => d.artifactWsdlByComponent),
    enabled: !!componentId && !!artifactType && !!artifactName && !!envId,
  });
}

// ── Component repository & commit history ──

export interface GqlRepository {
  gitProvider: string;
  organizationApp: string;
  nameApp: string;
  branch: string;
  appSubPath: string;
  bitbucketServerUrl?: string;
  serverUrl?: string;
  projectApp?: string;
}

export interface GqlCommit {
  sha: string;
  message: string;
  isLatest: boolean;
  author: {
    name: string;
    date: string;
    email: string;
    avatarUrl: string;
  };
}

const COMPONENT_REPOSITORY_QUERY = `
  query GetComponentRepository($projectId: String!, $componentHandler: String!) {
    component(projectId: $projectId, componentHandler: $componentHandler) {
      repository {
        gitProvider, organizationApp, nameApp, branch, appSubPath,
        bitbucketServerUrl, serverUrl, projectApp
      }
    }
  }`;

export function useComponentRepository(projectId: string, componentHandler: string) {
  return useQuery({
    queryKey: ['componentRepository', projectId, componentHandler],
    queryFn: () => gql<{ component: { repository: GqlRepository } }>(COMPONENT_REPOSITORY_QUERY, { projectId, componentHandler }).then((d) => d.component?.repository ?? null),
    enabled: !!projectId && !!componentHandler,
  });
}

const COMMIT_HISTORY_QUERY = `
  query GetCommitHistory($componentId: String!, $branch: String!) {
    commitHistory(componentId: $componentId, branch: $branch) {
      sha, message, isLatest,
      author { name, date, email, avatarUrl }
    }
  }`;

export function useCommitHistory(componentId: string, branch: string) {
  return useQuery({
    queryKey: ['commitHistory', componentId, branch],
    queryFn: () => gql<{ commitHistory: GqlCommit[] }>(COMMIT_HISTORY_QUERY, { componentId, branch }).then((d) => d.commitHistory ?? []),
    enabled: !!componentId && !!branch,
  });
}

// ── Execution / Schedule configs ──

export interface GqlExecutionConfigs {
  cronjobFrequency: string;
  cronjobTimezone: string;
  cronjobAllowConcurrency?: boolean;
  timeoutSeconds?: number;
  retryCount?: number;
}

const EXECUTION_CONFIGS_QUERY = `
  query GetExecutionConfigs($componentId: String!, $releaseId: String!) {
    executionConfigs(componentId: $componentId, releaseId: $releaseId) {
      cronjobFrequency, cronjobTimezone, cronjobAllowConcurrency, timeoutSeconds, retryCount
    }
  }`;

export function useExecutionConfigs(componentId: string, releaseId: string) {
  return useQuery({
    queryKey: ['executionConfigs', componentId, releaseId],
    queryFn: () =>
      gql<{ executionConfigs: GqlExecutionConfigs }>(EXECUTION_CONFIGS_QUERY, { componentId, releaseId })
        .then((d) => d.executionConfigs)
        .catch(() => null),
    enabled: !!componentId && !!releaseId,
    retry: false,
  });
}

// ── Component Deployment (for real releaseId) ──

export interface GqlComponentDeployment {
  releaseId: string;
  cron: string;
  cronTimezone: string;
  build?: { buildId: string };
}

const COMPONENT_DEPLOYMENT_QUERY = `
  query GetComponentDeployment($orgHandler: String!, $orgUuid: String!, $componentId: String!, $versionId: String!, $environmentId: String!) {
    componentDeployment(orgHandler: $orgHandler, orgUuid: $orgUuid, componentId: $componentId, versionId: $versionId, environmentId: $environmentId) {
      releaseId, cron, cronTimezone, build { buildId }
    }
  }`;

export function useComponentDeployment(orgHandler: string, orgUuid: string, componentId: string, versionId: string, environmentId: string) {
  return useQuery({
    queryKey: ['componentDeployment', orgHandler, componentId, versionId, environmentId],
    queryFn: () =>
      gql<{ componentDeployment: GqlComponentDeployment }>(COMPONENT_DEPLOYMENT_QUERY, { orgHandler, orgUuid, componentId, versionId, environmentId })
        .then((d) => d.componentDeployment)
        .catch(() => null),
    enabled: !!orgHandler && !!orgUuid && !!componentId && !!versionId && !!environmentId,
    retry: false,
  });
}

// ── Deployment execution history ──

export interface GqlDeploymentStatus {
  id: number;
  sha: string;
  started_at: string;
  completed_at: string;
  status: string;
  conclusion: string;
  conclusionV2: string;
  isAutoDeploy: boolean;
  name: string;
  failureReason: number;
  sourceCommitId: string;
  buildRef?: string;
}

const DEPLOYMENT_STATUS_QUERY = `
  query GetDeploymentStatus($versionId: String!, $componentId: String!) {
    deploymentStatusByVersion(versionId: $versionId, componentId: $componentId) {
      id, sha, started_at, completed_at, status, conclusion, conclusionV2, isAutoDeploy, name, failureReason, sourceCommitId, buildRef
    }
  }`;

export function useDeploymentStatus(componentId: string, versionId: string) {
  return useQuery({
    queryKey: ['deploymentStatus', componentId, versionId],
    queryFn: () =>
      gql<{ deploymentStatusByVersion: GqlDeploymentStatus[] }>(DEPLOYMENT_STATUS_QUERY, { versionId, componentId })
        .then((d) => d.deploymentStatusByVersion ?? [])
        .catch(() => []),
    enabled: !!componentId && !!versionId,
    retry: false,
    refetchInterval: 15000,
  });
}

export interface TaskExecution {
  id: string;
  startTime: string;
  completionTime: string;
  runId: string;
  revisionId: string;
  failedReason: string;
  status: string;
}

export function useTaskExecutions(releaseId: string) {
  const baseUrl = window.API_CONFIG?.systemApisBaseUrl ?? '';
  return useQuery({
    queryKey: ['taskExecutions', releaseId, baseUrl],
    queryFn: async (): Promise<TaskExecution[]> => {
      if (!baseUrl || !releaseId) return [];
      const url = `${baseUrl}/systemapis/choreoobsapi/0.3.0/tasks/executions?releaseId=${releaseId}&limit=10&verbose=true`;
      const res = await authenticatedFetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!baseUrl && !!releaseId,
    retry: false,
    staleTime: 0,
  });
}

export function useTaskExecutionCount(releaseId: string) {
  const baseUrl = window.API_CONFIG?.systemApisBaseUrl ?? '';
  return useQuery({
    queryKey: ['taskExecutionCount', releaseId, baseUrl],
    queryFn: async (): Promise<number | null> => {
      if (!baseUrl || !releaseId) return null;
      const to = new Date();
      const from = new Date(to);
      from.setDate(to.getDate() - 30);
      const url = `${baseUrl}/systemapis/choreoobsapi/0.3.0/tasks/executions/count?releaseId=${releaseId}&from=${from.toISOString()}&to=${to.toISOString()}`;
      const res = await authenticatedFetch(url);
      if (!res.ok) return null;
      const data: { count: number } = await res.json();
      return data.count ?? null;
    },
    enabled: !!baseUrl && !!releaseId,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

// ── Schema-based configurable values ──

export interface SchemaConfigValue {
  value: string;
  environmentUuid?: string;
}

export interface SchemaConfigItem {
  key: string;
  values: SchemaConfigValue[];
  valueType?: string;
  isRequired?: boolean;
  isSensitive?: boolean;
}

export interface SchemaConfigData {
  jsonSchema?: string; // base64-encoded JSON schema
  mappingId?: string;
  configurations: SchemaConfigItem[];
}

export function useSchemaConfig(projectId: string, componentId: string, envId: string, deploymentTrackId: string, commitHash?: string) {
  return useQuery({
    queryKey: ['schemaConfig', projectId, componentId, envId, deploymentTrackId, commitHash],
    queryFn: async (): Promise<SchemaConfigData | null> => {
      const base = new URL(window.API_CONFIG.graphqlUrl).origin;
      const qs = commitHash ? `?commitHash=${encodeURIComponent(commitHash)}` : '';
      const url = `${base}/configuration-schema/v1.0/projects/${projectId}/components/${componentId}/env-template/${envId}/deployment-track/${deploymentTrackId}/configurations${qs}`;
      const res = await authenticatedFetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId && !!componentId && !!envId && !!deploymentTrackId && !!commitHash,
    retry: false,
  });
}

// ── Refresh environment artifacts ──

export function useRefreshEnvironmentArtifacts() {
  const qc = useQueryClient();

  return (envId: string, componentId: string) => {
    return Promise.all([
      qc.invalidateQueries({
        queryKey: ['artifacts'],
        predicate: (query) => {
          const [, , envIdKey, compIdKey] = query.queryKey;
          return envIdKey === envId && compIdKey === componentId;
        },
      }),
      qc.invalidateQueries({
        queryKey: ['artifactTypes', componentId, envId],
      }),
    ]);
  };
}
