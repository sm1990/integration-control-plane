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

import { gql } from './graphql';
import type {
  Component,
  ComponentDetail,
  EnvEndpoint,
  CreateComponentInput,
  UpdateComponentInput,
  UpdateAutoDeployInput,
  GenerateComponentEndpointsInput,
  DisplayType,
  DeleteComponentResult,
  DeploymentTrack,
  CreateDeploymentTrackInput,
  DeleteTrackResult,
  CheckDeletableResult,
} from '../../types/component';
import type { ComponentNameAvailability, UpdateEndpointInput } from '../../types/component';
import type { CreateMcpProxyComponentInput } from '../../types/mcpProxy';

function gqlStr(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    // eslint-disable-next-line no-control-regex
    .replace(/\x08/g, '\\b')
    .replace(/\f/g, '\\f')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}"`;
}

const MI_DISPLAY_TYPES = new Set<DisplayType>(['miApiService', 'miCronjob', 'miJob', 'miWebhook', 'miEventHandler']);

function buildCreateComponentQuery(input: CreateComponentInput): string {
  const rawOrgId = window.API_CONFIG.asgardeoOrgNumericId;
  if (rawOrgId === undefined || !Number.isFinite(rawOrgId)) {
    throw new Error('API_CONFIG.asgardeoOrgNumericId is missing or invalid; cannot create component without a valid organization numeric ID');
  }
  const orgId = rawOrgId;
  const subPath = (input.repositorySubPath ?? '/').replace(/^\//, '');
  return `mutation{ createComponent(
      component: {
        name: ${gqlStr(input.name)},
        orgId: ${orgId},
        orgHandler: ${gqlStr(input.orgHandler)},
        displayName: ${gqlStr(input.displayName)},
        displayType: ${gqlStr(input.displayType)},
        projectId: ${gqlStr(input.projectId)},
        labels: "",
        version: "v1.0",
        description: ${gqlStr(input.description)},
        apiId: "",
        ballerinaVersion: "swan-lake-alpha5",
        triggerChannels: "",
        triggerID: null,
        httpBase: true,
        sampleTemplate: "",
        accessibility: "external",
        srcGitRepoUrl: ${gqlStr(input.srcGitRepoUrl ?? '')}
        repositorySubPath: ${gqlStr(subPath)},
        repositoryType: "UserManagedNonEmpty",
        repositoryBranch: ${gqlStr(input.repositoryBranch ?? '')},
        initializeAsBallerinaProject: false,
        secretRef: ${gqlStr(input.secretRef ?? '')},
        isPublicRepo: ${input.isPublicRepo ?? false},
        enableAutoDeploy: ${input.enableAutoDeploy ?? true},
        enableAutoBuild: true,
        componentSubType: ${gqlStr(input.componentSubType ?? '')},
        originCloud: "devant",
        isUnitTestEnabled: true,
        pullLatestSubmodules: true,
        isPrebuilt: ${input.isPrebuilt ?? false}
      }){
        id, name, displayName, handler, orgId, projectId, createdAt, updatedAt
      }}`;
}

/**
 * Builds the `createComponent` mutation for an **MCP proxy** — a `proxy`
 * component (no source repo) that fronts an already-created APIM API via
 * `apiId`, with `componentSubType: MCP`. Mirrors devant's `createChoreoComponent`
 * for MCP: proxies keep the API `version` (not `v1.0`) and `repositoryType` is
 * empty (no source build).
 */
function buildCreateMcpProxyComponentQuery(input: CreateMcpProxyComponentInput): string {
  const rawOrgId = window.API_CONFIG.asgardeoOrgNumericId;
  if (rawOrgId === undefined || !Number.isFinite(rawOrgId)) {
    throw new Error('API_CONFIG.asgardeoOrgNumericId is missing or invalid; cannot create MCP proxy component without a valid organization numeric ID');
  }
  const orgId = rawOrgId;
  return `mutation{ createComponent(
      component: {
        name: ${gqlStr(input.name)},
        orgId: ${orgId},
        orgHandler: ${gqlStr(input.orgHandler)},
        displayName: ${gqlStr(input.displayName)},
        displayType: "proxy",
        projectId: ${gqlStr(input.projectId)},
        labels: "",
        version: ${gqlStr(input.version)},
        description: ${gqlStr(input.description)},
        apiId: ${gqlStr(input.apiId)},
        ballerinaVersion: "swan-lake-alpha5",
        triggerChannels: "",
        triggerID: null,
        httpBase: true,
        sampleTemplate: "",
        accessibility: "external",
        repositorySubPath: "",
        repositoryType: "",
        repositoryBranch: "",
        initializeAsBallerinaProject: false,
        secretRef: "",
        isPublicRepo: false,
        enableAutoDeploy: true,
        enableAutoBuild: true,
        componentSubType: "MCP",
        originCloud: "devant",
        isUnitTestEnabled: true,
        pullLatestSubmodules: true,
        isPrebuilt: false
      }){
        id, name, displayName, handler, orgId, projectId, createdAt, updatedAt
      }}`;
}

function buildCreateMiComponentQuery(input: CreateComponentInput): string {
  const rawOrgId = window.API_CONFIG.asgardeoOrgNumericId;
  if (rawOrgId === undefined || !Number.isFinite(rawOrgId)) {
    throw new Error('API_CONFIG.asgardeoOrgNumericId is missing or invalid; cannot create MI component without a valid organization numeric ID');
  }
  const orgId = rawOrgId;
  const subPath = (input.repositorySubPath ?? '/').replace(/^\//, '');
  const srcUrl = (input.srcGitRepoUrl ?? '').replace(/\/$/, '');
  return `mutation{ createIntegrationComponent(
      component: {
        name: ${gqlStr(input.name)},
        displayName: ${gqlStr(input.displayName)},
        description: ${gqlStr(input.description)},
        orgId: ${orgId},
        orgHandler: ${gqlStr(input.orgHandler)},
        projectId: ${gqlStr(input.projectId)},
        labels: "",
        componentType: ${gqlStr(input.displayType)},
        accessibility: "external",
        srcGitRepoUrl: ${gqlStr(srcUrl)},
        srcGitRepoBranch: ${gqlStr(input.repositoryBranch ?? '')},
        repositorySubPath: ${gqlStr(subPath)},
        oasFilePath: "",
        version: "1.0.0",
        secretRef: "",
        isPublicRepo: ${input.isPublicRepo ?? false},
        enableAutoDeploy: ${input.enableAutoDeploy ?? true},
        enableAutoBuild: true,
        componentSubType: ${gqlStr(input.componentSubType ?? '')},
        originCloud: "devant",
        isPrebuilt: ${input.isPrebuilt ?? false}
      }){
        id, organizationId, projectId, handle
      }}`;
}

const COMPONENTS_QUERY = `
  query GetComponents($orgHandler: String!, $projectId: String!) {
    components(orgHandler: $orgHandler, projectId: $projectId) {
      projectId, id, name, handler, displayName, displayType, description, status, initStatus, componentSubType, version, createdAt, lastBuildDate, labels, originCloud, apiId
      repository { organizationApp nameApp }
    }
  }`;

const COMPONENT_BY_HANDLER_QUERY = `
  query GetComponent($projectId: String!, $componentHandler: String!) {
    component(projectId: $projectId, componentHandler: $componentHandler) {
      projectId, id, name, handler, displayName, displayType,
      description, status, componentSubType, serviceAccessMode,
      version, createdAt, lastBuildDate, orgHandler, labels, apiId, isPrebuilt,
      deploymentTracks { id, autoDeployEnabled, branch, apiVersion, latest }
      apiVersions { id, apiVersion, branch, latest, accessibility }
    }
  }`;

const COMPONENT_ENDPOINTS_QUERY = `
  query GetComponentEndpoints($componentId: String!, $versionId: String!) {
    componentEndpoints(input: { componentId: $componentId, versionId: $versionId }) {
      id releaseId environmentId displayName visibility apimId type port apiContext signature
    }
  }`;

const DELETE_COMPONENT_V2 = `
  mutation DeleteComponentV2($orgHandler: String!, $componentId: String!, $projectId: String!) {
    deleteComponentV2(orgHandler: $orgHandler, componentId: $componentId, projectId: $projectId) {
      status, canDelete, message, encodedData
    }
  }`;

const GET_OR_GENERATE_COMPONENT_ENV_JWT_SECRET = `
  mutation GenerateComponentEnvironmentJwtSecret($componentId: String!, $environmentId: String!) {
    generateComponentEnvironmentJwtSecret(componentId: $componentId, environmentId: $environmentId)
  }`;

const ROTATE_COMPONENT_ENV_JWT_SECRET = `
  mutation RotateComponentEnvironmentJwtSecret($componentId: String!, $environmentId: String!) {
    rotateComponentEnvironmentJwtSecret(componentId: $componentId, environmentId: $environmentId)
  }`;

const UPDATE_DEPLOYMENT_TRACK = `
  mutation UpdateDeploymentTrack($componentId: String!, $deploymentTrackId: String!, $branch: String!, $description: String!, $enableAutoDeploy: Boolean!) {
    updateDeploymentTrack(input: {
      componentId: $componentId,
      id: $deploymentTrackId,
      branch: $branch,
      description: $description,
      enableAutoDeploy: $enableAutoDeploy
    }) {
      id, componentId, branch, autoDeployEnabled
    }
  }`;

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

const GENERATE_COMPONENT_ENDPOINTS = `
  mutation GenerateEndpoints($componentId: String!, $versionId: String!, $releaseId: String!, $commitHash: String!, $dryRun: Boolean!) {
    generateComponentEndpoints(
      input: {
        componentId: $componentId
        versionId: $versionId
        releaseId: $releaseId
        commitHash: $commitHash
        dryRun: $dryRun
      }
    ) {
      id name createdAt updatedAt releaseId port environmentId displayName invokeUrl hostName
      isAutoGenerated protocol apiContext apiDefinitionPath visibility networkVisibilities type
      apimId apimRevisionId internalGwRevisionId externalGwRevisionId apimName
      projectUrl organizationUrl publicUrl state
      stateReason { code message details workerId }
      isDeleted deletedAt configurationGroupName signature shortUrlReassignState isScopeAdded
    }
  }`;

export async function fetchComponents(orgHandler: string, projectId: string): Promise<Component[]> {
  return gql<{ components: Component[] }>(COMPONENTS_QUERY, { orgHandler, projectId }).then((d) => d.components);
}

export async function fetchComponentByHandler(projectId: string, componentHandler: string): Promise<ComponentDetail> {
  return gql<{ component: ComponentDetail }>(COMPONENT_BY_HANDLER_QUERY, { projectId, componentHandler }).then((d) => d.component);
}

export async function fetchComponentEndpoints(componentId: string, versionId: string): Promise<EnvEndpoint[]> {
  return gql<{ componentEndpoints: EnvEndpoint[] }>(COMPONENT_ENDPOINTS_QUERY, { componentId, versionId })
    .then((d) => d.componentEndpoints ?? [])
    .catch(() => []);
}

export async function createComponent(input: CreateComponentInput): Promise<Component> {
  if (MI_DISPLAY_TYPES.has(input.displayType)) {
    const d = await gql<{ createIntegrationComponent: { id: string; handle: string; projectId: string; organizationId: string } }>(buildCreateMiComponentQuery(input));
    return {
      id: d.createIntegrationComponent.id,
      projectId: d.createIntegrationComponent.projectId,
      handler: d.createIntegrationComponent.handle,
      name: input.name,
      displayName: input.displayName,
      displayType: input.displayType,
      description: input.description,
      status: '',
      componentSubType: input.componentSubType ?? null,
      version: '1.0.0',
      createdAt: '',
      lastBuildDate: '',
    };
  }
  return gql<{ createComponent: Component }>(buildCreateComponentQuery(input)).then((d) => d.createComponent);
}

/**
 * Create an MCP **proxy** component (no source repo) fronting an existing APIM
 * API. Uses the same `createComponent` mutation as devant's MCP convert flow,
 * with `displayType: proxy` + `componentSubType: MCP` + the API `apiId`/`version`.
 */
export async function createMcpProxyComponent(input: CreateMcpProxyComponentInput): Promise<Component> {
  return gql<{ createComponent: Component }>(buildCreateMcpProxyComponentQuery(input)).then((d) => d.createComponent);
}

export async function deleteComponent(input: { orgHandler: string; componentId: string; projectId: string }): Promise<DeleteComponentResult> {
  return gql<{ deleteComponentV2: DeleteComponentResult }>(DELETE_COMPONENT_V2, input).then((d) => d.deleteComponentV2);
}

export async function generateComponentEnvironmentJwtSecret(componentId: string, environmentId: string): Promise<string> {
  return gql<{ generateComponentEnvironmentJwtSecret: string }>(GET_OR_GENERATE_COMPONENT_ENV_JWT_SECRET, { componentId, environmentId }).then((d) => d.generateComponentEnvironmentJwtSecret);
}

export async function rotateComponentEnvironmentJwtSecret(componentId: string, environmentId: string): Promise<string> {
  return gql<{ rotateComponentEnvironmentJwtSecret: string }>(ROTATE_COMPONENT_ENV_JWT_SECRET, { componentId, environmentId }).then((d) => d.rotateComponentEnvironmentJwtSecret);
}

export async function updateAutoDeployEnabled(input: UpdateAutoDeployInput): Promise<{ id: string; autoDeployEnabled: boolean }> {
  return gql<{ updateDeploymentTrack: { id: string; autoDeployEnabled: boolean } }>(UPDATE_DEPLOYMENT_TRACK, {
    componentId: input.componentId,
    deploymentTrackId: input.deploymentTrackId,
    branch: input.branch,
    description: input.description ?? '',
    enableAutoDeploy: input.enableAutoDeploy,
  }).then((d) => d.updateDeploymentTrack);
}

const CREATE_DEPLOYMENT_TRACK = `
  mutation CreateDeploymentTrack($orgUuid: String!, $componentId: String!, $apiVersion: String!, $branch: String!, $description: String!) {
    createDeploymentTrack(input: {
      orgUuid: $orgUuid,
      componentId: $componentId,
      apiVersion: $apiVersion,
      branch: $branch,
      description: $description
    }) {
      id, createdAt, updatedAt, apiVersion, branch, description, componentId, latest, versionStrategy
    }
  }`;

const DELETE_DEPLOYMENT_TRACK = `
  mutation DeleteDeploymentTrack($orgHandler: String!, $componentId: String!, $projectId: String!, $deploymentTrackId: String!) {
    deleteDeploymentTrack(input: {
      orgHandler: $orgHandler,
      componentId: $componentId,
      projectId: $projectId,
      deploymentTrackId: $deploymentTrackId
    }) {
      status, canDelete, message, encodedData
    }
  }`;

const CHECK_DEPLOYMENT_TRACK_DELETABLE = `
  mutation CheckDeploymentTrackDeletable($orgHandler: String!, $componentId: String!, $projectId: String!, $deploymentTrackId: String!) {
    checkDeploymentTrackDeletable(input: {
      orgHandler: $orgHandler,
      componentId: $componentId,
      projectId: $projectId,
      deploymentTrackId: $deploymentTrackId
    }) {
      canDelete, message
    }
  }`;

export async function createDeploymentTrack(input: CreateDeploymentTrackInput): Promise<DeploymentTrack> {
  return gql<{ createDeploymentTrack: DeploymentTrack }>(CREATE_DEPLOYMENT_TRACK, {
    orgUuid: input.orgUuid,
    componentId: input.componentId,
    apiVersion: input.apiVersion,
    branch: input.branch,
    description: input.description ?? '',
  }).then((d) => d.createDeploymentTrack);
}

export async function deleteDeploymentTrack(input: { orgHandler: string; componentId: string; projectId: string; deploymentTrackId: string }): Promise<DeleteTrackResult> {
  return gql<{ deleteDeploymentTrack: DeleteTrackResult }>(DELETE_DEPLOYMENT_TRACK, input).then((d) => d.deleteDeploymentTrack);
}

export async function checkDeploymentTrackDeletable(input: { orgHandler: string; componentId: string; projectId: string; deploymentTrackId: string }): Promise<CheckDeletableResult> {
  return gql<{ checkDeploymentTrackDeletable: CheckDeletableResult }>(CHECK_DEPLOYMENT_TRACK_DELETABLE, input).then((d) => d.checkDeploymentTrackDeletable);
}

export async function updateComponent(input: UpdateComponentInput): Promise<Component> {
  return gql<{ updateComponent: Component }>(UPDATE_COMPONENT, {
    id: input.id,
    displayName: input.displayName,
    description: input.description,
    version: input.version,
    // The GraphQL mutation takes labels as a comma-joined String!.
    labels: (input.labels ?? []).join(','),
  }).then((d) => d.updateComponent);
}

export async function updateEndpoint(input: UpdateEndpointInput): Promise<object> {
  const networkVisibilitiesGql = `[${input.networkVisibilities.map(gqlStr).join(', ')}]`;
  const query = `mutation Update {
    updateComponentEndpoint(
      input: {
        componentId: ${gqlStr(input.componentId)}
        versionId: ${gqlStr(input.versionId)}
        releaseId: ${gqlStr(input.releaseId)}
        endpointId: ${gqlStr(input.endpointId)}
        displayName: ${gqlStr(input.displayName)}
        networkVisibilities: ${networkVisibilitiesGql}
      }
    ) {
      id displayName networkVisibilities visibility invokeUrl publicUrl organizationUrl projectUrl
    }
  }`;
  return gql<{ updateComponentEndpoint: object }>(query, {}).then((d) => d.updateComponentEndpoint);
}

export async function generateComponentEndpoints(input: GenerateComponentEndpointsInput): Promise<EnvEndpoint[]> {
  return gql<{ generateComponentEndpoints: EnvEndpoint[] }>(GENERATE_COMPONENT_ENDPOINTS, {
    componentId: input.componentId,
    versionId: input.versionId,
    releaseId: input.releaseId,
    commitHash: input.commitHash,
    dryRun: input.dryRun ?? false,
  }).then((d) => d.generateComponentEndpoints ?? []);
}

export async function fetchComponentNameAvailability(projectId: string, componentNameCandidate: string): Promise<ComponentNameAvailability> {
  return gql<{ componentNameAvailability: ComponentNameAvailability }>(
    `query {
      componentNameAvailability(projectId: ${gqlStr(projectId)}, componentNameCandidate: ${gqlStr(componentNameCandidate)}) {
        componentNameUnique alternateComponentName
      }
    }`,
  ).then((d) => d.componentNameAvailability);
}

const COMPONENT_ENDPOINT_API_DEFINITION_QUERY = `
  query ApiDefinition($componentId: String!, $versionId: String!, $endpointId: String!) {
    componentEndpointApiDefinition(
      input: { componentId: $componentId, versionId: $versionId, endpointId: $endpointId }
    ) { content }
  }`;

export async function fetchComponentEndpointSpec(componentId: string, versionId: string, endpointId: string): Promise<string | null> {
  const data = await gql<{ componentEndpointApiDefinition: { content: string } | null }>(COMPONENT_ENDPOINT_API_DEFINITION_QUERY, { componentId, versionId, endpointId });
  const b64 = data.componentEndpointApiDefinition?.content;
  if (!b64) return null;
  try {
    return atob(b64);
  } catch {
    return null;
  }
}
