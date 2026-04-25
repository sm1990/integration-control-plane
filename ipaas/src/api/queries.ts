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
import { authenticatedFetch, getOrgUuidFromToken, refreshAccessToken } from '../auth/tokenManager';
import { choreoDevopsApiUrl, componentMgtApiUrl, subscriptionsApiUrl } from '../config/api';
import { fetchApimApi, fetchApimSwagger, type ApimApiInfo } from './apim';
import { UUID_RE } from '../utils/string';

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
  serviceAccessMode?: string | null;
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

export function useProjectByHandler(handler: string) {
  const id = orgId();
  return useQuery({
    queryKey: ['project', 'handler', handler, id],
    queryFn: () => gql<{ projectByHandler: GqlProject }>(PROJECT_BY_HANDLER_QUERY, { orgId: id, projectHandler: handler }).then((d) => d.projectByHandler),
    // Guard: never call if handler is empty or looks like a UUID (should use useProject instead)
    enabled: !!handler && id > 0 && !UUID_RE.test(handler),
    retry: false,
  });
}

export interface ProjectContributor {
  id: number;
  displayName: string;
  email: string;
  pictureUrl: string | null;
  totalContributions: number;
}

const PROJECT_CONTRIBUTORS_QUERY = `
  query GetProjectContributors($orgId: Int!, $projectId: String!) {
    project(orgId: $orgId, projectId: $projectId) {
      projectContributorsData {
        contributorCount
        contributors { id, pictureUrl, email, displayName, totalContributions }
      }
    }
  }`;

export function useProjectContributors(projectId: string) {
  const id = orgId();
  return useQuery({
    queryKey: ['projectContributors', projectId, id],
    queryFn: () =>
      gql<{ project: { projectContributorsData: { contributorCount: number; contributors: ProjectContributor[] } } }>(PROJECT_CONTRIBUTORS_QUERY, { orgId: id, projectId })
        .then((d) => d.project?.projectContributorsData?.contributors ?? [])
        .catch(() => []),
    enabled: !!projectId && id > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useComponents(orgHandler: string, projectId: string) {
  return useQuery({
    queryKey: ['components', orgHandler, projectId],
    queryFn: () => gql<{ components: GqlComponent[] }>(COMPONENTS_QUERY, { orgHandler, projectId }).then((d) => d.components),
    enabled: !!orgHandler && !!projectId,
  });
}

export interface GqlDeploymentTrack {
  id: string;
  branch?: string;
  apiVersion?: string;
  latest?: boolean;
}

export interface GqlApiVersion {
  id: string;
  apiVersion: string;
  branch: string;
  latest: boolean;
  accessibility?: string;
}

export interface GqlComponentDetail extends GqlComponent {
  orgHandler: string;
  deploymentTracks?: GqlDeploymentTrack[];
  apiVersions?: GqlApiVersion[];
  repository?: GqlRepository;
}

const COMPONENT_BY_HANDLER_QUERY = `
  query GetComponent($projectId: String!, $componentHandler: String!) {
    component(projectId: $projectId, componentHandler: $componentHandler) {
      projectId, id, name, handler, displayName, displayType,
      description, status, componentSubType, serviceAccessMode,
      version, createdAt, lastBuildDate, orgHandler, labels, apiId,
      deploymentTracks { id, branch, apiVersion, latest }
      apiVersions { id, apiVersion, branch, latest, accessibility }
      repository {
        gitProvider, organizationApp, nameApp, branch, appSubPath,
        bitbucketServerUrl, serverUrl, projectApp,
        isBuildConfigurationMigrated,
        buildpackConfig { versionId, buildContext, isUnitTestEnabled, languageVersion, pullLatestSubmodules, enableTrivyScan, keyValues { id, key, value } }
      }
    }
  }`;

export function useComponentByHandler(projectId: string, handler: string | undefined) {
  return useQuery({
    queryKey: ['component', projectId, handler],
    queryFn: () => gql<{ component: GqlComponentDetail }>(COMPONENT_BY_HANDLER_QUERY, { projectId, componentHandler: handler }).then((d) => d.component),
    enabled: !!projectId && !!handler,
  });
}

export interface GqlEndpoint {
  displayName: string;
  visibility: string;
  apimId?: string | null;
}

const COMPONENT_ENDPOINTS_QUERY = `
  query GetComponentEndpoints($componentId: String!, $versionId: String!) {
    componentEndpoints(input: { componentId: $componentId, versionId: $versionId }) {
      displayName, visibility, apimId
    }
  }`;

export function useComponentEndpoints(componentId: string, versionId: string) {
  return useQuery({
    queryKey: ['componentEndpoints', componentId, versionId],
    queryFn: () =>
      gql<{ componentEndpoints: GqlEndpoint[] }>(COMPONENT_ENDPOINTS_QUERY, { componentId, versionId })
        .then((d) => d.componentEndpoints ?? [])
        .catch(() => []),
    enabled: !!componentId && !!versionId,
    staleTime: 60_000,
  });
}

export function useApimApi(apimId: string | undefined | null) {
  return useQuery<ApimApiInfo | null>({
    queryKey: ['apimApi', apimId],
    queryFn: () => fetchApimApi(apimId!),
    enabled: !!apimId,
    staleTime: 30_000,
    retry: false,
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
  apimEnvId?: string;
}

const ENVIRONMENTS_QUERY = `
  query GetEnvironments($orgUuid: String!, $projectId: String!) {
    environments(orgUuid: $orgUuid, type: "external", projectId: $projectId) {
      id, name, critical, templateId, dpId, apimEnvId
    }
  }`;

export function useEnvironments(orgUuid: string, projectId: string) {
  const effectiveOrgUuid = getOrgUuidFromToken() ?? orgUuid;
  return useQuery({
    queryKey: ['environments', effectiveOrgUuid, projectId],
    queryFn: () => gql<{ environments: GqlEnvironment[] }>(ENVIRONMENTS_QUERY, { orgUuid: effectiveOrgUuid, projectId }).then((d) => d.environments),
    enabled: !!effectiveOrgUuid && !!projectId,
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

export interface GqlBuildpackConfig {
  versionId: string;
  buildContext: string;
  isUnitTestEnabled: boolean;
  languageVersion: string;
  pullLatestSubmodules: boolean;
  enableTrivyScan: boolean;
  keyValues?: Array<{ id?: string; key: string; value: string }>;
}

export interface GqlRepository {
  gitProvider: string;
  organizationApp: string;
  nameApp: string;
  branch: string;
  appSubPath: string;
  bitbucketServerUrl?: string;
  serverUrl?: string;
  projectApp?: string;
  isBuildConfigurationMigrated?: boolean;
  buildpackConfig?: GqlBuildpackConfig[];
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
        bitbucketServerUrl, serverUrl, projectApp,
        isBuildConfigurationMigrated,
        buildpackConfig { versionId, buildContext, isUnitTestEnabled, languageVersion, pullLatestSubmodules, enableTrivyScan, keyValues { id, key, value } }
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

export interface GqlReleaseMgtDeployment {
  releaseMgtReleaseId: string;
  releaseMgtDeploymentId: string;
}

export interface GqlComponentDeployment {
  releaseId: string;
  cron: string;
  cronTimezone: string;
  deploymentStatusV2?: string | null;
  invokeUrl?: string | null;
  imageUrl?: string | null;
  configCount?: number;
  releaseMgtDeployment?: GqlReleaseMgtDeployment | null;
  build?: {
    buildId: string;
    deployedAt?: string;
    commit?: {
      sha: string;
      message: string;
      isLatest: boolean;
      author: { name: string; date: string; email: string; avatarUrl: string };
    };
  };
}

const COMPONENT_DEPLOYMENT_QUERY = `
  query GetComponentDeployment($orgHandler: String!, $orgUuid: String!, $componentId: String!, $versionId: String!, $environmentId: String!) {
    componentDeployment(orgHandler: $orgHandler, orgUuid: $orgUuid, componentId: $componentId, versionId: $versionId, environmentId: $environmentId) {
      releaseId, cron, cronTimezone, deploymentStatusV2, invokeUrl, imageUrl, configCount,
      releaseMgtDeployment { releaseMgtReleaseId, releaseMgtDeploymentId },
      build { buildId, deployedAt, commit { sha, message, isLatest, author { name, date, email, avatarUrl } } }
    }
  }`;

export function useComponentDeployment(orgHandler: string, orgUuid: string, componentId: string, versionId: string, environmentId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['componentDeployment', orgHandler, componentId, versionId, environmentId],
    queryFn: () =>
      gql<{ componentDeployment: GqlComponentDeployment }>(COMPONENT_DEPLOYMENT_QUERY, { orgHandler, orgUuid, componentId, versionId, environmentId })
        .then((d) => d.componentDeployment)
        .catch(() => null),
    enabled: !!orgHandler && !!orgUuid && !!componentId && !!versionId && !!environmentId,
    retry: false,
    refetchInterval: options?.refetchInterval,
  });
}

// ── Per-environment endpoints (filtered by releaseId) ──

export interface GqlEnvEndpoint {
  id: string;
  releaseId: string;
  environmentId: string;
  displayName: string;
  port?: number | null;
  type: string;
  apiContext?: string | null;
  apiDefinitionPath?: string | null;
  visibility: string;
  invokeUrl?: string | null;
  publicUrl?: string | null;
  organizationUrl?: string | null;
  projectUrl?: string | null;
  defaultPublicUrl?: string | null;
  defaultOrganizationUrl?: string | null;
  networkVisibilities?: string[] | null;
  state?: string | null;
  apimId?: string | null;
  apimRevisionId?: string | null;
}

const ENV_ENDPOINTS_QUERY = `
  query GetEnvEndpoints($componentId: String!, $versionId: String!, $releaseId: String!) {
    componentEndpoints(input: {
      componentId: $componentId,
      versionId: $versionId,
      options: { filter: { releaseIds: [$releaseId] } }
    }) {
      id, releaseId, environmentId, displayName, port, type, apiContext, apiDefinitionPath,
      visibility, invokeUrl, publicUrl, organizationUrl, projectUrl,
      defaultPublicUrl, defaultOrganizationUrl, networkVisibilities, state, apimId, apimRevisionId
    }
  }`;

export function useEnvEndpoints(componentId: string, versionId: string, releaseId: string) {
  return useQuery({
    queryKey: ['envEndpoints', componentId, versionId, releaseId],
    queryFn: () =>
      gql<{ componentEndpoints: GqlEnvEndpoint[] }>(ENV_ENDPOINTS_QUERY, { componentId, versionId, releaseId })
        .then((d) => d.componentEndpoints ?? [])
        .catch(() => []),
    enabled: !!componentId && !!versionId && !!releaseId,
    staleTime: 30_000,
    retry: false,
  });
}

export function useApiDefinition(apimRevisionId: string | null | undefined) {
  return useQuery({
    queryKey: ['apiDefinition', apimRevisionId],
    queryFn: () => fetchApimSwagger(apimRevisionId!),
    enabled: !!apimRevisionId,
    staleTime: 60_000,
    retry: false,
  });
}

const COMPONENT_ENDPOINT_API_DEFINITION_QUERY = `
  query ApiDefinition($componentId: String!, $versionId: String!, $endpointId: String!) {
    componentEndpointApiDefinition(
      input: {
        componentId: $componentId
        versionId: $versionId
        endpointId: $endpointId
      }
    ) {
      content
    }
  }`;

export async function fetchComponentEndpointSpec(componentId: string, versionId: string, endpointId: string): Promise<string | null> {
  const data = await gql<{ componentEndpointApiDefinition: { content: string } | null }>(COMPONENT_ENDPOINT_API_DEFINITION_QUERY, { componentId, versionId, endpointId });
  const b64 = data.componentEndpointApiDefinition?.content;
  if (!b64) return null;
  return atob(b64);
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
  isTriggeredAtCreation: boolean;
  name: string;
  failureReason: number;
  sourceCommitId: string;
  buildRef?: string;
}

const DEPLOYMENT_STATUS_QUERY = `
  query GetDeploymentStatus($versionId: String!, $componentId: String!) {
    deploymentStatusByVersion(versionId: $versionId, componentId: $componentId) {
      id, sha, started_at, completed_at, status, conclusion, conclusionV2, isAutoDeploy, isTriggeredAtCreation, name, failureReason, sourceCommitId, buildRef
    }
  }`;

const TERMINAL_CONCLUSIONS = new Set(['success', 'failure', 'cancelled', 'timed_out', 'neutral', 'skipped']);

export function useDeploymentStatus(componentId: string, versionId: string) {
  return useQuery({
    queryKey: ['deploymentStatus', componentId, versionId],
    queryFn: () => gql<{ deploymentStatusByVersion: GqlDeploymentStatus[] }>(DEPLOYMENT_STATUS_QUERY, { versionId, componentId }).then((d) => d.deploymentStatusByVersion ?? []),
    enabled: !!componentId && !!versionId,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as GqlDeploymentStatus[] | undefined;
      if (!data || data.length === 0) return 15000;
      const allTerminal = data.every((d) => d.status === 'completed' || TERMINAL_CONCLUSIONS.has((d.conclusionV2 ?? d.conclusion ?? '').toLowerCase()));
      return allTerminal ? false : 15000;
    },
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
  arguments?: string | null;
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

const EXECUTION_ARGUMENTS_QUERY = `
  query GetExecutionArguments($id: String!, $componentId: String!, $releaseId: String!) {
    execution(input: { id: $id, componentId: $componentId, releaseId: $releaseId }) {
      arguments {
        argumentName
        argumentValue
      }
    }
  }`;

interface ExecutionArgument {
  argumentName: string;
  argumentValue: string;
}

export function useExecutionArguments(runId: string, componentId: string, releaseId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['executionArguments', runId, componentId, releaseId],
    queryFn: () =>
      gql<{ execution: { arguments: ExecutionArgument[] } }>(EXECUTION_ARGUMENTS_QUERY, { id: runId, componentId, releaseId })
        .then((d) => d.execution?.arguments ?? [])
        .catch(() => []),
    enabled: enabled && !!runId && !!componentId && !!releaseId,
    retry: false,
    staleTime: 60000,
  });
}

export interface ExecutionLogEntry {
  timestamp: string;
  message: string;
}

export function useExecutionLogs(componentId: string, deploymentTrackId: string, executionId: string, environmentId: string, enabled: boolean) {
  const baseUrl = window.API_CONFIG?.systemApisBaseUrl ?? '';
  return useQuery({
    queryKey: ['executionLogs', componentId, deploymentTrackId, executionId, environmentId, baseUrl],
    queryFn: async (): Promise<ExecutionLogEntry[]> => {
      if (!baseUrl || !componentId || !deploymentTrackId || !executionId || !environmentId) return [];
      const url = `${baseUrl}/systemapis/choreologgingapi/0.2.0/components/${componentId}/deployment-tracks/${deploymentTrackId}/executions/${executionId}/logs?environmentId=${environmentId}&offset=0&limit=10000`;
      const res = await authenticatedFetch(url);
      if (!res.ok) return [];
      const data: { columns: { name: string }[]; rows: string[][] } = await res.json();
      const logIdx = data.columns?.findIndex((c) => c.name === 'LogEntry') ?? -1;
      const timeIdx = data.columns?.findIndex((c) => c.name === 'TimeGenerated') ?? -1;
      return (data.rows ?? []).map((row) => ({
        timestamp: timeIdx >= 0 ? row[timeIdx] : '',
        message: logIdx >= 0 ? row[logIdx] : (row[0] ?? ''),
      }));
    },
    enabled: enabled && !!baseUrl && !!componentId && !!deploymentTrackId && !!executionId && !!environmentId,
    retry: false,
    staleTime: 30000,
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
  keyId?: string;
  configGroupId?: string;
  configKeyId?: string;
  isDynamic?: boolean;
}

export interface SchemaConfigData {
  jsonSchema?: string; // base64-encoded JSON schema
  mappingId?: string;
  configurations: SchemaConfigItem[];
}

// ── Certificate groups & mappings ──

export interface CertGroupKey {
  keyUuid: string;
  key: string;
  isSensitive: boolean;
  isFile: boolean;
}

export interface CertGroup {
  groupUuid: string;
  groupName: string;
  groupDisplayName?: string;
  configurations: CertGroupKey[];
}

export function useConfigGroups(projectId: string, componentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['configGroups', projectId, componentId],
    queryFn: async (): Promise<CertGroup[]> => {
      const base = new URL(window.API_CONFIG.graphqlUrl).origin;
      const params = new URLSearchParams({ projectId, componentId, nested_search: 'true' });
      const res = await authenticatedFetch(`${base}/config-svc/v1.0/configs/groups?${params}`);
      if (!res.ok) return [];
      const data: CertGroup[] = await res.json();
      return data.filter((g) => !g.groupName.startsWith('certificates-'));
    },
    enabled: enabled && !!projectId && !!componentId,
    retry: false,
  });
}

export function useCertificateGroups(projectId: string, componentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['certGroups', projectId, componentId],
    queryFn: async (): Promise<CertGroup[]> => {
      const base = new URL(window.API_CONFIG.graphqlUrl).origin;
      const params = new URLSearchParams({ projectId, componentId, nested_search: 'true' });
      const res = await authenticatedFetch(`${base}/config-svc/v1.0/configs/groups?${params}`);
      if (!res.ok) return [];
      const data: CertGroup[] = await res.json();
      return data.filter((g) => g.groupName.startsWith('certificates-'));
    },
    enabled: enabled && !!projectId && !!componentId,
    retry: false,
  });
}

export interface CertMappingConfig {
  key: string;
  isDynamic: boolean;
  configGroupId?: string;
  configKeyId?: string;
  configGroupName?: string;
  configKeyName?: string;
  isFile?: boolean;
  isSensitive?: boolean;
  keyId?: string;
  values?: { value: string; environmentUuid: string }[];
}

export interface CertMapping {
  projectId: string;
  componentId: string;
  envTemplateId: string;
  deploymentTrackId: string;
  configurations: CertMappingConfig[];
  mappingId?: string;
}

export function useCertificateMappings(projectId: string, componentId: string, envId: string, deploymentTrackId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['certMappings', projectId, componentId, envId, deploymentTrackId],
    queryFn: async (): Promise<CertMapping | null> => {
      const base = new URL(window.API_CONFIG.graphqlUrl).origin;
      const params = new URLSearchParams({ projectId, componentId, envTemplateId: envId, deploymentTrackId });
      const res = await authenticatedFetch(`${base}/config-mapping-svc/v1.0/configs/mappings?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: enabled && !!projectId && !!componentId && !!envId && !!deploymentTrackId,
    retry: false,
  });
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

// ── config-mgt configurable values ──

export interface ConfigMgtValue {
  value?: string;
  valueRef?: string;
  isSensitive?: boolean;
}

export interface ConfigMgtItem {
  configKeyName: string;
  valueType: string;
  isSystem?: boolean;
  isRequired?: boolean;
  configurationValue?: ConfigMgtValue;
  metadata?: { isSecret?: boolean };
  configPackageName: string;
  configPackageOrganization: string;
}

export interface ConfigMgtData {
  jsonSchema?: string;
  configurationMount?: ConfigMgtItem[];
  defaultPackage?: string;
}

export function useGetConfigMgt(orgHandler: string, projectId: string, componentId: string, envId: string, versionId: string, componentName: string, commitHash?: string, drawerOpen = false) {
  return useQuery({
    queryKey: ['configMgt', orgHandler, projectId, componentId, envId, versionId, commitHash],
    queryFn: async (): Promise<ConfigMgtData> => {
      const base = new URL(window.API_CONFIG.graphqlUrl).origin;
      const qs = new URLSearchParams({ component_name: componentName, ...(commitHash ? { commit_hash: commitHash } : {}) });
      const url = `${base}/config-mgt/1.0.0/orgs/${encodeURIComponent(orgHandler)}/projects/${encodeURIComponent(projectId)}/components/${encodeURIComponent(componentId)}/envs/${encodeURIComponent(envId)}/${encodeURIComponent(versionId)}/configurations?${qs}`;
      const res = await authenticatedFetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      return res.json();
    },
    enabled: drawerOpen && !!orgHandler && !!projectId && !!componentId && !!envId && !!versionId && !!componentName,
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

// GitHub repo / branch queries

const USER_REPOS_QUERY = `
  query GetUserRepos {
    userRepos {
      orgName
      repositories { name }
    }
  }`;

export interface GqlUserRepo {
  orgName: string;
  repositories: { name: string }[];
}

export function useGitHubUserRepos(enabled: boolean) {
  return useQuery({
    queryKey: ['githubUserRepos'],
    queryFn: () => gql<{ userRepos: GqlUserRepo[] }>(USER_REPOS_QUERY).then((d) => d.userRepos ?? []),
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

const REPO_BRANCHES_QUERY = `
  query GetRepoBranches($repositoryOrganization: String!, $repositoryName: String!, $isPublicRepo: Boolean!) {
    repoBranchList(secretRef: "", repositoryOrganization: $repositoryOrganization, repositoryName: $repositoryName, isPublicRepo: $isPublicRepo) {
      name
      isDefault
    }
  }`;

export interface GqlRepoBranch {
  name: string;
  isDefault: boolean;
}

export function useRepoBranches(repoOrg: string, repoName: string, isPublicRepo: boolean) {
  return useQuery({
    queryKey: ['repoBranches', repoOrg, repoName, isPublicRepo],
    queryFn: () => gql<{ repoBranchList: GqlRepoBranch[] }>(REPO_BRANCHES_QUERY, { repositoryOrganization: repoOrg, repositoryName: repoName, isPublicRepo }).then((d) => d.repoBranchList ?? []),
    enabled: !!repoOrg && !!repoName,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

// Repository metadata / path validation

const REPO_METADATA_QUERY = `
  query GetRepoMetadata(
    $organizationName: String!, $repoName: String!, $branch: String!,
    $subPath: String!, $secretRef: String!, $isPublicRepo: Boolean!
  ) {
    repoMetadata(
      organizationName: $organizationName,
      repoName: $repoName,
      branch: $branch,
      subPath: $subPath,
      buildpackId: "",
      dockerFilePath: "",
      dockerContextPath: "",
      openAPIPath: "",
      componentId: "",
      testRunnerType: "",
      secretRef: $secretRef,
      isService: false,
      isPublicRepo: $isPublicRepo,
      isGitProxy: false
    ) {
      isBareRepo
      isSubPathEmpty
      isSubPathValid
      isValidRepo
      hasBallerinaTomlInPath
      hasBallerinaTomlInRoot
      isDockerfilePathValid
      hasDockerfileInPath
      hasPomXmlInPath
      hasPomXmlInRoot
      isBuildpackPathValid
      isProcfileExists
      isEndpointYamlExists
    }
  }`;

export interface GqlRepoMetadata {
  isBareRepo: boolean;
  isSubPathEmpty: boolean;
  isSubPathValid: boolean;
  isValidRepo: boolean;
  hasBallerinaTomlInPath: boolean;
  hasBallerinaTomlInRoot: boolean;
  isDockerfilePathValid: boolean;
  hasDockerfileInPath: boolean;
  hasPomXmlInPath: boolean;
  hasPomXmlInRoot: boolean;
  isBuildpackPathValid: boolean;
  isProcfileExists: boolean;
  isEndpointYamlExists: boolean;
}

export type DetectedMode = 'mi' | 'ballerina' | 'empty' | 'non-empty' | null;

export function useRepoMetadata(org: string, repo: string, branch: string, subPath: string, enabled: boolean, isPublicRepo = false) {
  return useQuery({
    queryKey: ['repoMetadata', org, repo, branch, subPath, isPublicRepo],
    queryFn: () =>
      gql<{ repoMetadata: GqlRepoMetadata }>(REPO_METADATA_QUERY, {
        organizationName: org,
        repoName: repo,
        branch,
        subPath: subPath.replace(/^\//, ''), // strip leading slash for the API
        secretRef: '',
        isPublicRepo,
      }).then((d) => d.repoMetadata),
    enabled: enabled && !!org && !!repo && !!branch,
    staleTime: 60 * 1000,
    retry: false,
  });
}

// Repository directory contents (for file picker)

export interface RepoTreeNode {
  path: string;
  subPath: string;
  type: 'tree' | 'blob';
  children?: RepoTreeNode[];
}

export function useRepoContents(org: string, repo: string, branch: string, isPublicRepo = false) {
  return useQuery({
    queryKey: ['repoContents', org, repo, branch, isPublicRepo],
    queryFn: async (): Promise<RepoTreeNode[]> => {
      const url = `${componentMgtApiUrl()}/repositories/${org}/${repo}/branches/${encodeURIComponent(branch)}/contents?isPublicRepo=${isPublicRepo}`;
      let res = await authenticatedFetch(url);

      if (res.status === 403) {
        const stsConfigured = !!window.API_CONFIG.stsTokenEndpoint && !!window.API_CONFIG.stsClientId;
        const tokenIsUnscoped = stsConfigured && !getOrgUuidFromToken();
        if (tokenIsUnscoped) {
          await refreshAccessToken();
          res = await authenticatedFetch(url);
        }
      }

      if (!res.ok) throw new Error(`Failed to fetch repo contents: ${res.status}`);
      const json = await res.json();
      return (json?.data ?? json) as RepoTreeNode[];
    },
    enabled: !!org && !!repo && !!branch,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

// Choreo sample images (used for Cloud Editor)

export interface ChoreoSampleImage {
  name: string;
  [key: string]: unknown;
}

export function useChoreoSampleImages(orgUuid: string, projectId: string) {
  return useQuery({
    queryKey: ['choreoSampleImages', orgUuid, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgUuid, project_id: projectId });
      const res = await authenticatedFetch(`${choreoDevopsApiUrl()}/api/v1/byoi/components/choreo-sample-images?${params}`);
      if (!res.ok) throw new Error(`Failed to fetch sample images: ${res.status}`);
      const json = await res.json();
      return (json?.data?.images ?? []) as ChoreoSampleImage[];
    },
    enabled: !!orgUuid && !!projectId,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export interface OrgComponentLimits {
  billableComponentCount: number;
  componentCount: number;
}

export function useOrgComponentLimits(orgUuid: string) {
  return useQuery({
    queryKey: ['orgComponentLimits', orgUuid],
    queryFn: async (): Promise<OrgComponentLimits> => {
      const url = `${componentMgtApiUrl()}/orgs/${encodeURIComponent(orgUuid)}/component-limits?originCloud=devant`;
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error(`Failed to fetch component limits: ${res.status}`);
      const json = await res.json();
      return json.data as OrgComponentLimits;
    },
    enabled: !!orgUuid,
    staleTime: 30 * 1000,
  });
}

export interface OrgSubscription {
  tierId: string;
  subscriptionId: string;
  subscriptionType: string;
  subscriptionStatus: string;
}

export function useOrgSubscriptions(orgUuid: string) {
  return useQuery({
    queryKey: ['orgSubscriptions', orgUuid],
    queryFn: async (): Promise<OrgSubscription[]> => {
      const url = `${subscriptionsApiUrl()}/api/organizations/${encodeURIComponent(orgUuid)}/subscriptions?cloudType=devant&origin=choreo-console`;
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error(`Failed to fetch subscriptions: ${res.status}`);
      const json = await res.json();
      return (json.list ?? []) as OrgSubscription[];
    },
    enabled: !!orgUuid,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
}

export interface ComponentNameAvailability {
  componentNameUnique: boolean;
  alternateComponentName: string;
}

export function useComponentNameAvailability(projectId: string, componentNameCandidate: string) {
  return useQuery({
    queryKey: ['componentNameAvailability', projectId, componentNameCandidate],
    queryFn: () =>
      gql<{ componentNameAvailability: ComponentNameAvailability }>(`query { componentNameAvailability(projectId: "${projectId}", componentNameCandidate: "${componentNameCandidate}") { componentNameUnique alternateComponentName } }`).then(
        (d) => d.componentNameAvailability,
      ),
    enabled: !!projectId && !!componentNameCandidate && componentNameCandidate.length >= 3,
    staleTime: 0,
    retry: false,
  });
}
