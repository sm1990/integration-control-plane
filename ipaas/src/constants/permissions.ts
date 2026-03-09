export const Permissions = {
  // Integration Management
  INTEGRATION_VIEW: 'integration_mgt:view',
  INTEGRATION_EDIT: 'integration_mgt:edit',
  INTEGRATION_MANAGE: 'integration_mgt:manage',

  // Environment Management
  ENVIRONMENT_MANAGE: 'environment_mgt:manage',
  ENVIRONMENT_MANAGE_NONPROD: 'environment_mgt:manage_nonprod',

  // Project Management
  PROJECT_VIEW: 'project_mgt:view',
  PROJECT_EDIT: 'project_mgt:edit',
  PROJECT_MANAGE: 'project_mgt:manage',

  // Observability
  OBSERVABILITY_VIEW_LOGS: 'observability_mgt:view_logs',
  OBSERVABILITY_VIEW_INSIGHTS: 'observability_mgt:view_insights',

  // User Management
  USER_MANAGE_USERS: 'user_mgt:manage_users',
  USER_UPDATE_USERS: 'user_mgt:update_users',
  USER_MANAGE_GROUPS: 'user_mgt:manage_groups',
  USER_MANAGE_ROLES: 'user_mgt:manage_roles',
  USER_UPDATE_GROUP_ROLES: 'user_mgt:update_group_roles',
  USER_VIEW: 'user_mgt:view',
} as const;

export const ALL_ROLE_MODIFY_PERMISSIONS = [Permissions.USER_MANAGE_USERS, Permissions.USER_MANAGE_GROUPS, Permissions.USER_MANAGE_ROLES, Permissions.USER_UPDATE_GROUP_ROLES] as const;
export const ALL_USER_MGT_PERMISSIONS = [Permissions.USER_MANAGE_USERS, Permissions.USER_UPDATE_USERS, Permissions.USER_MANAGE_GROUPS, Permissions.USER_MANAGE_ROLES, Permissions.USER_UPDATE_GROUP_ROLES, Permissions.USER_VIEW] as const;
