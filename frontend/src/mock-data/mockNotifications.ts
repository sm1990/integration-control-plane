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

import type { NotificationItem } from './types';

/**
 * Sample notifications for the notification panel.
 */
export const mockNotifications: NotificationItem[] = [
  {
    id: '1',
    type: 'info',
    title: 'New feature available',
    message: 'Check out the new analytics dashboard with real-time insights.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    read: false,
    avatar: 'A',
    actionLabel: 'View',
  },
  {
    id: '2',
    type: 'success',
    title: 'Deployment successful',
    message: 'Your application has been deployed to production.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    read: false,
  },
  {
    id: '3',
    type: 'warning',
    title: 'Storage limit approaching',
    message: 'You have used 85% of your storage quota. Consider upgrading your plan.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    read: true,
    actionLabel: 'Upgrade',
  },
  {
    id: '4',
    type: 'error',
    title: 'Build failed',
    message: 'The latest build for project "api-service" failed. Check the logs for details.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    read: true,
    actionLabel: 'View Logs',
  },
  {
    id: '5',
    type: 'info',
    title: 'Team member joined',
    message: 'Sarah Johnson has joined your organization.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    read: true,
    avatar: 'SJ',
  },
  {
    id: '6',
    type: 'info',
    title: 'Scheduled maintenance',
    message: 'Planned maintenance on December 20th from 2:00 AM - 4:00 AM UTC.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    read: true,
  },
];
