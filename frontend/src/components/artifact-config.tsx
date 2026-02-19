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

import { Globe, Link2, ListOrdered, Clock, FolderArchive, Package, Plug, FileText, Radio, Server, Wifi, Layers, Zap, Database, Cpu, LayoutTemplate, Table, HardDrive } from '@wso2/oxygen-ui-icons-react';
import type { JSX } from 'react';
import type { GqlArtifact } from '../api/queries';

/** Format artifact type name for display: "RestApi" → "Rest Api" */
export function formatArtifactTypeName(t: string): string {
  return t.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** "RestApi" → "Rest Api(s)", "ProxyService" → "Proxy Service(s)" */
export function typePlural(t: string): string {
  return t.replace(/([a-z])([A-Z])/g, '$1 $2') + '(s)';
}

export const ARTIFACT_ICONS: Record<string, JSX.Element> = {
  RestApi: <Globe size={18} />,
  ProxyService: <Server size={18} />,
  Endpoint: <Link2 size={18} />,
  InboundEndpoint: <Radio size={18} />,
  Sequence: <ListOrdered size={18} />,
  Task: <Clock size={18} />,
  LocalEntry: <FileText size={18} />,
  CarbonApp: <Package size={18} />,
  Connector: <Plug size={18} />,
  RegistryResource: <FolderArchive size={18} />,
  Listener: <Wifi size={18} />,
  Service: <Layers size={18} />,
  Automation: <Zap size={18} />,
  MessageStore: <Database size={18} />,
  MessageProcessor: <Cpu size={18} />,
  Template: <LayoutTemplate size={18} />,
  DataService: <Table size={18} />,
  DataSource: <HardDrive size={18} />,
};

export const ARTIFACT_TABS: Record<string, string[]> = {
  RestApi: ['Source', 'Runtimes'],
  ProxyService: ['Endpoints', 'WSDL', 'Runtimes'],
  Task: ['Runtimes'],
  LocalEntry: ['Value', 'Runtimes'],
  CarbonApp: ['Artifacts', 'Runtimes'],
  Connector: ['Runtimes'],
  RegistryResource: ['Runtimes'],
  Listener: ['Runtimes'],
  Service: ['Runtimes'],
  Automation: ['Executions', 'Runtimes'],
  MessageStore: ['Runtimes'],
  MessageProcessor: ['Runtimes'],
  Template: ['Runtimes'],
  DataService: ['Runtimes'],
  DataSource: ['Runtimes'],
};
export const DEFAULT_ARTIFACT_TABS = ['Source', 'Runtimes'];

export const ENTRY_POINT_CONFIG: Record<string, { label: string; detailLabel: string; color: string; bgColor: string; metaField?: string; overviewFields?: string }> = {
  RestApi: { label: 'API', detailLabel: 'REST API', color: '#1565c0', bgColor: '#e3f2fd', metaField: 'context', overviewFields: 'context, url' },
  ProxyService: { label: 'Proxy', detailLabel: 'PROXY SERVICE', color: '#e65100', bgColor: '#fff3e0', overviewFields: 'state' },
  InboundEndpoint: { label: 'Inbound', detailLabel: 'INBOUND ENDPOINT', color: '#2e7d32', bgColor: '#e8f5e9', metaField: 'protocol', overviewFields: 'protocol, sequence, onError' },
  Task: { label: 'Task', detailLabel: 'TASK', color: '#00695c', bgColor: '#e0f2f1', overviewFields: 'group' },
  Service: { label: 'Service', detailLabel: 'SERVICE', color: '#4a148c', bgColor: '#f3e5f5', metaField: 'basePath', overviewFields: 'package, basePath, type' },
  Listener: { label: 'Listener', detailLabel: 'LISTENER', color: '#bf360c', bgColor: '#fbe9e7', overviewFields: 'package, protocol, host, port' },
  Automation: { label: 'Automation', detailLabel: 'AUTOMATION', color: '#f57c00', bgColor: '#fff3e0', metaField: 'packageVersion', overviewFields: 'packageOrg, packageName, packageVersion' },
};

export const ENTRY_POINT_DETAIL_TABS: Record<string, string[]> = {
  RestApi: ['Resources'],
  ProxyService: ['Overview', 'Runtimes'],
  InboundEndpoint: ['Overview', 'Runtimes'],
  Task: ['Runtimes'],
  Service: ['Overview', 'Resources', 'Runtimes'],
  Listener: ['Overview', 'Runtimes'],
};

export const ENTRY_POINT_TYPE_SET = new Set(Object.keys(ENTRY_POINT_CONFIG));

export interface SelectedArtifact {
  artifact: GqlArtifact;
  artifactType: string;
  envId: string;
  componentId: string;
  projectId: string;
  initialTab?: string;
}

export type TabProps = SelectedArtifact;
