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

import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, MenuItem, Select as MuiSelect, Stack, TextField, Tooltip, Typography } from '@wso2/oxygen-ui';
import { Building2, Check, ChevronDown, ChevronUp, Copy, Folder, Globe, Link, Pencil, Settings, Trash2, Upload, X } from '@wso2/oxygen-ui-icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEnvEndpoints,
  useGetConfigMgt,
  useSchemaConfig,
  useConfigGroups,
  useCertificateGroups,
  useCertificateMappings,
  type ConfigMgtItem,
  type GqlEnvEndpoint,
  type SchemaConfigItem,
  type CertGroup,
  type CertMapping,
  type CertMappingConfig,
} from '../../api/queries';
import { usePostConfigMgt, useRedeployDeployment, useUpdateEndpoint, useSaveSchemaConfig, usePostCertificateMappings, type ConfigMgtSaveItem } from '../../api/mutations';
import ManageDrawer from './ManageDrawer';
import { ConfigForm } from '../SchemaConfigForm/ConfigForm';
import type { LinkingInfo } from '../SchemaConfigForm/ConfigForm';
import { type BaseType, type JSONSchema, getRequiredPathsAtLevel } from '../SchemaConfigForm/schemaUtils';
import { parseConfigToml, filterTomlValuesBySchema, getAllSchemaKeys } from '../SchemaConfigForm/tomlUtils';

// ── Schema parsing ────────────────────────────────────────────────────────────

interface ParsedField {
  key: string;
  displayName: string;
  group: string;
  type: string;
  description?: string;
  required: boolean;
  isSensitive: boolean;
}

function parseSchema(base64: string | undefined, configMount: ConfigMgtItem[] | undefined): ParsedField[] {
  if (!base64) return [];
  try {
    const root = JSON.parse(atob(base64));
    const fields: ParsedField[] = [];

    function flatten(props: Record<string, Record<string, unknown>>, required: string[], keyPrefix: string, group: string, displayPrefix: string) {
      for (const [name, prop] of Object.entries(props)) {
        const fullKey = `${keyPrefix}.${name}`;
        const display = displayPrefix ? `${displayPrefix}.${name}` : name;

        if (prop.type === 'object' && prop.properties) {
          const nestedRequired = Array.isArray(prop.required) ? (prop.required as string[]) : [];
          flatten(prop.properties as Record<string, Record<string, unknown>>, nestedRequired, fullKey, group, display);
        } else {
          fields.push({
            key: fullKey,
            displayName: display,
            group,
            type: typeof prop.type === 'string' ? prop.type : 'string',
            description: typeof prop.description === 'string' ? prop.description : undefined,
            required: required.includes(name),
            isSensitive: typeof prop['x-sensitive'] === 'boolean' ? (prop['x-sensitive'] as boolean) : false,
          });
        }
      }
    }

    for (const [org, orgSchema] of Object.entries((root.properties ?? {}) as Record<string, Record<string, unknown>>)) {
      for (const [pkg, pkgSchema] of Object.entries((orgSchema.properties ?? {}) as Record<string, Record<string, unknown>>)) {
        const group = `${org}.${pkg}`;
        const pkgRequired = Array.isArray((pkgSchema as Record<string, unknown>).required) ? ((pkgSchema as Record<string, unknown>).required as string[]) : [];
        flatten(((pkgSchema as Record<string, unknown>).properties ?? {}) as Record<string, Record<string, unknown>>, pkgRequired, `${org}.${pkg}`, group, '');
      }
    }

    const reqKeys = new Set((configMount ?? []).filter((c) => c.isRequired).map((c) => c.configKeyName));
    return fields.map((f) => ({ ...f, required: f.required || reqKeys.has(f.key) }));
  } catch {
    return [];
  }
}

function buildInitialValues(configMount: ConfigMgtItem[] | undefined): Record<string, string> {
  const vals: Record<string, string> = {};
  for (const item of configMount ?? []) {
    vals[item.configKeyName] = item.configurationValue?.value ?? '';
  }
  return vals;
}

// ── Config field components ───────────────────────────────────────────────────

interface FieldRowProps {
  displayName: string;
  type: string;
  description?: string;
  isSensitive: boolean;
  value: string;
  onChange: (v: string) => void;
}

function FieldRow({ displayName, type, description, isSensitive, value, onChange }: FieldRowProps) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {displayName}
        </Typography>
        <Chip label={type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
      </Stack>
      {description && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.25 }}>
          {description}
        </Typography>
      )}
      <TextField size="small" fullWidth type={isSensitive ? 'password' : 'text'} placeholder="Enter a value" value={value} onChange={(e) => onChange(e.target.value)} />
    </Box>
  );
}

interface PackageGroupProps {
  label: string;
  fields: ParsedField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function PackageGroup({ label, fields, values, onChange }: PackageGroupProps) {
  const [open, setOpen] = useState(true);
  return (
    <Box sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" onClick={() => setOpen((p) => !p)} sx={{ px: 1.5, py: 0.75, cursor: 'pointer', userSelect: 'none', borderBottom: open ? '1px solid' : 'none', borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {label}
        </Typography>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 1 }}>
          {fields.map((f) => (
            <FieldRow key={f.key} displayName={f.displayName} type={f.type} description={f.description} isSensitive={f.isSensitive} value={values[f.key] ?? ''} onChange={(v) => onChange(f.key, v)} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

interface DefaultableConfigurablesAccordionProps {
  groups: { label: string; fields: ParsedField[] }[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function DefaultableConfigurablesAccordion({ groups, values, onChange }: DefaultableConfigurablesAccordionProps) {
  const [open, setOpen] = useState(true);
  return (
    <Box sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setOpen((p) => !p)}
        sx={{ px: 2, py: 1.25, cursor: 'pointer', userSelect: 'none', borderBottom: open ? '1px solid' : 'none', borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Defaultable Configurables
        </Typography>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ p: 1.5 }}>
          {groups.map((g) => (
            <PackageGroup key={g.label} label={g.label} fields={g.fields} values={values} onChange={onChange} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Configurations', 'Endpoints'];
const AUTOMATION_STEPS = ['Configurations', 'Certificate Mount'];

function StepIndicator({ step, steps }: { step: number; steps: string[] }) {
  return (
    <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
      {steps.map((label, idx) => {
        const num = idx + 1;
        const isActive = num === step;
        const isDone = num < step;
        return (
          <Stack key={label} direction="row" alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  bgcolor: isActive ? 'primary.main' : isDone ? 'success.main' : 'action.disabledBackground',
                  color: isActive || isDone ? 'primary.contrastText' : 'text.disabled',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}>
                {num}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'text.primary' : 'text.secondary',
                  whiteSpace: 'nowrap',
                }}>
                {label}
              </Typography>
            </Stack>
            {idx < steps.length - 1 && <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider', mx: 0.75 }} />}
          </Stack>
        );
      })}
    </Stack>
  );
}

// ── Endpoint components ───────────────────────────────────────────────────────

const VISIBILITY_OPTS = [
  {
    key: 'Public',
    label: 'Public',
    Icon: Globe,
    description: 'Allows any client to access the endpoint, regardless of location or organization.',
  },
  {
    key: 'Organization',
    label: 'Organization',
    Icon: Building2,
    description: 'Allows any integration within the same organization to access the endpoint.',
  },
  {
    key: 'Project',
    label: 'Project',
    Icon: Folder,
    description: 'Allows any integration within the same project to access the endpoint.',
  },
] as const;

function getStatusColor(state?: string | null) {
  if (!state) return 'text.disabled';
  const s = state.toUpperCase();
  if (s === 'ACTIVE') return 'success.main';
  if (s === 'ERROR') return 'error.main';
  if (s === 'IN_PROGRESS' || s === 'PENDING' || s === 'PROGRESSING') return 'warning.main';
  return 'text.disabled';
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton size="small" onClick={handle} sx={{ p: 0.25, flexShrink: 0 }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </IconButton>
    </Tooltip>
  );
}

interface EndpointCardProps {
  ep: GqlEnvEndpoint;
  onEdit: (ep: GqlEnvEndpoint) => void;
  onSettings: (ep: GqlEnvEndpoint) => void;
  defaultExpanded?: boolean;
}

function EndpointCard({ ep, onEdit, onSettings, defaultExpanded = false }: EndpointCardProps) {
  const [open, setOpen] = useState(defaultExpanded);
  const visRows = VISIBILITY_OPTS.map((v) => {
    const url = v.key === 'Public' ? ep.publicUrl || ep.defaultPublicUrl || ep.invokeUrl || '' : v.key === 'Organization' ? ep.organizationUrl || ep.defaultOrganizationUrl || '' : ep.projectUrl || '';
    const active = !ep.networkVisibilities?.length || ep.networkVisibilities.includes(v.key);
    return { ...v, url, active };
  }).filter((r) => r.url && r.active);

  const fallbackUrl = visRows.length === 0 ? ep.invokeUrl || '' : '';

  return (
    <Box sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1, borderBottom: open ? '1px solid' : 'none', borderColor: 'divider' }}>
        {/* Status dot */}
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getStatusColor(ep.state), flexShrink: 0 }} onClick={() => setOpen((p) => !p)} />
        {/* Name */}
        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => setOpen((p) => !p)}>
          {ep.displayName}
        </Typography>
        {/* Edit */}
        <Tooltip title="Edit endpoint">
          <IconButton
            size="small"
            sx={{ p: 0.5, flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(ep);
            }}>
            <Pencil size={14} />
          </IconButton>
        </Tooltip>
        {/* Settings */}
        <Tooltip title="API settings">
          <IconButton
            size="small"
            sx={{ p: 0.5, flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onSettings(ep);
            }}>
            <Settings size={14} />
          </IconButton>
        </Tooltip>
        {/* Chevron */}
        <IconButton size="small" sx={{ p: 0.25, flexShrink: 0 }} onClick={() => setOpen((p) => !p)}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </IconButton>
      </Stack>

      {/* Expanded content */}
      <Collapse in={open}>
        <Box sx={{ px: 1.5, py: 1.25 }}>
          {/* Details box */}
          <Box sx={{ mb: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1 }}>
            {[
              { label: 'Port', value: ep.port != null ? String(ep.port) : null },
              { label: 'Status', value: ep.state ?? null },
              { label: 'Type', value: ep.type ?? null },
              { label: 'Context', value: ep.apiContext ?? null },
              { label: 'Schema', value: ep.apiDefinitionPath ?? null },
            ].map(({ label, value }) =>
              value ? (
                <Stack key={label} direction="row" alignItems="center" sx={{ py: 0.3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, width: 72, flexShrink: 0 }}>
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: label === 'Schema' ? 'monospace' : undefined }}>
                    {value}
                  </Typography>
                </Stack>
              ) : null,
            )}
            {/* Network Visibilities row */}
            {ep.networkVisibilities && ep.networkVisibilities.length > 0 && (
              <Stack direction="row" alignItems="center" sx={{ py: 0.3 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, width: 72, flexShrink: 0 }}>
                  Visibility
                </Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {ep.networkVisibilities.map((v) => (
                    <Chip key={v} label={v} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
                  ))}
                </Stack>
              </Stack>
            )}
          </Box>

          {/* URLs box */}
          {(visRows.length > 0 || fallbackUrl) && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {visRows.map((r, i) => (
                <Box key={r.key} sx={{ px: 1.5, py: 0.75, borderBottom: i < visRows.length - 1 || !!fallbackUrl ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>
                    {r.label} URL
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {r.url}
                    </Typography>
                    <CopyBtn text={r.url} />
                  </Stack>
                </Box>
              ))}
              {fallbackUrl && (
                <Box sx={{ px: 1.5, py: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>
                    Public URL
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {fallbackUrl}
                    </Typography>
                    <CopyBtn text={fallbackUrl} />
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// ── ManageEndpoint (inline edit view) ─────────────────────────────────────────

interface ManageEndpointProps {
  ep: GqlEnvEndpoint;
  componentId: string;
  versionId: string;
  releaseId: string;
  onBack: () => void;
}

function ManageEndpoint({ ep, componentId, versionId, releaseId, onBack }: ManageEndpointProps) {
  const [visibilities, setVisibilities] = useState<string[]>(ep.networkVisibilities ?? [ep.visibility ?? 'Public']);
  const [saveError, setSaveError] = useState<string | null>(null);
  const updateEp = useUpdateEndpoint();

  const handleToggle = (key: string) => {
    setVisibilities((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  };

  const handleSave = () => {
    setSaveError(null);
    updateEp.mutate(
      { componentId, versionId, releaseId, endpointId: ep.id, displayName: ep.displayName, networkVisibilities: visibilities },
      {
        onSuccess: onBack,
        onError: (err) => setSaveError(err instanceof Error ? err.message : 'Failed to update endpoint'),
      },
    );
  };

  return (
    <Box>
      {/* Endpoint details (read-only) */}
      <Box sx={{ mb: 2 }}>
        {[
          { label: 'Name', value: ep.displayName },
          { label: 'Port', value: ep.port != null ? String(ep.port) : null },
          { label: 'Status', value: ep.state ?? null },
          { label: 'Type', value: ep.type ?? null },
          { label: 'Context', value: ep.apiContext ?? null },
          { label: 'Schema', value: ep.apiDefinitionPath ?? null },
        ].map(({ label, value }) =>
          value ? (
            <Typography key={label} variant="body2" sx={{ mb: 0.5 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                {label}
              </Box>
              : {value}
            </Typography>
          ) : null,
        )}
      </Box>

      {/* Network visibility */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Network Visibility
      </Typography>
      <Stack gap={1} sx={{ mb: 2 }}>
        {VISIBILITY_OPTS.map(({ key, label, Icon, description }) => {
          const checked = visibilities.includes(key);
          return (
            <Box
              key={key}
              onClick={() => handleToggle(key)}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.25,
                p: 1.5,
                border: '1px solid',
                borderColor: checked ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                '&:hover': { borderColor: 'primary.main' },
              }}>
              <Box sx={{ display: 'flex', color: 'primary.main', mt: 0.25, flexShrink: 0 }}>
                <Icon size={18} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {description}
                </Typography>
              </Box>
              <Checkbox checked={checked} size="small" sx={{ p: 0, flexShrink: 0, mt: 0.25 }} onClick={(e) => e.stopPropagation()} onChange={() => handleToggle(key)} />
            </Box>
          );
        })}
      </Stack>

      {saveError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {saveError}
        </Alert>
      )}

      <Stack direction="row" justifyContent="flex-end" gap={1}>
        <Button onClick={onBack}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={updateEp.isPending || visibilities.length === 0} startIcon={updateEp.isPending ? <CircularProgress color="inherit" size={16} /> : undefined}>
          {updateEp.isPending ? 'Updating…' : 'Update'}
        </Button>
      </Stack>
    </Box>
  );
}

// ── Automation configure drawer ───────────────────────────────────────────────

function parseSchemaBase64(base64: string | undefined): JSONSchema | null {
  if (!base64) return null;
  try {
    return JSON.parse(atob(base64)) as JSONSchema;
  } catch {
    return null;
  }
}

function parseTomlConfigLegacy(content: string): Map<string, BaseType> {
  const result = new Map<string, BaseType>();
  let section = '';
  const stripQuotes = (value: string) => {
    const trimmedValue = value.trim();
    if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) || (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
      return trimmedValue.slice(1, -1);
    }
    return trimmedValue;
  };
  const stripComment = (value: string) => {
    let inString = false;
    let stringChar = '';
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      const previousChar = value[i - 1];
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && previousChar !== '\\') {
        inString = false;
        stringChar = '';
      } else if (!inString && char === '#') {
        return value.slice(0, i).trim();
      }
    }
    return value.trim();
  };

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      section = stripQuotes(sectionMatch[1]);
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = stripQuotes(line.slice(0, eqIdx));
    if (!key) continue;

    const rawVal = stripComment(line.slice(eqIdx + 1));
    if (rawVal.startsWith('"""') || rawVal.startsWith("'''") || rawVal.startsWith('[')) continue;

    let value: BaseType = rawVal;
    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      value = rawVal.slice(1, -1);
    } else if (rawVal === 'true' || rawVal === 'false') {
      value = rawVal === 'true';
    } else if (/^[+-]?\d+(\.\d+)?$/.test(rawVal)) {
      value = Number(rawVal);
    }

    const fullKey = section ? `${section}.${key}` : key;
    result.set(fullKey, value);
  }

  return result;
}

const normalizeConfigPath = (key: string): string =>
  key
    .replace(/\//g, '.')
    .replace(/\.\[/g, '[')
    .replace(/\[\*\]/g, '[]')
    .replace(/\[\d+\]/g, '[]')
    .replace(/\.\*/g, '.*')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');

const findMatchingSchemaKey = (tomlKey: string, schemaKeys: string[]): string | undefined => {
  const normalizedTomlKey = normalizeConfigPath(tomlKey);
  return schemaKeys.find((schemaKey) => {
    const normalizedSchemaKey = normalizeConfigPath(schemaKey);
    return schemaKey === tomlKey || normalizedSchemaKey === normalizedTomlKey || normalizedSchemaKey.endsWith(`.${normalizedTomlKey}`) || normalizedTomlKey.endsWith(`.${normalizedSchemaKey}`);
  });
};

// ── Certificate Mount step components ──────────────────────────────────────────

interface LinkedCert {
  groupUuid: string;
  groupName: string;
  groupDisplayName?: string;
  mountPath: string;
  keys: { keyUuid: string; key: string; mountedAs: string }[];
}

interface CertLinkFormProps {
  availableCerts: CertGroup[];
  onLink: (cert: CertGroup, mountPath: string) => void;
  onCancel: () => void;
}

function CertLinkForm({ availableCerts, onLink, onCancel }: CertLinkFormProps) {
  const [selectedGroupUuid, setSelectedGroupUuid] = useState('');
  const [mountPath, setMountPath] = useState('');
  const mountPathError = mountPath && !mountPath.startsWith('/') ? 'Mount path must start with /' : '';
  const selected = availableCerts.find((c) => c.groupUuid === selectedGroupUuid) ?? null;
  const canLink = !!selected && !!mountPath && !mountPathError;

  return (
    <Box sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 1, p: 1.5, mb: 1.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        Link Certificate
      </Typography>
      <TextField
        size="small"
        fullWidth
        label="Mount Path"
        placeholder="/certs"
        value={mountPath}
        onChange={(e) => setMountPath(e.target.value)}
        error={!!mountPathError}
        helperText={mountPathError || 'Directory where certificate files will be mounted'}
        sx={{ mb: 1.5 }}
      />
      <MuiSelect size="small" fullWidth displayEmpty value={selectedGroupUuid} onChange={(e) => setSelectedGroupUuid(e.target.value as string)} sx={{ mb: 1.5 }}>
        <MenuItem value="" disabled>
          Select a Certificate
        </MenuItem>
        {availableCerts.map((c) => (
          <MenuItem key={c.groupUuid} value={c.groupUuid}>
            {c.groupDisplayName || c.groupName}
          </MenuItem>
        ))}
      </MuiSelect>
      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="small" variant="contained" disabled={!canLink} onClick={() => selected && onLink(selected, mountPath)}>
          Link
        </Button>
      </Stack>
    </Box>
  );
}

interface LinkedCertCardProps {
  cert: LinkedCert;
  onUnlink: () => void;
  onMountPathChange: (path: string) => void;
}

function LinkedCertCard({ cert, onUnlink, onMountPathChange }: LinkedCertCardProps) {
  const [open, setOpen] = useState(true);
  const [mountPath, setMountPath] = useState(cert.mountPath);
  const mountPathError = mountPath && !mountPath.startsWith('/') ? 'Mount path must start with /' : '';

  return (
    <Box sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1, cursor: 'pointer', borderBottom: open ? '1px solid' : 'none', borderColor: 'divider' }} onClick={() => setOpen((p) => !p)}>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          {cert.groupDisplayName || cert.groupName}
        </Typography>
        <Chip label="Certificate" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
        <Button
          size="small"
          variant="text"
          color="error"
          startIcon={<Trash2 size={13} />}
          onClick={(e) => {
            e.stopPropagation();
            onUnlink();
          }}
          sx={{ minWidth: 0, px: 0.5 }}>
          Unlink
        </Button>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            label="Mount Path"
            value={mountPath}
            error={!!mountPathError}
            helperText={mountPathError || 'Directory where certificate files will be mounted'}
            onChange={(e) => {
              setMountPath(e.target.value);
              if (!e.target.value || e.target.value.startsWith('/')) onMountPathChange(e.target.value);
            }}
            sx={{ mb: 1 }}
          />
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0.5, overflow: 'hidden' }}>
            <Stack direction="row" sx={{ px: 1, py: 0.5, bgcolor: 'action.hover' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }}>
                FILE NAME
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                CERTIFICATE KEY NAME
              </Typography>
            </Stack>
            {cert.keys.map((k) => (
              <Stack key={k.keyUuid} direction="row" alignItems="center" sx={{ px: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', flex: 1 }}>
                  {k.mountedAs}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  {k.key}
                </Typography>
              </Stack>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

interface CertificateMountStepProps {
  projectId: string;
  componentId: string;
  envId: string;
  deploymentTrackId: string;
  open: boolean;
  linkedCerts: LinkedCert[];
  onChange: (certs: LinkedCert[]) => void;
}

function CertificateMountStep({ projectId, componentId, envId: _envId, deploymentTrackId: _deploymentTrackId, open, linkedCerts, onChange }: CertificateMountStepProps) {
  const { data: certGroups = [], isLoading } = useCertificateGroups(projectId, componentId, open);
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);

  const linkedUuids = new Set(linkedCerts.map((c) => c.groupUuid));
  const linkable = certGroups.filter((g) => !linkedUuids.has(g.groupUuid));

  const handleLink = (cert: CertGroup, mountPath: string) => {
    const newCert: LinkedCert = {
      groupUuid: cert.groupUuid,
      groupName: cert.groupName,
      groupDisplayName: cert.groupDisplayName,
      mountPath,
      keys: cert.configurations
        .filter((k) => k.isFile)
        .map((k) => ({
          keyUuid: k.keyUuid,
          key: k.key,
          mountedAs:
            k.key
              .split('/')
              .pop()
              ?.toLowerCase()
              .replace(/[^a-z0-9._-]/g, '_') || k.key,
        })),
    };
    onChange([...linkedCerts, newCert]);
    setIsLinking(false);
  };

  const handleUnlink = (groupUuid: string) => {
    onChange(linkedCerts.filter((c) => c.groupUuid !== groupUuid));
    setUnlinkTarget(null);
  };

  const handleMountPathChange = (groupUuid: string, path: string) => {
    onChange(linkedCerts.map((c) => (c.groupUuid === groupUuid ? { ...c, mountPath: path } : c)));
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Button variant="outlined" size="small" startIcon={<Link size={14} />} onClick={() => setIsLinking(true)} disabled={isLinking || linkable.length === 0}>
          Link a Certificate
        </Button>
      </Box>

      {isLinking && <CertLinkForm availableCerts={linkable} onLink={handleLink} onCancel={() => setIsLinking(false)} />}

      {linkedCerts.length === 0 && !isLinking ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No certificates linked. Click &apos;Link a Certificate&apos; to mount certificates to your component.
          </Typography>
        </Box>
      ) : (
        linkedCerts.map((cert) => <LinkedCertCard key={cert.groupUuid} cert={cert} onUnlink={() => setUnlinkTarget(cert.groupUuid)} onMountPathChange={(path) => handleMountPathChange(cert.groupUuid, path)} />)
      )}

      <Dialog open={!!unlinkTarget} onClose={() => setUnlinkTarget(null)}>
        <DialogTitle>Unlink Certificate</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Are you sure you want to unlink this certificate? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnlinkTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => unlinkTarget && handleUnlink(unlinkTarget)}>
            Unlink
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface AutomationConfigureDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  componentId: string;
  envId: string;
  deploymentTrackId: string;
  commitHash?: string;
  orgHandler: string;
  releaseId?: string;
  displayType?: string;
  releaseMgtReleaseId?: string;
  releaseMgtDeploymentId?: string;
}

function AutomationConfigureDrawer({ open, onClose, projectId, componentId, envId, deploymentTrackId, commitHash, orgHandler, releaseId, displayType, releaseMgtReleaseId, releaseMgtDeploymentId }: AutomationConfigureDrawerProps) {
  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    onClose();
  };

  const { data, isLoading, isError } = useSchemaConfig(projectId, componentId, envId, deploymentTrackId, commitHash);
  const { data: configGroups = [] } = useConfigGroups(projectId, componentId, open);
  const { data: existingCertMappings } = useCertificateMappings(projectId, componentId, envId, deploymentTrackId, open);
  const save = useSaveSchemaConfig();
  const saveCertMappings = usePostCertificateMappings();
  const redeploy = useRedeployDeployment();
  const [step, setStep] = useState(1);
  const [valueMap, setValueMap] = useState<Map<string, BaseType>>(new Map());
  const [validationMap, setValidationMap] = useState<Map<string, boolean>>(new Map());
  const [sensitiveMap, setSensitiveMap] = useState<Map<string, boolean>>(new Map());
  const [linkingMap, setLinkingMap] = useState<Map<string, LinkingInfo>>(new Map());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [linkedCerts, setLinkedCerts] = useState<LinkedCert[]>([]);
  const certSeededRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedSchema = useMemo(() => parseSchemaBase64(data?.jsonSchema), [data?.jsonSchema]);
  const requiredJsonPathList = useMemo(() => (parsedSchema ? getRequiredPathsAtLevel(parsedSchema) : []), [parsedSchema]);

  const buildInitialConfigState = useCallback(
    (configurations: SchemaConfigItem[] | undefined) => {
      const initialValues = new Map<string, BaseType>();
      const initialValidations = new Map<string, boolean>();
      const initialSensitive = new Map<string, boolean>();
      const initialLinking = new Map<string, LinkingInfo>();

      for (const cfg of configurations ?? []) {
        if (cfg.values?.length) {
          initialValues.set(cfg.key, cfg.values[0]?.value ?? '');
          initialValidations.set(cfg.key, true);
        }
        if (cfg.isSensitive !== undefined) {
          initialSensitive.set(cfg.key, cfg.isSensitive);
        }
        if (cfg.configGroupId || cfg.configKeyId || cfg.isDynamic !== undefined) {
          initialLinking.set(cfg.key, {
            configGroupId: cfg.configGroupId,
            configKeyId: cfg.configKeyId,
            isDynamic: cfg.isDynamic,
          });
        }
      }

      for (const path of requiredJsonPathList) {
        if (!initialValidations.has(path) && !path.includes('[*]') && !path.includes('.*')) {
          initialValidations.set(path, false);
        }
      }

      return {
        initialSensitive,
        initialValidations,
        initialValues,
        initialLinking,
      };
    },
    [requiredJsonPathList],
  );

  // Seed values only on open; avoid clobbering edits on background refetches.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSaveError(null);
    setImportedFileName(null);
    certSeededRef.current = false;
    if (data !== undefined) {
      const { initialSensitive, initialValidations, initialValues, initialLinking } = buildInitialConfigState(data?.configurations);
      setValueMap(initialValues);
      setValidationMap(initialValidations);
      setSensitiveMap(initialSensitive);
      setLinkingMap(initialLinking);
      seededRef.current = true;
    } else {
      seededRef.current = false;
    }
  }, [open, buildInitialConfigState, data]);

  useEffect(() => {
    if (!open || seededRef.current || data === undefined) return;
    const { initialSensitive, initialValidations, initialValues, initialLinking } = buildInitialConfigState(data?.configurations);
    setValueMap(initialValues);
    setValidationMap(initialValidations);
    setSensitiveMap(initialSensitive);
    setLinkingMap(initialLinking);
    seededRef.current = true;
  }, [open, data, buildInitialConfigState]);

  // Seed cert mappings from existing data
  useEffect(() => {
    if (!open || certSeededRef.current || !existingCertMappings) return;
    // Group existing cert mappings by configGroupId
    const byGroup: Record<string, CertMappingConfig[]> = {};
    for (const cfg of existingCertMappings.configurations ?? []) {
      if (!cfg.configGroupId || !cfg.isFile) continue;
      if (!byGroup[cfg.configGroupId]) byGroup[cfg.configGroupId] = [];
      byGroup[cfg.configGroupId].push(cfg);
    }
    const certs: LinkedCert[] = Object.entries(byGroup).map(([groupId, cfgs]) => {
      const first = cfgs[0];
      // mountDirectory is derived from the full key (e.g., /certs/ca.crt → /certs)
      const fullKey = first.key;
      const lastSlash = fullKey.lastIndexOf('/');
      const mountPath = lastSlash > 0 ? fullKey.substring(0, lastSlash) : '/certs';
      return {
        groupUuid: groupId,
        groupName: first.configGroupName || groupId,
        mountPath,
        keys: cfgs.map((c) => ({
          keyUuid: c.configKeyId || '',
          key: c.configKeyName || c.key,
          mountedAs: lastSlash > 0 ? c.key.substring(lastSlash + 1) : c.key,
        })),
      };
    });
    if (certs.length > 0) {
      setLinkedCerts(certs);
    }
    certSeededRef.current = true;
  }, [open, existingCertMappings]);

  const handleValueChange = (key: string, value: BaseType, configMap?: Map<string, BaseType>) => {
    if (configMap) {
      setValueMap(configMap);
    } else {
      setValueMap((prev) => {
        const next = new Map(prev);
        next.set(key, value);
        return next;
      });
    }
  };

  const handleValidationChange = (key: string, isValid: boolean, configValidationMap?: Map<string, boolean>) => {
    if (configValidationMap) {
      setValidationMap(configValidationMap);
    } else {
      setValidationMap((prev) => {
        const next = new Map(prev);
        next.set(key, isValid);
        return next;
      });
    }
  };

  const handleTomlImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ((ev.target?.result as string) ?? '').replace(/^\uFEFF/, '');
      if (!file.name.toLowerCase().endsWith('.toml')) {
        setSaveError('Invalid file type. Please import a .toml file.');
        setImportedFileName(null);
        return;
      }
      if (!content.trim()) {
        setSaveError('File is empty. Please import a valid config.toml file with configuration values.');
        setImportedFileName(null);
        return;
      }
      const parsed = parseConfigToml(content);
      const legacyParsed = parseTomlConfigLegacy(content);
      const parsedValues = parsed.success && parsed.data ? parsed.data : legacyParsed.size > 0 ? legacyParsed : null;

      if (parsedValues) {
        setImportedFileName(file.name);
        let filtered = parsedSchema ? filterTomlValuesBySchema(parsedValues, parsedSchema) : parsedValues;

        if (filtered.size === 0 && parsedSchema) {
          const validKeys = getAllSchemaKeys(parsedSchema);
          const fallback = new Map<string, BaseType>();

          legacyParsed.forEach((value, tomlKey) => {
            const matchedKey = findMatchingSchemaKey(tomlKey, validKeys);
            if (matchedKey) {
              fallback.set(matchedKey, value);
            }
          });

          filtered = fallback;
        }

        if (filtered.size === 0) {
          setSaveError('The file was imported, but no matching configuration keys were found to populate.');
          return;
        }

        const mergedValues = new Map(valueMap);
        filtered.forEach((val, key) => mergedValues.set(key, val));

        const nextValidationMap = new Map(validationMap);
        filtered.forEach((_, key) => nextValidationMap.set(key, true));
        for (const path of requiredJsonPathList) {
          if (!path.includes('[*]') && !path.includes('.*')) {
            const value = mergedValues.get(path);
            nextValidationMap.set(path, value !== undefined && value !== '' && value !== null);
          }
        }

        setValueMap(mergedValues);
        setValidationMap(nextValidationMap);
        setSaveError(null);
      } else {
        setImportedFileName(null);
        setSaveError(parsed.error ?? 'Failed to parse config.toml file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearToml = () => {
    setImportedFileName(null);
    const { initialValidations, initialValues } = buildInitialConfigState(data?.configurations);
    setValueMap(initialValues);
    setValidationMap(initialValidations);
  };

  const handleNext = () => {
    if (step < 2) {
      setStep((s) => s + 1);
    } else {
      setSaveError(null);
      const configurations: SchemaConfigItem[] = [];
      const existingConfigMap = new Map((data?.configurations ?? []).map((cfg) => [cfg.key, cfg]));
      valueMap.forEach((value, key) => {
        if (value !== undefined && value !== '') {
          const existingConfig = existingConfigMap.get(key);
          const linking = linkingMap.get(key);
          configurations.push({
            key,
            values: [{ environmentUuid: envId, value: String(value) }],
            isSensitive: sensitiveMap.get(key) ?? existingConfig?.isSensitive,
            keyId: existingConfig?.keyId,
            configGroupId: linking?.configGroupId ?? existingConfig?.configGroupId,
            configKeyId: linking?.configKeyId ?? existingConfig?.configKeyId,
            isDynamic: linking?.isDynamic ?? existingConfig?.isDynamic,
          });
        }
      });

      const doRedeploy = () => {
        // Close the drawer immediately so the user isn't blocked waiting for redeploy.
        onClose();
        if (releaseId && displayType) {
          redeploy.mutate({ orgHandler, componentId, releaseId, type: displayType, releaseMgtReleaseId, releaseMgtDeploymentId });
        }
      };

      const saveCerts = () => {
        // Build cert mapping configurations
        const certConfigs: CertMappingConfig[] = [];
        for (const cert of linkedCerts) {
          for (const k of cert.keys) {
            certConfigs.push({
              key: `${cert.mountPath}/${k.mountedAs}`,
              isDynamic: false,
              configGroupId: cert.groupUuid,
              configKeyId: k.keyUuid,
              configGroupName: cert.groupName,
              configKeyName: k.key,
              isFile: true,
              isSensitive: false,
              values: [{ value: `\${${cert.groupName}.${k.key}}`, environmentUuid: envId }],
            });
          }
        }

        const certPayload: CertMapping = {
          projectId,
          componentId,
          envTemplateId: envId,
          deploymentTrackId,
          configurations: certConfigs,
          ...(existingCertMappings?.mappingId ? { mappingId: existingCertMappings.mappingId } : {}),
        };

        saveCertMappings.mutate(certPayload, {
          onSuccess: doRedeploy,
          onError: (err) => setSaveError(err instanceof Error ? err.message : 'Failed to save certificate mounts'),
        });
      };

      save.mutate(
        { projectId, componentId, envId, deploymentTrackId, configurations, commitHash },
        {
          onSuccess: saveCerts,
          onError: (err) => setSaveError(err instanceof Error ? err.message : 'Failed to save configuration'),
        },
      );
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep((s) => s - 1);
    else handleClose();
  };

  const renderConfigurations = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress size={32} color="primary" />
        </Box>
      );
    }
    if (isError || data === null) {
      return (
        <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Configuration schema is not available for this component.
          </Typography>
        </Box>
      );
    }
    if (!data?.jsonSchema || !parsedSchema) {
      return (
        <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No configurable values found for this component.
          </Typography>
        </Box>
      );
    }
    return (
      <>
        <ConfigForm
          schema={parsedSchema}
          valueMap={valueMap}
          validationMap={validationMap}
          sensitiveMap={sensitiveMap}
          setSensitiveMap={setSensitiveMap}
          configGroups={configGroups}
          linkingMap={linkingMap}
          setLinkingMap={setLinkingMap}
          handleValueChange={handleValueChange}
          handleValidationChange={handleValidationChange}
        />
        {saveError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {saveError}
          </Alert>
        )}
      </>
    );
  };

  const renderCertificateMount = () => <CertificateMountStep projectId={projectId} componentId={componentId} envId={envId} deploymentTrackId={deploymentTrackId} open={open} linkedCerts={linkedCerts} onChange={setLinkedCerts} />;

  const hasSchema = !isLoading && !isError && data !== null && !!data?.jsonSchema && !!parsedSchema;
  const hasRequiredMissing = Array.from(validationMap.values()).some((isValid) => !isValid);
  const isApplying = save.isPending || saveCertMappings.isPending || redeploy.isPending;
  const prevLabel = step === 1 ? 'Cancel' : 'Back';
  const nextLabel = step === 2 ? (isApplying ? 'Updating…' : 'Update') : 'Next';
  const nextDisabled = step === 1 ? hasRequiredMissing || isLoading : isApplying;

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} variant="temporary" sx={drawerSx}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="h5">Configurations</Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          {hasSchema &&
            step === 1 &&
            (importedFileName ? (
              <Chip label={importedFileName} onDelete={handleClearToml} size="small" variant="outlined" sx={{ maxWidth: 180 }} />
            ) : (
              <Button variant="outlined" size="small" startIcon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>
                Import config.toml
              </Button>
            ))}
          <IconButton size="small" aria-label="close" onClick={handleClose}>
            <X size={16} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Step indicator */}
      <StepIndicator step={step} steps={AUTOMATION_STEPS} />

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>{step === 1 ? renderConfigurations() : renderCertificateMount()}</Box>

      {/* Footer */}
      {hasSchema && (
        <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Button onClick={handlePrev}>{prevLabel}</Button>
          <Button variant="contained" onClick={handleNext} disabled={nextDisabled} startIcon={isApplying ? <CircularProgress color="inherit" size={16} /> : undefined}>
            {nextLabel}
          </Button>
        </Stack>
      )}
      <input ref={fileInputRef} type="file" accept=".toml" style={{ display: 'none' }} onChange={handleTomlImport} />
    </Drawer>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

const drawerSx = {
  '& .MuiDrawer-paper': {
    width: 440,
    position: 'fixed',
    top: 64,
    height: 'calc(100% - 64px)',
    borderLeft: '1px solid',
    borderColor: 'divider',
    display: 'flex',
    flexDirection: 'column',
  },
} as const;

export interface ConfigureDrawerProps {
  open: boolean;
  onClose: () => void;
  orgHandler: string;
  projectId: string;
  componentId: string;
  envId: string;
  versionId: string;
  componentName: string;
  projectHandler: string;
  commitHash?: string;
  releaseId?: string;
  displayType?: string;
  releaseMgtReleaseId?: string;
  releaseMgtDeploymentId?: string;
  isAutomation?: boolean;
  envTemplateId?: string;
}

export default function ConfigureDrawer(props: ConfigureDrawerProps) {
  if (props.isAutomation) {
    return (
      <AutomationConfigureDrawer
        open={props.open}
        onClose={props.onClose}
        projectId={props.projectId}
        componentId={props.componentId}
        envId={props.envTemplateId ?? props.envId}
        deploymentTrackId={props.versionId}
        commitHash={props.commitHash}
        orgHandler={props.orgHandler}
        releaseId={props.releaseId}
        displayType={props.displayType}
        releaseMgtReleaseId={props.releaseMgtReleaseId}
        releaseMgtDeploymentId={props.releaseMgtDeploymentId}
      />
    );
  }
  return <GenericServiceConfigureDrawer {...props} />;
}

function GenericServiceConfigureDrawer({
  open,
  onClose,
  orgHandler,
  projectId,
  componentId,
  envId,
  versionId,
  componentName,
  projectHandler: _projectHandler,
  commitHash,
  releaseId,
  displayType,
  releaseMgtReleaseId,
  releaseMgtDeploymentId,
}: ConfigureDrawerProps) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [managingEp, setManagingEp] = useState<GqlEnvEndpoint | null>(null);
  const [manageDrawerOpen, setManageDrawerOpen] = useState(false);
  const [manageApimId, setManageApimId] = useState<string | null>(null);

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    onClose();
  };

  const { data, isLoading, isError, error } = useGetConfigMgt(orgHandler, projectId, componentId, envId, versionId, componentName, commitHash, open);
  const { data: endpoints = [] } = useEnvEndpoints(open ? componentId : '', open ? versionId : '', open && releaseId ? releaseId : '');
  const queryClient = useQueryClient();
  const save = usePostConfigMgt();
  const redeploy = useRedeployDeployment();

  const fields = useMemo(() => parseSchema(data?.jsonSchema, data?.configurationMount), [data]);

  const defaultGroup = useMemo(() => {
    if (!data?.defaultPackage) return '';
    const [org, pkg] = data.defaultPackage.split('/');
    return org && pkg ? `${org}.${pkg}` : '';
  }, [data?.defaultPackage]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, ParsedField[]>();
    for (const f of fields) {
      if (!byGroup.has(f.group)) byGroup.set(f.group, []);
      byGroup.get(f.group)!.push(f);
    }
    return Array.from(byGroup.entries()).map(([group, groupFields]) => ({
      label: group === defaultGroup ? componentName : group,
      fields: groupFields,
    }));
  }, [fields, defaultGroup, componentName]);

  // Tracks whether we have seeded values for the current open session, so that
  // subsequent data refetches while the drawer is open don't clobber edits.
  const seededRef = useRef(false);

  // Reset UI state when the drawer opens; seed immediately if data is already available.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSaveError(null);
    setManagingEp(null);
    if (data !== undefined) {
      setValues(buildInitialValues(data?.configurationMount));
      seededRef.current = true;
    } else {
      seededRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // intentionally omit data — seeding on open only

  // Seed values when data arrives for the first time after the drawer opened.
  useEffect(() => {
    if (!open || seededRef.current || data === undefined) return;
    setValues(buildInitialValues(data?.configurationMount));
    seededRef.current = true;
  }, [open, data]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    setSaveError(null);
    if (!commitHash) {
      setSaveError('Cannot save: commit information is not available.');
      return;
    }
    if (releaseId && !displayType) {
      setSaveError('Cannot save: component type is not available.');
      return;
    }
    const configs: ConfigMgtSaveItem[] = fields
      .filter((f) => values[f.key] !== undefined && values[f.key] !== '')
      .map((f) => {
        const mountItem = data?.configurationMount?.find((c) => c.configKeyName === f.key);
        return {
          configKeyName: f.key,
          valueType: f.type,
          valueOrSource: values[f.key],
          isRequired: f.required,
          metadata: { isSecret: mountItem?.metadata?.isSecret ?? f.isSensitive },
          configPackageName: mountItem?.configPackageName ?? f.group.split('.')[1] ?? '',
          configPackageOrganization: mountItem?.configPackageOrganization ?? f.group.split('.')[0] ?? '',
        };
      });

    save.mutate(
      { orgHandler, projectId, componentId, envId, versionId, moduleName: componentName, commitHash, configs },
      {
        onSuccess: () => {
          if (releaseId) {
            redeploy.mutate(
              { orgHandler, componentId, releaseId, type: displayType!, releaseMgtReleaseId, releaseMgtDeploymentId },
              {
                onSettled: () => {
                  queryClient.invalidateQueries({ queryKey: ['envEndpoints'] });
                  queryClient.invalidateQueries({ queryKey: ['componentDeployment'] });
                  onClose();
                },
              },
            );
          } else {
            onClose();
          }
        },
        onError: (err) => setSaveError(err instanceof Error ? err.message : 'Failed to save configuration'),
      },
    );
  };

  const handleNext = () => {
    if (step < 2) setStep((s) => s + 1);
    else handleApply();
  };

  const handlePrev = () => {
    if (step > 1) setStep((s) => s - 1);
    else handleClose();
  };

  const handleSettings = (ep: GqlEnvEndpoint) => {
    setManageApimId(ep.apimId ?? null);
    setManageDrawerOpen(true);
  };

  // ── Step content ──────────────────────────────────────────────────────────

  const renderConfigurations = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress size={32} color="primary" />
        </Box>
      );
    }
    if (isError) {
      return <Alert severity="error">{error instanceof Error ? error.message : 'Failed to load configuration.'}</Alert>;
    }
    if (!fields.length) {
      return (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No configurable values found for this component.
          </Typography>
        </Box>
      );
    }
    return (
      <Box>
        <DefaultableConfigurablesAccordion groups={groups} values={values} onChange={handleChange} />
        {saveError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {saveError}
          </Alert>
        )}
      </Box>
    );
  };

  const renderEndpoints = () => {
    if (managingEp) {
      return <ManageEndpoint ep={managingEp} componentId={componentId} versionId={versionId} releaseId={releaseId ?? ''} onBack={() => setManagingEp(null)} />;
    }
    if (!endpoints.length) {
      return (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No endpoints available for this deployment.
          </Typography>
        </Box>
      );
    }
    return (
      <Box>
        {endpoints.map((ep, idx) => (
          <EndpointCard key={ep.id} ep={ep} defaultExpanded={idx === 0} onEdit={setManagingEp} onSettings={handleSettings} />
        ))}
      </Box>
    );
  };

  const stepContent = step === 1 ? renderConfigurations() : renderEndpoints();
  const prevLabel = step === 1 ? 'Cancel' : 'Back';
  const isApplying = save.isPending || redeploy.isPending;
  const nextLabel = step === 2 ? (isApplying ? 'Applying…' : 'Apply') : 'Next';
  const nextDisabled = (step === 1 && isLoading) || (step === 2 && isApplying);
  // Hide footer buttons when in ManageEndpoint (it has its own buttons)
  const showFooter = !(step === 2 && managingEp !== null);

  return (
    <>
      <Drawer anchor="right" open={open} onClose={handleClose} variant="temporary" sx={drawerSx}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="h5">Configure</Typography>
          <IconButton size="small" aria-label="close" onClick={handleClose}>
            <X size={16} />
          </IconButton>
        </Stack>

        {/* Step indicator */}
        <StepIndicator step={step} steps={STEPS} />

        {/* Scrollable content */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>{stepContent}</Box>

        {/* Footer */}
        {showFooter && (
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <Button onClick={handlePrev}>{prevLabel}</Button>
            <Button variant="contained" onClick={handleNext} disabled={nextDisabled} startIcon={step === 2 && isApplying ? <CircularProgress color="inherit" size={16} /> : undefined}>
              {nextLabel}
            </Button>
          </Stack>
        )}
      </Drawer>

      <ManageDrawer open={manageDrawerOpen} onClose={() => setManageDrawerOpen(false)} apimId={manageApimId} />
    </>
  );
}
