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

import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Popover, Stack, Typography } from '@wso2/oxygen-ui';
import { Edit, Plus, Trash2 } from '@wso2/oxygen-ui-icons-react';
import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import type { CertGroup } from '../../../api/queries';
import type { LinkingInfo } from '../ConfigForm';
import { type BaseType, extractAllKeySet, extractUniqueKeySet, type JSONSchema, setArrayType, typeDisplayName } from '../schemaUtils';
import { BaseElement } from './BaseElement';

// Forward declare to avoid circular import issues at module level
// ObjectElement and AnyOfElement are imported lazily via ConfigElement
import { ConfigElement } from './ConfigElement';

interface ArrayElementProps {
  type: string;
  title: string;
  schema: JSONSchema | undefined;
  valueMap: Map<string, BaseType>;
  validationMap: Map<string, boolean>;
  jsonPath: string;
  allowLinking?: boolean;
  configGroups?: CertGroup[];
  linkingMap?: Map<string, LinkingInfo>;
  setLinkingMap?: Dispatch<SetStateAction<Map<string, LinkingInfo>>>;
  sensitiveMap?: Map<string, boolean>;
  setSensitiveMap?: Dispatch<SetStateAction<Map<string, boolean>>>;
  handleValueChange: (key: string, value: BaseType, valueMap?: Map<string, BaseType>) => void;
  handleValidationChange: (jsonPath: string, isValid: boolean, validationMap?: Map<string, boolean>) => void;
  disableAddButton?: boolean;
  isRequiredAtRequiredLevel: boolean;
}

interface ArrayItemProps {
  itemKey: string;
  schema: JSONSchema;
  valueMap: Map<string, BaseType>;
  validationMap: Map<string, boolean>;
  handleValueChange: (key: string, value: BaseType, valueMap?: Map<string, BaseType>) => void;
  handleValidationChange: (key: string, isValid: boolean, validMap?: Map<string, boolean>) => void;
  onDelete: (key: string) => void;
  isRequiredAtRequiredLevel: boolean;
  allowLinking?: boolean;
  configGroups?: CertGroup[];
  linkingMap?: Map<string, LinkingInfo>;
  setLinkingMap?: Dispatch<SetStateAction<Map<string, LinkingInfo>>>;
  sensitiveMap?: Map<string, boolean>;
  setSensitiveMap?: Dispatch<SetStateAction<Map<string, boolean>>>;
}

function ArrayItem({ itemKey, schema, valueMap, validationMap, handleValueChange, handleValidationChange, onDelete, isRequiredAtRequiredLevel, allowLinking, configGroups, linkingMap, setLinkingMap, sensitiveMap, setSensitiveMap }: ArrayItemProps) {
  const type = schema.type || 'string';

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
      <Box sx={{ flex: 1 }}>
        {schema.anyOf ? (
          // Handled by ConfigElement below
          <ConfigElement
            schema={schema}
            type="anyOf"
            title=""
            jsonPath={itemKey}
            valueMap={valueMap}
            validationMap={validationMap}
            handleValueChange={handleValueChange}
            handleValidationChange={handleValidationChange}
            isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
            allowLinking={allowLinking}
            configGroups={configGroups}
            linkingMap={linkingMap}
            setLinkingMap={setLinkingMap}
            sensitiveMap={sensitiveMap}
            setSensitiveMap={setSensitiveMap}
            propertyKey=""
            isSkipLabel
          />
        ) : (
          <BaseElement
            title=""
            type={type}
            jsonPath={itemKey}
            valueMap={valueMap}
            validationMap={validationMap}
            handleValueChange={handleValueChange}
            handleValidationChange={handleValidationChange}
            isRequired
            isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
            schema={schema}
            isSkipLabel
            allowLinking={allowLinking}
            configGroups={configGroups}
            linkingMap={linkingMap}
            setLinkingMap={setLinkingMap}
            sensitiveMap={sensitiveMap}
            setSensitiveMap={setSensitiveMap}
          />
        )}
      </Box>
      <Box sx={{ pt: 1 }}>
        <IconButton size="small" color="error" onClick={() => onDelete(itemKey)} aria-label="delete array element">
          <Trash2 size={14} />
        </IconButton>
      </Box>
    </Box>
  );
}

export function ArrayElement({
  title,
  schema,
  valueMap,
  validationMap,
  jsonPath,
  allowLinking,
  configGroups,
  linkingMap,
  setLinkingMap,
  sensitiveMap,
  setSensitiveMap,
  handleValueChange,
  handleValidationChange,
  disableAddButton,
  isRequiredAtRequiredLevel,
}: ArrayElementProps) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [localValueMap, setLocalValueMap] = useState<Map<string, BaseType>>(new Map());
  const [localValidationMap, setLocalValidationMap] = useState<Map<string, boolean>>(new Map());
  const [uniqueKeySet, setUniqueKeySet] = useState<Set<string>>(new Set());
  const [deletedIndexArray, setDeletedIndexArray] = useState<number[]>([]);
  const [isAddNewArrayElement, setIsAddNewArrayElement] = useState(false);
  const [isDisableSaveBtn, setIsDisableSaveBtn] = useState(true);

  const safeSchema: JSONSchema = schema ?? { type: 'string' };
  const chipType = setArrayType(typeDisplayName(safeSchema.type));

  const onAddArrayElement = useCallback(() => {
    let maxIndex = Array.from(uniqueKeySet).reduce((max, key) => {
      const match = key.match(/\[(\d+)\]$/);
      const idx = match ? parseInt(match[1], 10) : -1;
      return idx > max ? idx : max;
    }, -1);

    const deletedMaxIndex = Math.max(...deletedIndexArray, -1);
    if (deletedMaxIndex > maxIndex) {
      maxIndex = deletedMaxIndex;
    }
    const newJsonPath = `${jsonPath.replace('[*]', '')}[${maxIndex + 1}]`;
    setUniqueKeySet((prevSet) => {
      const next = new Set(prevSet);
      next.add(newJsonPath);
      return next;
    });
  }, [uniqueKeySet, deletedIndexArray, jsonPath]);

  const resetLocalValueMap = useCallback(
    (configValueMap: Map<string, BaseType>, configValidationMap: Map<string, boolean>) => {
      if (!configValueMap || configValueMap.size === 0) {
        setLocalValueMap(new Map());
        setLocalValidationMap(new Map());
        return;
      }
      const allKeys = extractAllKeySet(configValueMap, jsonPath);
      const localConfigValueMap = new Map<string, BaseType>();
      const localConfigValidationMap = new Map<string, boolean>();

      allKeys.forEach((key) => {
        localConfigValueMap.set(key, configValueMap.get(key) ?? '');
        localConfigValidationMap.set(key, configValidationMap.get(key) || false);
      });
      setLocalValueMap(localConfigValueMap);
      setLocalValidationMap(localConfigValidationMap);
      const uniqueKeys = extractUniqueKeySet(configValueMap, jsonPath);
      if (uniqueKeys.size === 0) {
        if (!isAddNewArrayElement) {
          const initialPath = `${jsonPath.replace('[*]', '')}[0]`;
          setUniqueKeySet((prevSet) => {
            const next = new Set(prevSet);
            next.add(initialPath);
            return next;
          });
          setIsAddNewArrayElement(true);
        }
      } else {
        setUniqueKeySet(uniqueKeys);
        if (isAddNewArrayElement) {
          setIsAddNewArrayElement(false);
        }
      }
    },
    [jsonPath, isAddNewArrayElement],
  );

  useEffect(() => {
    let isDisable = false;
    uniqueKeySet.forEach((uniqueKey) => {
      localValidationMap.forEach((value, k) => {
        if (k.startsWith(uniqueKey)) {
          if (!value) {
            isDisable = true;
          }
        }
      });
    });
    setIsDisableSaveBtn(isDisable);
  }, [localValidationMap, uniqueKeySet]);

  const handleLocalValidationChange = (key: string, isValid: boolean, configValidationMap?: Map<string, boolean>) => {
    if (configValidationMap) {
      setLocalValidationMap(configValidationMap);
    } else {
      setLocalValidationMap((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(key, isValid);
        return newMap;
      });
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setOpen(false);
    setTimeout(() => resetLocalValueMap(valueMap, validationMap), 500);
  };

  const handleLocalValueChange = (key: string, value: BaseType, configMap?: Map<string, BaseType>) => {
    if (configMap) {
      setLocalValueMap(configMap);
    } else {
      setLocalValueMap((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(key, value ?? '');
        return newMap;
      });
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setOpen(true);
    setAnchorEl(event.currentTarget);
    if (!isAddNewArrayElement && uniqueKeySet.size === 0) {
      onAddArrayElement();
      setIsAddNewArrayElement(true);
    }
  };

  const handleOnValueAdd = () => {
    const newGlobalValueMap = new Map(valueMap);
    const newGlobalValidationMap = new Map(validationMap);
    const jsonPathPrefix = jsonPath.substring(0, jsonPath.length - 4);
    let rebaseIndexCounter = 0;

    for (let i = 0; i < uniqueKeySet.size + deletedIndexArray.length; i += 1) {
      const currentJsonPath = `${jsonPathPrefix}.[${i}]`;
      if (deletedIndexArray.includes(i)) {
        valueMap.forEach((_, k) => {
          if (k.startsWith(currentJsonPath)) {
            newGlobalValueMap.delete(k);
            newGlobalValidationMap.delete(k);
          }
        });
        rebaseIndexCounter += 1;
      } else {
        const newJsonPath = `${jsonPathPrefix}.[${i - rebaseIndexCounter}]`;
        localValueMap.forEach((_, k) => {
          if (k.startsWith(currentJsonPath)) {
            newGlobalValueMap.delete(k);
            newGlobalValidationMap.delete(k);
            newGlobalValueMap.set(newJsonPath + k.substring(currentJsonPath.length), localValueMap.get(k) ?? '');
            newGlobalValidationMap.set(newJsonPath + k.substring(currentJsonPath.length), localValidationMap.get(k) || false);
          }
        });
      }
    }

    const mergedValueMap = new Map(valueMap);
    const mergedValidationMap = new Map(validationMap);

    valueMap.forEach((_, key) => {
      if (key.startsWith(jsonPathPrefix)) {
        mergedValueMap.delete(key);
      }
    });

    validationMap.forEach((_, key) => {
      if (key.startsWith(jsonPathPrefix)) {
        mergedValidationMap.delete(key);
      }
    });

    newGlobalValueMap.forEach((val, key) => {
      mergedValueMap.set(key, val);
    });

    newGlobalValidationMap.forEach((isValid, key) => {
      mergedValidationMap.set(key, isValid);
    });

    handleValueChange('', '', mergedValueMap);
    handleValidationChange('', false, mergedValidationMap);
    setOpen(false);
    setAnchorEl(null);
    setDeletedIndexArray([]);
  };

  const onDeleteArrayElement = (deletedJsonPath: string) => {
    const match = deletedJsonPath.match(/\[(\d+)\]$/);
    const deletedIndex = match ? parseInt(match[1], 10) : -1;

    setUniqueKeySet((prevSet) => {
      const newSet = new Set(prevSet);
      newSet.delete(deletedJsonPath);
      return newSet;
    });

    if (deletedIndex >= 0) {
      setDeletedIndexArray((prevArray) => [...prevArray, deletedIndex]);
    }
  };

  useEffect(() => {
    resetLocalValueMap(valueMap, validationMap);
  }, [valueMap, validationMap, resetLocalValueMap]);

  const useDialogFallback = !anchorEl;
  const popoverId = open ? `${jsonPath}-popover` : undefined;

  const popoverContent = (
    <Box sx={{ p: 2, minWidth: 320, maxWidth: 480 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Add Values
      </Typography>
      {Array.from(uniqueKeySet)
        .sort()
        .map((key) => (
          <ArrayItem
            key={key}
            itemKey={key}
            schema={safeSchema}
            valueMap={localValueMap}
            validationMap={localValidationMap}
            handleValueChange={handleLocalValueChange}
            handleValidationChange={handleLocalValidationChange}
            onDelete={onDeleteArrayElement}
            isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
            allowLinking={allowLinking}
            configGroups={configGroups}
            linkingMap={linkingMap}
            setLinkingMap={setLinkingMap}
            sensitiveMap={sensitiveMap}
            setSensitiveMap={setSensitiveMap}
          />
        ))}
      <Button variant="text" size="small" startIcon={<Plus size={14} />} onClick={onAddArrayElement} sx={{ mt: 1 }}>
        Add
      </Button>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mt: 2 }}>
        <Button size="small" onClick={handleClose}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={handleOnValueAdd} disabled={isDisableSaveBtn}>
          Save
        </Button>
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        <Chip label={chipType} size="small" variant="outlined" color="default" sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.75 }} />
        <Box sx={{ flex: 1 }} />
        <Button variant="text" size="small" disabled={disableAddButton} startIcon={uniqueKeySet.size === 0 || isAddNewArrayElement ? <Plus size={14} /> : <Edit size={14} />} onClick={handleClick}>
          {uniqueKeySet.size === 0 || isAddNewArrayElement ? 'Add' : 'Edit'}
        </Button>
      </Box>

      {useDialogFallback ? (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>Add Values</DialogTitle>
          <DialogContent>{popoverContent}</DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleOnValueAdd} disabled={isDisableSaveBtn}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      ) : (
        <Popover id={popoverId} open={open} anchorEl={anchorEl} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {popoverContent}
        </Popover>
      )}
    </Box>
  );
}

// Need a ref to avoid circular import at module load time
const _ref = { ConfigElement };
void _ref;

export default ArrayElement;
