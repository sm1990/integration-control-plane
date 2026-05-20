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

import { type RouteProps, Navigate, Outlet } from 'react-router';
import { cookiePolicyUrl, loginUrl, orgRoleDetailUrl, privacyPolicyUrl, projectRoleDetailUrl, componentRoleDetailUrl, projectGroupDetailUrl, componentGroupDetailUrl, alertsSegment, buildsSegment, deploySegment, signupUrl, registerOrgUrl } from '../paths';
import OrgHomeRedirect from '../components/OrgHomeRedirect';
import Signup from '../pages/Signup';
import RegisterOrganization from '../pages/RegisterOrganization';
import CreateUser from '../pages/CreateUser';
import EditUser from '../pages/EditUser';
import CreateRole from '../pages/CreateRole';
import CreateGroup from '../pages/CreateGroup';
import EditGroup from '../pages/EditGroup';
import EditEnvironment from '../pages/EditEnvironment';
import PublicLayout from '../layouts/PublicLayout';
import PolicyLayout from '../layouts/PolicyLayout';
import Login from '../pages/Login';
import CookiePolicy from '../pages/CookiePolicy';
import PrivacyPolicy from '../pages/PrivacyPolicy';
import OIDCCallback from '../pages/OIDCCallback';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../auth/ProtectedRoute';
import Projects from '../pages/Projects';
import CreateProject from '../pages/CreateProject';
import ImportProject from '../pages/ImportProject';
import CreateIntegrationOptions from '../pages/CreateIntegrationOptions';
import ImportIntegration from '../pages/ImportIntegration';
import BrowseSamples from '../pages/BrowseSamples';
import BrowsePrebuiltIntegrations from '../pages/BrowsePrebuiltIntegrations';
import PrebuiltIntegrationSetup from '../pages/PrebuiltIntegrationSetup';
import PrebuiltIntegrationDeploy from '../pages/PrebuiltIntegrationDeploy';
import GitHubOAuthCallback from '../pages/GitHubOAuthCallback';
import Project from '../pages/Project';
import Component from '../pages/Component';
import RuntimeLogsProject from '../pages/RuntimeLogsProject';
import RuntimeLogsIntegration from '../pages/RuntimeLogsIntegration';
import Metrics from '../pages/Metrics';
import Environments from '../pages/Environments';
import CreateEnvironment from '../pages/CreateEnvironment';
import Runtime from '../pages/Runtime';
import { OrgAccessControl, ProjectAccessControl, ComponentAccessControl } from '../pages/AccessControl';
import RoleDetail from '../pages/RoleDetail';
import ProjectRoleDetail from '../pages/ProjectRoleDetail';
import ComponentRoleDetail from '../pages/ComponentRoleDetail';
import ProjectGroupDetail from '../pages/ProjectGroupDetail';
import ComponentGroupDetail from '../pages/ComponentGroupDetail';
import Profile from '../pages/Profile';
import ForceChangePassword from '../pages/ForceChangePassword';
import ComingSoon from '../pages/ComingSoon';
import Alerts from '../pages/Alerts';
import { ScopeResolver, generateMatrixRoutes, withScope, type Matrix } from '../nav';
import { createElement } from 'react';
import { PrebuiltIntegrationConfigProvider } from '../contexts/PrebuiltIntegrationConfigContext';
import Build from '../pages/Build';
import OrgBuild from '../pages/OrgBuild';
import ProjectBuild from '../pages/ProjectBuild';
import OrgDeploy from '../pages/OrgDeploy';
import ProjectDeploy from '../pages/ProjectDeploy';
import CloudEditorDeployment from '../pages/CloudEditorDeployment';
import TestConsole from '../pages/TestConsole';
import ApiChat from '../pages/ApiChat';
import Deploy from '../pages/Deploy';
import ProjectsRedirect from '../pages/ProjectsRedirect';
import OrgHome from '../pages/OrgHome';
import Lifecycle from '../pages/Lifecycle';

export interface AppRoute extends Omit<RouteProps, 'children'> {
  children?: AppRoute[];
}

const MATRIX: Matrix = {
  overview: { segment: '', pages: { organizations: Projects, projects: Project, components: Component } },
  logs: { segment: 'logs', pages: { projects: RuntimeLogsProject, components: RuntimeLogsIntegration } },
  alerts: { segment: alertsSegment, pages: { components: Alerts } },
  build: { segment: buildsSegment, pages: { organizations: OrgBuild, projects: ProjectBuild, components: Build } },
  deploy: { segment: deploySegment, pages: { organizations: OrgDeploy, projects: ProjectDeploy, components: Deploy } },
  metrics: { segment: 'metrics', pages: { projects: Metrics, components: Metrics } },
  runtimes: { segment: 'runtimes', pages: { projects: Runtime, components: Runtime } },
  environments: { segment: 'environments', pages: { organizations: Environments, projects: Environments } },
  'access-control': { segment: 'settings/access-control/:tab', pages: { organizations: OrgAccessControl, projects: ProjectAccessControl, components: ComponentAccessControl } },
};

const routes: AppRoute[] = [
  { path: '/', element: <Navigate to="/login" replace /> },
  {
    element: <PublicLayout />,
    children: [
      { path: loginUrl(), element: <Login /> },
      { path: signupUrl(), element: <Signup /> },
    ],
  },
  {
    element: <PolicyLayout />,
    children: [
      { path: cookiePolicyUrl(), element: <CookiePolicy /> },
      { path: privacyPolicyUrl(), element: <PrivacyPolicy /> },
    ],
  },
  { path: '/signin', element: <OIDCCallback /> },
  { path: '/ghapp', element: <GitHubOAuthCallback /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: registerOrgUrl(), element: <RegisterOrganization /> },
      { path: '/change-password', element: <ForceChangePassword /> },
      { path: '/editor', element: <CloudEditorDeployment /> },
      {
        element: <ScopeResolver />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: 'organizations/:orgHandler', element: <OrgHomeRedirect /> },
              { path: 'organizations/:orgHandler/develop', element: <ComingSoon title="Coming Soon" description="Development tools are currently under development." /> },
              { path: 'organizations/:orgHandler/deploy', element: <ComingSoon title="Coming Soon" description="Deployment management is currently under development." /> },
              { path: 'organizations/:orgHandler/test', element: <ComingSoon title="Coming Soon" description="Testing tools are currently under development." /> },
              { path: 'organizations/:orgHandler/insights/usage', element: <ComingSoon title="Coming Soon" description="Usage insights are currently under development." /> },
              { path: 'organizations/:orgHandler/insights/delivery', element: <ComingSoon title="Coming Soon" description="Delivery insights are currently under development." /> },
              { path: 'organizations/:orgHandler/insights/compliance', element: <ComingSoon title="Coming Soon" description="Compliance insights are currently under development." /> },
              { path: 'organizations/:orgHandler/logs', element: <ComingSoon title="Coming Soon" description="Organization-level logs are currently under development." /> },
              { path: 'organizations/:orgHandler/metrics', element: <ComingSoon title="Coming Soon" description="Organization-level metrics are currently under development." /> },
              { path: 'organizations/:orgHandler/rag/scheduled-ingestion', element: <ComingSoon title="Coming Soon" description="Scheduled ingestion is currently under development." /> },
              { path: 'organizations/:orgHandler/rag/service', element: <ComingSoon title="Coming Soon" description="RAG service management is currently under development." /> },
              { path: 'organizations/:orgHandler/rag/retrieval', element: <ComingSoon title="Coming Soon" description="Retrieval configuration is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/databases', element: <ComingSoon title="Coming Soon" description="Databases management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/vector-databases', element: <ComingSoon title="Coming Soon" description="Vector Databases management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/message-brokers', element: <ComingSoon title="Coming Soon" description="Message Brokers management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/third-party', element: <ComingSoon title="Coming Soon" description="Third Party Services management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/genai-services', element: <ComingSoon title="Coming Soon" description="GenAI Services management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/config-groups', element: <ComingSoon title="Coming Soon" description="Config Groups management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/governance', element: <ComingSoon title="Coming Soon" description="Governance management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/cd-pipelines', element: <ComingSoon title="Coming Soon" description="CD Pipelines management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/data-planes', element: <ComingSoon title="Coming Soon" description="Data Planes management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/audit-logs', element: <ComingSoon title="Coming Soon" description="Audit Logs are currently under development." /> },
              { path: 'organizations/:orgHandler/admin/approvals', element: <ComingSoon title="Coming Soon" description="Approvals management is currently under development." /> },
              { path: 'organizations/:orgHandler/admin/certificates', element: <ComingSoon title="Coming Soon" description="Certificates management is currently under development." /> },
              ...generateMatrixRoutes(MATRIX),
              { path: 'organizations/:orgHandler/projects/:projectHandler/develop', element: <ComingSoon title="Coming Soon" description="Development tools are currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/deploy', element: <ComingSoon title="Coming Soon" description="Deployment management is currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/test', element: <ComingSoon title="Coming Soon" description="Testing tools are currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/insights/usage', element: <ComingSoon title="Coming Soon" description="Usage insights are currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/insights/delivery', element: <ComingSoon title="Coming Soon" description="Delivery insights are currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/insights/compliance', element: <ComingSoon title="Coming Soon" description="Compliance insights are currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/observe/runtimelogs', element: createElement(withScope(RuntimeLogsProject, ['projects'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/observe/metrics', element: createElement(withScope(Metrics, ['projects'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/admin/connections', element: <ComingSoon title="Coming Soon" description="Connections management is currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/admin/third-party-services', element: <ComingSoon title="Coming Soon" description="Third Party Services management is currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/admin/gen-ai-services', element: <ComingSoon title="Coming Soon" description="GenAI Services management is currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/admin/cd-pipelines', element: <ComingSoon title="Coming Soon" description="CD Pipelines management is currently under development." /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/devops/environments', element: createElement(withScope(Environments, ['projects'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/settings/project-overview', element: <ComingSoon title="Coming Soon" description="Project settings are currently under development." /> },
              { path: 'organizations/:orgHandler/projects/redirect', element: <ProjectsRedirect /> },
              { path: 'organizations/:orgHandler/home', element: createElement(withScope(OrgHome, ['organizations'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/home', element: createElement(withScope(Project, ['projects'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/overview', element: createElement(withScope(Component, ['components'])) },
              { path: 'organizations/:orgHandler/projects/new', element: createElement(withScope(CreateProject, ['organizations'])) },
              { path: 'organizations/:orgHandler/projects/import', element: createElement(withScope(ImportProject, ['organizations'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/components/new', element: createElement(withScope(CreateIntegrationOptions, ['projects'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/components/new/import', element: createElement(withScope(ImportIntegration, ['projects'])) },
              { path: 'organizations/:orgHandler/projects/:projectHandler/components/new/samples', element: createElement(withScope(BrowseSamples, ['projects'])) },
              { path: 'organizations/:orgHandler/environments/new', element: createElement(withScope(CreateEnvironment, ['organizations'])) },
              { path: 'organizations/:orgHandler/environments/:envId/edit', element: <EditEnvironment /> },
              { path: 'organizations/:orgHandler/settings/access-control/users/new', element: <CreateUser /> },
              { path: 'organizations/:orgHandler/settings/access-control/users/:userId/edit', element: <EditUser /> },
              { path: 'organizations/:orgHandler/settings/access-control/roles/new', element: <CreateRole /> },
              { path: 'organizations/:orgHandler/settings/access-control/groups/new', element: <CreateGroup /> },
              { path: 'organizations/:orgHandler/settings/access-control/groups/:groupId/edit', element: <EditGroup /> },
              { path: orgRoleDetailUrl(':orgHandler', ':roleId'), element: <RoleDetail /> },
              { path: projectRoleDetailUrl(':orgHandler', ':projectHandler', ':roleId'), element: <ProjectRoleDetail /> },
              { path: componentRoleDetailUrl(':orgHandler', ':projectHandler', ':componentHandler', ':roleId'), element: <ComponentRoleDetail /> },
              { path: projectGroupDetailUrl(':orgHandler', ':projectHandler', ':groupId'), element: <ProjectGroupDetail /> },
              { path: componentGroupDetailUrl(':orgHandler', ':projectHandler', ':componentHandler', ':groupId'), element: <ComponentGroupDetail /> },
              { path: '/profile', element: <Profile /> },
              { path: 'organizations/:orgHandler/projects/:projectHandler/prebuilt-integrations', element: createElement(withScope(BrowsePrebuiltIntegrations, ['projects'])) },
              {
                element: (
                  <PrebuiltIntegrationConfigProvider>
                    <Outlet />
                  </PrebuiltIntegrationConfigProvider>
                ),
                children: [
                  { path: 'organizations/:orgHandler/projects/:projectHandler/prebuilt-integrations/:slug', element: createElement(withScope(PrebuiltIntegrationSetup, ['projects'])) },
                  { path: 'organizations/:orgHandler/projects/:projectHandler/prebuilt-integrations/:slug/deploy', element: createElement(withScope(PrebuiltIntegrationDeploy, ['projects'])) },
                ],
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/new/import-coming-soon',
                element: <ComingSoon title="Coming Soon" description="Importing from this Git provider is currently not available. You'll be able to import integrations from this source soon." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/test',
                element: <ComingSoon title="Coming Soon" description="Testing tools are currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/test/console',
                element: createElement(withScope(TestConsole, ['components'])),
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/test/api-chat',
                element: createElement(withScope(ApiChat, ['components'])),
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/manage/lifecycle',
                element: createElement(withScope(Lifecycle, ['components'])),
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/documents',
                element: <ComingSoon title="Coming Soon" description="API documentation is currently under development. You'll be able to manage your API documents directly from here." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/plans',
                element: <ComingSoon title="Coming Soon" description="Subscription plans management is currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/deploy',
                element: <ComingSoon title="Coming Soon" description="Deployment management is currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/insights/usage',
                element: <ComingSoon title="Coming Soon" description="Usage insights are currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/insights/delivery',
                element: <ComingSoon title="Coming Soon" description="Delivery insights are currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/insights/compliance',
                element: <ComingSoon title="Coming Soon" description="Compliance insights are currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/admin/connections',
                element: <ComingSoon title="Coming Soon" description="Connections management is currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/admin/containers',
                element: <ComingSoon title="Coming Soon" description="Containers management is currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/admin/configs',
                element: <ComingSoon title="Coming Soon" description="Configs & Secrets management is currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/admin/health-checks',
                element: <ComingSoon title="Coming Soon" description="Health Checks configuration is currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/admin/scaling',
                element: <ComingSoon title="Coming Soon" description="Scaling configuration is currently under development." />,
              },
              {
                path: 'organizations/:orgHandler/projects/:projectHandler/components/:componentHandler/admin/storage',
                element: <ComingSoon title="Coming Soon" description="Storage management is currently under development." />,
              },
            ],
          },
        ],
      },
    ],
  },
];

export default routes;
