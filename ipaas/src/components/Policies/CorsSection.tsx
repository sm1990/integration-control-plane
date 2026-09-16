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

import { Autocomplete, Checkbox, Chip, Collapse, FormControlLabel, Stack, Switch, TextField, Typography } from '@wso2/oxygen-ui';
import type { ReactNode } from 'react';
import { CORS_METHOD_OPTIONS, DEFAULT_CORS_HEADERS } from '../../constants/policy';
import type { CorsConfig } from '../../types/policy';
import { allowsAllOrigins } from '../../utils/policy';

interface CorsSectionProps {
  value: CorsConfig;
  onChange: (value: CorsConfig) => void;
  disabled?: boolean;
}

function TagField({ label, placeholder, options, values, onChange, disabled }: { label: string; placeholder: string; options: string[]; values: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <Autocomplete
      multiple
      freeSolo
      disableCloseOnSelect
      options={options}
      value={values}
      disabled={disabled}
      onChange={(_, v) => onChange(v as string[])}
      renderTags={(tags: string[], getTagProps) =>
        tags.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return <Chip key={key} label={option} size="small" variant="outlined" {...tagProps} />;
        })
      }
      renderInput={(params) => <TextField {...params} size="small" label={label} placeholder={values.length === 0 ? placeholder : ''} />}
    />
  );
}

/**
 * Editor for the MCP API's CORS configuration. Controlled by the parent page
 * so it can track dirty state and save the whole API in one PUT.
 */
export default function CorsSection({ value, onChange, disabled }: CorsSectionProps): ReactNode {
  const wildcardOrigins = allowsAllOrigins(value);
  return (
    <Stack gap={1.5}>
      <FormControlLabel control={<Switch size="small" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} disabled={disabled} />} label={<Typography variant="body2">Enable CORS</Typography>} />

      <Collapse in={value.enabled} unmountOnExit>
        <Stack gap={2} sx={{ pl: 0.5 }}>
          {/* Ticking allow-all clears credentials in the model, not just in the view. */}
          <FormControlLabel
            control={<Checkbox size="small" checked={value.allowAllOrigins} onChange={(e) => onChange({ ...value, allowAllOrigins: e.target.checked, allowCredentials: e.target.checked ? false : value.allowCredentials })} disabled={disabled} />}
            label={<Typography variant="body2">Allow all origins (*)</Typography>}
          />

          {!value.allowAllOrigins && <TagField label="Access control allow origins" placeholder="e.g. https://app.example.com" options={[]} values={value.origins} onChange={(v) => onChange({ ...value, origins: v })} disabled={disabled} />}

          <TagField label="Access control allow headers" placeholder="Add a header" options={DEFAULT_CORS_HEADERS} values={value.headers} onChange={(v) => onChange({ ...value, headers: v })} disabled={disabled} />

          <TagField label="Access control allow methods" placeholder="Add a method" options={CORS_METHOD_OPTIONS} values={value.methods} onChange={(v) => onChange({ ...value, methods: v })} disabled={disabled} />

          {/* Credentials + a wildcard origin makes the gateway 500 every request, so don't offer it. */}
          <FormControlLabel
            control={<Checkbox size="small" checked={value.allowCredentials && !wildcardOrigins} onChange={(e) => onChange({ ...value, allowCredentials: e.target.checked })} disabled={disabled || wildcardOrigins} />}
            label={
              <Typography variant="body2" color={wildcardOrigins ? 'text.disabled' : undefined}>
                Allow credentials{wildcardOrigins ? ' — unavailable while all origins are allowed' : ''}
              </Typography>
            }
          />
        </Stack>
      </Collapse>
    </Stack>
  );
}
