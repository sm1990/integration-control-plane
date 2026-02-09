import { type RouteProps, Navigate } from 'react-router';
import { rootUrl, loginUrl, orgUrl, newProjectUrl, projectUrl, componentUrl } from '../paths';
import PublicLayout from '../layouts/PublicLayout';
import Login from '../pages/Login';
import AppLayout from '../layouts/AppLayout';
import Projects from '../pages/Projects';
import CreateProject from '../pages/CreateProject';
import Project from '../pages/Project';
import Component from '../pages/Component';

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
    element: <AppLayout />,
    children: [
      { path: orgUrl(':orgHandler'), element: <Projects /> },
      { path: newProjectUrl(':orgHandler'), element: <CreateProject /> },
      { path: projectUrl(':orgHandler', ':projectId'), element: <Project /> },
      { path: componentUrl(':orgHandler', ':projectId', ':componentHandler'), element: <Component /> },
    ],
  },
];

export default routes;
