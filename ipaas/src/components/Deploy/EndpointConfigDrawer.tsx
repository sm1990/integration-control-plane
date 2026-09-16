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

import { Alert, Box, Button, Checkbox, CircularProgress, Collapse, Divider, Drawer, FormControlLabel, IconButton, InputAdornment, MenuItem, Select, Stack, Switch, TextField, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft, ArrowRight, Search, X } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useRef, useState } from 'react';
import { useApiDefinition, useEnvEndpoints } from '../../hooks/useDeployments';
import { useApimApi, useUpdateApimApi } from '../../hooks/useApim';
import type { EnvEndpoint } from '../../types/component';
import type { ApimApiInfo, ApimApiOperation } from '../../types/apim';
import { API_KEY_SCHEME, OAUTH2_SCHEME, OPS_PER_PAGE } from '../../constants/endpointConfig';
import { buildEndpointSecurityState, extractScopesFromSwagger, toggleSchemeToken } from '../../utils/deploy';
import { getHttpMethodColors } from '../../utils/httpMethods';
import type { EndpointSecurityState } from '../../types/deploy';
import TagInput from './TagInput';
import ApiSecurityDrawer from '../Overview/integration-as-api/ApiSecurityDrawer';
import { IS_CLOUD } from '../../features';
import { toEndpointOptions } from '../../utils/endpoints';

const drawerSx = {
  '& .MuiDrawer-paper': {
    width: 720,
    position: 'fixed',
    top: 64,
    height: 'calc(100% - 64px)',
    borderLeft: '1px solid',
    borderColor: 'divider',
    display: 'flex',
    flexDirection: 'column',
  },
} as const;

function EndpointPanel({ ep, onSaved }: { ep: EnvEndpoint; onSaved: () => void }) {
  const { data: swaggerDoc } = useApiDefinition(ep.apimRevisionId);
  const { data, isLoading } = useApimApi(ep.apimId ?? null);
  const apimApiInfo: ApimApiInfo | null = data ?? null;
  const isFetchingInitial = !!ep.apimId && isLoading;
  const fetchError = !!ep.apimId && !isLoading && data === null ? 'Failed to load endpoint configuration. Please try again.' : null;

  const updateMutation = useUpdateApimApi();
  const saving = updateMutation.isPending;

  const [state, setState] = useState<EndpointSecurityState>(() => buildEndpointSecurityState(null));
  const [stateInitializedFor, setStateInitializedFor] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form state from fetched data once per apimId
  useEffect(() => {
    if (apimApiInfo && stateInitializedFor !== ep.apimId) {
      setState(buildEndpointSecurityState(apimApiInfo));
      setStateInitializedFor(ep.apimId ?? null);
    }
  }, [apimApiInfo, ep.apimId, stateInitializedFor]);

  const availableScopes: string[] = [...extractScopesFromSwagger(swaggerDoc), ...(apimApiInfo?.scopes ?? []).map((s) => s.scope.name)].filter((v, i, arr) => arr.indexOf(v) === i);

  const apiKeyEnabled = state.securityScheme.includes(API_KEY_SCHEME);
  const oauth2Enabled = state.securityScheme.includes(OAUTH2_SCHEME);

  const operations = apimApiInfo?.operations ?? [];
  const filteredOps = operations.filter((op) => `${op.verb} ${op.target}`.toLowerCase().includes(state.opSearch.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredOps.length / OPS_PER_PAGE));
  const pageOps = filteredOps.slice(state.opPage * OPS_PER_PAGE, (state.opPage + 1) * OPS_PER_PAGE);

  const update = (partial: Partial<EndpointSecurityState>) => setState((prev) => ({ ...prev, ...partial }));

  const handleApply = async () => {
    if (!apimApiInfo || !ep.apimId || saving) return;
    setSaveError(null);
    setSaveSuccess(false);

    const updatedOperations: ApimApiOperation[] = operations.map((op) => {
      const key = `${op.verb.toUpperCase()}-${op.target}`;
      return { ...op, scopes: state.operationScopes[key] ?? [] };
    });

    const updated: ApimApiInfo = {
      ...apimApiInfo,
      securityScheme: state.securityScheme,
      authorizationHeader: state.authorizationHeader,
      apiKeyHeader: state.apiKeyHeader,
      enableBackendJWT: state.enableBackendJWT,
      backendJWTConfiguration: {
        ...(apimApiInfo.backendJWTConfiguration ?? {}),
        audiences: state.backendJWTAudiences,
      },
      operations: updatedOperations,
    };

    try {
      await updateMutation.mutateAsync({ apimId: ep.apimId, body: updated });
      setSaveSuccess(true);
      setTimeout(() => onSaved(), 800);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings. Please try again.');
    }
  };

  if (isFetchingInitial) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (fetchError) {
    return (
      <Box sx={{ px: 3, py: 4 }}>
        <Alert severity="error">{fetchError}</Alert>
      </Box>
    );
  }

  if (!ep.apimId) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No API configured for this endpoint.
      </Alert>
    );
  }

  return (
    <>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Deploy the integration after applying changes for the configuration to take effect.
        </Alert>

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>
            Endpoint configuration saved successfully.
          </Alert>
        )}
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          Security
        </Typography>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', mb: 3 }}>
          <Stack direction="row" sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 40 }} />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Security Scheme
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ width: 240 }}>
              Header Name
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ width: 40 }}>
              <Checkbox size="small" checked={apiKeyEnabled} onChange={() => update({ securityScheme: toggleSchemeToken(state.securityScheme, API_KEY_SCHEME) })} />
            </Box>
            <Typography variant="body2" sx={{ flex: 1 }}>
              API Key
            </Typography>
            <Box sx={{ width: 240 }}>
              <TextField size="small" fullWidth value={state.apiKeyHeader} onChange={(e) => update({ apiKeyHeader: e.target.value })} disabled={!apiKeyEnabled} placeholder="ApiKey" label="Key header" />
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25 }}>
            <Box sx={{ width: 40 }}>
              <Checkbox size="small" checked={oauth2Enabled} onChange={() => update({ securityScheme: toggleSchemeToken(state.securityScheme, OAUTH2_SCHEME) })} />
            </Box>
            <Typography variant="body2" sx={{ flex: 1 }}>
              OAuth2
            </Typography>
            <Box sx={{ width: 240 }}>
              <TextField size="small" fullWidth value={state.authorizationHeader} onChange={(e) => update({ authorizationHeader: e.target.value })} disabled={!oauth2Enabled} placeholder="Authorization" label="Authorization header" />
            </Box>
          </Stack>
        </Box>

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          Pass End-User Attributes to Backend
        </Typography>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 3 }}>
          <FormControlLabel
            control={<Switch size="small" checked={state.enableBackendJWT} onChange={(e) => update({ enableBackendJWT: e.target.checked })} />}
            label={<Typography variant="body2">Send end-user attributes as a JWT to the backend</Typography>}
            sx={{ mb: state.enableBackendJWT ? 2 : 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse', mx: 0 }}
          />
          <Collapse in={state.enableBackendJWT} unmountOnExit>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Audience claims
              </Typography>
              <TagInput values={state.backendJWTAudiences} onChange={(v) => update({ backendJWTAudiences: v })} placeholder="Type and press Enter to add audience claims" />
            </Box>
          </Collapse>
        </Box>

        {operations.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Resources
            </Typography>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', mb: 3 }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search resources"
                  value={state.opSearch}
                  onChange={(e) => update({ opSearch: e.target.value, opPage: 0 })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={14} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Stack direction="row" sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ width: 72, flexShrink: 0 }}>
                  Method
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  Resource
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ width: 220, flexShrink: 0 }}>
                  Permissions (Scopes)
                </Typography>
              </Stack>

              {filteredOps.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No resources match your search.
                  </Typography>
                </Box>
              ) : (
                pageOps.map((op) => {
                  const key = `${op.verb.toUpperCase()}-${op.target}`;
                  const colors = getHttpMethodColors(op.verb);
                  const currentScopes = state.operationScopes[key] ?? [];
                  return (
                    <Stack
                      key={key}
                      direction="row"
                      alignItems="center"
                      gap={1.5}
                      sx={{
                        px: 2,
                        py: 1.25,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                      }}>
                      <Box sx={{ width: 72, flexShrink: 0 }}>
                        <Box sx={{ bgcolor: colors.badgeBg, color: '#fff', fontWeight: 700, fontSize: '11px', px: 1, py: 0.5, borderRadius: 0.5, textAlign: 'center' }}>{op.verb.toUpperCase()}</Box>
                      </Box>
                      <Typography sx={{ flex: 1, fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all', color: 'text.primary' }}>{op.target}</Typography>
                      <Box sx={{ width: 220, flexShrink: 0 }}>
                        <TagInput values={currentScopes} onChange={(v) => update({ operationScopes: { ...state.operationScopes, [key]: v } })} placeholder="Add scopes…" suggestions={availableScopes} />
                      </Box>
                    </Stack>
                  );
                })
              )}

              {totalPages > 1 && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <Typography variant="caption" color="text.secondary">
                    {state.opPage * OPS_PER_PAGE + 1}–{Math.min((state.opPage + 1) * OPS_PER_PAGE, filteredOps.length)} of {filteredOps.length} resources
                  </Typography>
                  <Stack direction="row" gap={0.5}>
                    <IconButton size="small" disabled={state.opPage === 0} onClick={() => update({ opPage: state.opPage - 1 })}>
                      <ArrowLeft size={14} />
                    </IconButton>
                    <IconButton size="small" disabled={state.opPage >= totalPages - 1} onClick={() => update({ opPage: state.opPage + 1 })}>
                      <ArrowRight size={14} />
                    </IconButton>
                  </Stack>
                </Stack>
              )}
            </Box>
          </>
        )}
      </Box>

      <Divider />
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        <Button variant="contained" onClick={handleApply} disabled={saving || isFetchingInitial || !ep.apimId} startIcon={saving ? <CircularProgress color="inherit" size={16} /> : undefined}>
          {saving ? 'Applying…' : 'Apply'}
        </Button>
      </Stack>
    </>
  );
}

interface EndpointConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  componentId: string;
  versionId: string;
  firstEnvReleaseId: string;
  /** Environment slug, required by the cloud security drawer's BFF routes. */
  firstEnvId?: string;
}

export default function EndpointConfigDrawer({ open, onClose, componentId, versionId, firstEnvReleaseId, firstEnvId }: EndpointConfigDrawerProps) {
  const { data: endpoints = [], isLoading: endpointsLoading } = useEnvEndpoints(componentId, versionId, firstEnvReleaseId);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [openKey, setOpenKey] = useState(0);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSelectedIdx(0);
      setOpenKey((k) => k + 1);
    }
    prevOpenRef.current = open;
  }, [open]);

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    onClose();
  };

  const selectedEp: EnvEndpoint | null = endpoints[selectedIdx] ?? null;

  // The panel below edits an APIM API object, which cloud has none of.
  if (IS_CLOUD) {
    return <ApiSecurityDrawer open={open} onClose={handleClose} componentName={componentId} envName={firstEnvId ?? ''} endpoints={toEndpointOptions(endpoints)} activeEndpointName={selectedEp?.id} />;
  }

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} variant="temporary" sx={drawerSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Stack gap={0.25}>
          <Typography variant="h5">Endpoint Configurations</Typography>
          {endpointsLoading ? (
            <Typography variant="caption" color="text.secondary">
              Loading endpoints…
            </Typography>
          ) : endpoints.length > 1 ? (
            <Select size="small" value={selectedIdx} onChange={(e) => setSelectedIdx(Number(e.target.value))} sx={{ minWidth: 240, mt: 0.5 }}>
              {endpoints.map((ep, idx) => (
                <MenuItem key={ep.id} value={idx}>
                  {ep.displayName}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {endpoints[0]?.displayName ?? ''}
            </Typography>
          )}
        </Stack>
        <IconButton size="small" aria-label="close" onClick={handleClose}>
          <X size={16} />
        </IconButton>
      </Stack>

      {endpointsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : endpoints.length === 0 ? (
        <Box sx={{ px: 3, py: 4 }}>
          <Alert severity="info">No endpoints available for this deployment.</Alert>
        </Box>
      ) : selectedEp ? (
        <EndpointPanel key={`${selectedEp.id}-${openKey}`} ep={selectedEp} onSaved={handleClose} />
      ) : null}
    </Drawer>
  );
}
