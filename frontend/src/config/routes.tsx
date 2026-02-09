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

import { type RouteProps, Navigate } from 'react-router'
import DefaultLayout from '../layouts/DefaultLayout'
import Home from '../pages/Home'
import Login from '../pages/Login'
import PublicLayout from '../layouts/PublicLayout'
import Project from '../pages/Project'
import CreateComponent from '../pages/CreateComponent'
import Components from '../pages/Components'
import Logs from '../pages/Logs'
import ComponentEditor from '../pages/ComponentEditor'
import Settings from '../pages/Settings'
import Error from '../pages/Error'
import AppLayout from '../layouts/AppLayout'
import Analytics from '../pages/Analytics'
import Projects from '../pages/Projects'
import Organizations from '../pages/Organizations'

export interface AppRoute extends Omit<RouteProps, 'children'> {
  children?: AppRoute[]
  label?: string
  showInNav?: boolean
}

const routes: AppRoute[] = [
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/login',
        element: <Login />,
        label: 'Login Page',
        showInNav: true,
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: '/organizations',
        element: <Organizations />,
        label: 'Organizations',
        showInNav: false,
      },
      {
        path: '/o/:orgId/projects',
        element: <Projects />,
        label: 'Projects',
        showInNav: false,
      },
      {
        path: '/o/:orgId/projects/:id',
        element: <Project />,
        label: 'Project Overview',
        showInNav: false,
      },
      {
        path: '/o/:orgId/analytics',
        element: <Analytics />,
        label: 'Analytics Overview',
        showInNav: false,
      },
      {
        path: '/o/:orgId/projects/:id/components',
        element: <Components />,
        label: 'Components',
        showInNav: false,
      },
      {
        path: '/o/:orgId/projects/:id/components/new',
        element: <CreateComponent />,
        label: 'Create Component',
        showInNav: false,
      },
      {
        path: '/o/:orgId/projects/:id/components/:componentId',
        element: <ComponentEditor />,
        label: 'Component Editor',
        showInNav: false,
      },
      {
        path: '/o/:orgId/projects/:id/components/:componentId/edit',
        element: <ComponentEditor />,
        label: 'Edit Component',
        showInNav: false,
      },
      {
        path: '/o/:orgId/analytics/logs',
        element: <Logs />,
        label: 'Activity Logs',
        showInNav: false,
      },
      {
        path: '/settings',
        element: <Settings />,
        label: 'Organization Settings',
        showInNav: false,
      },
    ],
  },
  {
    element: <DefaultLayout />,
    children: [
      {
        path: '/Home',
        element: <Home />,
        label: 'Home',
        showInNav: false,
      },
      {
        path: '/error',
        element: <Error />,
        label: '404 Error Page',
        showInNav: true,
      },
    ],
  },
]

export default routes
