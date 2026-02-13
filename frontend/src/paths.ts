/**
 * API URLs, external links, and legacy path helpers for pages not yet migrated to nav.ts.
 * Navigation for the main matrix pages is handled by src/nav.ts.
 */

export function loginUrl(): string {
  return '/login';
}

export function oidcCallbackUrl(): string {
  return '/auth/callback';
}

// ---------------------------------------------------------------------------
// Legacy path helpers — used by pages outside the nav matrix (Organizations,
// Analytics, Components, ComponentEditor, Error, etc.). Migrate these pages
// to nav.ts before removing.
// ---------------------------------------------------------------------------

export function rootUrl(): string {
  return '/';
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

export function projectUrl(orgHandler: string, projectId: string): string {
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

export function orgAccessControlUrl(orgHandler: string, tab: 'users' | 'roles' | 'groups' = 'users'): string {
  return `/organizations/${orgHandler}/settings/access-control/${tab}`;
}

export function orgRoleDetailUrl(orgHandler: string, roleId: string): string {
  return `/organizations/${orgHandler}/settings/access-control/roles/${roleId}`;
}

export function projectAccessControlUrl(orgHandler: string, projectId: string, tab: 'roles' | 'groups' = 'roles'): string {
  return `/organizations/${orgHandler}/projects/${projectId}/settings/access-control/${tab}`;
}

export function projectRoleDetailUrl(orgHandler: string, projectId: string, roleId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/settings/access-control/roles/${roleId}`;
}

export function componentAccessControlUrl(orgHandler: string, projectId: string, componentHandler: string, tab: 'roles' | 'groups' = 'roles'): string {
  return `/organizations/${orgHandler}/projects/${projectId}/components/${componentHandler}/settings/access-control/${tab}`;
}

export function componentRoleDetailUrl(orgHandler: string, projectId: string, componentHandler: string, roleId: string): string {
  return `/organizations/${orgHandler}/projects/${projectId}/components/${componentHandler}/settings/access-control/roles/${roleId}`;
}

export function orgAnalyticsUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}/analytics`;
}

export function orgAnalyticsLogsUrl(orgHandler: string): string {
  return `/organizations/${orgHandler}/analytics/logs`;
}

// ---------------------------------------------------------------------------
// External links
// ---------------------------------------------------------------------------

export const external = {
  wso2: 'https://www.wso2.com',
  vite: 'https://vite.dev',
  react: 'https://react.dev',
  oxygenUi: 'https://github.com/wso2/oxygen-ui/tree/next',
} as const;

// ---------------------------------------------------------------------------
// Mock-data path constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// API URLs
// ---------------------------------------------------------------------------

export const observabilityLogsApiUrl = 'https://localhost:9448/icp/observability/logs?live=true';

export const authApiBaseUrl = 'https://localhost:9445/auth';
export const loginApiUrl = `${authApiBaseUrl}/login`;
export const refreshTokenApiUrl = `${authApiBaseUrl}/refresh-token`;
export const revokeTokenApiUrl = `${authApiBaseUrl}/revoke-token`;
export const oidcAuthorizeApiUrl = `${authApiBaseUrl}/oidc/authorize-url`;
export const oidcCallbackApiUrl = `${authApiBaseUrl}/login/oidc`;
