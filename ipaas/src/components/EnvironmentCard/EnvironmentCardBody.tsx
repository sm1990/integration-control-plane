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

import { Alert, Box, CircularProgress, Divider, IconButton, MenuItem, Select, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { Building2, Check, Copy, Download, Folder, Globe } from '@wso2/oxygen-ui-icons-react';
import { useState, useCallback, useMemo } from 'react';
import AutomationExecutions from '../AutomationExecutions';
import EnvCardInsights from '../Overview/integration-as-api/ServiceInsights';
import EnvCardAutomationInsights from '../Overview/automation/AutomationInsights';
import SwaggerOperationsList from '../Overview/integration-as-api/SwaggerOperationsList';
import { useFetchComponentEndpointSpec } from '../../hooks/useComponents';
import { useApiDefinition } from '../../hooks/useDeployments';
import type { EnvEndpoint } from '../../types/component';
import { trimEndpointName } from '../../utils/endpoints';
import DeploymentNotice from '../DeploymentNotice';

// ---------- CopyButton ----------

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
      <IconButton size="small" onClick={handleCopy} sx={{ p: 0.25, flexShrink: 0 }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </IconButton>
    </Tooltip>
  );
}

// ---------- VisibilityUrlRow ----------

const VISIBILITY_ROWS = [
  {
    key: 'public',
    label: 'Public',
    Icon: Globe,
    getUrl: (ep: EnvEndpoint) => ep.publicUrl || ep.defaultPublicUrl || ep.invokeUrl || '',
  },
  {
    key: 'organization',
    label: 'Organization',
    Icon: Building2,
    getUrl: (ep: EnvEndpoint) => ep.organizationUrl || ep.defaultOrganizationUrl || '',
  },
  {
    key: 'project',
    label: 'Project',
    Icon: Folder,
    getUrl: (ep: EnvEndpoint) => ep.projectUrl || '',
  },
] as const;

function VisibilityUrlRow({ Icon, label, url }: { Icon: React.ElementType; label: string; url: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
      <Tooltip title={label}>
        <Box component="span" role="img" aria-label={label} sx={{ display: 'flex', alignItems: 'center', color: 'primary.main', flexShrink: 0 }}>
          <Icon size={15} aria-hidden="true" />
        </Box>
      </Tooltip>
      <Typography
        variant="body2"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
        title={url}>
        {url}
      </Typography>
      <CopyButton url={url} />
    </Stack>
  );
}

// ---------- EndpointUrlsPanel ----------

interface EndpointUrlsPanelProps {
  endpoints: EnvEndpoint[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  componentId: string;
  deploymentTrackId: string;
}

function EndpointUrlsPanel({ endpoints, selectedIdx, onSelect, componentId, deploymentTrackId }: EndpointUrlsPanelProps) {
  const fetchSpecMutation = useFetchComponentEndpointSpec();
  const ep = endpoints[selectedIdx];
  if (!ep) return null;

  const urlRows = VISIBILITY_ROWS.map((row) => ({ ...row, url: row.getUrl(ep) })).filter((r) => !!r.url && (!ep.networkVisibilities?.length || ep.networkVisibilities.includes(r.label)));
  // Fallback to invokeUrl if no visibility-specific URL
  const fallbackUrl = urlRows.length === 0 ? ep.invokeUrl || '' : '';

  const handleDownload = async () => {
    if (!ep.id) return;
    try {
      const content = await fetchSpecMutation.mutateAsync({ componentId, versionId: deploymentTrackId, endpointId: ep.id });
      if (!content) return;
      const blob = new Blob([content], { type: 'text/yaml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${trimEndpointName(ep.displayName) || 'api'}-spec.yaml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch {
      // silently ignore
    }
  };

  const cols = '220px minmax(0,1fr) auto';

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: cols, columnGap: 2, rowGap: 0.75, mb: 2 }}>
      {/* Row 1 – Labels */}
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        Endpoint
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        URLs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        Download Spec
      </Typography>

      {/* Row 2 – Values (all centre-aligned with each other) */}
      <Box sx={{ alignSelf: 'start' }}>
        {endpoints.length > 1 ? (
          <Select size="small" value={selectedIdx} onChange={(e) => onSelect(Number(e.target.value))} sx={{ fontSize: '13px', width: '100%' }}>
            {endpoints.map((e, i) => (
              <MenuItem key={e.id} value={i} sx={{ fontSize: '13px' }}>
                {trimEndpointName(e.displayName)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <Box
            sx={{
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0.5,
              px: 1.5,
              py: 0.75,
              fontSize: '13px',
              fontWeight: 500,
            }}>
            {trimEndpointName(ep.displayName)}
          </Box>
        )}
      </Box>

      <Box sx={{ minWidth: 0, alignSelf: 'start' }}>
        {urlRows.length > 0 ? (
          <Stack gap={0.5}>
            {urlRows.map((row) => (
              <VisibilityUrlRow key={row.key} Icon={row.Icon} label={row.label} url={row.url} />
            ))}
          </Stack>
        ) : fallbackUrl ? (
          <VisibilityUrlRow Icon={Globe} label="Invoke" url={fallbackUrl} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </Box>

      <Box sx={{ alignSelf: 'start' }}>
        <Tooltip title="Download API specification">
          <IconButton size="small" onClick={() => void handleDownload()}>
            <Download size={16} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ---------- EnvironmentCardBody ----------

interface EnvironmentCardBodyProps {
  isAutomation: boolean;
  isGenericService?: boolean;
  loadingEnvDeployment: boolean;
  hasDeployment: boolean;
  deploymentStatusV2?: string | null;
  envEndpoints?: EnvEndpoint[];
  scheduleDescription: string | null;
  releaseId: string;
  projectId: string;
  componentId: string;
  deploymentTrackId: string;
  environmentId: string;
  orgHandler: string;
  projectHandler: string;
  componentHandler: string;
  envCritical: boolean;
  pendingTriggerTime: number | null;
  pendingTriggerArgs?: string[] | null;
  onTriggerResolved: () => void;
  onRunSuccess?: () => void;
  envId?: string;
  envName?: string;
  apimEnvId?: string;
  apiId?: string;
  prevEnvEndpoints?: EnvEndpoint[];
  prevEnvName?: string;
  notification?: { text: string; severity: 'success' | 'error' } | null;
}

export default function EnvironmentCardBody({
  isAutomation,
  isGenericService,
  loadingEnvDeployment,
  hasDeployment,
  deploymentStatusV2,
  envEndpoints,
  scheduleDescription,
  releaseId,
  projectId,
  componentId,
  deploymentTrackId,
  environmentId,
  orgHandler,
  projectHandler,
  componentHandler,
  envCritical,
  pendingTriggerTime,
  pendingTriggerArgs,
  onTriggerResolved,
  onRunSuccess,
  envId,
  envName,
  apimEnvId,
  apiId,
  prevEnvEndpoints,
  prevEnvName,
  notification,
}: EnvironmentCardBodyProps) {
  const showAutomationInsights = isAutomation && envCritical && !!releaseId;
  const serviceNotDeployed = isGenericService && !loadingEnvDeployment && !hasDeployment;

  // Endpoint selection drives the swagger fetch
  const [selectedEpIdx, setSelectedEpIdx] = useState(0);
  const activeEndpoint = envEndpoints?.[selectedEpIdx] ?? envEndpoints?.[0];

  const { data: swagger } = useApiDefinition(isGenericService && hasDeployment ? activeEndpoint?.apimRevisionId : null);

  // Find the matching endpoint in the previous environment by displayName
  const prevEndpoint = useMemo(() => {
    if (!prevEnvEndpoints?.length || !activeEndpoint) return null;
    return prevEnvEndpoints.find((ep) => ep.displayName === activeEndpoint.displayName) ?? null;
  }, [prevEnvEndpoints, activeEndpoint]);

  const { data: prevSwagger, isLoading: loadingPrevSwagger } = useApiDefinition(isGenericService && hasDeployment ? prevEndpoint?.apimRevisionId : null);

  // Compare swagger omitting the 'security' field (same logic as devant)
  const isSwaggerChanged = useMemo(() => {
    if (!prevEnvName || !prevEndpoint?.apimRevisionId) return true; // no prev env → always show swagger
    if (loadingPrevSwagger) return true; // prev spec still loading → show current swagger optimistically
    if (!swagger || !prevSwagger) return false; // data unavailable → show placeholder
    const omitSecurity = (s: object): Record<string, unknown> => {
      const c = { ...(s as Record<string, unknown>) };
      delete c['security'];
      return c;
    };
    return JSON.stringify(omitSecurity(swagger)) !== JSON.stringify(omitSecurity(prevSwagger));
  }, [swagger, prevSwagger, prevEndpoint, prevEnvName, loadingPrevSwagger]);

  const showEndpointPanel = isGenericService && hasDeployment && !!envEndpoints?.length;

  // Use the endpoint's apimId for insights — component.apiId is often null for generic services
  const insightsApiId = activeEndpoint?.apimId ?? apiId ?? '';
  const showServiceInsights = !isAutomation && envCritical && !!envId && !!envName && !!projectId;

  return (
    <>
      <Divider sx={{ my: 2 }} />
      {notification ? (
        <Alert severity={notification.severity} sx={{ mb: 2 }}>
          {notification.text}
        </Alert>
      ) : (
        isAutomation &&
        hasDeployment &&
        scheduleDescription && (
          <Box sx={{ bgcolor: 'action.selected', borderRadius: 1, px: 2, py: 1, mb: 2 }}>
            <Typography variant="body2">{scheduleDescription}</Typography>
          </Box>
        )
      )}

      {/* Generic service: deployment in progress */}
      {isGenericService && deploymentStatusV2 === 'IN_PROGRESS' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
          <CircularProgress size={20} sx={{ color: 'warning.main' }} />
        </Box>
      )}

      {/* Generic service: endpoint URLs panel */}
      {showEndpointPanel && deploymentStatusV2 !== 'IN_PROGRESS' && <EndpointUrlsPanel endpoints={envEndpoints!} selectedIdx={selectedEpIdx} onSelect={setSelectedEpIdx} componentId={componentId} deploymentTrackId={deploymentTrackId} />}

      {/* Generic service: swagger operations or "same contract" message */}
      {isGenericService &&
        hasDeployment &&
        deploymentStatusV2 !== 'IN_PROGRESS' &&
        (isSwaggerChanged
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            !!swagger && <SwaggerOperationsList swagger={swagger as any} />
          : !!prevEnvName && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1.5, p: 1, bgcolor: 'action.selected', borderLeft: '3px solid', borderColor: 'primary.main', minWidth: 200 }}>
                <Typography variant="body2">
                  The contract is same as the <strong>{prevEnvName}</strong> environment&apos;s matching endpoint.
                </Typography>
              </Box>
            ))}

      {/* Generic service: not deployed yet */}
      {serviceNotDeployed && deploymentStatusV2 !== 'IN_PROGRESS' && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          This component has not been deployed to this environment yet.
        </Typography>
      )}

      {isAutomation && !loadingEnvDeployment && hasDeployment && (
        <AutomationExecutions
          releaseId={releaseId}
          projectId={projectId}
          componentId={componentId}
          deploymentTrackId={deploymentTrackId}
          environmentId={environmentId}
          orgHandler={orgHandler}
          projectHandler={projectHandler}
          componentHandler={componentHandler}
          envCritical={envCritical}
          deploymentStatusV2={deploymentStatusV2}
          pendingTriggerTime={pendingTriggerTime}
          pendingTriggerArgs={pendingTriggerArgs}
          onTriggerResolved={onTriggerResolved}
          onRunSuccess={onRunSuccess}
        />
      )}
      {isAutomation && !loadingEnvDeployment && !hasDeployment && <DeploymentNotice hasDeployment={false} envCritical={!!envCritical} />}
      {showServiceInsights && <EnvCardInsights envName={envName!} envId={envId!} apimEnvId={apimEnvId} projectId={projectId!} apiId={insightsApiId} />}
      {showAutomationInsights && <EnvCardAutomationInsights releaseId={releaseId} executionScope={{ componentId, envId: environmentId, projectId }} />}
    </>
  );
}
