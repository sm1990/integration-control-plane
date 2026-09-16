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

// API security & exposure is a cloud-only surface today (the ipaas-service BFF
// owns it); the icp UI is gated on IS_CLOUD and never reaches these. They throw
// via ni() so an unsupported call can never look successful.
// TODO: implement using icp APIs
import type { ApiExposure, ApiKeyAuthOptions, ApiKeyResult, ApiKeySummary, Consumer, CreateApiKeyInput, CreateConsumerInput, EndpointPolicyConfig, EndpointRef, SecurityConfig, ConsumerCredential } from '../../types/consumers';

const ni = (name: string): never => {
  throw new Error(`[icp] consumers.${name}: not implemented`);
};

export const exposeEndpoint = (_ref: EndpointRef): Promise<ApiExposure> => ni('exposeEndpoint');
export const unexposeEndpoint = (_ref: EndpointRef): Promise<void> => ni('unexposeEndpoint');

export const listEndpointApiKeys = (_ref: EndpointRef): Promise<ApiKeySummary[]> => ni('listEndpointApiKeys');
export const createEndpointApiKey = (_ref: EndpointRef, _input: CreateApiKeyInput): Promise<ApiKeyResult> => ni('createEndpointApiKey');
export const revokeEndpointApiKey = (_ref: EndpointRef, _keyName: string): Promise<void> => ni('revokeEndpointApiKey');
export const createEndpointTestKey = (_ref: EndpointRef): Promise<ApiKeyResult> => ni('createEndpointTestKey');

export const setEndpointApiKeyAuth = (_ref: EndpointRef, _enabled: boolean, _options?: ApiKeyAuthOptions): Promise<boolean> => ni('setEndpointApiKeyAuth');
export const setEndpointJwtAuth = (_ref: EndpointRef, _enabled: boolean): Promise<boolean> => ni('setEndpointJwtAuth');
export const getEndpointSecurity = (_ref: EndpointRef): Promise<SecurityConfig> => ni('getEndpointSecurity');
export const setEndpointSecurity = (_ref: EndpointRef, _cfg: SecurityConfig): Promise<SecurityConfig> => ni('setEndpointSecurity');
export const getEndpointPolicies = (_ref: EndpointRef): Promise<EndpointPolicyConfig> => ni('getEndpointPolicies');
export const setEndpointPolicies = (_ref: EndpointRef, _cfg: EndpointPolicyConfig): Promise<EndpointPolicyConfig> => ni('setEndpointPolicies');

export const fetchConsumers = (_ref: EndpointRef, _projectName?: string): Promise<Consumer[]> => ni('fetchConsumers');
export const createConsumer = (_input: CreateConsumerInput): Promise<Consumer> => ni('createConsumer');
export const regenerateConsumerToken = (_ref: EndpointRef, _consumer: Consumer): Promise<ConsumerCredential> => ni('regenerateConsumerToken');
export const revokeConsumer = (_ref: EndpointRef, _consumer: Consumer): Promise<void> => ni('revokeConsumer');
export const deleteConsumer = (_ref: EndpointRef, _consumer: Consumer): Promise<void> => ni('deleteConsumer');
