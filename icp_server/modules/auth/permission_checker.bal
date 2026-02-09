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

import icp_server.storage;
import icp_server.types;

import ballerina/log;

// ============================================================================
// RBAC V2 - Permission Checker
// ============================================================================
// This module provides high-level permission checking functions that leverage
// the repository layer to make authorization decisions.
//
// Design: Permissions are stored in JWT as a flat list of permission names.
// This module validates those permissions against actual resource access.
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

// Build an AccessScope from GraphQL context parameters
// This standardizes scope creation across all GraphQL endpoints
public isolated function buildScopeFromContext(
    string? projectId = (),
    string? integrationId = (),
    string? envId = ()
) returns types:AccessScope {
    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    if projectId is string {
        scope.projectUuid = projectId;
    }
    
    if integrationId is string {
        scope.integrationUuid = integrationId;
    }
    
    if envId is string {
        scope.envUuid = envId;
    }
    
    return scope;
}

// ============================================================================
// Core Permission Checking
// ============================================================================

// Check if user has a specific permission in the given scope
// This is the core authorization function used by all other permission checks
public isolated function hasPermission(string userId, string permissionName, types:AccessScope scope) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} has permission ${permissionName} in scope`);

    // Get user's effective permissions for this scope
    types:Permission[] permissions = check storage:getUserEffectivePermissions(userId, scope);

    // Check if the requested permission is in the list
    foreach types:Permission permission in permissions {
        if permission.permissionName == permissionName {
            log:printDebug(string `User ${userId} HAS permission ${permissionName}`);
            return true;
        }
    }

    log:printDebug(string `User ${userId} DOES NOT have permission ${permissionName}`);
    return false;
}

// Check if user has ANY of the given permissions in the scope
public isolated function hasAnyPermission(string userId, string[] permissionNames, types:AccessScope scope) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} has any of ${permissionNames.length()} permissions`);

    types:Permission[] permissions = check storage:getUserEffectivePermissions(userId, scope);
    map<boolean> permissionMap = {};
    
    // Build a map for O(1) lookup
    foreach types:Permission permission in permissions {
        permissionMap[permission.permissionName] = true;
    }

    // Check if any requested permission exists
    foreach string permissionName in permissionNames {
        if permissionMap.hasKey(permissionName) {
            log:printDebug(string `User ${userId} has permission ${permissionName}`);
            return true;
        }
    }

    return false;
}

// Check if user has ALL of the given permissions in the scope
public isolated function hasAllPermissions(string userId, string[] permissionNames, types:AccessScope scope) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} has all of ${permissionNames.length()} permissions`);

    types:Permission[] permissions = check storage:getUserEffectivePermissions(userId, scope);
    map<boolean> permissionMap = {};
    
    // Build a map for O(1) lookup
    foreach types:Permission permission in permissions {
        permissionMap[permission.permissionName] = true;
    }

    // Check if all requested permissions exist
    foreach string permissionName in permissionNames {
        if !permissionMap.hasKey(permissionName) {
            log:printDebug(string `User ${userId} missing permission ${permissionName}`);
            return false;
        }
    }

    return true;
}

// ============================================================================
// Integration Management Permissions
// ============================================================================

// Check if user can view a specific integration
public isolated function canViewIntegration(string userId, string integrationId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can view integration ${integrationId}`);

    // First check if user has access to the integration at all
    boolean hasAccess = check storage:hasAccessToIntegration(userId, integrationId);
    if !hasAccess {
        return false;
    }

    // Get integration details to build scope
    // Note: In real implementation, we'd fetch project_uuid from components table
    // For now, we check at org level (will be refined when integrated with component queries)
    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasAnyPermission(userId, [PERMISSION_INTEGRATION_VIEW, PERMISSION_INTEGRATION_EDIT, PERMISSION_INTEGRATION_MANAGE], scope);
}

// Check if user can edit a specific integration
public isolated function canEditIntegration(string userId, string integrationId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can edit integration ${integrationId}`);

    boolean hasAccess = check storage:hasAccessToIntegration(userId, integrationId);
    if !hasAccess {
        return false;
    }

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasAnyPermission(userId, [PERMISSION_INTEGRATION_EDIT, PERMISSION_INTEGRATION_MANAGE], scope);
}

// Check if user can manage (create/delete) integrations
public isolated function canManageIntegration(string userId, string integrationId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can manage integration ${integrationId}`);

    boolean hasAccess = check storage:hasAccessToIntegration(userId, integrationId);
    if !hasAccess {
        return false;
    }

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasPermission(userId, PERMISSION_INTEGRATION_MANAGE, scope);
}

// Check if user can create integrations in a project
public isolated function canCreateIntegration(string userId, string projectId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can create integration in project ${projectId}`);

    boolean hasAccess = check storage:hasAccessToProject(userId, projectId);
    if !hasAccess {
        return false;
    }

    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID,
        projectUuid: projectId
    };
    
    return check hasPermission(userId, PERMISSION_INTEGRATION_MANAGE, scope);
}

// ============================================================================
// Project Management Permissions
// ============================================================================

// Check if user can view a specific project
public isolated function canViewProject(string userId, string projectId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can view project ${projectId}`);

    boolean hasAccess = check storage:hasAccessToProject(userId, projectId);
    if !hasAccess {
        return false;
    }

    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID,
        projectUuid: projectId
    };
    
    return check hasAnyPermission(userId, [PERMISSION_PROJECT_VIEW, PERMISSION_PROJECT_EDIT, PERMISSION_PROJECT_MANAGE], scope);
}

// Check if user can edit a specific project
public isolated function canEditProject(string userId, string projectId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can edit project ${projectId}`);

    boolean hasAccess = check storage:hasAccessToProject(userId, projectId);
    if !hasAccess {
        return false;
    }

    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID,
        projectUuid: projectId
    };
    
    return check hasAnyPermission(userId, [PERMISSION_PROJECT_EDIT, PERMISSION_PROJECT_MANAGE], scope);
}

// Check if user can manage (create/delete) projects
public isolated function canManageProject(string userId, string? projectId = ()) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can manage projects`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    if projectId is string {
        scope.projectUuid = projectId;
    }
    
    return check hasPermission(userId, PERMISSION_PROJECT_MANAGE, scope);
}

// ============================================================================
// Environment Management Permissions
// ============================================================================

// Check if user can manage all environments (including production)
public isolated function canManageEnvironment(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can manage all environments`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasPermission(userId, PERMISSION_ENVIRONMENT_MANAGE, scope);
}

// Check if user can manage non-production environments only
public isolated function canManageNonProdEnvironment(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can manage non-prod environments`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasAnyPermission(userId, [PERMISSION_ENVIRONMENT_MANAGE_NONPROD, PERMISSION_ENVIRONMENT_MANAGE], scope);
}

// ============================================================================
// Observability Management Permissions
// ============================================================================

// Check if user can view logs for an integration/project
public isolated function canViewLogs(string userId, string? integrationId = (), string? projectId = (), string? envId = ()) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can view logs`);

    // If integration specified, check integration access
    if integrationId is string {
        boolean hasAccess = check storage:hasAccessToIntegration(userId, integrationId);
        if !hasAccess {
            return false;
        }
    }

    // If project specified (but not integration), check project access
    if projectId is string && integrationId is () {
        boolean hasAccess = check storage:hasAccessToProject(userId, projectId);
        if !hasAccess {
            return false;
        }
    }

    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID,
        projectUuid: projectId,
        integrationUuid: integrationId,
        envUuid: envId
    };
    
    return check hasPermission(userId, PERMISSION_OBSERVABILITY_VIEW_LOGS, scope);
}

// Check if user can view insights for an integration/project
public isolated function canViewInsights(string userId, string? integrationId = (), string? projectId = (), string? envId = ()) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can view insights`);

    // If integration specified, check integration access
    if integrationId is string {
        boolean hasAccess = check storage:hasAccessToIntegration(userId, integrationId);
        if !hasAccess {
            return false;
        }
    }

    // If project specified (but not integration), check project access
    if projectId is string && integrationId is () {
        boolean hasAccess = check storage:hasAccessToProject(userId, projectId);
        if !hasAccess {
            return false;
        }
    }

    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID,
        projectUuid: projectId,
        integrationUuid: integrationId,
        envUuid: envId
    };
    
    return check hasPermission(userId, PERMISSION_OBSERVABILITY_VIEW_INSIGHTS, scope);
}

// ============================================================================
// User Management Permissions
// ============================================================================

// Check if user can manage users (create/update/delete)
public isolated function canManageUsers(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can manage users`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasPermission(userId, PERMISSION_USER_MANAGE_USERS, scope);
}

// Check if user can update users (assign groups)
public isolated function canUpdateUsers(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can update users`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasAnyPermission(userId, [PERMISSION_USER_UPDATE_USERS, PERMISSION_USER_MANAGE_USERS], scope);
}

// Check if user can manage groups
public isolated function canManageGroups(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can manage groups`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasPermission(userId, PERMISSION_USER_MANAGE_GROUPS, scope);
}

// Check if user can manage roles
public isolated function canManageRoles(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can manage roles`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasPermission(userId, PERMISSION_USER_MANAGE_ROLES, scope);
}

// Check if user can update group-role mappings
public isolated function canUpdateGroupRoles(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can update group roles`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasPermission(userId, PERMISSION_USER_UPDATE_GROUP_ROLES, scope);
}

// ============================================================================
// Granular Permission Checks for Group-Role Assignments
// ============================================================================

// Check if user has permission to assign roles at a specific project scope
// Used when assigning group-role mappings with projectUuid
public isolated function canAssignRolesAtProjectScope(string userId, string projectId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can assign roles at project scope: ${projectId}`);

    // First check if user has access to the project
    boolean hasAccess = check storage:hasAccessToProject(userId, projectId);
    if !hasAccess {
        log:printDebug(string `User ${userId} does not have access to project ${projectId}`);
        return false;
    }

    // Check if user has any of the required permissions at project scope
    // Includes user management permissions and project management permissions
    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID,
        projectUuid: projectId
    };

    return check hasAnyPermission(
        userId,
        [PERMISSION_USER_MANAGE_GROUPS, PERMISSION_USER_UPDATE_GROUP_ROLES, PERMISSION_USER_MANAGE_USERS,
         PERMISSION_PROJECT_EDIT, PERMISSION_PROJECT_MANAGE],
        scope
    );
}

// Check if user has permission to assign roles at a specific integration scope
// Used when assigning group-role mappings with integrationUuid
public isolated function canAssignRolesAtIntegrationScope(string userId, string integrationId, string projectId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can assign roles at integration scope: ${integrationId}`);

    // First check if user has access to the integration
    boolean hasAccess = check storage:hasAccessToIntegration(userId, integrationId);
    if !hasAccess {
        log:printDebug(string `User ${userId} does not have access to integration ${integrationId}`);
        return false;
    }

    // Check if user has any of the required permissions at integration scope
    // Includes user management permissions and integration management permissions
    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID,
        projectUuid: projectId,
        integrationUuid: integrationId
    };

    return check hasAnyPermission(
        userId,
        [PERMISSION_USER_MANAGE_GROUPS, PERMISSION_USER_UPDATE_GROUP_ROLES, PERMISSION_USER_MANAGE_USERS,
         PERMISSION_INTEGRATION_EDIT, PERMISSION_INTEGRATION_MANAGE],
        scope
    );
}

// Check if user has permission to assign roles at org level
// This is the most permissive check - just validates org-level permissions
public isolated function canAssignRolesAtOrgScope(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} can assign roles at org scope`);

    types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
    
    return check hasAnyPermission(
        userId, 
        [PERMISSION_USER_MANAGE_GROUPS, PERMISSION_USER_UPDATE_GROUP_ROLES, PERMISSION_USER_MANAGE_USERS], 
        scope
    );
}
