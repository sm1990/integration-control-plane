/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
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

import type { Organization } from './types';

/**
 * Sample organizations for the org switcher.
 */
export const mockOrganizations: Organization[] = [
  {
    id: 'org-1',
    name: 'Acme Corporation',
    avatar: 'AC',
    description: 'Primary organization',
    orgId: '62edf0f6-b427-413b-aac8-67ba7d6b403b',
    status: 'active',
  },
  {
    id: 'org-2',
    name: 'Beta Industries',
    avatar: 'BI',
    description: 'Partner organization',
    orgId: 'b1f5d9a2-1e2a-4d0e-9a1f-cc32b0a98c12',
    status: 'inactive',
  },
  {
    id: 'org-3',
    name: 'Gamma Labs',
    avatar: 'GL',
    description: 'Research division',
    orgId: '2f7a0f14-9f12-4d2f-8a41-1b9d8d3ab9e1',
    status: 'active',
  },
];
