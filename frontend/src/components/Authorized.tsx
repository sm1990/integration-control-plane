/**
 * Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
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

import type { ReactNode, JSX } from 'react';
import { useAccessControl } from '../contexts/AccessControlContext';
import { useScope, hasProject, hasComponent } from '../nav';
import { useProjectByHandler, useComponents } from '../api/queries';

interface AuthorizedProps {
  permissions: string | string[];
  children: ReactNode;
  fallback?: JSX.Element;
}

export default function Authorized({ permissions, children, fallback }: AuthorizedProps) {
  const { hasAnyPermission } = useAccessControl();
  const scope = useScope();

  const { data: project } = useProjectByHandler(hasProject(scope) ? scope.project : '');
  const projectId = project?.id;
  const { data: components = [] } = useComponents(scope.org, projectId ?? '');
  const currentComponent = hasComponent(scope) ? components.find((c) => c.handler === scope.component) : undefined;
  const componentId = currentComponent?.id;

  const permList = Array.isArray(permissions) ? permissions : [permissions];
  if (hasAnyPermission(permList, projectId, componentId)) return <>{children}</>;
  return fallback ?? null;
}
