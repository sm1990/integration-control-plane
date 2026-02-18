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

import { Box, Chip, CircularProgress, Stack, Typography } from '@wso2/oxygen-ui';
import { useArtifactSource, useLocalEntryValue, ARTIFACT_TYPE_TO_SOURCE_TYPE } from '../api/queries';
import CodeViewer from './CodeViewer';
import DataTable, { emptySx } from './DataTable';
import type { TabProps } from './artifact-config';

export function ArtifactSource({ envId, componentId, artifactType, artifact }: TabProps) {
  const sourceType = ARTIFACT_TYPE_TO_SOURCE_TYPE[artifactType] ?? artifactType.toLowerCase();
  const { data: source, isLoading, error } = useArtifactSource(envId, componentId, sourceType, artifact.name?.toString() ?? '');
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (error || !source) return <Typography sx={emptySx}>No source content available.</Typography>;

  return <CodeViewer code={source} language="xml" />;
}

export function ArtifactApiDefinition({ artifact }: TabProps) {
  const resources = (artifact.resources as Array<{ path?: string; methods?: string }> | undefined) ?? [];
  const context = (artifact.context ?? '/*').toString();
  const items = resources.length === 0 ? [{ methods: 'POST', path: context }] : resources;
  return (
    <Stack gap={1}>
      {items.map((r, i) => (
        <Box key={i} sx={{ bgcolor: '#e8f5e9', p: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip label={(r.methods ?? 'GET').toString().toUpperCase()} size="small" sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 700 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {r.path ?? context}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

export function ArtifactEndpoints({ artifact }: TabProps) {
  const endpoints = (artifact.endpoints as string[] | undefined) ?? [];
  return (
    <DataTable
      rows={endpoints.map((ep) => [
        <Typography key={ep} variant="body2" sx={{ fontFamily: 'monospace' }}>
          {ep}
        </Typography>,
      ])}
      emptyMsg="No endpoints available."
    />
  );
}

export function ServiceResources({ artifact }: TabProps) {
  const resources = (artifact.resources as Array<{ url?: string; methods?: string[] }> | undefined) ?? [];
  const basePath = (artifact.basePath ?? '/').toString();

  return (
    <Stack gap={1}>
      {resources.length === 0 ? (
        <Typography sx={emptySx}>No resources available.</Typography>
      ) : (
        resources.map((r, i) => {
          const raw = r.methods ?? [];
          const methods = Array.isArray(raw) ? raw : [String(raw)];
          return (
            <Box key={i} sx={{ bgcolor: '#e8f5e9', p: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {methods.map((method, idx) => (
                <Chip key={idx} label={method.toUpperCase()} size="small" sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 700 }} />
              ))}
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {basePath}
                {r.url ?? ''}
              </Typography>
            </Box>
          );
        })
      )}
    </Stack>
  );
}

export function ArtifactWsdl({ envId, componentId, artifactType, artifact }: TabProps) {
  const sourceType = ARTIFACT_TYPE_TO_SOURCE_TYPE[artifactType] ?? artifactType.toLowerCase();
  const { data: source, isLoading, error } = useArtifactSource(envId, componentId, sourceType, artifact.name?.toString() ?? '');
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (error || !source) return <Typography sx={emptySx}>No WSDL content available.</Typography>;
  return <CodeViewer code={source} language="xml" />;
}

export function ArtifactValue({ artifact, envId, componentId }: TabProps) {
  const { data: value, isLoading } = useLocalEntryValue(componentId, artifact.name?.toString() ?? '', envId);
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (!value) return <Typography sx={emptySx}>No value available.</Typography>;
  return <CodeViewer code={value} language="xml" />;
}

export function ArtifactCarbonArtifacts({ artifact }: TabProps) {
  const artifacts = (artifact.artifacts as Array<{ name: string; type: string }> | undefined) ?? [];
  return <DataTable headers={['Artifact Name', 'Artifact Type']} rows={artifacts.map((a) => [a.name, a.type])} emptyMsg="No artifacts found." />;
}

export function ArtifactRuntimes({ artifact }: TabProps) {
  const runtimes = (artifact.runtimes as Array<{ runtimeId: string; status: string }> | undefined) ?? [];
  return (
    <DataTable
      headers={['Runtime ID', 'Status']}
      rows={runtimes.map((r) => [
        <Typography key="id" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
          {r.runtimeId}
        </Typography>,
        <Typography key="status" variant="body2" color={r.status === 'RUNNING' ? 'success.main' : 'error.main'} sx={{ fontWeight: 600 }}>
          {r.status}
        </Typography>,
      ])}
      emptyMsg="No runtimes found."
    />
  );
}

export function AutomationExecutions({ artifact }: TabProps) {
  const runtimes = (artifact.runtimes as Array<{ runtimeId: string; status: string; executionTimestamps: string[] }> | undefined) ?? [];
  const allExecutions: Array<{ runtimeId: string; timestamp: string; status: string }> = [];

  runtimes.forEach((runtime) => {
    const timestamps = runtime.executionTimestamps ?? [];
    timestamps.forEach((timestamp) => {
      allExecutions.push({
        runtimeId: runtime.runtimeId,
        timestamp,
        status: runtime.status,
      });
    });
  });

  // Sort by timestamp descending (most recent first)
  allExecutions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <DataTable
      headers={['Timestamp', 'Runtime ID', 'Status']}
      rows={allExecutions.map((exec) => [
        <Typography key="timestamp" variant="body2">
          {exec.timestamp}
        </Typography>,
        <Typography key="runtimeId" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
          {exec.runtimeId}
        </Typography>,
        <Typography key="status" variant="body2" color={exec.status === 'ONLINE' ? 'success.main' : 'text.secondary'} sx={{ fontWeight: 600 }}>
          {exec.status}
        </Typography>,
      ])}
      emptyMsg="No executions found."
    />
  );
}
