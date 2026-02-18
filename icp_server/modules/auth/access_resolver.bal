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
// RBAC V2 - Access Resolver
// ============================================================================
// This module provides hierarchical access resolution and batch access checks
// for efficient resource filtering.
// ============================================================================

// ============================================================================
// Hierarchical Access Resolution
// ============================================================================

// Resolve project access through org → project hierarchy
// Returns access info including whether access is granted and at what level
public isolated function resolveProjectAccess(string userId, string projectId) returns ProjectAccessInfo|error {
    log:printDebug(string `Resolving project access for user ${userId} on project ${projectId}`);

    boolean hasAccess = check storage:hasAccessToProject(userId, projectId);

    if !hasAccess {
        return {
            hasAccess: false,
            accessLevel: "none",
            projectId: projectId
        };
    }

    // Check access level by querying the view
    types:UserProjectAccess[] projectAccess = check storage:getUserAccessibleProjects(userId);
    
    foreach types:UserProjectAccess access in projectAccess {
        if access.projectUuid == projectId {
            return {
                hasAccess: true,
                accessLevel: access.accessLevel,
                projectId: projectId,
                roleId: access.roleId
            };
        }
    }

    // Has access but not in view results (shouldn't happen)
    return {
        hasAccess: true,
        accessLevel: "unknown",
        projectId: projectId
    };
}

// Resolve integration access through org → project → integration hierarchy
// Returns access info including whether access is granted and at what level
public isolated function resolveIntegrationAccess(string userId, string integrationId) returns IntegrationAccessInfo|error {
    log:printDebug(string `Resolving integration access for user ${userId} on integration ${integrationId}`);

    boolean hasAccess = check storage:hasAccessToIntegration(userId, integrationId);

    if !hasAccess {
        return {
            hasAccess: false,
            accessLevel: "none",
            integrationId: integrationId
        };
    }

    // Check access level by querying the view
    types:UserIntegrationAccess[] integrationAccess = check storage:getUserAccessibleIntegrations(userId);
    
    foreach types:UserIntegrationAccess access in integrationAccess {
        if access.integrationUuid == integrationId {
            return {
                hasAccess: true,
                accessLevel: access.accessLevel,
                integrationId: integrationId,
                projectId: access.projectUuid,
                roleId: access.roleId,
                envRestriction: access.envUuid
            };
        }
    }

    // Has access but not in view results (shouldn't happen)
    return {
        hasAccess: true,
        accessLevel: "unknown",
        integrationId: integrationId
    };
}

// Resolve environment access restrictions for a user
// Returns list of allowed environments, or () if all environments are accessible
public isolated function resolveEnvironmentAccess(string userId, string? projectId = (), string? integrationId = ()) returns EnvironmentAccessInfo|error {
    log:printDebug(string `Resolving environment access for user ${userId}`);

    string[]? allowedEnvs = check storage:getEnvironmentRestriction(userId, projectId, integrationId);

    if allowedEnvs is () {
        return {
            hasRestriction: false,
            allowedEnvironments: (),
            restrictionLevel: "none"
        };
    }

    if allowedEnvs.length() == 0 {
        return {
            hasRestriction: true,
            allowedEnvironments: [],
            restrictionLevel: "blocked"
        };
    }

    return {
        hasRestriction: true,
        allowedEnvironments: allowedEnvs,
        restrictionLevel: "filtered"
    };
}

// ============================================================================
// Batch Access Checks (for performance)
// ============================================================================

// Filter a list of project IDs to only those the user can access
// Returns subset of projectIds that user has access to
public isolated function filterAccessibleProjects(string userId, string[] projectIds) returns string[]|error {
    log:printDebug(string `Filtering ${projectIds.length()} projects for user ${userId}`);

    if projectIds.length() == 0 {
        return [];
    }

    // Get all accessible projects for user
    types:UserProjectAccess[] accessibleProjects = check storage:getUserAccessibleProjects(userId);
    
    // Build a set of accessible project IDs
    map<boolean> accessibleProjectMap = {};
    foreach types:UserProjectAccess access in accessibleProjects {
        accessibleProjectMap[access.projectUuid] = true;
    }

    // Filter input list
    string[] filteredProjects = [];
    foreach string projectId in projectIds {
        if accessibleProjectMap.hasKey(projectId) {
            filteredProjects.push(projectId);
        }
    }

    log:printDebug(string `User ${userId} has access to ${filteredProjects.length()} of ${projectIds.length()} projects`);
    return filteredProjects;
}

// Filter a list of integration IDs to only those the user can access
// Returns subset of integrationIds that user has access to
public isolated function filterAccessibleIntegrations(string userId, string[] integrationIds, string? projectId = (), string? envId = ()) returns string[]|error {
    log:printDebug(string `Filtering ${integrationIds.length()} integrations for user ${userId}`);

    if integrationIds.length() == 0 {
        return [];
    }

    // Get all accessible integrations for user
    types:UserIntegrationAccess[] accessibleIntegrations = check storage:getUserAccessibleIntegrations(userId, projectId, envId);
    
    // Build a set of accessible integration IDs
    map<boolean> accessibleIntegrationMap = {};
    foreach types:UserIntegrationAccess access in accessibleIntegrations {
        accessibleIntegrationMap[access.integrationUuid] = true;
    }

    // Filter input list
    string[] filteredIntegrations = [];
    foreach string integrationId in integrationIds {
        if accessibleIntegrationMap.hasKey(integrationId) {
            filteredIntegrations.push(integrationId);
        }
    }

    log:printDebug(string `User ${userId} has access to ${filteredIntegrations.length()} of ${integrationIds.length()} integrations`);
    return filteredIntegrations;
}

// Filter a list of runtime IDs to only those the user can access
// Returns subset of runtimeIds that user has access to
// Note: This checks both integration access AND environment restrictions
public isolated function filterAccessibleRuntimes(string userId, string[] runtimeIds) returns string[]|error {
    log:printDebug(string `Filtering ${runtimeIds.length()} runtimes for user ${userId}`);

    if runtimeIds.length() == 0 {
        return [];
    }

    // Check each runtime individually (could be optimized with a batch query in the future)
    string[] filteredRuntimes = [];
    foreach string runtimeId in runtimeIds {
        boolean hasAccess = check storage:hasAccessToRuntime(userId, runtimeId);
        if hasAccess {
            filteredRuntimes.push(runtimeId);
        }
    }

    log:printDebug(string `User ${userId} has access to ${filteredRuntimes.length()} of ${runtimeIds.length()} runtimes`);
    return filteredRuntimes;
}

// Get all accessible projects for a user
// Convenience function that wraps storage layer
public isolated function getAccessibleProjects(string userId) returns types:UserProjectAccess[]|error {
    log:printDebug(string `Getting accessible projects for user ${userId}`);
    return check storage:getUserAccessibleProjects(userId);
}

// Get all accessible integrations for a user
// Convenience function that wraps storage layer
public isolated function getAccessibleIntegrations(string userId, string? projectId = (), string? envId = ()) returns types:UserIntegrationAccess[]|error {
    log:printDebug(string `Getting accessible integrations for user ${userId}`);
    return check storage:getUserAccessibleIntegrations(userId, projectId, envId);
}

// ============================================================================
// Type Definitions
// ============================================================================

// Project access information with hierarchy details
public type ProjectAccessInfo record {
    boolean hasAccess;
    string accessLevel; // "org", "project", "integration", "none", "unknown"
    string projectId;
    string? roleId?; // Role ID that grants this access
};

// Integration access information with hierarchy details
public type IntegrationAccessInfo record {
    boolean hasAccess;
    string accessLevel; // "org", "project", "integration", "none", "unknown"
    string integrationId;
    string? projectId?; // Parent project ID
    string? roleId?; // Role ID that grants this access
    string? envRestriction?; // If set, only this environment is accessible
};

// Environment access restrictions
public type EnvironmentAccessInfo record {
    boolean hasRestriction;
    string[]? allowedEnvironments; // () = all allowed, [] = none allowed, [ids] = specific envs
    string restrictionLevel; // "none", "filtered", "blocked"
};
