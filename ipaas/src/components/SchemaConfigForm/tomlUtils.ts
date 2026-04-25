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

import { type BaseType, type JSONSchema } from './schemaUtils';

type TomlValue = BaseType | TomlValue[] | { [key: string]: TomlValue };

const stripInlineComment = (rawValue: string): string => {
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < rawValue.length; i++) {
    const char = rawValue[i];
    const previousChar = rawValue[i - 1];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && previousChar !== '\\') {
      inString = false;
      stringChar = '';
    } else if (!inString && char === '#') {
      return rawValue.slice(0, i).trim();
    }
  }

  return rawValue.trim();
};

const stripTomlKeyQuotes = (key: string): string => {
  const trimmedKey = key.trim();
  if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) || (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
    return trimmedKey.slice(1, -1);
  }
  return trimmedKey;
};

const parseTomlValue = (rawValue: string): unknown => {
  const value = rawValue.trim();

  if ((value.startsWith('"""') && value.endsWith('"""')) || (value.startsWith("'''") && value.endsWith("'''"))) {
    return value.slice(3, -3);
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  if (/^[+-]?\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  if (/^[+-]?\d*\.\d+([eE][+-]?\d+)?$/.test(value)) {
    return parseFloat(value);
  }

  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(value)) {
    return parseFloat(value);
  }

  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    return parseInt(value, 16);
  }
  if (/^0o[0-7]+$/.test(value)) {
    return parseInt(value.slice(2), 8);
  }
  if (/^0b[01]+$/.test(value)) {
    return parseInt(value.slice(2), 2);
  }

  if (value.startsWith('{') && value.endsWith('}')) {
    const tableContent = value.slice(1, -1).trim();
    if (tableContent === '') return {};

    const result: Record<string, unknown> = {};
    const pairs = tableContent.split(',');
    pairs.forEach((pair) => {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        const pairValue = valueParts.join('=').trim();
        result[key.trim()] = parseTomlValue(pairValue);
      }
    });
    return result;
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    const arrayContent = value.slice(1, -1).trim();
    if (arrayContent === '') return [];

    const items: unknown[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < arrayContent.length; i++) {
      const char = arrayContent[i];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      } else if (!inString) {
        if (char === '[' || char === '{') {
          depth++;
        } else if (char === ']' || char === '}') {
          depth--;
        } else if (char === ',' && depth === 0) {
          if (current.trim()) {
            items.push(parseTomlValue(current.trim()));
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      items.push(parseTomlValue(current.trim()));
    }

    return items;
  }

  return value;
};

const parseToml = (content: string): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let currentSection = '';
  let lineNumber = 0;
  let currentArrayTable = '';
  const arrayTables: Record<string, unknown[]> = {};

  for (const line of lines) {
    lineNumber += 1;
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    try {
      const arrayTableMatch = trimmedLine.match(/^\[\[([^\]]+)\]\]$/);
      if (arrayTableMatch) {
        currentArrayTable = arrayTableMatch[1].trim();
        currentSection = '';
        if (!arrayTables[currentArrayTable]) {
          arrayTables[currentArrayTable] = [];
        }
        arrayTables[currentArrayTable].push({});
        continue;
      }

      const sectionMatch = trimmedLine.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = stripTomlKeyQuotes(sectionMatch[1]);
        currentArrayTable = '';
        continue;
      }

      const keyValueMatch = trimmedLine.match(/^([^=]+)=(.+)$/);
      if (keyValueMatch) {
        const key = stripTomlKeyQuotes(keyValueMatch[1]);
        const rawValue = stripInlineComment(keyValueMatch[2]);
        const parsedValue = parseTomlValue(rawValue);

        if (currentArrayTable) {
          const tableArray = arrayTables[currentArrayTable];
          const lastItem = tableArray[tableArray.length - 1] as Record<string, unknown>;
          lastItem[key] = parsedValue;
        } else {
          const fullKey = currentSection ? `${currentSection}.${key}` : key;
          result[fullKey] = parsedValue;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid syntax';
      throw new Error(`Parse error at line ${lineNumber}: ${errorMessage}`);
    }
  }

  Object.entries(arrayTables).forEach(([tableName, tableArray]) => {
    result[tableName] = tableArray;
  });

  return result;
};

const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, TomlValue> => {
  const flattened: Record<string, TomlValue> = {};

  Object.entries(obj).forEach(([key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      flattened[newKey] = value as TomlValue;
    }
  });

  return flattened;
};

const convertArrayToFormFormat = (arrayValue: unknown[], keyPrefix: string): Record<string, TomlValue> => {
  const result: Record<string, TomlValue> = {};

  arrayValue.forEach((item, index) => {
    const indexedKey = `${keyPrefix}.[${index}]`;

    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const flattened = flattenObject(item as Record<string, unknown>, indexedKey);
      Object.assign(result, flattened);
    } else if (Array.isArray(item)) {
      const nestedArray = convertArrayToFormFormat(item, indexedKey);
      Object.assign(result, nestedArray);
    } else {
      result[indexedKey] = item as TomlValue;
    }
  });

  return result;
};

const convertObjectToMapFormat = (objectValue: Record<string, unknown>, keyPrefix: string): Record<string, TomlValue> => {
  const result: Record<string, TomlValue> = {};

  Object.entries(objectValue).forEach(([mapKey, mapValue]) => {
    const fullKey = `${keyPrefix}.${mapKey}`;

    if (mapValue && typeof mapValue === 'object' && !Array.isArray(mapValue)) {
      const flattened = flattenObject(mapValue as Record<string, unknown>, fullKey);
      Object.assign(result, flattened);
    } else if (Array.isArray(mapValue)) {
      const arrayFormatted = convertArrayToFormFormat(mapValue, fullKey);
      Object.assign(result, arrayFormatted);
    } else {
      result[fullKey] = mapValue as TomlValue;
    }
  });

  return result;
};

const convertTomlValuesToBaseType = (tomlValues: Map<string, TomlValue>): Map<string, BaseType> => {
  const baseTypeMap = new Map<string, BaseType>();

  tomlValues.forEach((value, key) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      baseTypeMap.set(key, value);
    } else {
      baseTypeMap.set(key, JSON.stringify(value));
    }
  });

  return baseTypeMap;
};

export interface TomlParseResult {
  success: boolean;
  data?: Map<string, BaseType>;
  error?: string;
}

export const parseConfigToml = (tomlContent: string): TomlParseResult => {
  try {
    const parsed = parseToml(tomlContent);

    const configMap = new Map<string, TomlValue>();

    Object.entries(parsed).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const arrayFormatted = convertArrayToFormFormat(value, key);
        Object.entries(arrayFormatted).forEach(([arrayKey, arrayValue]) => {
          configMap.set(arrayKey, arrayValue);
        });
      } else if (value && typeof value === 'object') {
        const objectFormatted = convertObjectToMapFormat(value as Record<string, unknown>, key);
        Object.entries(objectFormatted).forEach(([objKey, objValue]) => {
          configMap.set(objKey, objValue);
        });
      } else {
        configMap.set(key, value as TomlValue);
      }
    });

    const baseTypeMap = convertTomlValuesToBaseType(configMap);

    return { success: true, data: baseTypeMap };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse TOML file',
    };
  }
};

export const isValidTomlFile = (fileName: string, content: string): boolean => {
  if (!fileName.toLowerCase().endsWith('.toml')) {
    return false;
  }

  try {
    parseToml(content);
    return true;
  } catch {
    return false;
  }
};

export const getAllSchemaKeys = (schema: JSONSchema): string[] => {
  const keys: string[] = [];

  const collectKeys = (currentSchema: JSONSchema, basePath = '') => {
    if (currentSchema.properties) {
      Object.keys(currentSchema.properties).forEach((key) => {
        const fullPath = basePath ? `${basePath}.${key}` : key;
        const property = currentSchema.properties![key];

        if (property.type === 'object' && property.properties) {
          collectKeys(property, fullPath);
        } else if (property.type === 'array') {
          keys.push(fullPath);
          if (property.items && typeof property.items === 'object' && property.items.properties) {
            collectKeys(property.items, `${fullPath}[*]`);
          }
        } else if (property.type === 'object' && property.additionalProperties) {
          keys.push(fullPath);
          if (typeof property.additionalProperties === 'object' && property.additionalProperties.properties) {
            collectKeys(property.additionalProperties as JSONSchema, `${fullPath}.*`);
          }
        } else {
          keys.push(fullPath);
        }
      });
    }
  };

  collectKeys(schema);
  return keys;
};

const extractBaseKey = (tomlKey: string): string => {
  let baseKey = tomlKey.replace(/\[\d+\]/g, '');

  const arrayMatch = tomlKey.match(/^([^[]+)(\[\d+\])/);
  if (arrayMatch) {
    return arrayMatch[1];
  }

  const lastDotIndex = baseKey.lastIndexOf('.');
  if (lastDotIndex > 0) {
    baseKey = baseKey.substring(0, lastDotIndex);
  }

  return baseKey;
};

const normalizeKeyPath = (key: string): string =>
  key
    .replace(/\//g, '.')
    .replace(/\.\[/g, '[')
    .replace(/\[\*\]/g, '[]')
    .replace(/\[\d+\]/g, '[]')
    .replace(/\.\*/g, '.*')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');

const convertTomlKeyToSchemaKey = (tomlKey: string, matchedSchemaKey: string): string => {
  if (matchedSchemaKey.includes('[*]')) {
    const arrayIndices = tomlKey.match(/\[\d+\]/g) || [];

    if (arrayIndices.length > 0) {
      let result = matchedSchemaKey;
      arrayIndices.forEach((index) => {
        if (result.includes('.[*]')) {
          result = result.replace('.[*]', `.${index}`);
        } else {
          result = result.replace('[*]', `.${index}`);
        }
      });
      return result;
    }
  }

  const normalizedTomlKey = normalizeKeyPath(tomlKey);
  const normalizedSchemaKey = normalizeKeyPath(matchedSchemaKey);
  if (normalizedSchemaKey === normalizedTomlKey || normalizedSchemaKey.endsWith(`.${normalizedTomlKey}`)) {
    return matchedSchemaKey;
  }

  const schemaKeyParts = matchedSchemaKey.split('.');

  if (schemaKeyParts.length > 2) {
    const strippedSchemaKey = schemaKeyParts.slice(2).join('.');
    if (tomlKey === strippedSchemaKey || tomlKey.startsWith(`${strippedSchemaKey}.`) || tomlKey.startsWith(`${strippedSchemaKey}[`)) {
      const prefix = schemaKeyParts.slice(0, 2).join('.');
      return `${prefix}.${tomlKey}`;
    }
  }

  if (schemaKeyParts.length > 1) {
    const strippedSchemaKey = schemaKeyParts.slice(1).join('.');
    if (tomlKey === strippedSchemaKey || tomlKey.startsWith(`${strippedSchemaKey}.`) || tomlKey.startsWith(`${strippedSchemaKey}[`)) {
      const prefix = schemaKeyParts[0];
      return `${prefix}.${tomlKey}`;
    }
  }

  return matchedSchemaKey;
};

const matchesWithStripping = (tomlKey: string, schemaKey: string): boolean => {
  if (schemaKey === tomlKey) {
    return true;
  }

  const normalizedTomlKey = normalizeKeyPath(tomlKey);
  const normalizedSchemaKey = normalizeKeyPath(schemaKey);
  if (normalizedSchemaKey === normalizedTomlKey || normalizedSchemaKey.endsWith(`.${normalizedTomlKey}`) || normalizedTomlKey.endsWith(`.${normalizedSchemaKey}`)) {
    return true;
  }

  const tomlBaseKey = extractBaseKey(tomlKey);

  const checkKeyMatch = (keyToCheck: string, targetSchema: string): boolean => {
    const schemaWithWildcard = targetSchema.replace(/\[\*\]/g, '\\[\\d+\\]');
    const regexPattern = new RegExp(`^${schemaWithWildcard}$`);

    return targetSchema === keyToCheck || keyToCheck.startsWith(`${targetSchema}.`) || keyToCheck.startsWith(`${targetSchema}[`) || tomlBaseKey === targetSchema || tomlBaseKey.startsWith(`${targetSchema}.`) || regexPattern.test(keyToCheck);
  };

  const schemaKeyParts = schemaKey.split('.');
  if (schemaKeyParts.length > 2) {
    const strippedSchemaKey = schemaKeyParts.slice(2).join('.');
    if (checkKeyMatch(tomlKey, strippedSchemaKey)) {
      return true;
    }
  }

  if (schemaKeyParts.length > 1) {
    const strippedSchemaKey = schemaKeyParts.slice(1).join('.');
    if (checkKeyMatch(tomlKey, strippedSchemaKey)) {
      return true;
    }
  }

  if (checkKeyMatch(tomlKey, schemaKey)) {
    return true;
  }

  return false;
};

export const filterTomlValuesBySchema = (tomlValues: Map<string, BaseType>, schema: JSONSchema): Map<string, BaseType> => {
  const filteredMap = new Map<string, BaseType>();
  const validKeys = getAllSchemaKeys(schema);

  tomlValues.forEach((value, tomlKey) => {
    for (const validKey of validKeys) {
      if (matchesWithStripping(tomlKey, validKey)) {
        const schemaFormattedKey = convertTomlKeyToSchemaKey(tomlKey, validKey);
        filteredMap.set(schemaFormattedKey, value);
        break;
      }
    }
  });

  return filteredMap;
};
