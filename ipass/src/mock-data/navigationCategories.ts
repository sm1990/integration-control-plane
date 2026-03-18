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

import { Home, BarChart3, Users, FolderOpen, Layers, Shield, Database, Globe, Activity, PieChart, TrendingUp, UserCog, Lock, Key, FileText } from '@wso2/oxygen-ui-icons-react';
import { dashboard, analytics, users, projects, integrations, security, databases, domains } from '../paths';
import type { NavigationCategory } from './types';

/**
 * Main navigation items organized by category.
 * Demonstrates hierarchical menu structure with sub-menus.
 */
export const navigationCategories: NavigationCategory[] = [
  {
    id: 'main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Home,
        href: dashboard,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        children: [
          {
            id: 'analytics-dashboard',
            label: 'Dashboard',
            icon: PieChart,
            href: analytics.base,
          },
          {
            id: 'analytics-reports',
            label: 'Reports',
            icon: FileText,
            href: analytics.reports,
          },
          {
            id: 'analytics-realtime',
            label: 'Real-time',
            icon: Activity,
            href: analytics.realtime,
          },
          {
            id: 'analytics-trends',
            label: 'Trends',
            icon: TrendingUp,
            href: analytics.trends,
          },
        ],
      },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      {
        id: 'users',
        label: 'Users',
        icon: Users,
        badge: 3,
        children: [
          {
            id: 'users-list',
            label: 'All Users',
            icon: Users,
            href: users.list,
          },
          {
            id: 'users-roles',
            label: 'Roles',
            icon: UserCog,
            href: users.roles,
          },
          {
            id: 'users-permissions',
            label: 'Permissions',
            icon: Lock,
            href: users.permissions,
          },
        ],
      },
      {
        id: 'projects',
        label: 'Projects',
        icon: FolderOpen,
        href: projects,
      },
      {
        id: 'integrations',
        label: 'Integrations',
        icon: Layers,
        href: integrations,
      },
    ],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    items: [
      {
        id: 'security',
        label: 'Security',
        icon: Shield,
        children: [
          {
            id: 'security-dashboard',
            label: 'Dashboard',
            icon: Shield,
            href: security.base,
          },
          {
            id: 'security-api-keys',
            label: 'API Keys',
            icon: Key,
            href: security.apiKeys,
          },
        ],
      },
      {
        id: 'databases',
        label: 'Databases',
        icon: Database,
        href: databases,
      },
      {
        id: 'domains',
        label: 'Domains',
        icon: Globe,
        href: domains,
      },
    ],
  },
];
