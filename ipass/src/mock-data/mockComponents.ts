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

import type { Component } from './types';

export const mockComponents: Component[] = [
  {
    id: '1',
    name: 'Basic Login Flow',
    type: 'Authentication',
    category: 'Login Flow',
    status: 'active',
    lastModified: '2 hours ago',
    author: 'John Doe',
    description: 'Standard username/password authentication flow',
  },
  {
    id: '2',
    name: 'Social Sign Up',
    type: 'Registration',
    category: 'Sign Up Flow',
    status: 'active',
    lastModified: '1 day ago',
    author: 'Jane Smith',
    description: 'Registration via social identity providers',
  },
  {
    id: '3',
    name: 'Password Reset',
    type: 'Recovery',
    category: 'Password Management',
    status: 'active',
    lastModified: '3 days ago',
    author: 'Mike Johnson',
    description: 'Email-based password recovery flow',
  },
  {
    id: '4',
    name: 'MFA Setup',
    type: 'Multi-Factor Authentication',
    category: 'Login Flow',
    status: 'inactive',
    lastModified: '1 week ago',
    author: 'Sarah Wilson',
    description: 'Configure TOTP and SMS verification',
  },
  {
    id: '5',
    name: 'OAuth Integration',
    type: 'Authorization',
    category: 'Enterprise SSO',
    status: 'draft',
    lastModified: '2 weeks ago',
    author: 'John Doe',
    description: 'OAuth 2.0 authorization code flow',
  },
  {
    id: '6',
    name: 'SAML SSO',
    type: 'Authentication',
    category: 'Enterprise SSO',
    status: 'active',
    lastModified: '4 days ago',
    author: 'Alice Brown',
    description: 'SAML 2.0 single sign-on integration',
  },
  {
    id: '7',
    name: 'Email Verification',
    type: 'Registration',
    category: 'Sign Up Flow',
    status: 'active',
    lastModified: '5 days ago',
    author: 'Bob Williams',
    description: 'Email confirmation during registration',
  },
  {
    id: '8',
    name: 'Account Lockout',
    type: 'Multi-Factor Authentication',
    category: 'Security',
    status: 'active',
    lastModified: '6 days ago',
    author: 'Charlie Davis',
    description: 'Brute force protection with account lockout',
  },
  {
    id: '9',
    name: 'Session Management',
    type: 'Authorization',
    category: 'Security',
    status: 'active',
    lastModified: '1 week ago',
    author: 'Diana Martinez',
    description: 'User session timeout and invalidation',
  },
  {
    id: '10',
    name: 'Magic Link Login',
    type: 'Authentication',
    category: 'Passwordless',
    status: 'draft',
    lastModified: '2 weeks ago',
    author: 'Edward Lee',
    description: 'Passwordless authentication via email link',
  },
  {
    id: '11',
    name: 'Biometric Auth',
    type: 'Multi-Factor Authentication',
    category: 'Passwordless',
    status: 'inactive',
    lastModified: '3 weeks ago',
    author: 'Fiona Garcia',
    description: 'WebAuthn fingerprint and face recognition',
  },
  {
    id: '12',
    name: 'API Key Management',
    type: 'Authorization',
    category: 'API Security',
    status: 'active',
    lastModified: '4 days ago',
    author: 'George Taylor',
    description: 'Generate and manage API access keys',
  },
];
