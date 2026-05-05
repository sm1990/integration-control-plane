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

import { Alert, Box, Button, Checkbox, CircularProgress, Collapse, Divider, Drawer, FormControlLabel, FormHelperText, IconButton, InputAdornment, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronUp, Search, X } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useReducer, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import CenteredLoader from '../CenteredLoader';
import { useApimApi } from '../../api/queries';
import { useThrottlingPolicies } from '../../api/marketplace';
import { updateApimApi, deploySettingsV2, type ApimApiOperation, type CorsConfiguration } from '../../api/apim';
import { useUpdateEndpoint } from '../../api/mutations';

// ── Drawer style (same as ConfigureDrawer) ─────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────────────────

type RateLimitLevel = 'UNLIMITED' | 'API_LEVEL' | 'RESOURCE_LEVEL';
type TimeUnit = 'MINUTE' | 'HOUR' | 'DAY';

interface RateLimitPolicy {
  requestCount: string;
  timeUnit: TimeUnit;
}

const VISIBILITY_OPTIONS = ['Public', 'Organization', 'Project'] as const;
type VisibilityOption = (typeof VISIBILITY_OPTIONS)[number];

interface ManageState {
  corsEnabled: boolean;
  allowAllOrigins: boolean;
  origins: string[];
  headers: string[];
  methods: string[];
  allowCredentials: boolean;
  rateLimitLevel: RateLimitLevel;
  apiLevelPolicy: RateLimitPolicy;
  resourceLevelPolicies: Record<string, RateLimitPolicy>;
  timeout: string;
  networkVisibilities: VisibilityOption[];
}

const DEFAULT_HEADERS = ['authorization', 'Access-Control-Allow-Origin', 'Content-Type', 'SOAPAction', 'apikey', 'testKey'];
const DEFAULT_METHODS = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'];
const DEFAULT_TIMEOUT = '60000';
const DEFAULT_RATE_LIMIT: RateLimitPolicy = { requestCount: '-1', timeUnit: 'MINUTE' };

function opKey(op: ApimApiOperation) {
  return `${op.verb.toUpperCase()}-${op.target}`;
}

function buildInitialState(apimApiInfo: ReturnType<typeof useApimApi>['data'], initialNetworkVisibilities?: string[]): ManageState {
  const cors = apimApiInfo?.corsConfiguration;
  const origins = cors?.accessControlAllowOrigins ?? [];
  const endpointConfig = apimApiInfo?.endpointConfig as Record<string, unknown> | undefined;
  const prodEndpoints = endpointConfig?.production_endpoints as Record<string, unknown> | undefined;
  const config = prodEndpoints?.config as Record<string, unknown> | undefined;
  const timeout = (config?.actionDuration as string | undefined) ?? DEFAULT_TIMEOUT;

  const apiThrottlingPolicy = apimApiInfo?.apiThrottlingPolicy;
  const operations = apimApiInfo?.operations ?? [];

  const hasResourceLevel = operations.some((op) => op.throttlingPolicy);
  const rateLimitLevel: RateLimitLevel = hasResourceLevel ? 'RESOURCE_LEVEL' : apiThrottlingPolicy ? 'API_LEVEL' : 'UNLIMITED';

  const resourceLevelPolicies: Record<string, RateLimitPolicy> = {};
  for (const op of operations) {
    if (op.throttlingPolicy) {
      resourceLevelPolicies[opKey(op)] = { requestCount: op.throttlingPolicy, timeUnit: 'MINUTE' };
    }
  }

  const networkVisibilities = (initialNetworkVisibilities ?? []).filter((v): v is VisibilityOption => VISIBILITY_OPTIONS.includes(v as VisibilityOption));

  return {
    corsEnabled: cors?.corsConfigurationEnabled ?? false,
    allowAllOrigins: origins.includes('*'),
    origins: origins.filter((o) => o !== '*'),
    headers: cors?.accessControlAllowHeaders ?? DEFAULT_HEADERS,
    methods: cors?.accessControlAllowMethods ?? DEFAULT_METHODS,
    allowCredentials: cors?.accessControlAllowCredentials ?? false,
    rateLimitLevel,
    apiLevelPolicy: { requestCount: apiThrottlingPolicy ?? '-1', timeUnit: 'MINUTE' },
    resourceLevelPolicies,
    timeout,
    networkVisibilities,
  };
}

// ── TagInput ───────────────────────────────────────────────────────────────────

function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      const val = input.trim().replace(/,$/, '');
      if (val && !values.includes(val)) onChange([...values, val]);
      setInput('');
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, minHeight: 40 }}>
      {values.map((v) => (
        <Box key={v} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, bgcolor: 'action.selected', borderRadius: 0.75, px: 0.75, py: 0.25, fontSize: '0.75rem' }}>
          <span>{v}</span>
          <Box component="span" onClick={() => onChange(values.filter((x) => x !== v))} sx={{ cursor: 'pointer', ml: 0.25, opacity: 0.6, '&:hover': { opacity: 1 }, lineHeight: 1 }}>
            ×
          </Box>
        </Box>
      ))}
      <Box
        component="input"
        value={input}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={values.length === 0 ? placeholder : ''}
        sx={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8125rem', flex: 1, minWidth: 80, color: 'text.primary', '&::placeholder': { color: 'text.disabled' } }}
      />
    </Box>
  );
}

// ── Section accordion ──────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', mb: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setOpen((p) => !p)}
        sx={{ px: 2, py: 1.25, cursor: 'pointer', userSelect: 'none', bgcolor: 'action.hover', borderBottom: open ? '1px solid' : 'none', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

// ── Config row ──────────────────────────────────────────────────────────────────

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="flex-start" gap={2} sx={{ mb: 1.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 220, flexShrink: 0, pt: 0.75 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Stack>
  );
}

// ── Rate limit inputs (request count + time unit) ──────────────────────────────

function RateLimitInputs({ policy, onChange }: { policy: RateLimitPolicy; onChange: (p: RateLimitPolicy) => void }) {
  return (
    <Stack direction="row" gap={1}>
      <TextField
        size="small"
        type="number"
        label="Request count"
        value={policy.requestCount === '-1' ? '' : policy.requestCount}
        placeholder="-1 (unlimited)"
        onChange={(e) => onChange({ ...policy, requestCount: e.target.value || '-1' })}
        inputProps={{ min: -1 }}
        sx={{ flex: 1 }}
      />
      <TextField select size="small" label="Time unit" value={policy.timeUnit} onChange={(e) => onChange({ ...policy, timeUnit: e.target.value as TimeUnit })} sx={{ width: 120 }}>
        <MenuItem value="MINUTE">Minute</MenuItem>
        <MenuItem value="HOUR">Hour</MenuItem>
        <MenuItem value="DAY">Day</MenuItem>
      </TextField>
    </Stack>
  );
}

// ── Method badge (matches SwaggerOperationsList) ───────────────────────────────

interface MethodColors {
  cardBg: string;
  border: string;
  badgeBg: string;
}

const METHOD_COLORS: Record<string, MethodColors> = {
  GET: { cardBg: '#F4FAFF', border: '#C1E4FC', badgeBg: '#0095FF' },
  POST: { cardBg: '#F5FFF7', border: '#CDF1DF', badgeBg: '#36B475' },
  PUT: { cardBg: '#FFFBF6', border: '#FEE6C8', badgeBg: '#FF9D52' },
  DELETE: { cardBg: 'rgba(252,237,237,0.5)', border: 'rgba(248,194,194,0.69)', badgeBg: '#FE523C' },
  PATCH: { cardBg: 'rgba(1,206,181,0.08)', border: 'rgba(1,206,181,0.28)', badgeBg: '#01CEB5' },
  OPTIONS: { cardBg: 'rgba(5,102,200,0.07)', border: 'rgba(5,102,200,0.2)', badgeBg: '#0566C8' },
  HEAD: { cardBg: 'rgba(123,85,213,0.08)', border: 'rgba(123,85,213,0.18)', badgeBg: '#7B55D5' },
  TRACE: { cardBg: '#f5f5f5', border: '#d0d0d0', badgeBg: '#785446' },
};
const DEFAULT_METHOD_COLORS: MethodColors = { cardBg: '#f5f5f5', border: '#e0e0e0', badgeBg: '#9e9e9e' };

// ── Main drawer ────────────────────────────────────────────────────────────────

interface ManageDrawerProps {
  open: boolean;
  onClose: () => void;
  apimId: string | null | undefined;
  // Optional — when provided, enables deploy-settings-v2 redeploy after save
  componentId?: string;
  versionId?: string;
  releaseId?: string;
  buildId?: string;
  environmentId?: string;
  apimRevisionId?: string | null;
  // Optional — when provided, enables network visibility editing
  endpointId?: string;
  endpointDisplayName?: string;
  networkVisibilities?: string[] | null;
}

export default function ManageDrawer({ open, onClose, apimId, componentId, versionId, releaseId, buildId, environmentId, apimRevisionId, endpointId, endpointDisplayName, networkVisibilities: initialNetworkVisibilities }: ManageDrawerProps) {
  const queryClient = useQueryClient();
  const { data: apimApiInfo, isLoading } = useApimApi(open ? apimId : null);
  useThrottlingPolicies(); // prefetch
  const updateEndpoint = useUpdateEndpoint();

  const [state, dispatch] = useReducer(
    (prev: ManageState, update: Partial<ManageState>) => ({ ...prev, ...update }),
    null,
    () => buildInitialState(apimApiInfo, initialNetworkVisibilities ?? undefined),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [timeoutError, setTimeoutError] = useState<string | null>(null);
  const [opSearch, setOpSearch] = useState('');
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set());

  const canRedeploy = !!(componentId && versionId && buildId && releaseId && environmentId);
  const canEditVisibility = !!(endpointId && componentId && versionId && releaseId);

  useEffect(() => {
    if (open) {
      dispatch(buildInitialState(apimApiInfo, initialNetworkVisibilities ?? undefined));
      setSaveError(null);
      setSaveSuccess(false);
      setOpSearch('');
      setExpandedOps(new Set());
    }
  }, [open, apimApiInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    onClose();
  };

  const validateTimeout = (val: string) => {
    const n = Number(val);
    if (!val || isNaN(n) || n <= 0) {
      setTimeoutError('Timeout must be a positive number');
      return false;
    }
    setTimeoutError(null);
    return true;
  };

  const handleApply = async () => {
    if (!apimApiInfo || !apimId) return;
    if (!validateTimeout(state.timeout)) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const corsConfiguration: CorsConfiguration = {
      corsConfigurationEnabled: state.corsEnabled,
      accessControlAllowOrigins: state.corsEnabled ? (state.allowAllOrigins ? ['*'] : state.origins) : [],
      accessControlAllowCredentials: state.corsEnabled ? state.allowCredentials : false,
      accessControlAllowHeaders: state.corsEnabled ? state.headers : [],
      accessControlAllowMethods: state.corsEnabled ? state.methods : [],
    };

    const existingEndpointConfig = (apimApiInfo.endpointConfig as Record<string, unknown>) ?? {};
    const existingProd = (existingEndpointConfig.production_endpoints as Record<string, unknown>) ?? {};
    const existingConfig = (existingProd.config as Record<string, unknown>) ?? {};
    const endpointConfig = {
      ...existingEndpointConfig,
      production_endpoints: { ...existingProd, config: { ...existingConfig, actionDuration: state.timeout } },
    };

    const updatedOperations: ApimApiOperation[] = (apimApiInfo.operations ?? []).map((op) => {
      const key = opKey(op);
      if (state.rateLimitLevel === 'RESOURCE_LEVEL' && state.resourceLevelPolicies[key]) {
        return { ...op, throttlingPolicy: state.resourceLevelPolicies[key].requestCount };
      }
      return { ...op, throttlingPolicy: undefined };
    });

    const updated = {
      ...apimApiInfo,
      corsConfiguration,
      apiThrottlingPolicy: state.rateLimitLevel === 'API_LEVEL' ? state.apiLevelPolicy.requestCount || null : null,
      endpointConfig,
      operations: updatedOperations,
    };

    try {
      const savedApi = await updateApimApi(apimId, updated);
      queryClient.invalidateQueries({ queryKey: ['apimApi', apimId] });

      // Phase 1: trigger redeploy via proxy deployer when context is available
      if (canRedeploy) {
        const settingsKey = (savedApi.revisionedApiId as string | null | undefined) || savedApi.name;
        const apiLevelRc = Number(state.apiLevelPolicy.requestCount);
        const apiLevelThrottle = state.rateLimitLevel === 'API_LEVEL' ? { requestCount: isNaN(apiLevelRc) ? -1 : apiLevelRc, unit: state.apiLevelPolicy.timeUnit } : null;
        const accessMode = state.networkVisibilities.length === 1 && state.networkVisibilities[0] === 'Public' ? 'External' : 'Internal';
        await deploySettingsV2(componentId!, versionId!, {
          environmentId: environmentId!,
          buildId: buildId!,
          comment: '',
          apiSettings: {
            [settingsKey]: {
              accessMode,
              settings: {
                corsConfiguration: { ...corsConfiguration, corsOverrideEnabled: true },
                throttlingLimit: apiLevelThrottle,
                operations: updatedOperations.map((op) => ({
                  verb: op.verb.toUpperCase(),
                  target: op.target,
                  throttlingLimit: { requestCount: ((_rc) => (isNaN(_rc) ? -1 : _rc))(Number(op.throttlingPolicy)), unit: 'MINUTE' },
                })),
                resiliency: Number(state.timeout) || undefined,
              },
              revisionId: apimRevisionId ?? undefined,
              isAsyncAPI: false,
              multiGatewayDeployment: state.networkVisibilities.includes('Public') && state.networkVisibilities.includes('Organization'),
            },
          },
        });
      }

      // Phase 2: update endpoint visibility when endpoint context is available
      if (canEditVisibility) {
        await updateEndpoint.mutateAsync({
          componentId: componentId!,
          versionId: versionId!,
          releaseId: releaseId!,
          endpointId: endpointId!,
          displayName: endpointDisplayName ?? '',
          networkVisibilities: state.networkVisibilities,
        });
      }

      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const operations = apimApiInfo?.operations ?? [];
  const filteredOps = operations.filter((op) => `${op.verb} ${op.target}`.toLowerCase().includes(opSearch.toLowerCase()));

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} variant="temporary" sx={drawerSx}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="h5">Manage</Typography>
        <IconButton size="small" aria-label="close" onClick={handleClose}>
          <X size={16} />
        </IconButton>
      </Stack>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
        {isLoading ? (
<<<<<<< Updated upstream
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress color="primary" />
          </Box>
=======
          <CenteredLoader />
>>>>>>> Stashed changes
        ) : !apimId ? (
          <Alert severity="info">No API configured for this endpoint.</Alert>
        ) : (
          <>
            {saveSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>
                Settings saved successfully.
              </Alert>
            )}
            {saveError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
                {saveError}
              </Alert>
            )}

            {/* CORS */}
            <Section title="CORS">
              <FormControlLabel control={<Checkbox checked={state.corsEnabled} onChange={(e) => dispatch({ corsEnabled: e.target.checked })} size="small" />} label={<Typography variant="body2">Enable</Typography>} sx={{ mb: 1 }} />
              <Collapse in={state.corsEnabled} unmountOnExit>
                <Box sx={{ mt: 1 }}>
                  <ConfigRow label="Access Control Allow Origin">
                    <FormControlLabel control={<Checkbox checked={state.allowAllOrigins} onChange={(e) => dispatch({ allowAllOrigins: e.target.checked })} size="small" />} label={<Typography variant="body2">Allow All</Typography>} />
                    {!state.allowAllOrigins && (
                      <Box sx={{ mt: 0.5 }}>
                        <TagInput values={state.origins} onChange={(v) => dispatch({ origins: v })} placeholder="Enter origins and press Enter" />
                      </Box>
                    )}
                  </ConfigRow>
                  <ConfigRow label="Access Control Allow Headers">
                    <TagInput values={state.headers} onChange={(v) => dispatch({ headers: v })} placeholder="Enter headers and press Enter" />
                  </ConfigRow>
                  <ConfigRow label="Access Control Allow Methods">
                    <TagInput values={state.methods} onChange={(v) => dispatch({ methods: v })} placeholder="Enter methods and press Enter" />
                  </ConfigRow>
                  <ConfigRow label="Access Control Allow Credentials">
                    <Checkbox checked={state.allowCredentials} onChange={(e) => dispatch({ allowCredentials: e.target.checked })} size="small" />
                  </ConfigRow>
                </Box>
              </Collapse>
            </Section>

            {/* Rate Limiting */}
            <Section title="Rate Limiting">
              <ConfigRow label="Rate Limiting Level">
                <RadioGroup row value={state.rateLimitLevel} onChange={(e) => dispatch({ rateLimitLevel: e.target.value as RateLimitLevel })}>
                  <FormControlLabel value="UNLIMITED" control={<Radio size="small" />} label={<Typography variant="body2">Unlimited</Typography>} />
                  <FormControlLabel value="API_LEVEL" control={<Radio size="small" />} label={<Typography variant="body2">API Level</Typography>} />
                  <FormControlLabel value="RESOURCE_LEVEL" control={<Radio size="small" />} label={<Typography variant="body2">Resource Level</Typography>} />
                </RadioGroup>
              </ConfigRow>

              <Collapse in={state.rateLimitLevel === 'API_LEVEL'} unmountOnExit>
                <Box sx={{ mt: 1 }}>
                  <RateLimitInputs policy={state.apiLevelPolicy} onChange={(p) => dispatch({ apiLevelPolicy: p })} />
                </Box>
              </Collapse>

              <Collapse in={state.rateLimitLevel === 'RESOURCE_LEVEL'} unmountOnExit>
                <Box sx={{ mt: 1.5 }}>
                  {/* Search */}
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search operations"
                    value={opSearch}
                    onChange={(e) => setOpSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={14} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 1.5 }}
                  />

                  {/* Operations list */}
                  {operations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No operations found.
                    </Typography>
                  ) : filteredOps.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No operations match your search.
                    </Typography>
                  ) : (
                    filteredOps.map((op) => {
                      const key = opKey(op);
                      const policy = state.resourceLevelPolicies[key] ?? DEFAULT_RATE_LIMIT;
                      const colors = METHOD_COLORS[op.verb.toUpperCase()] ?? DEFAULT_METHOD_COLORS;
                      const isExpanded = expandedOps.has(key);
                      const toggle = () =>
                        setExpandedOps((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      return (
                        <Box key={key} sx={{ border: `0.5px solid ${colors.badgeBg}`, borderRadius: 0.5, overflow: 'hidden', mb: 1 }}>
                          <Stack direction="row" alignItems="center" gap={1.5} onClick={toggle} sx={{ px: 1, py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                            <Box sx={{ bgcolor: colors.badgeBg, color: '#fff', fontWeight: 700, fontSize: '11px', minWidth: 64, px: 1, py: 0.5, borderRadius: 0.5, textAlign: 'center', flexShrink: 0 }}>{op.verb.toUpperCase()}</Box>
                            <Typography sx={{ flex: 1, fontSize: '13px', fontWeight: 500, fontFamily: 'monospace', color: '#222228', wordBreak: 'break-word' }}>{op.target}</Typography>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </Stack>
                          <Collapse in={isExpanded}>
                            <Box sx={{ px: 2, py: 1.5, borderTop: `0.5px solid ${colors.badgeBg}`, bgcolor: 'background.default' }}>
                              <RateLimitInputs policy={policy} onChange={(p) => dispatch({ resourceLevelPolicies: { ...state.resourceLevelPolicies, [key]: p } })} />
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    })
                  )}
                </Box>
              </Collapse>
            </Section>

            {/* Resiliency */}
            <Section title="Resiliency">
              <ConfigRow label="Endpoint timeout (ms)">
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  value={state.timeout}
                  onChange={(e) => {
                    dispatch({ timeout: e.target.value });
                    if (timeoutError) validateTimeout(e.target.value);
                  }}
                  onBlur={() => validateTimeout(state.timeout)}
                  error={!!timeoutError}
                  inputProps={{ min: 1 }}
                />
                {timeoutError && <FormHelperText error>{timeoutError}</FormHelperText>}
              </ConfigRow>
            </Section>

            {/* Network Visibility — only shown when endpoint context is available */}
            {canEditVisibility && (
              <Section title="Network Visibility">
                <Stack direction="row" gap={2} flexWrap="wrap">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <FormControlLabel
                      key={opt}
                      control={
                        <Checkbox
                          size="small"
                          checked={state.networkVisibilities.includes(opt)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...state.networkVisibilities, opt] : state.networkVisibilities.filter((v) => v !== opt);
                            dispatch({ networkVisibilities: next });
                          }}
                        />
                      }
                      label={<Typography variant="body2">{opt}</Typography>}
                    />
                  ))}
                </Stack>
              </Section>
            )}
          </>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleApply} disabled={saving || isLoading || !apimId} startIcon={saving ? <CircularProgress color="inherit" size={16} /> : undefined}>
          {saving ? 'Applying…' : 'Apply'}
        </Button>
      </Stack>
    </Drawer>
  );
}
