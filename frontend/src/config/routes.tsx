import { type RouteProps, Navigate } from 'react-router';
import { rootUrl, loginUrl, orgUrl, newProjectUrl, projectUrl, componentUrl, projectLogsUrl, componentLogsUrl, environmentsUrl, newEnvironmentUrl, oidcCallbackUrl, projectRuntimeUrl, componentRuntimeUrl, orgAccessControlUrl, projectAccessControlUrl } from '../paths';
import PublicLayout from '../layouts/PublicLayout';
import Login from '../pages/Login';
import OIDCCallback from '../pages/OIDCCallback';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../auth/ProtectedRoute';
import Projects from '../pages/Projects';
import CreateProject from '../pages/CreateProject';
import Project from '../pages/Project';
import Component from '../pages/Component';
import RuntimeLogs from '../pages/RuntimeLogs';
import Environments from '../pages/Environments';
import CreateEnvironment from '../pages/CreateEnvironment';
import Runtime from '../pages/Runtime';
import AccessControl, { ProjectAccessControl } from '../pages/AccessControl';

export interface AppRoute extends Omit<RouteProps, 'children'> {
  children?: AppRoute[];
}

const routes: AppRoute[] = [
  { path: rootUrl(), element: <Navigate to={loginUrl()} replace /> },
  {
    element: <PublicLayout />,
    children: [{ path: loginUrl(), element: <Login /> }],
  },
  { path: oidcCallbackUrl(), element: <OIDCCallback /> },
  {
    element: <ProtectedRoute />,
    children: [{
    element: <AppLayout />,
    children: [
      { path: orgUrl(':orgHandler'), element: <Projects /> },
      { path: environmentsUrl(':orgHandler'), element: <Environments /> },
      { path: newEnvironmentUrl(':orgHandler'), element: <CreateEnvironment /> },
      { path: orgAccessControlUrl(':orgHandler', ':tab' as any), element: <AccessControl /> },
      { path: projectAccessControlUrl(':orgHandler', ':projectId', ':tab' as any), element: <ProjectAccessControl /> },
      { path: newProjectUrl(':orgHandler'), element: <CreateProject /> },
      { path: projectUrl(':orgHandler', ':projectId'), element: <Project /> },
      { path: componentUrl(':orgHandler', ':projectId', ':componentHandler'), element: <Component /> },
      { path: projectLogsUrl(':orgHandler', ':projectId'), element: <RuntimeLogs /> },
      { path: componentLogsUrl(':orgHandler', ':projectId', ':componentHandler'), element: <RuntimeLogs /> },
      { path: projectRuntimeUrl(':orgHandler', ':projectId'), element: <Runtime /> },
      { path: componentRuntimeUrl(':orgHandler', ':projectId', ':componentHandler'), element: <Runtime /> },
    ],
  }],
  },
];

export default routes;
