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

/**
 * Container health checks (Kubernetes liveness / readiness probes). Wire shapes
 * mirror Devant's devops health-check REST API. A container has at most one
 * HealthCheck record holding both probes; an unset probe reads back as `{ type: '' }`.
 */

export const PROBE_KIND = {
  LIVENESS: 'Liveness',
  READINESS: 'Readiness',
} as const;
export type ProbeKind = (typeof PROBE_KIND)[keyof typeof PROBE_KIND];

/** Probe mechanism. `''` marks an unconfigured probe. */
export const PROBE_TYPE = {
  HTTP_GET: 'httpGet',
  TCP: 'tcp',
  EXEC: 'exec',
} as const;
export type ProbeType = (typeof PROBE_TYPE)[keyof typeof PROBE_TYPE] | '';

export interface HttpHeader {
  name: string;
  value: string;
}

export interface ProbeConfig {
  failureThreshold: number;
  initialDelaySeconds: number;
  periodSeconds: number;
  successThreshold: number;
  timeoutSeconds: number;
  httpGet?: { path?: string; port?: number; httpHeaders?: HttpHeader[] };
  tcpSocket?: { port?: number };
  exec?: { command?: string[] };
}

export interface HCProbe {
  type: ProbeType;
  probe: ProbeConfig;
}

export interface HealthCheck {
  ID: string;
  container_id: string;
  app_environment_id: string;
  organization_id?: string;
  project_id?: string;
  choreo_managed?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
  probes: {
    liveness_probe: HCProbe;
    readiness_probe: HCProbe;
  };
  /** Set when the platform rejected the last render; the write itself still succeeded. */
  sync_status?: string;
  sync_message?: string;
}

/** An unset probe serialises to `{}` in write payloads. */
export type WriteProbe = HCProbe | Record<string, never>;

/** POST/PUT body for a health check. */
export interface HealthCheckWriteData {
  probes: {
    liveness_probe: WriteProbe;
    readiness_probe: WriteProbe;
  };
}
