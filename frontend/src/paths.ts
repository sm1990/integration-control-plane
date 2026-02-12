/**
 * Single source of truth for app and external URLs. Pure functions and constants only.
 * id = uuid, handle = slug
 */

export function rootUrl(): string {
  return '/';
}

export function loginUrl(): string {
  return '/login';
}

export function oidcCallbackUrl(): string {
  return '/auth/callback';
}

export function orgUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}`;
}

export function orgProjectsUrl(orgHandler: string): string {
  return orgUrl(orgHandler);
}

export function newOrgUrl(): string {
  return '/organizations/new';
}

export function editOrgUrl(orgId: string): string {
  return `/organizations/${orgId}/edit`;
}

export function environmentsUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}/environments`;
}

export function newEnvironmentUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}/environments/new`;
}

export function newProjectUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}/projects/new`;
}

export function projectUrl(orgHandler: string, projectId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}`;
}

export function projectComponentsUrl(orgHandler: string, projectId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}`;
}

export function componentUrl(orgHandler: string, projectId: string, componentHandler: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/components/${componentHandler}`;
}

export function newComponentUrl(orgHandler: string, projectId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/components/new`;
}

export function editComponentUrl(orgHandler: string, projectId: string, componentId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/components/${componentId}/edit`;
}

export function projectLogsUrl(orgHandler: string, projectId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/observe/runtimelogs`;
}

export function componentLogsUrl(orgHandler: string, projectId: string, componentHandler: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/components/${componentHandler}/observe/runtimelogs`;
}

export function projectRuntimeUrl(orgHandler: string, projectId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/admin/runtime`;
}

export function componentRuntimeUrl(orgHandler: string, projectId: string, componentHandler: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/components/${componentHandler}/admin/runtime`;
}

export function orgAccessControlUrl(orgHandler: string, tab: 'users' | 'roles' | 'groups' = 'users'): string {
  return `/organizations/${orgHandler}/settings/access-control/${tab}`;
}

export function projectAccessControlUrl(orgHandler: string, projectId: string, tab: 'roles' | 'groups' = 'groups'): string {
  return `/organizations/${orgHandler}/projects/${projectId}/settings/access-control/${tab}`;
}

export function orgAnalyticsUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}/analytics`;
}

export function orgAnalyticsLogsUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}/analytics/logs`;
}

export const external = {
  wso2: 'https://www.wso2.com',
  vite: 'https://vite.dev',
  react: 'https://react.dev',
  oxygenUi: 'https://github.com/wso2/oxygen-ui/tree/next',
} as const;

export const dashboard = '/dashboard';
export const analytics = {
  base: '/analytics',
  reports: '/analytics/reports',
  realtime: '/analytics/realtime',
  trends: '/analytics/trends',
} as const;
export const users = { list: '/users', roles: '/users/roles', permissions: '/users/permissions' } as const;
export const projects = '/projects';
export const integrations = '/integrations';
export const security = { base: '/security', apiKeys: '/security/api-keys' } as const;
export const databases = '/databases';
export const domains = '/domains';
export const settings = { base: '/settings', notifications: '/settings/notifications' } as const;
export const help = '/help';
export const docs = {
  tutorials: {
    createProject: '/docs/tutorials/create-project',
    inviteTeam: '/docs/tutorials/invite-team',
    configureSettings: '/docs/tutorials/configure-settings',
  },
  references: {
    concepts: '/docs/references/concepts',
    configuration: '/docs/references/configuration',
  },
} as const;
export const support = {
  helpCenter: '/support/help-center',
  contact: '/support/contact',
} as const;

export const observabilityLogsApiUrl = 'https://localhost:9448/icp/observability/logs?live=true';

export const authApiBaseUrl = 'https://localhost:9445/auth';
export const loginApiUrl = `${authApiBaseUrl}/login`;
export const refreshTokenApiUrl = `${authApiBaseUrl}/refresh-token`;
export const revokeTokenApiUrl = `${authApiBaseUrl}/revoke-token`;
export const oidcAuthorizeApiUrl = `${authApiBaseUrl}/oidc/authorize-url`;
export const oidcCallbackApiUrl = `${authApiBaseUrl}/login/oidc`;
