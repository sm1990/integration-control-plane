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

// TODO: implement using ICP local REST APIs

import type {
  Component,
  ComponentDetail,
  Endpoint,
  EnvEndpoint,
  CreateComponentInput,
  UpdateComponentInput,
  UpdateAutoDeployInput,
  UpdateEndpointInput,
  GenerateComponentEndpointsInput,
  ComponentNameAvailability,
  DeleteComponentResult,
  DeploymentTrack,
  CreateDeploymentTrackInput,
  DeleteTrackResult,
  CheckDeletableResult,
} from '../../types/component';
import type { CreateMcpProxyComponentInput } from '../../types/mcpProxy';

const ni = (name: string): never => {
  throw new Error(`[icp] components.${name}: not implemented`);
};

export const fetchComponents = (_orgHandler: string, _projectId: string): Promise<Component[]> => ni('fetchComponents');
export const fetchComponentByHandler = (_projectId: string, _componentHandler: string): Promise<ComponentDetail> => ni('fetchComponentByHandler');
export const fetchComponentEndpoints = (_componentId: string, _versionId: string): Promise<Endpoint[]> => ni('fetchComponentEndpoints');
export const createComponent = (_input: CreateComponentInput): Promise<Component> => ni('createComponent');
export const deleteComponent = (_input: { orgHandler: string; componentId: string; projectId: string }): Promise<DeleteComponentResult> => ni('deleteComponent');
export const updateComponent = (_input: UpdateComponentInput): Promise<Component> => ni('updateComponent');
export const updateAutoDeployEnabled = (_input: UpdateAutoDeployInput): Promise<{ id: string; autoDeployEnabled: boolean }> => ni('updateAutoDeployEnabled');
export const updateEndpoint = (_input: UpdateEndpointInput): Promise<object> => ni('updateEndpoint');
export const generateComponentEndpoints = (_input: GenerateComponentEndpointsInput): Promise<EnvEndpoint[]> => ni('generateComponentEndpoints');
export const fetchComponentNameAvailability = (_projectId: string, _candidate: string): Promise<ComponentNameAvailability> => ni('fetchComponentNameAvailability');
export const fetchComponentEndpointSpec = (_componentId: string, _versionId: string, _endpointId: string): Promise<string | null> => ni('fetchComponentEndpointSpec');
export const createMcpProxyComponent = (_input: CreateMcpProxyComponentInput): Promise<Component> => ni('createMcpProxyComponent');
export const createDeploymentTrack = (_input: CreateDeploymentTrackInput): Promise<DeploymentTrack> => ni('createDeploymentTrack');
export const deleteDeploymentTrack = (_input: { orgHandler: string; componentId: string; projectId: string; deploymentTrackId: string }): Promise<DeleteTrackResult> => ni('deleteDeploymentTrack');
export const checkDeploymentTrackDeletable = (_input: { orgHandler: string; componentId: string; projectId: string; deploymentTrackId: string }): Promise<CheckDeletableResult> => ni('checkDeploymentTrackDeletable');
