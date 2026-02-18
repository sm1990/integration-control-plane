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
