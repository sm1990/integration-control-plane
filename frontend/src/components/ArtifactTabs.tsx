import { Box, Chip, CircularProgress, Stack, Typography } from '@wso2/oxygen-ui';
import { useArtifactSource, useLocalEntryValue, ARTIFACT_TYPE_TO_SOURCE_TYPE } from '../api/queries';
import CodeViewer from './CodeViewer';
import DataTable from './DataTable';
import type { TabProps } from './artifact-config';

const emptySx = { color: 'text.secondary', py: 2 };

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
