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
// RBAC V2 - Context Builder
// ============================================================================
// This module provides utilities for building authorization contexts from
// resource IDs and user information.
// ============================================================================

// Build an AccessScope from resource IDs
// This is used to create the context for permission checks
public isolated function buildAccessScope(string? projectId = (), string? integrationId = (), string? envId = ()) returns types:AccessScope {
    log:printDebug("Building access scope from resource IDs");

    types:AccessScope scope = {
        orgUuid: storage:DEFAULT_ORG_ID
    };

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

// Build a complete authorization context for a user with effective permissions
// Returns groups, roles, and flattened list of unique permission names
public isolated function buildUserAuthzContext(string userId, types:AccessScope? scope = ()) returns UserAuthzContext|error {
    log:printDebug(string `Building authorization context for user ${userId}`);

    types:AccessScope effectiveScope = scope ?: {orgUuid: storage:DEFAULT_ORG_ID};

    // Get user's groups
    types:Group[] groups = check storage:getUserGroups(userId);

    // Get effective permissions for the scope
    types:Permission[] permissions = check storage:getUserEffectivePermissions(userId, effectiveScope);

    // Extract unique permission names for JWT/scope storage
    map<boolean> permissionNameMap = {};
    foreach types:Permission permission in permissions {
        permissionNameMap[permission.permissionName] = true;
    }
    string[] permissionNames = permissionNameMap.keys();

    // Get roles (deduplicated across all groups)
    map<types:RoleV2> rolesMap = {};
    foreach types:Group group in groups {
        types:RoleV2[] groupRoles = check storage:getGroupRoles(group.groupId, effectiveScope);
        foreach types:RoleV2 role in groupRoles {
            rolesMap[role.roleId] = role;
        }
    }
    types:RoleV2[] roles = rolesMap.toArray();

    UserAuthzContext context = {
        userId: userId,
        scope: effectiveScope,
        groups: groups,
        roles: roles,
        permissions: permissions,
        permissionNames: permissionNames
    };

    log:printDebug(string `Built context: ${groups.length()} groups, ${roles.length()} roles, ${permissionNames.length()} permissions`);
    return context;
}

// Get flattened list of all permission names for a user across ALL scopes
// This is used for JWT generation - gives user's complete permission set
public isolated function getUserPermissionNames(string userId) returns string[]|error {
    log:printDebug(string `Getting all permission names for user ${userId}`);

    // Get all permissions across all scopes (org, project, integration levels)
    types:Permission[] permissions = check storage:getAllUserPermissions(userId);

    // Extract unique permission names
    map<boolean> permissionNameMap = {};
    foreach types:Permission permission in permissions {
        permissionNameMap[permission.permissionName] = true;
    }

    string[] permissionNames = permissionNameMap.keys();
    log:printDebug(string `User ${userId} has ${permissionNames.length()} unique permissions`);

    return permissionNames;
}

// Quick check if user has Super Admin role (org-level, all permissions)
public isolated function isSuperAdmin(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} is super admin`);

    // Get user's groups
    types:Group[] groups = check storage:getUserGroups(userId);

    // Get org-level scope
    types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};

    // Check if any group has the Super Admin role at org level
    foreach types:Group group in groups {
        types:RoleV2[] roles = check storage:getGroupRoles(group.groupId, orgScope);
        foreach types:RoleV2 role in roles {
            if role.roleName == "Super Admin" {
                log:printDebug(string `User ${userId} IS super admin via group ${group.groupId}`);
                return true;
            }
        }
    }

    log:printDebug(string `User ${userId} is NOT super admin`);
    return false;
}

// Check if user is an admin (has Admin or Super Admin role)
public isolated function isAdmin(string userId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} is admin`);

    // Get user's groups
    types:Group[] groups = check storage:getUserGroups(userId);

    // Get org-level scope
    types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};

    // Check if any group has Admin or Super Admin role at org level
    foreach types:Group group in groups {
        types:RoleV2[] roles = check storage:getGroupRoles(group.groupId, orgScope);
        foreach types:RoleV2 role in roles {
            if role.roleName == "Admin" || role.roleName == "Super Admin" {
                log:printDebug(string `User ${userId} IS admin via role ${role.roleName}`);
                return true;
            }
        }
    }

    log:printDebug(string `User ${userId} is NOT admin`);
    return false;
}

// ============================================================================
// Type Definitions
// ============================================================================

// Complete authorization context for a user
// This includes all information needed to make authorization decisions
public type UserAuthzContext record {
    string userId;
    types:AccessScope scope;
    types:Group[] groups;
    types:RoleV2[] roles;
    types:Permission[] permissions;
    string[] permissionNames; // Flattened list for JWT storage
};
