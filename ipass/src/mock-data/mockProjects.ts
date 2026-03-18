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

import type { Project } from './types';

/**
 * Sample projects for the project switcher.
 */
export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'E-Commerce Platform',
    description: 'Complete authentication and user management system for e-commerce',
    status: 'active',
    componentsCount: 12,
    lastUpdated: '2 hours ago',
    color: '#1976d2',
  },
  {
    id: '2',
    name: 'Banking Application',
    description: 'Secure authentication flows for banking services',
    status: 'active',
    componentsCount: 8,
    lastUpdated: '1 day ago',
    color: '#9c27b0',
  },
  {
    id: '3',
    name: 'Healthcare Portal',
    description: 'HIPAA compliant authentication system',
    status: 'draft',
    componentsCount: 5,
    lastUpdated: '3 days ago',
    color: '#2e7d32',
  },
  {
    id: '4',
    name: 'Legacy System',
    description: 'Old authentication flows - archived for reference',
    status: 'archived',
    componentsCount: 15,
    lastUpdated: '2 months ago',
    color: '#ed6c02',
  },
];
