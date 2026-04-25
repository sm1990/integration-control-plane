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

import { Box, Collapse, FormControlLabel, Stack, Switch, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronUp } from '@wso2/oxygen-ui-icons-react';
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useState } from 'react';
import { ConfigElement } from './FormElements/ConfigElement';
import { type BaseType, type JSONSchema, type SchemaAtLevel, getSchemasAtLevel } from './schemaUtils';
import type { CertGroup } from '../../api/queries';

export interface LinkingInfo {
  configGroupId?: string;
  configKeyId?: string;
  isDynamic?: boolean;
}

export interface ConfigFormProps {
  schema: JSONSchema;
  valueMap: Map<string, BaseType>;
  validationMap: Map<string, boolean>;
  sensitiveMap: Map<string, boolean>;
  setSensitiveMap: Dispatch<SetStateAction<Map<string, boolean>>>;
  configGroups?: CertGroup[];
  linkingMap?: Map<string, LinkingInfo>;
  setLinkingMap?: Dispatch<SetStateAction<Map<string, LinkingInfo>>>;
  handleValueChange: (key: string, value: BaseType, configMap?: Map<string, BaseType>) => void;
  handleValidationChange: (key: string, isValid: boolean, validationMap?: Map<string, boolean>) => void;
}

interface SectionCardProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function SectionCard({ title, children, defaultOpen = true }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" onClick={() => setOpen((prev) => !prev)} sx={{ px: 2, py: 1.25, cursor: 'pointer', userSelect: 'none' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ pt: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

interface GroupCardProps {
  title: string;
  children: ReactNode;
}

function GroupCard({ title, children }: GroupCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <Box sx={{ mx: 1.5, mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" onClick={() => setOpen((prev) => !prev)} sx={{ px: 1.5, py: 0.75, cursor: 'pointer', userSelect: 'none', borderBottom: open ? '1px solid' : 'none', borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {title}
        </Typography>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

export function ConfigForm({ schema, valueMap, validationMap, sensitiveMap, setSensitiveMap, configGroups, linkingMap, setLinkingMap, handleValueChange, handleValidationChange }: ConfigFormProps) {
  const [isRequiredKeysInSchema, setIsRequiredKeysInSchema] = useState(false);
  const [isOptionalKeysInSchema, setIsOptionalKeysInSchema] = useState(false);
  const [schemasAtLevel, setSchemasAtLevel] = useState<SchemaAtLevel[]>([]);
  const [allowLinking, setAllowLinking] = useState(false);

  useEffect(() => {
    const targetLevel = schema.requiredLevel || 1;
    const schemas = getSchemasAtLevel(schema, targetLevel);
    setSchemasAtLevel(schemas);

    let hasRequired = false;
    let hasOptional = false;

    schemas.forEach(({ schema: levelSchema }) => {
      if (levelSchema.properties) {
        const required = levelSchema.required || [];
        const allProps = Object.keys(levelSchema.properties);

        if (required.length > 0) {
          hasRequired = true;
        }

        if (allProps.length > required.length) {
          hasOptional = true;
        }
      }
    });
    setIsRequiredKeysInSchema(hasRequired);
    setIsOptionalKeysInSchema(hasOptional);
  }, [schema]);

  useEffect(() => {
    if (linkingMap && linkingMap.size > 0) {
      setAllowLinking(true);
    }
  }, [linkingMap]);

  const renderConfigElements = (levelSchema: JSONSchema, path: string, isRequiredSection: boolean) => {
    if (!levelSchema.properties) return null;

    const required = levelSchema.required || [];
    const targetLevel = schema.requiredLevel || 1;

    const relevantKeys = Object.keys(levelSchema.properties).filter((key) => {
      const inRequired = required.includes(key);
      return isRequiredSection ? inRequired : !inRequired;
    });

    if (relevantKeys.length === 0) return null;

    if (targetLevel === 1) {
      return relevantKeys.map((key, index) => {
        const property = levelSchema.properties![key];
        const type = property.type || 'anyOf';
        const itemTitle = property.title || key;
        const fullPath = path ? `${path}.${key}` : key;

        return (
          <ConfigElement
            key={fullPath}
            title={itemTitle}
            type={type}
            schema={levelSchema}
            jsonPath={fullPath}
            propertyKey={key}
            valueMap={valueMap}
            handleValueChange={handleValueChange}
            validationMap={validationMap}
            handleValidationChange={handleValidationChange}
            isRequired={isRequiredSection}
            isRequiredAtRequiredLevel={isRequiredSection}
            isFirstElement={index === 0}
            sensitiveMap={sensitiveMap}
            setSensitiveMap={setSensitiveMap}
            allowLinking={allowLinking}
            configGroups={configGroups}
            linkingMap={linkingMap}
            setLinkingMap={setLinkingMap}
          />
        );
      });
    }

    return (
      <GroupCard key={`${path}-${isRequiredSection ? 'required' : 'optional'}`} title={path.replace('.', '/')}>
        <Box sx={{ width: '100%' }}>
          {relevantKeys.map((key, index) => {
            const property = levelSchema.properties![key];
            const type = property.type || 'anyOf';
            const itemTitle = property.title || key;
            const fullPath = path ? `${path}.${key}` : key;

            return (
              <ConfigElement
                key={fullPath}
                title={itemTitle}
                type={type}
                schema={levelSchema}
                jsonPath={fullPath}
                propertyKey={key}
                valueMap={valueMap}
                handleValueChange={handleValueChange}
                validationMap={validationMap}
                handleValidationChange={handleValidationChange}
                isRequired={isRequiredSection}
                isRequiredAtRequiredLevel={isRequiredSection}
                isFirstElement={index === 0}
                sensitiveMap={sensitiveMap}
                setSensitiveMap={setSensitiveMap}
                allowLinking={allowLinking}
                configGroups={configGroups}
                linkingMap={linkingMap}
                setLinkingMap={setLinkingMap}
              />
            );
          })}
        </Box>
      </GroupCard>
    );
  };

  return (
    <Box>
      {configGroups && configGroups.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <FormControlLabel control={<Switch size="small" checked={allowLinking} onChange={(e) => setAllowLinking(e.target.checked)} />} label="Allow Config Group Linking" />
        </Box>
      )}
      {isRequiredKeysInSchema && (
        <SectionCard title="Required">
          {schemasAtLevel.map(({ schema: levelSchema, path }) => {
            const required = levelSchema.required || [];
            const hasRequiredFields = levelSchema.properties && Object.keys(levelSchema.properties).some((key) => required.includes(key));
            if (!hasRequiredFields) return null;
            return renderConfigElements(levelSchema, path, true);
          })}
        </SectionCard>
      )}

      {isOptionalKeysInSchema && (
        <Box sx={{ mt: 2 }}>
          <SectionCard title="Optional" defaultOpen={false}>
            {schemasAtLevel.map(({ schema: levelSchema, path }) => {
              const required = levelSchema.required || [];
              const hasOptionalFields = levelSchema.properties && Object.keys(levelSchema.properties).some((key) => !required.includes(key));
              if (!hasOptionalFields) return null;
              return renderConfigElements(levelSchema, path, false);
            })}
          </SectionCard>
        </Box>
      )}
    </Box>
  );
}

export default ConfigForm;
