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

import { Box, Button, Chip, FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel, MenuItem, Select, Switch, TextField, Typography } from '@wso2/oxygen-ui';
import { Eye, EyeOff, Lock, Unlock } from '@wso2/oxygen-ui-icons-react';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import type { CertGroup } from '../../../api/queries';
import type { LinkingInfo } from '../ConfigForm';
import { type BaseType, isNumberType, type JSONSchema, typeDisplayName } from '../schemaUtils';

interface BaseElementProps {
  type: string;
  title: string;
  jsonPath: string;
  valueMap: Map<string, BaseType>;
  validationMap: Map<string, boolean>;
  handleValueChange: (key: string, value: BaseType, valueMap?: Map<string, BaseType>) => void;
  handleValidationChange: (jsonPath: string, isValid: boolean) => void;
  isRequired?: boolean;
  isRequiredAtRequiredLevel: boolean;
  schema?: JSONSchema;
  isFirstElement?: boolean;
  isSkipLabel?: boolean;
  allowLinking?: boolean;
  configGroups?: CertGroup[];
  linkingMap?: Map<string, LinkingInfo>;
  setLinkingMap?: Dispatch<SetStateAction<Map<string, LinkingInfo>>>;
  sensitiveMap?: Map<string, boolean>;
  setSensitiveMap?: Dispatch<SetStateAction<Map<string, boolean>>>;
}

export function BaseElement({
  type,
  title,
  jsonPath,
  valueMap,
  validationMap,
  handleValueChange,
  handleValidationChange,
  isRequired,
  isRequiredAtRequiredLevel,
  schema,
  isSkipLabel,
  allowLinking,
  configGroups,
  linkingMap,
  setLinkingMap,
  sensitiveMap,
  setSensitiveMap,
}: BaseElementProps) {
  const currentValue = valueMap.get(jsonPath);
  const isSensitiveFromMap = sensitiveMap?.get(jsonPath) ?? false;
  const isSensitiveType = type === 'secret';
  const linkedInfo = linkingMap?.get(jsonPath);
  const isLinked = !!linkedInfo?.configGroupId && !!linkedInfo?.configKeyId && linkedInfo?.isDynamic !== true;
  const selectedGroup = configGroups?.find((group) => group.groupUuid === linkedInfo?.configGroupId);
  const selectedConfigKey = selectedGroup?.configurations.find((configKey) => configKey.keyUuid === linkedInfo?.configKeyId);

  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  const isSensitive = isSensitiveType || isSensitiveFromMap;

  useEffect(() => {
    // Validate on mount/update
    if (isLinked) {
      const currentValid = validationMap.get(jsonPath);
      if (currentValid !== true) {
        handleValidationChange(jsonPath, true);
      }
    } else if (isRequired && isRequiredAtRequiredLevel) {
      const hasValue = currentValue !== undefined && currentValue !== '' && currentValue !== null;
      const currentValid = validationMap.get(jsonPath);
      if (currentValid !== hasValue) {
        handleValidationChange(jsonPath, hasValue);
      }
    } else {
      const currentValid = validationMap.get(jsonPath);
      if (currentValid !== true) {
        handleValidationChange(jsonPath, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonPath, isRequired, isRequiredAtRequiredLevel, isLinked]);

  const handleChange = (value: BaseType) => {
    setTouched(true);
    handleValueChange(jsonPath, value);
    if (isRequired && isRequiredAtRequiredLevel) {
      const hasValue = value !== undefined && value !== '' && value !== null;
      handleValidationChange(jsonPath, hasValue);
    } else {
      handleValidationChange(jsonPath, true);
    }
  };

  const handleToggleSensitive = () => {
    if (!setSensitiveMap) return;
    setSensitiveMap((prev) => {
      const next = new Map(prev);
      next.set(jsonPath, !isSensitiveFromMap);
      return next;
    });
  };

  const hasError = touched && isRequired && isRequiredAtRequiredLevel && (currentValue === undefined || currentValue === '');

  const typeLabel = typeDisplayName(type);
  const chipColor = isSensitiveType ? 'info' : 'default';

  const lockAdornment =
    !isSensitiveType && setSensitiveMap ? (
      <InputAdornment position="end">
        <IconButton size="small" onClick={handleToggleSensitive} aria-label={isSensitiveFromMap ? 'Mark as non-sensitive' : 'Mark as sensitive'}>
          {isSensitiveFromMap ? <Lock size={14} /> : <Unlock size={14} />}
        </IconButton>
      </InputAdornment>
    ) : null;

  const visibilityAdornment = isSensitive ? (
    <InputAdornment position="end">
      <IconButton size="small" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide value' : 'Show value'}>
        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
      </IconButton>
    </InputAdornment>
  ) : null;

  const combinedEndAdornment = isSensitive ? visibilityAdornment : lockAdornment;
  const shouldShowLinking = !!allowLinking && !!configGroups?.length;

  const updateLinking = (groupId?: string, keyId?: string) => {
    if (!setLinkingMap) return;

    setLinkingMap((prev) => {
      const next = new Map(prev);
      if (!groupId || !keyId) {
        next.delete(jsonPath);
      } else {
        next.set(jsonPath, { configGroupId: groupId, configKeyId: keyId, isDynamic: false });
      }
      return next;
    });

    if (!groupId || !keyId) {
      handleValueChange(jsonPath, '');
      if (isRequired && isRequiredAtRequiredLevel) {
        handleValidationChange(jsonPath, false);
      }
      return;
    }

    const group = configGroups?.find((item) => item.groupUuid === groupId);
    const configKey = group?.configurations.find((item) => item.keyUuid === keyId);
    if (group?.groupName && configKey?.key) {
      handleValueChange(jsonPath, `$${group.groupName}.${configKey.key}`);
      handleValidationChange(jsonPath, true);
    }
  };

  if (type === 'boolean') {
    const boolValue = currentValue === true || currentValue === 'true';
    return (
      <Box sx={{ mt: 1 }}>
        {!isSkipLabel && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            <Chip label={typeLabel} size="small" variant="outlined" color={chipColor} sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
          </Box>
        )}
        <FormControlLabel control={<Switch size="small" checked={boolValue} onChange={(e) => handleChange(e.target.checked)} />} label={boolValue ? 'true' : 'false'} />
      </Box>
    );
  }

  if (schema?.enum && schema.enum.length > 0) {
    const enumValue = currentValue !== undefined ? String(currentValue) : '';
    return (
      <Box sx={{ mt: 1 }}>
        {!isSkipLabel && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            <Chip label={typeLabel} size="small" variant="outlined" color={chipColor} sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
          </Box>
        )}
        <FormControl size="small" fullWidth error={hasError}>
          <InputLabel id={`${jsonPath}-label`}>{isSkipLabel ? '' : 'Select value'}</InputLabel>
          <Select labelId={`${jsonPath}-label`} value={enumValue} label={isSkipLabel ? '' : 'Select value'} onChange={(e) => handleChange(e.target.value as string)} onBlur={() => setTouched(true)}>
            {schema.enum.map((opt) => (
              <MenuItem key={String(opt)} value={String(opt)}>
                {String(opt)}
              </MenuItem>
            ))}
          </Select>
          {hasError && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
              {title} is required
            </Typography>
          )}
        </FormControl>
      </Box>
    );
  }

  const inputType = isSensitive && !showPassword ? 'password' : isNumberType(type) ? 'number' : 'text';
  const stringValue = currentValue !== undefined ? String(currentValue) : '';

  return (
    <Box sx={{ mt: 1 }}>
      {shouldShowLinking && (
        <Box sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Config Group Link
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: isLinked ? 1 : 0 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id={`${jsonPath}-group-label`}>Group</InputLabel>
              <Select labelId={`${jsonPath}-group-label`} value={linkedInfo?.configGroupId ?? ''} label="Group" onChange={(e) => updateLinking(e.target.value as string, '')}>
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {configGroups?.map((group) => (
                  <MenuItem key={group.groupUuid} value={group.groupUuid}>
                    {group.groupDisplayName || group.groupName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={!linkedInfo?.configGroupId}>
              <InputLabel id={`${jsonPath}-config-key-label`}>Key</InputLabel>
              <Select labelId={`${jsonPath}-config-key-label`} value={linkedInfo?.configKeyId ?? ''} label="Key" onChange={(e) => updateLinking(linkedInfo?.configGroupId, e.target.value as string)}>
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {selectedGroup?.configurations.map((configKey) => (
                  <MenuItem key={configKey.keyUuid} value={configKey.keyUuid}>
                    {configKey.key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {isLinked && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Linked to {selectedGroup?.groupName}.{selectedConfigKey?.key}
              </Typography>
              <Button size="small" variant="text" color="inherit" onClick={() => updateLinking(undefined, undefined)}>
                Unlink
              </Button>
            </Box>
          )}
        </Box>
      )}
      {!isSkipLabel && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {title}
          </Typography>
          <Chip label={typeLabel} size="small" variant="outlined" color={chipColor} sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
        </Box>
      )}
      {isSkipLabel && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Chip label={typeLabel} size="small" variant="outlined" color={chipColor} sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
        </Box>
      )}
      <TextField
        size="small"
        fullWidth
        type={inputType}
        placeholder={`Enter ${isSensitive ? 'secret' : typeLabel} value`}
        value={stringValue}
        disabled={isLinked}
        onChange={(e) => {
          const val = isNumberType(type) ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value;
          handleChange(val as BaseType);
        }}
        onBlur={() => setTouched(true)}
        error={hasError}
        helperText={hasError ? `${title} is required` : undefined}
        InputProps={{
          endAdornment: combinedEndAdornment,
        }}
      />
    </Box>
  );
}

export default BaseElement;
