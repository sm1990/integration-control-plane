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

import { choreoClient } from './httpClients';
import { encodeArrayItems } from '../../utils/containers';
import type { HCProbe, HealthCheck, HealthCheckWriteData, WriteProbe } from '../../types/healthChecks';

// Container health checks live on the devops service. The list is release-scoped;
// create/update/delete are container-scoped. URLs + `{ data }` wrapper mirror Devant.
const BASE = '/devops/1.0.0/api/v1';
type Wrapped<T> = { data: T };

function dq(orgUuid: string, projectId: string): string {
  return new URLSearchParams({ organization_id: orgUuid, project_id: projectId }).toString();
}

const releasePath = (componentId: string, releaseId: string): string => `${BASE}/components/${encodeURIComponent(componentId)}/release/${encodeURIComponent(releaseId)}`;
const containerHcPath = (componentId: string, releaseId: string, containerId: string, healthCheckId?: string): string =>
  `${releasePath(componentId, releaseId)}/container/${encodeURIComponent(containerId)}/health-check${healthCheckId ? `/${encodeURIComponent(healthCheckId)}` : ''}`;

export async function getHealthChecks(orgUuid: string, projectId: string, componentId: string, releaseId: string, _environmentId: string): Promise<HealthCheck[]> {
  const res = await choreoClient.get<Wrapped<HealthCheck[]>>(`${releasePath(componentId, releaseId)}/health-check?${dq(orgUuid, projectId)}`);
  return res.data;
}

// The devops API returns exec commands decoded but expects base64 on write.
function encodeExec(p: WriteProbe): WriteProbe {
  if (!('probe' in p)) return p;
  const hc = p as HCProbe;
  if (!hc.probe.exec?.command?.length) return hc;
  return { ...hc, probe: { ...hc.probe, exec: { command: encodeArrayItems(hc.probe.exec.command) } } };
}

function encodeWriteData(data: HealthCheckWriteData): HealthCheckWriteData {
  return { probes: { liveness_probe: encodeExec(data.probes.liveness_probe), readiness_probe: encodeExec(data.probes.readiness_probe) } };
}

export async function createHealthCheck(orgUuid: string, projectId: string, componentId: string, releaseId: string, _environmentId: string, containerId: string, data: HealthCheckWriteData): Promise<HealthCheck> {
  const res = await choreoClient.post<Wrapped<HealthCheck>>(`${containerHcPath(componentId, releaseId, containerId)}?${dq(orgUuid, projectId)}`, encodeWriteData(data));
  return res.data;
}

export async function updateHealthCheck(orgUuid: string, projectId: string, componentId: string, releaseId: string, _environmentId: string, containerId: string, healthCheckId: string, data: HealthCheckWriteData): Promise<HealthCheck> {
  const res = await choreoClient.put<Wrapped<HealthCheck>>(`${containerHcPath(componentId, releaseId, containerId, healthCheckId)}?${dq(orgUuid, projectId)}`, encodeWriteData(data));
  return res.data;
}

export async function deleteHealthCheck(orgUuid: string, projectId: string, componentId: string, releaseId: string, _environmentId: string, containerId: string, healthCheckId: string): Promise<void> {
  await choreoClient.delete<void>(`${containerHcPath(componentId, releaseId, containerId, healthCheckId)}?${dq(orgUuid, projectId)}`);
}
