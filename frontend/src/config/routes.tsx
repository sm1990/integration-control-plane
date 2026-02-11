import { type RouteProps, Navigate } from 'react-router';
import { rootUrl, loginUrl, orgUrl, newProjectUrl, projectUrl, componentUrl, projectLogsUrl, componentLogsUrl, environmentsUrl, newEnvironmentUrl } from '../paths';
import PublicLayout from '../layouts/PublicLayout';
import Login from '../pages/Login';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../auth/ProtectedRoute';
import Projects from '../pages/Projects';
import CreateProject from '../pages/CreateProject';
import Project from '../pages/Project';
import Component from '../pages/Component';
import RuntimeLogs from '../pages/RuntimeLogs';
import Environments from '../pages/Environments';
import CreateEnvironment from '../pages/CreateEnvironment';

export interface AppRoute extends Omit<RouteProps, 'children'> {
  children?: AppRoute[];
}

const routes: AppRoute[] = [
  { path: rootUrl(), element: <Navigate to={loginUrl()} replace /> },
  {
    element: <PublicLayout />,
    children: [{ path: loginUrl(), element: <Login /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [{
    element: <AppLayout />,
    children: [
      { path: orgUrl(':orgHandler'), element: <Projects /> },
      { path: environmentsUrl(':orgHandler'), element: <Environments /> },
      { path: newEnvironmentUrl(':orgHandler'), element: <CreateEnvironment /> },
      { path: newProjectUrl(':orgHandler'), element: <CreateProject /> },
      { path: projectUrl(':orgHandler', ':projectId'), element: <Project /> },
      { path: componentUrl(':orgHandler', ':projectId', ':componentHandler'), element: <Component /> },
      { path: projectLogsUrl(':orgHandler', ':projectId'), element: <RuntimeLogs /> },
      { path: componentLogsUrl(':orgHandler', ':projectId', ':componentHandler'), element: <RuntimeLogs /> },
    ],
  }],
  },
];

export default routes;
