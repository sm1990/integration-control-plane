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

import { Accordion, AccordionSummary, AccordionDetails, Box, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@wso2/oxygen-ui';
import { ChevronDown } from '@wso2/oxygen-ui-icons-react';
import { useMemo } from 'react';
import { useArtifactSource, useArtifactParams, useArtifactWsdl, useLocalEntryValue, ARTIFACT_TYPE_TO_SOURCE_TYPE } from '../api/queries';
import { WSDL_NS, SOAP_NS, SOAP12_NS } from '../paths';
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
        <Box key={i} sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : '#e8f5e9'), p: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip label={(r.methods ?? 'GET').toString().toUpperCase()} size="small" sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 700 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>
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
            <Box key={i} sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : '#e8f5e9'), p: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {methods.map((method, idx) => (
                <Chip key={idx} label={method.toUpperCase()} size="small" sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 700 }} />
              ))}
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>
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
  const backendType = ARTIFACT_TYPE_TO_SOURCE_TYPE[artifactType] ?? artifactType.toLowerCase();
  const { data: wsdl, isLoading, error } = useArtifactWsdl(componentId, backendType, artifact.name, envId);
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (error || !wsdl) return <Typography sx={emptySx}>No WSDL content available.</Typography>;
  return <CodeViewer code={wsdl} language="xml" />;
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

export function InboundEndpointParameters({ artifact, envId, componentId, artifactType }: TabProps) {
  const artifactName = artifact.name?.toString() ?? '';
  const backendType = ARTIFACT_TYPE_TO_SOURCE_TYPE[artifactType] ?? artifactType.toLowerCase();
  const { data: params, isLoading, error } = useArtifactParams(componentId, backendType, artifactName, envId);
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (error) return <Typography sx={emptySx}>Failed to load parameters.</Typography>;
  if (!params || params.length === 0) return <Typography sx={emptySx}>No parameters found.</Typography>;

  const rows: [string, string][] = [];
  for (const p of params) {
    if (p.name === 'parameters') {
      try {
        const parsed = JSON.parse(p.value);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item.name === 'string' && typeof item.value === 'string') {
              rows.push([item.name, item.value]);
            }
          }
        } else {
          rows.push([p.name, p.value]);
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          rows.push([p.name, p.value]);
        }
      }
    } else {
      rows.push([p.name, p.value]);
    }
  }

  return <DataTable headers={['Name', 'Value']} rows={rows} emptyMsg="No parameters found." />;
}

// ── WSDL parsing helpers ─────────────────────────────────────────────────────

interface WsdlOperation {
  name: string;
  soapAction?: string;
  style?: string;
  inputMessage?: string;
  outputMessage?: string;
}

interface WsdlInfo {
  serviceName: string;
  targetNamespace: string;
  operations: WsdlOperation[];
}

function getByNs(parent: Document | Element, ns: string, localName: string): Element[] {
  const result = Array.from(parent.getElementsByTagNameNS(ns, localName));
  // Return empty array if namespace-aware query fails to avoid conflating elements from different namespaces
  return result;
}

function parseWsdl(xml: string): WsdlInfo | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const defs = doc.documentElement;
    const serviceEls = getByNs(doc, WSDL_NS, 'service');

    // Return null if required service name is missing
    const serviceName = serviceEls[0]?.getAttribute('name') ?? defs.getAttribute('name');
    if (!serviceName) return null;

    // Target namespace is required for valid WSDL
    const targetNamespace = defs.getAttribute('targetNamespace');
    if (!targetNamespace) return null;

    // Build soap:operation index keyed by operation name
    const soapInfo: Record<string, { soapAction?: string; style?: string }> = {};
    for (const ns of [SOAP_NS, SOAP12_NS]) {
      for (const soapOp of getByNs(doc, ns, 'operation')) {
        const bindingOpEl = soapOp.parentElement;
        const opName = bindingOpEl?.getAttribute('name');
        if (opName) {
          soapInfo[opName] = {
            soapAction: soapOp.getAttribute('soapAction') ?? undefined,
            style: soapOp.getAttribute('style') ?? undefined,
          };
        }
      }
    }

    // Get operations from the first portType
    const portTypeEls = getByNs(doc, WSDL_NS, 'portType');
    const opEls = portTypeEls[0] ? getByNs(portTypeEls[0], WSDL_NS, 'operation') : [];

    const operations: WsdlOperation[] = [];
    for (const opEl of opEls) {
      const name = opEl.getAttribute('name');
      if (!name) continue;

      const inputEl = getByNs(opEl, WSDL_NS, 'input')[0];
      const outputEl = getByNs(opEl, WSDL_NS, 'output')[0];
      operations.push({
        name,
        inputMessage: inputEl?.getAttribute('message')?.split(':').pop(),
        outputMessage: outputEl?.getAttribute('message')?.split(':').pop(),
        ...soapInfo[name],
      });
    }

    return { serviceName, targetNamespace, operations };
  } catch {
    return null;
  }
}

// ── Proxy API Reference (Swagger-like SOAP UI) ────────────────────────────────

function OperationRow({ op }: { op: WsdlOperation }) {
  return (
    <Accordion disableGutters sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Chip label="SOAP" size="small" sx={{ bgcolor: '#1565c0', color: 'white', fontWeight: 700, fontSize: '0.7rem', height: 22, borderRadius: 1 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {op.name}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ bgcolor: 'background.paper' }}>
        <Stack gap={0.75}>
          {op.soapAction && (
            <Stack direction="row" gap={1} alignItems="baseline">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                SOAP Action
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {op.soapAction}
              </Typography>
            </Stack>
          )}
          {op.style && (
            <Stack direction="row" gap={1} alignItems="baseline">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                Style
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {op.style}
              </Typography>
            </Stack>
          )}
          {op.inputMessage && (
            <Stack direction="row" gap={1} alignItems="baseline">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                Input
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {op.inputMessage}
              </Typography>
            </Stack>
          )}
          {op.outputMessage && (
            <Stack direction="row" gap={1} alignItems="baseline">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                Output
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {op.outputMessage}
              </Typography>
            </Stack>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function ProxyApiReference({ envId, componentId, artifactType, artifact }: TabProps) {
  const backendType = ARTIFACT_TYPE_TO_SOURCE_TYPE[artifactType] ?? artifactType.toLowerCase();
  const { data: wsdl, isLoading, error } = useArtifactWsdl(componentId, backendType, artifact.name, envId);

  const info = useMemo(() => (wsdl ? parseWsdl(wsdl) : null), [wsdl]);

  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (error || !wsdl) return <Typography sx={emptySx}>No WSDL content available.</Typography>;
  if (!info) return <Typography sx={emptySx}>Could not parse WSDL.</Typography>;

  return (
    <Stack gap={2}>
      <Card variant="outlined" sx={{ '& .MuiCardContent-root:last-child': { pb: 1.5 } }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {info.serviceName}
          </Typography>
          {info.targetNamespace && (
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
              Namespace: {info.targetNamespace}
            </Typography>
          )}
        </CardContent>
      </Card>
      <Box>
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Operations ({info.operations.length})
        </Typography>
        {info.operations.length === 0 ? (
          <Typography sx={emptySx}>No operations found.</Typography>
        ) : (
          <Stack gap={1}>
            {info.operations.map((op) => (
              <OperationRow key={op.name} op={op} />
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
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
