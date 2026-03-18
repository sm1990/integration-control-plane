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
