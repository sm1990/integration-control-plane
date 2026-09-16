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

export interface DeploymentParams {
  userId: string;
  orgUuid: string;
  orgHandle: string;
  projectId: string;
  componentId: string;
  codeServerSample: string;
  sourceCommitHash: string;
}

export interface ContainerRegistry {
  id: string;
  host: string;
  name: string;
}

export interface ChoreoSampleImage {
  name: string;
  image_url: string;
  [key: string]: unknown;
}

/** Result of createCodeServer — the editor URL plus the cluster coordinates needed to poll the pod. */
export interface CodeServerInstance {
  url: string;
  /** Whether the editor is serving at `url`. Never redirect unless this is true. */
  ready: boolean;
  clusterId: string;
  releaseId: string;
  namespace: string;
}

/** Ordered steps shown in the deployment wheel. */
export type CloudEditorStepKey = 'initializing' | 'creating' | 'scheduling' | 'starting' | 'opening';

export interface CloudEditorStep {
  key: CloudEditorStepKey;
  label: string;
}

// scheduling — until PodScheduled & Initialized are both True
// starting   — until PodReadyToStartContainers, ContainersReady & Ready are all True
// opening    — every condition above is True; waiting on the pod to reach Running
export type PodPhase = 'scheduling' | 'starting' | 'opening';
