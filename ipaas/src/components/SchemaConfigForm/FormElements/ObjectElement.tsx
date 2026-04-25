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

import { Box } from '@wso2/oxygen-ui';
import type { CertGroup } from '../../../api/queries';
import type { Dispatch, SetStateAction } from 'react';
import type { LinkingInfo } from '../ConfigForm';
import { type BaseType, generateArrayJsonPath, generatedNestedLabel, generateMapJsonPath, generateObjectJsonPath, isBaseType, type JSONSchema } from '../schemaUtils';
import { AnyOfElement } from './AnyOfElement';
import { ArrayElement } from './ArrayElement';
import { BaseElement } from './BaseElement';
import MapElement from './MapElement';

interface ObjectElementProps {
  type: string;
  title: string;
  schema: JSONSchema;
  valueMap: Map<string, BaseType>;
  allowLinking?: boolean;
  configGroups?: CertGroup[];
  linkingMap?: Map<string, LinkingInfo>;
  setLinkingMap?: Dispatch<SetStateAction<Map<string, LinkingInfo>>>;
  sensitiveMap?: Map<string, boolean>;
  setSensitiveMap?: Dispatch<SetStateAction<Map<string, boolean>>>;
  handleValueChange: (key: string, value: BaseType, valueMap?: Map<string, BaseType>) => void;
  jsonPath: string;
  validationMap: Map<string, boolean>;
  handleValidationChange: (jsonPath: string, isValid: boolean, validationMap?: Map<string, boolean>) => void;
  isRequired?: boolean;
  isRequiredAtRequiredLevel: boolean;
}

export function ObjectElement({
  title,
  schema,
  valueMap,
  allowLinking,
  configGroups,
  linkingMap,
  setLinkingMap,
  sensitiveMap,
  setSensitiveMap,
  handleValueChange,
  jsonPath,
  isRequired,
  validationMap,
  handleValidationChange,
  isRequiredAtRequiredLevel,
}: ObjectElementProps) {
  return (
    <Box>
      {schema.properties &&
        Object.keys(schema.properties).map((key) => {
          const prop = schema.properties![key];
          const type = prop.type;
          const subTitle = prop.title || key;
          const generatedJsonPath = generateObjectJsonPath(jsonPath, key);
          const nestedLabel = generatedNestedLabel(title, subTitle);

          if (type === 'object' && prop.additionalProperties) {
            return (
              <MapElement
                key={key}
                title={nestedLabel || key}
                jsonPath={generateMapJsonPath(generatedJsonPath)}
                valueMap={valueMap}
                handleValueChange={handleValueChange}
                handleValidationChange={handleValidationChange}
                validationMap={validationMap}
                isRequired={isRequired}
                schema={prop}
                isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
                allowLinking={allowLinking}
                configGroups={configGroups}
                linkingMap={linkingMap}
                setLinkingMap={setLinkingMap}
                sensitiveMap={sensitiveMap}
                setSensitiveMap={setSensitiveMap}
              />
            );
          }

          if (type === 'object') {
            return (
              <Box mt={2} key={generatedJsonPath}>
                <ObjectElement
                  title={nestedLabel || key}
                  type={type}
                  schema={prop}
                  valueMap={valueMap}
                  validationMap={validationMap}
                  handleValueChange={handleValueChange}
                  handleValidationChange={handleValidationChange}
                  jsonPath={generatedJsonPath}
                  isRequired={isRequired}
                  isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
                  allowLinking={allowLinking}
                  configGroups={configGroups}
                  linkingMap={linkingMap}
                  setLinkingMap={setLinkingMap}
                  sensitiveMap={sensitiveMap}
                  setSensitiveMap={setSensitiveMap}
                />
              </Box>
            );
          }

          if (isBaseType(type) || prop.enum) {
            return (
              <BaseElement
                key={generatedJsonPath}
                title={nestedLabel || key}
                type={prop.enum ? 'string' : type || ''}
                valueMap={valueMap}
                validationMap={validationMap}
                handleValueChange={handleValueChange}
                handleValidationChange={handleValidationChange}
                jsonPath={generatedJsonPath}
                isRequired={schema.required?.includes(key)}
                schema={prop}
                isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
                allowLinking={allowLinking}
                configGroups={configGroups}
                linkingMap={linkingMap}
                setLinkingMap={setLinkingMap}
                sensitiveMap={sensitiveMap}
                setSensitiveMap={setSensitiveMap}
              />
            );
          }

          if (type === 'array') {
            return (
              <ArrayElement
                key={generatedJsonPath}
                title={nestedLabel || key}
                type={type}
                schema={prop.items}
                jsonPath={generateArrayJsonPath(generatedJsonPath)}
                valueMap={valueMap}
                handleValueChange={handleValueChange}
                validationMap={validationMap}
                handleValidationChange={handleValidationChange}
                isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
                allowLinking={allowLinking}
                configGroups={configGroups}
                linkingMap={linkingMap}
                setLinkingMap={setLinkingMap}
                sensitiveMap={sensitiveMap}
                setSensitiveMap={setSensitiveMap}
              />
            );
          }

          if (prop.anyOf) {
            return (
              <AnyOfElement
                key={key}
                title={nestedLabel || key}
                schema={prop}
                jsonPath={generatedJsonPath}
                valueMap={valueMap}
                handleValueChange={handleValueChange}
                validationMap={validationMap}
                handleValidationChange={handleValidationChange}
                isRequiredAtRequiredLevel={isRequiredAtRequiredLevel}
                allowLinking={allowLinking}
                configGroups={configGroups}
                linkingMap={linkingMap}
                setLinkingMap={setLinkingMap}
                sensitiveMap={sensitiveMap}
                setSensitiveMap={setSensitiveMap}
              />
            );
          }

          return null;
        })}
    </Box>
  );
}

export default ObjectElement;
