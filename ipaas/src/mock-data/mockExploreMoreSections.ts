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

import { BookOpen, Book, Headphones } from '@wso2/oxygen-ui-icons-react';
import { docs, support } from '../paths';
import type { ExploreMoreSection } from './types';

export const mockExploreMoreSections: ExploreMoreSection[] = [
  {
    id: 'tutorials',
    title: 'Tutorials',
    icon: BookOpen,
    items: [
      {
        id: 't-1',
        label: 'Create your first project',
        href: docs.tutorials.createProject,
      },
      {
        id: 't-2',
        label: 'Invite team members',
        href: docs.tutorials.inviteTeam,
      },
      {
        id: 't-3',
        label: 'Configure basic settings',
        href: docs.tutorials.configureSettings,
      },
    ],
  },
  {
    id: 'references',
    title: 'References',
    icon: Book,
    items: [
      {
        id: 'r-1',
        label: 'Application concepts',
        href: docs.references.concepts,
      },
      {
        id: 'r-2',
        label: 'Configuration reference',
        href: docs.references.configuration,
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    icon: Headphones,
    items: [
      {
        id: 's-1',
        label: 'Help center',
        href: support.helpCenter,
      },
      {
        id: 's-2',
        label: 'Contact support',
        href: support.contact,
      },
    ],
  },
];
