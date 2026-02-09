import { type RouteProps, Navigate } from 'react-router';
import PublicLayout from '../layouts/PublicLayout';
import Login from '../pages/Login';
import AppLayout from '../layouts/AppLayout';
import Projects from '../pages/Projects';
import Project from '../pages/Project';
import Component from '../pages/Component';

export interface AppRoute extends Omit<RouteProps, 'children'> {
  children?: AppRoute[];
}

const routes: AppRoute[] = [
  { path: '/', element: <Navigate to="/login" replace /> },
  {
    element: <PublicLayout />,
    children: [{ path: '/login', element: <Login /> }],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/organizations/:orgHandler/home', element: <Projects /> },
      { path: '/organizations/:orgHandler/projects/:projectId/home', element: <Project /> },
      { path: '/organizations/:orgHandler/projects/:projectId/components/:componentHandler/overview', element: <Component /> },
    ],
  },
];

export default routes;
