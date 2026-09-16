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

import { test } from '@playwright/test';

type Product = 'wip' | 'cloud';

// Project names carry the product identity; every cloud project is prefixed 'cloud'.
function currentProduct(projectName?: string): Product {
  let name = projectName ?? '';
  if (!projectName) {
    try {
      name = test.info().project.name;
    } catch {
      // test.info() throws in beforeAll; those callers pass projectName from their own testInfo.
    }
  }
  return name.startsWith('cloud') ? 'cloud' : 'wip';
}

export function isCloud(projectName?: string): boolean {
  return currentProduct(projectName) === 'cloud';
}

/** Saved browser session, repo-root relative. Written by global.setup.ts / cloud.setup.ts. */
export function authStatePath(projectName?: string): string {
  return isCloud(projectName) ? '.auth/cloud-user.json' : '.auth/user.json';
}

/** Org/project handles captured during setup, repo-root relative. */
export function authContextPath(projectName?: string): string {
  return isCloud(projectName) ? '.auth/cloud-context.json' : '.auth/context.json';
}
