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
import { choreoClient } from './httpClients';
import type { CodeServerInstance, ContainerRegistry } from '../../types/cloudEditor';

const CHOREO_SAMPLES_REGISTRY_HOST = 'choreoanonymouspullable.azurecr.io';

async function getContainerRegistries(orgUuid: string): Promise<ContainerRegistry[]> {
  const data = await choreoClient.get<{ data: ContainerRegistry[] }>(`/devops/1.0.0/api/v1/container-registries?organization_id=${encodeURIComponent(orgUuid)}`);
  return data.data ?? [];
}

async function createContainerRegistry(orgUuid: string): Promise<ContainerRegistry> {
  const data = await choreoClient.post<{ data: ContainerRegistry }>(`/devops/1.0.0/api/v1/container-registries?organization_id=${encodeURIComponent(orgUuid)}`, {
    name: 'Choreo Samples Registry',
    type: 'vendor-specific',
    provider: 'Azure',
    credential: { host: CHOREO_SAMPLES_REGISTRY_HOST },
  });
  return data.data;
}

export async function getOrCreateSampleRegistry(orgUuid: string): Promise<ContainerRegistry> {
  const registries = await getContainerRegistries(orgUuid);
  const existing = registries.find((r) => r.host === CHOREO_SAMPLES_REGISTRY_HOST);
  if (existing) return existing;
  try {
    return await createContainerRegistry(orgUuid);
  } catch {
    // A concurrent request may have already created the registry; re-fetch before failing.
    const updated = await getContainerRegistries(orgUuid);
    const created = updated.find((r) => r.host === CHOREO_SAMPLES_REGISTRY_HOST);
    if (created) return created;
    throw new Error('Failed to create or find sample container registry');
  }
}

export async function callCreateCodeServer(params: { userId: string; organizationId: string; projectId: string; componentId: string; orgHandle: string; imageUrl: string; registryId: string; sourceCommitHash?: string }): Promise<CodeServerInstance> {
  const { userId, organizationId, projectId, componentId, orgHandle, imageUrl, registryId, sourceCommitHash } = params;
  // `createCodeServer` returns an object; a selection set is required and the URL is on `.url`.
  const result = await gql<{ createCodeServer: { url: string; clusterId: string; releaseId: string; namespace: string } }>(
    `mutation{ createCodeServer(codeServer: {
      userId: "${userId}",
      organizationId: "${organizationId}",
      projectId: "${projectId}",
      componentId: "${componentId}",
      orgHandle: "${orgHandle}",
      imageUrl: "${imageUrl}",
      registryId: "${registryId}",
      ${sourceCommitHash ? `sourceCommitHash: "${sourceCommitHash}",` : ''}
    }){ url clusterId releaseId namespace }}`,
  );
  const created = result.createCodeServer;
  if (!created?.url) throw new Error('No editor URL returned from server');
  // ready: true — this path reports readiness via pod polling, not the BFF.
  return { url: created.url, ready: true, clusterId: created.clusterId ?? '', releaseId: created.releaseId ?? '', namespace: created.namespace ?? '' };
}

/** Not available here: this product polls pod status instead. Throws rather than
 * returning null, which would read as "no editor". */
export function getCodeServer(_params: { userId: string; projectId: string; componentId: string }): Promise<CodeServerInstance | null> {
  return Promise.reject(new Error('[wip] cloudEditor.getCodeServer: not supported — this product polls pod status instead'));
}
