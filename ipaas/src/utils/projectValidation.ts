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

import { DENIED_HANDLERS, PROJECT_HANDLER_CHARS_REGEX, PROJECT_HANDLER_FULL_REGEX, PROJECT_HANDLER_MAX_LENGTH, PROJECT_NAME_MIN_LENGTH, PROJECT_NAME_REGEX } from '../constants/project';

export function validateProjectName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Display name is required.';
  if (trimmed.length < PROJECT_NAME_MIN_LENGTH) return `Minimum ${PROJECT_NAME_MIN_LENGTH} characters required.`;
  if (!PROJECT_NAME_REGEX.test(trimmed)) return 'Must start with a letter and contain only letters, numbers, spaces, hyphens, or underscores.';
  return null;
}

export function validateProjectHandler(handler: string): string | null {
  if (!handler) return 'Name is required.';
  if (handler.length > PROJECT_HANDLER_MAX_LENGTH) return `Maximum ${PROJECT_HANDLER_MAX_LENGTH} characters allowed.`;
  if (!PROJECT_HANDLER_CHARS_REGEX.test(handler)) return 'Only lowercase letters, numbers, and hyphens allowed.';
  if (handler.length >= 2 && !PROJECT_HANDLER_FULL_REGEX.test(handler)) return 'Must start and end with a letter or number.';
  if (DENIED_HANDLERS.has(handler)) return `"${handler}" is a reserved name in the console. Please choose a different one.`;
  return null;
}

export function normalizeProjectError(message: string): string {
  if (message === 'Failed to fetch') {
    return 'Unable to connect to the server. Please check that the server is running and try again.';
  }
  if (/already taken|already exists|duplicate/i.test(message) || /HTTP 409/.test(message)) {
    return 'A project with this name already exists. Please choose a different name.';
  }
  return message;
}
