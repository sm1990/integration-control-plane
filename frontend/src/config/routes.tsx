import { type RouteProps, Navigate } from 'react-router';
import { orgRoleDetailUrl, projectRoleDetailUrl, componentRoleDetailUrl } from '../paths';
import PublicLayout from '../layouts/PublicLayout';
import Login from '../pages/Login';
import OIDCCallback from '../pages/OIDCCallback';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../auth/ProtectedRoute';
import Projects from '../pages/Projects';
import CreateProject from '../pages/CreateProject';
import CreateComponent from '../pages/CreateComponent';
import Project from '../pages/Project';
import Component from '../pages/Component';
import RuntimeLogs from '../pages/RuntimeLogs';
import Environments from '../pages/Environments';
import CreateEnvironment from '../pages/CreateEnvironment';
import Runtime from '../pages/Runtime';
import { OrgAccessControl, ProjectAccessControl, ComponentAccessControl } from '../pages/AccessControl';
import RoleDetail from '../pages/RoleDetail';
import ProjectRoleDetail from '../pages/ProjectRoleDetail';
import ComponentRoleDetail from '../pages/ComponentRoleDetail';
import { ScopeResolver, generateMatrixRoutes, withScope, type Matrix } from '../nav';
import { createElement } from 'react';

export interface AppRoute extends Omit<RouteProps, 'children'> {
  children?: AppRoute[];
}

const MATRIX: Matrix = {
  overview: { segment: '', pages: { organizations: Projects, projects: Project, components: Component } },
  logs: { segment: 'logs', pages: { projects: RuntimeLogs, components: RuntimeLogs } },
  runtimes: { segment: 'runtimes', pages: { projects: Runtime, components: Runtime } },
  environments: { segment: 'environments', pages: { organizations: Environments, projects: Environments } },
  'access-control': { segment: 'settings/access-control/:tab', pages: { organizations: OrgAccessControl, projects: ProjectAccessControl, components: ComponentAccessControl } },
};

const routes: AppRoute[] = [
  { path: '/', element: <Navigate to="/login" replace /> },
  {
    element: <PublicLayout />,
    children: [{ path: '/login', element: <Login /> }],
  },
  { path: '/auth/callback', element: <OIDCCallback /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <ScopeResolver />,
        children: [
          {
            element: <AppLayout />,
            children: [
              ...generateMatrixRoutes(MATRIX),
              { path: 'organizations/:orgHandler/projects/new', element: createElement(withScope(CreateProject, ['organizations'])) },
              { path: 'organizations/:orgHandler/projects/:projectId/components/new', element: createElement(withScope(CreateComponent, ['projects'])) },
              { path: 'organizations/:orgHandler/environments/new', element: createElement(withScope(CreateEnvironment, ['organizations'])) },
              { path: orgRoleDetailUrl(':orgHandler', ':roleId'), element: <RoleDetail /> },
              { path: projectRoleDetailUrl(':orgHandler', ':projectId', ':roleId'), element: <ProjectRoleDetail /> },
              { path: componentRoleDetailUrl(':orgHandler', ':projectId', ':componentHandler', ':roleId'), element: <ComponentRoleDetail /> },
            ],
          },
        ],
      },
    ],
  },
];

export default routes;
