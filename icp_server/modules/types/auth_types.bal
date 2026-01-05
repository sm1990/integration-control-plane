// Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
//
// WSO2 Inc. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ballerina/sql;

// ============================================================================
// RBAC V2 - Authorization & Access Control Types
// ============================================================================
// This module contains types for the new group-based, permission-driven
// authorization system that will replace the simple role-based system.
//
// Key Concepts:
// - Users belong to Groups
// - Groups are assigned Roles in specific contexts (org/project/env/integration)
// - Roles contain Permissions
// - Permissions define fine-grained actions on resources
// ============================================================================

// === Permission Domain Enum ===

// Defines the five main functional domains in the system
public enum PermissionDomain {
    INTEGRATION_MANAGEMENT = "Integration-Management",
    ENVIRONMENT_MANAGEMENT = "Environment-Management",
    PROJECT_MANAGEMENT = "Project-Management",
    OBSERVABILITY_MANAGEMENT = "Observability-Management",
    USER_MANAGEMENT = "User-Management"
}

// === Core RBAC V2 Database Record Types ===

// Permission record - represents a fine-grained permission in the system
public type Permission record {
    @sql:Column {name: "permission_id"}
    string permissionId;
    
    @sql:Column {name: "permission_name"}
    string permissionName; // Format: domain:action (e.g., "integration_mgt:view")
    
    @sql:Column {name: "permission_domain"}
    PermissionDomain permissionDomain;
    
    @sql:Column {name: "resource_type"}
    string resourceType; // Changed from ResourceType enum to string for flexibility
    
    @sql:Column {name: "action"}
    string action; // Changed from Action enum to string for flexibility
    
    string description?;
    
    @sql:Column {name: "created_at"}
    string createdAt?;
    
    @sql:Column {name: "updated_at"}
    string updatedAt?;
};

// Role V2 record - represents a collection of permissions
// Note: Uses "RoleV2" to avoid conflict with existing Role type (old RBAC)
public type RoleV2 record {
    @sql:Column {name: "role_id"}
    string roleId;
    
    @sql:Column {name: "role_name"}
    string roleName;
    
    @sql:Column {name: "org_id"}
    int orgId; // Organization ID (default: 1 for single-tenant mode)
    
    string description?;
    
    @sql:Column {name: "created_at"}
    string createdAt?;
    
    @sql:Column {name: "updated_at"}
    string updatedAt?;
};

// Group record - represents a collection of users
public type Group record {
    @sql:Column {name: "group_id"}
    string groupId;
    
    @sql:Column {name: "group_name"}
    string groupName;
    
    @sql:Column {name: "org_uuid"}
    int orgUuid; // Default: 1 for single-tenant mode
    
    string description?;
    
    @sql:Column {name: "created_at"}
    string createdAt?;
    
    @sql:Column {name: "updated_at"}
    string updatedAt?;
};

// Group-User mapping - links users to groups (Many-to-Many)
public type GroupUserMapping record {
    int id;
    
    @sql:Column {name: "group_id"}
    string groupId;
    
    @sql:Column {name: "user_uuid"}
    string userUuid;
    
    @sql:Column {name: "created_at"}
    string createdAt?;
};

// Group-Role mapping - links groups to roles with hierarchical context (Many-to-Many with scoping)
// This is the core of the authorization model - defines WHAT roles a group has and WHERE they apply
public type GroupRoleMapping record {
    int id;
    
    @sql:Column {name: "group_id"}
    string groupId;
    
    @sql:Column {name: "role_id"}
    string roleId;
    
    // Hierarchical scoping - defines WHERE this role applies
    @sql:Column {name: "org_uuid"}
    int orgUuid?; // Organization scope (default: 1)
    
    @sql:Column {name: "project_uuid"}
    string projectUuid?; // Project scope (NULL = org-wide)
    
    @sql:Column {name: "env_uuid"}
    string envUuid?; // Environment filter (NULL = all environments)
    
    @sql:Column {name: "integration_uuid"}
    string integrationUuid?; // Integration scope (requires project_uuid)
    
    @sql:Column {name: "created_at"}
    string createdAt?;
};

// Role-Permission mapping - links roles to permissions (Many-to-Many)
public type RolePermissionMapping record {
    int id;
    
    @sql:Column {name: "role_id"}
    string roleId;
    
    @sql:Column {name: "permission_id"}
    string permissionId;
    
    @sql:Column {name: "created_at"}
    string createdAt?;
};

// === Authorization Context Types ===

// Access scope - defines the hierarchical context for authorization checks
// Represents WHERE a permission check is happening (org/project/integration + environment filter)
public type AccessScope record {
    int orgUuid; // Organization ID (default: 1)
    string projectUuid?; // Project ID (NULL = org-wide)
    string integrationUuid?; // Integration ID (NULL = project-wide or org-wide)
    string envUuid?; // Environment filter (NULL = all environments)
};

// Contextual permission - a permission with its scope context
// Represents WHAT permission is granted WHERE
public type ContextualPermission record {
    Permission permission;
    AccessScope scope;
};

// User permission context - complete authorization context for a user
// Contains all the information needed to make authorization decisions
public type UserPermissionContext record {
    string userId;
    string username;
    string displayName;
    
    // Groups the user belongs to
    Group[] groups;
    
    // Effective permissions with their scopes
    // Computed by resolving: user → groups → roles → permissions
    ContextualPermission[] effectivePermissions;
    
    // Legacy flags (from User table)
    boolean isSuperAdmin;
    boolean isProjectAuthor;
};

// === API Input Types for RBAC V2 Management ===

// Input for creating a new group
public type GroupInput record {
    string groupName;
    int orgUuid?; // Optional, defaults to 1
    string description?;
};

// Input for creating a new role
public type RoleV2Input record {
    string roleName;
    int orgId?; // Optional, defaults to 1
    string description?;
};

// Input for assigning a user to a group
public type AssignGroupToUserInput record {
    string groupId;
    string userId;
};

// Input for adding multiple users to a group
public type AddUsersToGroupInput record {
    string[] userIds;
};

// Input for updating groups of a user
public type UpdateUserGroupsInput record {
    string[] groupIds;
};

// Input for assigning a role to a group with context (used by storage layer)
// This is how permissions are granted to users (via groups)
public type AssignRoleToGroupInput record {
    string groupId;
    string roleId;
    
    // Scope context - defines WHERE this role applies
    int orgUuid?; // Default: 1
    string projectUuid?; // NULL = org-wide
    string envUuid?; // NULL = all environments (acts as filter)
    string integrationUuid?; // NULL = not integration-specific (requires projectUuid if set)
};

// Input for assigning multiple roles to a group (used by API endpoint)
public type AssignRolesToGroupInput record {
    string[] roleIds; // Multiple roles can be assigned at once
    
    // Scope context - defines WHERE these roles apply
    int orgUuid?; // Default: 1
    string projectUuid?; // NULL = org-wide
    string envUuid?; // NULL = all environments (acts as filter)
    string integrationUuid?; // NULL = not integration-specific (requires projectUuid if set)
};

// Input for updating/removing a group-role mapping
public type UpdateGroupRoleMappingInput record {
    int mappingId;
    string groupId?;
    string roleId?;
    int orgUuid?;
    string projectUuid?;
    string envUuid?;
    string integrationUuid?;
};

// Input for assigning permissions to a role
public type AssignPermissionsToRoleInput record {
    string roleId;
    string[] permissionIds;
};

// === API Response Types ===

// Group with its users
public type GroupWithUsers record {
    *Group;
    string[] userIds; // User IDs in this group
};

// Role with its permissions
public type RoleV2WithPermissions record {
    *RoleV2;
    Permission[] permissions;
};

// User with their groups and effective permissions (for API responses)
public type UserWithGroupsAndPermissions record {
    string userId;
    string username;
    string displayName;
    boolean isSuperAdmin;
    boolean isProjectAuthor;
    Group[] groups;
    RoleV2[] roles; // Roles through group memberships
    string[] permissions; // Permission names (e.g., "integration_mgt:view")
};

// === View Types (for querying hierarchical access) ===

// Project access view record - from v_user_project_access
public type UserProjectAccess record {
    @sql:Column {name: "user_uuid"}
    string userUuid;
    
    @sql:Column {name: "project_uuid"}
    string projectUuid;
    
    @sql:Column {name: "project_name"}
    string projectName;
    
    @sql:Column {name: "org_uuid"}
    int orgUuid;
    
    @sql:Column {name: "role_id"}
    string roleId;
    
    @sql:Column {name: "access_level"}
    string accessLevel; // "org", "project", or "integration"
};

// Integration access view record - from v_user_integration_access
public type UserIntegrationAccess record {
    @sql:Column {name: "user_uuid"}
    string userUuid;
    
    @sql:Column {name: "integration_uuid"}
    string integrationUuid;
    
    @sql:Column {name: "integration_name"}
    string integrationName;
    
    @sql:Column {name: "project_uuid"}
    string projectUuid;
    
    @sql:Column {name: "env_uuid"}
    string envUuid?;
    
    @sql:Column {name: "role_id"}
    string roleId;
    
    @sql:Column {name: "access_level"}
    string accessLevel; // "org", "project", or "integration"
};

// Environment access view record - from v_user_environment_access
public type UserEnvironmentAccess record {
    @sql:Column {name: "user_uuid"}
    string userUuid;
    
    @sql:Column {name: "env_uuid"}
    string envUuid?;
    
    @sql:Column {name: "project_uuid"}
    string projectUuid?;
    
    @sql:Column {name: "integration_uuid"}
    string integrationUuid?;
    
    @sql:Column {name: "role_id"}
    string roleId;
    
    @sql:Column {name: "scope_level"}
    string scopeLevel; // "org", "project", or "integration"
};
