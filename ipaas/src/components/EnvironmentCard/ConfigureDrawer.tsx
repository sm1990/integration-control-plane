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

import { Alert, Box, Button, Chip, CircularProgress, Collapse, Drawer, IconButton, Stack, TextField, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronUp, Plus, X } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useSchemaConfig, type SchemaConfigItem } from '../../api/queries';
import { useSaveSchemaConfig } from '../../api/mutations';

interface FlatField {
  key: string;
  leafKey: string;
  parentPath: string;
  type: string;
  description?: string;
  required: boolean;
  isSensitive: boolean;
}

function flattenSchema(properties: Record<string, Record<string, unknown>>, required: string[], dotPrefix = '', slashPrefix = ''): FlatField[] {
  const fields: FlatField[] = [];
  for (const [name, prop] of Object.entries(properties)) {
    const dotKey = dotPrefix ? `${dotPrefix}.${name}` : name;
    const slashPath = slashPrefix ? `${slashPrefix}/${name}` : name;
    if (prop.type === 'object' && prop.properties) {
      fields.push(...flattenSchema(prop.properties, prop.required ?? [], dotKey, slashPath));
    } else {
      fields.push({
        key: dotKey,
        leafKey: name,
        parentPath: slashPrefix,
        type: prop.type === 'array' ? 'object[]' : (prop.type ?? 'string'),
        description: prop.description,
        required: required.includes(name),
        isSensitive: prop['x-sensitive'] ?? false,
      });
    }
  }
  return fields;
}

function parseFields(base64: string | undefined): FlatField[] {
  if (!base64) return [];
  try {
    const schema = JSON.parse(atob(base64));
    return flattenSchema(schema.properties ?? {}, schema.required ?? []);
  } catch {
    return [];
  }
}

// Groups fields by parentPath, returns [{groupPath, fields}] sorted by groupPath
function groupFields(fields: FlatField[]): { groupPath: string; fields: FlatField[] }[] {
  const map = new Map<string, FlatField[]>();
  for (const f of fields) {
    const g = f.parentPath || f.leafKey;
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(f);
  }
  return Array.from(map.entries()).map(([groupPath, fields]) => ({ groupPath, fields }));
}

interface FieldRowProps {
  field: FlatField;
  value: string;
  onChange: (v: string) => void;
}

function FieldRow({ field, value, onChange }: FieldRowProps) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {field.leafKey}
        </Typography>
        <Chip label={field.type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
      </Stack>
      {field.description && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.25 }}>
          {field.description}
        </Typography>
      )}
      {field.type === 'object[]' ? (
        <Button variant="outlined" size="small" startIcon={<Plus size={12} />} sx={{ mt: 0.25 }}>
          Add
        </Button>
      ) : (
        <TextField size="small" fullWidth type={field.isSensitive ? 'password' : 'text'} placeholder="Enter a value" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Box>
  );
}

interface FieldGroupProps {
  groupPath: string;
  fields: FlatField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function FieldGroup({ groupPath, fields, values, onChange }: FieldGroupProps) {
  const [open, setOpen] = useState(true);
  return (
    <Box sx={{ mx: 1.5, mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" onClick={() => setOpen((p) => !p)} sx={{ px: 1.5, py: 0.75, cursor: 'pointer', userSelect: 'none', borderBottom: open ? '1px solid' : 'none', borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {groupPath}
        </Typography>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 1 }}>
          {fields.map((field) => (
            <FieldRow key={field.key} field={field} value={values[field.key] ?? ''} onChange={(v) => onChange(field.key, v)} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

interface SectionProps {
  title: string;
  groups: { groupPath: string; fields: FlatField[] }[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  defaultOpen?: boolean;
}

function Section({ title, groups, values, onChange, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (groups.length === 0) return null;
  return (
    <Box sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" onClick={() => setOpen((p) => !p)} sx={{ px: 2, py: 1.25, cursor: 'pointer', userSelect: 'none' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ pt: 1 }}>
          {groups.map(({ groupPath, fields }) => (
            <FieldGroup key={groupPath} groupPath={groupPath} fields={fields} values={values} onChange={onChange} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

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
  projectId: string;
  componentId: string;
  envId: string;
  deploymentTrackId: string;
  commitHash?: string;
}

export default function ConfigureDrawer({ open, onClose, projectId, componentId, envId, deploymentTrackId, commitHash }: ConfigureDrawerProps) {
  const { data, isLoading, isError } = useSchemaConfig(projectId, componentId, envId, deploymentTrackId, commitHash);
  const save = useSaveSchemaConfig();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const fields = useMemo(() => parseFields(data?.jsonSchema), [data?.jsonSchema]);
  const requiredFields = useMemo(() => fields.filter((f) => f.required), [fields]);
  const optionalFields = useMemo(() => fields.filter((f) => !f.required), [fields]);
  const requiredGroups = useMemo(() => groupFields(requiredFields), [requiredFields]);
  const optionalGroups = useMemo(() => groupFields(optionalFields), [optionalFields]);

  useEffect(() => {
    if (open) {
      setSaveError(null);
      const initial: Record<string, string> = {};
      if (data?.configurations) {
        for (const cfg of data.configurations) {
          initial[cfg.key] = cfg.values?.[0]?.value ?? '';
        }
      }
      setValues(initial);
    }
  }, [open, data]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSaveError(null);
    const configurations: SchemaConfigItem[] = fields.filter((f) => f.type !== 'object[]' && values[f.key] !== undefined && values[f.key] !== '').map((f) => ({ key: f.key, values: [{ environmentUuid: envId, value: values[f.key] }] }));
    save.mutate(
      { projectId, componentId, envId, deploymentTrackId, configurations, commitHash },
      {
        onSuccess: onClose,
        onError: (err) => setSaveError(err instanceof Error ? err.message : 'Failed to save configuration'),
      },
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
          <CircularProgress size={32} />
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

    if (!data?.jsonSchema || fields.length === 0) {
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
        <Section title="Required" groups={requiredGroups} values={values} onChange={handleChange} />
        <Section title="Optional" groups={optionalGroups} values={values} onChange={handleChange} defaultOpen={false} />
        {saveError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {saveError}
          </Alert>
        )}
      </>
    );
  };

  const hasSchema = !isLoading && !isError && data !== null && !!data?.jsonSchema && fields.length > 0;
  const hasRequiredMissing = requiredFields.some((f) => !values[f.key]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} variant="temporary" sx={drawerSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Configurations
        </Typography>
        <IconButton size="small" aria-label="close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>{renderContent()}</Box>

      {hasSchema && (
        <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={save.isPending || hasRequiredMissing}>
            {save.isPending ? 'Saving…' : 'Update'}
          </Button>
        </Stack>
      )}
    </Drawer>
  );
}
