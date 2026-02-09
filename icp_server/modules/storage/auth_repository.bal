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

import icp_server.types as types;

import ballerina/log;
import ballerina/sql;
import ballerina/uuid;

// ============================================================================
// RBAC V2 - Authorization Repository
// ============================================================================
// This module provides data access functions for the group-based, 
// permission-driven authorization system (RBAC V2).
//
// Organization: All queries default to org_uuid=1 for single-tenant mode
// ============================================================================

public const int DEFAULT_ORG_ID = 1;

// ============================================================================
// 3.1 Organization Helper Functions
// ============================================================================

// Get organization ID by handle
public isolated function getOrgIdByHandle(string orgHandle) returns int|error {
    log:printDebug(string `Resolving org handle: ${orgHandle} to org ID`);
    
    record {|int org_id;|} result = check dbClient->queryRow(
        `SELECT org_id FROM organizations WHERE org_handle = ${orgHandle}`
    );
    
    return result.org_id;
}

// ============================================================================
// 3.2 Group Management Functions
// ============================================================================

// Create a new group
public isolated function createGroup(types:GroupInput input) returns string|error {
    string groupId = uuid:createType1AsString();
    int orgId = input.orgUuid ?: DEFAULT_ORG_ID;

    log:printDebug(string `Creating group: ${input.groupName} with groupId: ${groupId}`);

    sql:ExecutionResult|error result = dbClient->execute(
        `INSERT INTO user_groups (group_id, group_name, org_uuid, description) 
         VALUES (${groupId}, ${input.groupName}, ${orgId}, ${input.description})`
    );

    if result is error {
        log:printError(string `Failed to create group ${input.groupName}`, result);
        return result;
    }

    log:printInfo(string `Successfully created group ${input.groupName}`, groupId = groupId);
    return groupId;
}

// Get group by ID
public isolated function getGroupById(string groupId) returns types:Group|error {
    log:printDebug(string `Fetching group details for groupId: ${groupId}`);

    types:Group group = check dbClient->queryRow(
        `SELECT group_id, group_name, org_uuid, description, created_at, updated_at 
         FROM user_groups 
         WHERE group_id = ${groupId}`
    );

    return group;
}

// Get all groups for an organization
public isolated function getGroupsByOrgId(int orgId) returns types:Group[]|error {
    log:printDebug(string `Fetching groups for orgId: ${orgId}`);

    types:Group[] groups = [];
    stream<types:Group, sql:Error?> groupStream = dbClient->query(
        `SELECT group_id, group_name, org_uuid, description, created_at, updated_at 
         FROM user_groups 
         WHERE org_uuid = ${orgId}`
    );

    check from types:Group group in groupStream
        do {
            groups.push(group);
        };

    return groups;
}

// Update group details
public isolated function updateGroup(string groupId, types:GroupInput input) returns error? {
    log:printDebug(string `Updating group: ${groupId}`);

    sql:ExecutionResult result = check dbClient->execute(
        `UPDATE user_groups 
         SET group_name = ${input.groupName}, 
             description = ${input.description}
         WHERE group_id = ${groupId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `Group not found: ${groupId}`);
    }

    log:printInfo(string `Successfully updated group ${groupId}`);
    return ();
}

// Delete a group
public isolated function deleteGroup(string groupId) returns error? {
    log:printDebug(string `Deleting group: ${groupId}`);

    sql:ExecutionResult result = check dbClient->execute(
        `DELETE FROM user_groups WHERE group_id = ${groupId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `Group not found: ${groupId}`);
    }

    log:printInfo(string `Successfully deleted group ${groupId}`);
    return ();
}

// ============================================================================
// 3.3 Role V2 Management Functions
// ============================================================================

// Create a new role
public isolated function createRoleV2(types:RoleV2Input input) returns string|error {
    string roleId = uuid:createType1AsString();
    int orgId = input.orgId ?: DEFAULT_ORG_ID;

    log:printDebug(string `Creating role: ${input.roleName} with roleId: ${roleId}`);

    sql:ExecutionResult|error result = dbClient->execute(
        `INSERT INTO roles_v2 (role_id, role_name, org_id, description) 
         VALUES (${roleId}, ${input.roleName}, ${orgId}, ${input.description})`
    );

    if result is error {
        log:printError(string `Failed to create role ${input.roleName}`, result);
        return result;
    }

    log:printInfo(string `Successfully created role ${input.roleName}`, roleId = roleId);
    return roleId;
}

// Get role by ID
public isolated function getRoleV2ById(string roleId) returns types:RoleV2|error {
    log:printDebug(string `Fetching role details for roleId: ${roleId}`);

    types:RoleV2 role = check dbClient->queryRow(
        `SELECT role_id, role_name, org_id, description, created_at, updated_at 
         FROM roles_v2 
         WHERE role_id = ${roleId}`
    );

    return role;
}

// Get all roles for an organization
public isolated function getAllRolesV2(int orgId) returns types:RoleV2[]|error {
    log:printDebug(string `Fetching all roles for orgId: ${orgId}`);

    types:RoleV2[] roles = [];
    stream<types:RoleV2, sql:Error?> roleStream = dbClient->query(
        `SELECT role_id, role_name, org_id, description, created_at, updated_at 
         FROM roles_v2 
         WHERE org_id = ${orgId}
         ORDER BY role_name`
    );

    check from types:RoleV2 role in roleStream
        do {
            roles.push(role);
        };

    return roles;
}

// Update role details
public isolated function updateRoleV2(string roleId, types:RoleV2Input input) returns error? {
    log:printDebug(string `Updating role: ${roleId}`);

    sql:ExecutionResult result = check dbClient->execute(
        `UPDATE roles_v2 
         SET role_name = ${input.roleName}, 
             description = ${input.description}
         WHERE role_id = ${roleId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `Role not found: ${roleId}`);
    }

    log:printInfo(string `Successfully updated role ${roleId}`);
    return ();
}

// Delete a role
public isolated function deleteRoleV2(string roleId) returns error? {
    log:printDebug(string `Deleting role: ${roleId}`);

    sql:ExecutionResult result = check dbClient->execute(
        `DELETE FROM roles_v2 WHERE role_id = ${roleId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `Role not found: ${roleId}`);
    }

    log:printInfo(string `Successfully deleted role ${roleId}`);
    return ();
}

// ============================================================================
// 3.4 Permission Management Functions
// ============================================================================

// Get permission by ID
public isolated function getPermissionById(string permissionId) returns types:Permission|error {
    log:printDebug(string `Fetching permission details for permissionId: ${permissionId}`);

    types:Permission permission = check dbClient->queryRow(
        `SELECT permission_id, permission_name, permission_domain, resource_type, action, description, created_at, updated_at 
         FROM permissions 
         WHERE permission_id = ${permissionId}`
    );

    return permission;
}

// Get permission by name
public isolated function getPermissionByName(string permissionName) returns types:Permission|error {
    log:printDebug(string `Fetching permission details for permissionName: ${permissionName}`);

    types:Permission permission = check dbClient->queryRow(
        `SELECT permission_id, permission_name, permission_domain, resource_type, action, description, created_at, updated_at 
         FROM permissions 
         WHERE permission_name = ${permissionName}`
    );

    return permission;
}

// Get all permissions
public isolated function getAllPermissions() returns types:Permission[]|error {
    log:printDebug("Fetching all permissions");

    types:Permission[] permissions = [];
    stream<types:Permission, sql:Error?> permissionStream = dbClient->query(
        `SELECT permission_id, permission_name, permission_domain, resource_type, action, description, created_at, updated_at 
         FROM permissions 
         ORDER BY permission_domain, permission_name`
    );

    check from types:Permission permission in permissionStream
        do {
            permissions.push(permission);
        };

    return permissions;
}

// Get permissions by domain
public isolated function getPermissionsByDomain(types:PermissionDomain domain) returns types:Permission[]|error {
    log:printDebug(string `Fetching permissions for domain: ${domain}`);

    types:Permission[] permissions = [];
    stream<types:Permission, sql:Error?> permissionStream = dbClient->query(
        `SELECT permission_id, permission_name, permission_domain, resource_type, action, description, created_at, updated_at 
         FROM permissions 
         WHERE permission_domain = ${domain}
         ORDER BY permission_name`
    );

    check from types:Permission permission in permissionStream
        do {
            permissions.push(permission);
        };

    return permissions;
}

// ============================================================================
// 3.5 Mapping Management Functions
// ============================================================================

// Add user to group
public isolated function addUserToGroup(string userId, string groupId) returns error? {
    log:printDebug(string `Adding user ${userId} to group ${groupId}`);

    sql:ExecutionResult|error result = dbClient->execute(
        `INSERT INTO group_user_mapping (group_id, user_uuid) 
         VALUES (${groupId}, ${userId})`
    );

    if result is error {
        log:printError(string `Failed to add user ${userId} to group ${groupId}`, result);
        return result;
    }

    log:printInfo(string `Successfully added user ${userId} to group ${groupId}`);
    return ();
}

// Remove user from group
public isolated function removeUserFromGroup(string userId, string groupId) returns error? {
    log:printDebug(string `Removing user ${userId} from group ${groupId}`);

    sql:ExecutionResult result = check dbClient->execute(
        `DELETE FROM group_user_mapping 
         WHERE group_id = ${groupId} AND user_uuid = ${userId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `User ${userId} not found in group ${groupId}`);
    }

    log:printInfo(string `Successfully removed user ${userId} from group ${groupId}`);
    return ();
}

// Assign role to group with scope context
public isolated function assignRoleToGroup(types:AssignRoleToGroupInput input) returns int|error {
    int orgId = input.orgUuid ?: DEFAULT_ORG_ID;

    log:printDebug(string `Assigning role ${input.roleId} to group ${input.groupId} with scope`);

    sql:ExecutionResult|error result = dbClient->execute(
        `INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid, env_uuid, integration_uuid) 
         VALUES (${input.groupId}, ${input.roleId}, ${orgId}, ${input.projectUuid}, ${input.envUuid}, ${input.integrationUuid})`
    );

    if result is error {
        log:printError(string `Failed to assign role ${input.roleId} to group ${input.groupId}`, result);
        return result;
    }

    int|string? lastInsertId = result.lastInsertId;
    if lastInsertId is int {
        log:printInfo(string `Successfully assigned role ${input.roleId} to group ${input.groupId}`, mappingId = lastInsertId);
        return lastInsertId;
    }

    return error("Failed to retrieve mapping ID after role assignment");
}

// Remove role from group (by mapping ID)
public isolated function removeRoleFromGroup(int mappingId) returns error? {
    log:printDebug(string `Removing group-role mapping with ID: ${mappingId}`);

    sql:ExecutionResult result = check dbClient->execute(
        `DELETE FROM group_role_mapping WHERE id = ${mappingId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `Group-role mapping not found: ${mappingId}`);
    }

    log:printInfo(string `Successfully removed group-role mapping ${mappingId}`);
    return ();
}

// Update group-role mapping scope
public isolated function updateGroupRoleMapping(int mappingId, types:UpdateGroupRoleMappingInput input) returns error? {
    log:printDebug(string `Updating group-role mapping: ${mappingId}`);

    // Build dynamic update query based on provided fields
    sql:ParameterizedQuery updateQuery = `UPDATE group_role_mapping SET `;
    boolean hasUpdate = false;

    if input.groupId is string {
        updateQuery = sql:queryConcat(updateQuery, `group_id = ${input.groupId}`);
        hasUpdate = true;
    }

    if input.roleId is string {
        if hasUpdate {
            updateQuery = sql:queryConcat(updateQuery, `, `);
        }
        updateQuery = sql:queryConcat(updateQuery, `role_id = ${input.roleId}`);
        hasUpdate = true;
    }

    if input.orgUuid is int {
        if hasUpdate {
            updateQuery = sql:queryConcat(updateQuery, `, `);
        }
        updateQuery = sql:queryConcat(updateQuery, `org_uuid = ${input.orgUuid}`);
        hasUpdate = true;
    }

    if input.projectUuid is string {
        if hasUpdate {
            updateQuery = sql:queryConcat(updateQuery, `, `);
        }
        updateQuery = sql:queryConcat(updateQuery, `project_uuid = ${input.projectUuid}`);
        hasUpdate = true;
    }

    if input.envUuid is string {
        if hasUpdate {
            updateQuery = sql:queryConcat(updateQuery, `, `);
        }
        updateQuery = sql:queryConcat(updateQuery, `env_uuid = ${input.envUuid}`);
        hasUpdate = true;
    }

    if input.integrationUuid is string {
        if hasUpdate {
            updateQuery = sql:queryConcat(updateQuery, `, `);
        }
        updateQuery = sql:queryConcat(updateQuery, `integration_uuid = ${input.integrationUuid}`);
        hasUpdate = true;
    }

    if !hasUpdate {
        return error("No fields provided for update");
    }

    updateQuery = sql:queryConcat(updateQuery, ` WHERE id = ${mappingId}`);

    sql:ExecutionResult result = check dbClient->execute(updateQuery);

    if result.affectedRowCount == 0 {
        return error(string `Group-role mapping not found: ${mappingId}`);
    }

    log:printInfo(string `Successfully updated group-role mapping ${mappingId}`);
    return ();
}

// Assign permissions to role
public isolated function assignPermissionsToRole(string roleId, string[] permissionIds) returns error? {
    log:printDebug(string `Assigning ${permissionIds.length()} permissions to role ${roleId}`);

    transaction {
        foreach string permissionId in permissionIds {
            sql:ExecutionResult _ = check dbClient->execute(
                `INSERT INTO role_permission_mapping (role_id, permission_id) 
                 VALUES (${roleId}, ${permissionId})`
            );
        }

        check commit;
        log:printInfo(string `Successfully assigned ${permissionIds.length()} permissions to role ${roleId}`);
    } on fail error e {
        log:printError(string `Transaction failed while assigning permissions to role ${roleId}`, e);
        return error(string `Failed to assign permissions to role ${roleId}`, e);
    }

    return ();
}

// Remove permissions from role
public isolated function removePermissionsFromRole(string roleId, string[] permissionIds) returns error? {
    log:printDebug(string `Removing ${permissionIds.length()} permissions from role ${roleId}`);

    transaction {
        foreach string permissionId in permissionIds {
            sql:ExecutionResult result = check dbClient->execute(
                `DELETE FROM role_permission_mapping 
                 WHERE role_id = ${roleId} AND permission_id = ${permissionId}`
            );

            if result.affectedRowCount == 0 {
                log:printWarn(string `Permission ${permissionId} not found in role ${roleId}, skipping`);
            }
        }

        check commit;
        log:printInfo(string `Successfully removed permissions from role ${roleId}`);
    } on fail error e {
        log:printError(string `Transaction failed while removing permissions from role ${roleId}`, e);
        return error(string `Failed to remove permissions from role ${roleId}`, e);
    }

    return ();
}

// ============================================================================
// 3.6 User Group & Role Resolution Functions
// ============================================================================

// Get all groups for a user
public isolated function getUserGroups(string userId) returns types:Group[]|error {
    log:printDebug(string `Fetching groups for user: ${userId}`);

    types:Group[] groups = [];
    stream<types:Group, sql:Error?> groupStream = dbClient->query(
        `SELECT g.group_id, g.group_name, g.org_uuid, g.description, g.created_at, g.updated_at
         FROM user_groups g
         INNER JOIN group_user_mapping gum ON g.group_id = gum.group_id
         WHERE gum.user_uuid = ${userId}`
    );

    check from types:Group group in groupStream
        do {
            groups.push(group);
        };

    return groups;
}

// Get roles for a group in a specific context (with optional scope filtering)
public isolated function getGroupRoles(string groupId, types:AccessScope? scope) returns types:RoleV2[]|error {
    log:printDebug(string `Fetching roles for group: ${groupId} with scope context`);

    types:RoleV2[] roles = [];
    
    // Build query with optional scope filters
    sql:ParameterizedQuery query = `SELECT DISTINCT r.role_id, r.role_name, r.description, r.created_at, r.updated_at
                                     FROM roles_v2 r
                                     INNER JOIN group_role_mapping grm ON r.role_id = grm.role_id
                                     WHERE grm.group_id = ${groupId}`;

    // Add scope filters if provided
    if scope is types:AccessScope {
        query = sql:queryConcat(query, ` AND grm.org_uuid = ${scope.orgUuid}`);
        
        if scope.projectUuid is string {
            query = sql:queryConcat(query, ` AND (grm.project_uuid = ${scope.projectUuid} OR grm.project_uuid IS NULL)`);
        }
        
        if scope.envUuid is string {
            query = sql:queryConcat(query, ` AND (grm.env_uuid = ${scope.envUuid} OR grm.env_uuid IS NULL)`);
        }
        
        if scope.integrationUuid is string {
            query = sql:queryConcat(query, ` AND (grm.integration_uuid = ${scope.integrationUuid} OR grm.integration_uuid IS NULL)`);
        }
    }

    stream<types:RoleV2, sql:Error?> roleStream = dbClient->query(query);

    check from types:RoleV2 role in roleStream
        do {
            roles.push(role);
        };

    return roles;
}

// Get all permissions for a role
public isolated function getRolePermissions(string roleId) returns types:Permission[]|error {
    log:printDebug(string `Fetching permissions for role: ${roleId}`);

    types:Permission[] permissions = [];
    stream<types:Permission, sql:Error?> permissionStream = dbClient->query(
        `SELECT p.permission_id, p.permission_name, p.permission_domain, p.resource_type, p.action, p.description, p.created_at, p.updated_at
         FROM permissions p
         INNER JOIN role_permission_mapping rpm ON p.permission_id = rpm.permission_id
         WHERE rpm.role_id = ${roleId}
         ORDER BY p.permission_domain, p.permission_name`
    );

    check from types:Permission permission in permissionStream
        do {
            permissions.push(permission);
        };

    return permissions;
}

// Get user's effective permissions in a given scope
// This computes: user → groups → roles (in scope) → permissions
public isolated function getUserEffectivePermissions(string userId, types:AccessScope scope) returns types:Permission[]|error {
    log:printDebug(string `Computing effective permissions for user ${userId} in scope: ${scope.toString()}`);

    types:Permission[] permissions = [];

    // Base EXISTS-style query that checks for existence of a (group -> role -> permission)
    // mapping for the user within the provided scope. We'll append scope-specific clauses
    // (project, env, integration) to match current semantics exactly.
    sql:ParameterizedQuery query = `
        SELECT DISTINCT
            p.permission_id,
            p.permission_name,
            p.permission_domain,
            p.resource_type,
            p.action,
            p.description,
            p.created_at,
            p.updated_at
        FROM permissions p
        WHERE EXISTS (
            SELECT 1
            FROM role_permission_mapping rpm
            INNER JOIN group_role_mapping grm ON grm.role_id = rpm.role_id
            INNER JOIN group_user_mapping gum ON gum.group_id = grm.group_id
            WHERE rpm.permission_id = p.permission_id
              AND gum.user_uuid = ${userId}
              AND grm.org_uuid = ${scope.orgUuid}
    `;

    // Project scope: if projectUuid provided, include org-wide OR project-specific roles.
    // If not provided, restrict to org-wide only (grm.project_uuid IS NULL).
    if scope.projectUuid is string {
        query = sql:queryConcat(query, ` AND (grm.project_uuid IS NULL OR grm.project_uuid = ${scope.projectUuid})`);
    } else {
        query = sql:queryConcat(query, ` AND grm.project_uuid IS NULL`);
    }

    // Environment filter: include roles that apply to all envs OR the specific env when given.
    if scope.envUuid is string {
        query = sql:queryConcat(query, ` AND (grm.env_uuid IS NULL OR grm.env_uuid = ${scope.envUuid})`);
    }

    // Integration scope: if integrationUuid provided include project-wide OR integration-specific roles.
    // If no integration but project scope present, exclude integration-specific roles.
    if scope.integrationUuid is string {
        query = sql:queryConcat(query, ` AND (grm.integration_uuid IS NULL OR grm.integration_uuid = ${scope.integrationUuid})`);
    } else if scope.projectUuid is string {
        // project scope without integration: do not include integration-specific role mappings
        query = sql:queryConcat(query, ` AND grm.integration_uuid IS NULL`);
    }

    // Close the EXISTS and apply ordering
    query = sql:queryConcat(query, `
        ) -- end EXISTS
        ORDER BY p.permission_domain, p.permission_name
    `);

    stream<types:Permission, sql:Error?> permissionStream = dbClient->query(query);

    // Collect results
    check from types:Permission permission in permissionStream
        do {
            permissions.push(permission);
        };

    log:printDebug(string `Found ${permissions.length()} effective permissions for user ${userId}`);
    return permissions;
}

// Get ALL permissions for a user across ALL scopes (org, project, integration levels)
// This is used for JWT token generation at login - returns complete permission set
// regardless of where the permissions are assigned (org-wide, project-specific, or integration-specific)
public isolated function getAllUserPermissions(string userId) returns types:Permission[]|error {
    log:printDebug(string `Fetching all permissions for user ${userId} across all scopes`);

    types:Permission[] permissions = [];

    // Query that gets all unique permissions for a user regardless of scope
    // Joins through: user -> groups -> role mappings (any scope) -> roles -> permissions
    sql:ParameterizedQuery query = `
        SELECT DISTINCT
            p.permission_id,
            p.permission_name,
            p.permission_domain,
            p.resource_type,
            p.action,
            p.description,
            p.created_at,
            p.updated_at
        FROM permissions p
        WHERE EXISTS (
            SELECT 1
            FROM role_permission_mapping rpm
            INNER JOIN group_role_mapping grm ON grm.role_id = rpm.role_id
            INNER JOIN group_user_mapping gum ON gum.group_id = grm.group_id
            WHERE rpm.permission_id = p.permission_id
              AND gum.user_uuid = ${userId}
        )
        ORDER BY p.permission_domain, p.permission_name
    `;

    stream<types:Permission, sql:Error?> permissionStream = dbClient->query(query);

    check from types:Permission permission in permissionStream
        do {
            permissions.push(permission);
        };

    log:printDebug(string `Found ${permissions.length()} total permissions for user ${userId}`);
    return permissions;
}

// ============================================================================
// 3.7 Access Query Functions (Using Views)
// ============================================================================

// Get all projects accessible to a user
public isolated function getUserAccessibleProjects(string userId) returns types:UserProjectAccess[]|error {
    log:printDebug(string `Fetching accessible projects for user: ${userId}`);

    types:UserProjectAccess[] projects = [];
    stream<types:UserProjectAccess, sql:Error?> projectStream = dbClient->query(
        `SELECT user_uuid, project_uuid, project_name, role_id, org_uuid, access_level
         FROM v_user_project_access
         WHERE user_uuid = ${userId}
         ORDER BY project_name`
    );

    check from types:UserProjectAccess project in projectStream
        do {
            projects.push(project);
        };

    log:printDebug(string `Found ${projects.length()} accessible projects for user ${userId}`);
    return projects;
}

// Get all integrations accessible to a user (with optional project and environment filters)
public isolated function getUserAccessibleIntegrations(string userId, string? projectId = (), string? envId = ()) returns types:UserIntegrationAccess[]|error {
    log:printDebug(string `Fetching accessible integrations for user: ${userId}`);

    types:UserIntegrationAccess[] integrations = [];
    
    sql:ParameterizedQuery query = `
        SELECT user_uuid, integration_uuid, integration_name, project_uuid, 
               env_uuid, role_id, access_level
        FROM v_user_integration_access
        WHERE user_uuid = ${userId}`;

    // Apply optional filters
    if projectId is string {
        query = sql:queryConcat(query, ` AND project_uuid = ${projectId}`);
    }

    if envId is string {
        query = sql:queryConcat(query, ` AND (env_uuid = ${envId} OR env_uuid IS NULL)`);
    }

    query = sql:queryConcat(query, ` ORDER BY integration_name`);

    stream<types:UserIntegrationAccess, sql:Error?> integrationStream = dbClient->query(query);

    check from types:UserIntegrationAccess integration in integrationStream
        do {
            integrations.push(integration);
        };

    log:printDebug(string `Found ${integrations.length()} accessible integrations for user ${userId}`);
    return integrations;
}

// Get environment restrictions for a user (with optional project and integration filters)
public isolated function getUserEnvironmentRestrictions(string userId, string? projectId = (), string? integrationId = ()) returns types:UserEnvironmentAccess[]|error {
    log:printDebug(string `Fetching environment restrictions for user: ${userId}`);

    types:UserEnvironmentAccess[] environments = [];
    
    sql:ParameterizedQuery query = `
        SELECT user_uuid, env_uuid, project_uuid, 
               integration_uuid, role_id, scope_level
        FROM v_user_environment_access
        WHERE user_uuid = ${userId}`;

    // Apply optional filters
    if projectId is string {
        query = sql:queryConcat(query, ` AND (project_uuid = ${projectId} OR project_uuid IS NULL)`);
    }

    if integrationId is string {
        query = sql:queryConcat(query, ` AND (integration_uuid = ${integrationId} OR integration_uuid IS NULL)`);
    }

    query = sql:queryConcat(query, ` ORDER BY env_uuid`);

    stream<types:UserEnvironmentAccess, sql:Error?> envStream = dbClient->query(query);

    check from types:UserEnvironmentAccess env in envStream
        do {
            environments.push(env);
        };

    log:printDebug(string `Found ${environments.length()} environment restrictions for user ${userId}`);
    return environments;
}

// ============================================================================
// 3.8 Context-Aware Access Check Functions
// ============================================================================

// Check if user has access to a specific project
public isolated function hasAccessToProject(string userId, string projectId) returns boolean|error {
    log:printDebug(string `Checking project access for user ${userId} on project ${projectId}`);

    int count = check dbClient->queryRow(
        `SELECT COUNT(*) as count
         FROM v_user_project_access
         WHERE user_uuid = ${userId} AND project_uuid = ${projectId}`
    );

    return count > 0;
}

// Check if user has access to a specific integration
public isolated function hasAccessToIntegration(string userId, string integrationId) returns boolean|error {
    log:printDebug(string `Checking integration access for user ${userId} on integration ${integrationId}`);

    int count = check dbClient->queryRow(
        `SELECT COUNT(*) as count
         FROM v_user_integration_access
         WHERE user_uuid = ${userId} AND integration_uuid = ${integrationId}`
    );

    return count > 0;
}

// Get environment restriction for user in a given context
// Returns: () if all environments allowed, or string[] of allowed environment UUIDs
public isolated function getEnvironmentRestriction(string userId, string? projectId = (), string? integrationId = ()) returns string[]?|error {
    log:printDebug(string `Checking environment restrictions for user ${userId}`);

    string[] envIds = [];
    boolean hasNullEnv = false;

    sql:ParameterizedQuery query = `
        SELECT DISTINCT env_uuid
        FROM v_user_environment_access
        WHERE user_uuid = ${userId}`;

    // Apply context filters
    if projectId is string {
        query = sql:queryConcat(query, ` AND (project_uuid = ${projectId} OR project_uuid IS NULL)`);
    }

    if integrationId is string {
        query = sql:queryConcat(query, ` AND (integration_uuid = ${integrationId} OR integration_uuid IS NULL)`);
    }

    stream<record {|string? env_uuid;|}, sql:Error?> envStream = dbClient->query(query);

    check from record {|string? env_uuid;|} env in envStream
        do {
            string? envUuid = env.env_uuid;
            if envUuid is string {
                envIds.push(envUuid);
            } else {
                hasNullEnv = true;
            }
        };

    // If any role has NULL env_uuid, user has access to all environments
    if hasNullEnv {
        log:printDebug(string `User ${userId} has access to all environments in context`);
        return ();
    }

    // If no environment restrictions found at all, deny access
    if envIds.length() == 0 {
        log:printDebug(string `User ${userId} has no environment access in context`);
        return [];
    }

    log:printDebug(string `User ${userId} restricted to ${envIds.length()} specific environments`);
    return envIds;
}

// Check if user has access to a specific runtime (integration + environment combination)
public isolated function hasAccessToRuntime(string userId, string runtimeId) returns boolean|error {
    log:printDebug(string `Checking runtime access for user ${userId} on runtime ${runtimeId}`);

    // First, get the integration_uuid and env_uuid for this runtime
    record {|string integration_uuid; string? env_uuid;|}? runtime = check dbClient->queryRow(
        `SELECT integration_uuid, env_uuid 
         FROM runtimes 
         WHERE runtime_uuid = ${runtimeId}`
    );

    if runtime is () {
        log:printWarn(string `Runtime not found: ${runtimeId}`);
        return false;
    }

    // Check integration access
    boolean hasIntegrationAccess = check hasAccessToIntegration(userId, runtime.integration_uuid);
    if !hasIntegrationAccess {
        return false;
    }

    // If runtime has no specific environment, user needs org/project-level access
    if runtime.env_uuid is () {
        return true;
    }

    // Check environment restriction
    string[]? allowedEnvs = check getEnvironmentRestriction(userId, integrationId = runtime.integration_uuid);

    // If allowedEnvs is (), user has access to all environments
    if allowedEnvs is () {
        return true;
    }

    // Check if runtime's environment is in the allowed list
    foreach string envId in allowedEnvs {
        if envId == runtime.env_uuid {
            return true;
        }
    }

    log:printDebug(string `User ${userId} does not have access to runtime ${runtimeId} (environment restriction)`);
    return false;
}

// ============================================================================
// 3.9 Helper/Utility Functions
// ============================================================================

// Build effective permissions with scope context for a user
// Returns contextual permissions (permission + scope) for use in authorization decisions
public isolated function buildEffectivePermissionsWithScope(string userId, types:AccessScope scope) returns types:ContextualPermission[]|error {
    log:printDebug(string `Building effective permissions with scope for user: ${userId}`);

    types:Permission[] permissions = check getUserEffectivePermissions(userId, scope);

    types:ContextualPermission[] contextualPermissions = [];
    foreach types:Permission permission in permissions {
        contextualPermissions.push({
            permission: permission,
            scope: scope
        });
    }

    log:printDebug(string `Built ${contextualPermissions.length()} contextual permissions for user ${userId}`);
    return contextualPermissions;
}

// Check if user is a member of a specific group
public isolated function isUserInGroup(string userId, string groupId) returns boolean|error {
    log:printDebug(string `Checking if user ${userId} is in group ${groupId}`);

    int count = check dbClient->queryRow(
        `SELECT COUNT(*) as count
         FROM group_user_mapping
         WHERE user_uuid = ${userId} AND group_id = ${groupId}`
    );

    return count > 0;
}

// Get all users in a group
public isolated function getGroupUsers(string groupId) returns string[]|error {
    log:printDebug(string `Fetching users for group: ${groupId}`);

    string[] userIds = [];
    stream<record {|string user_uuid;|}, sql:Error?> userStream = dbClient->query(
        `SELECT user_uuid
         FROM group_user_mapping
         WHERE group_id = ${groupId}
         ORDER BY user_uuid`
    );

    check from record {|string user_uuid;|} user in userStream
        do {
            userIds.push(user.user_uuid);
        };

    log:printDebug(string `Found ${userIds.length()} users in group ${groupId}`);
    return userIds;
}

// Get all groups that have a specific role (in any scope)
public isolated function getRoleGroups(string roleId) returns types:Group[]|error {
    log:printDebug(string `Fetching groups with role: ${roleId}`);

    types:Group[] groups = [];
    stream<types:Group, sql:Error?> groupStream = dbClient->query(
        `SELECT DISTINCT g.group_id, g.group_name, g.org_uuid, g.description, g.created_at, g.updated_at
         FROM user_groups g
         INNER JOIN group_role_mapping grm ON g.group_id = grm.group_id
         WHERE grm.role_id = ${roleId}
         ORDER BY g.group_name`
    );

    check from types:Group group in groupStream
        do {
            groups.push(group);
        };

    log:printDebug(string `Found ${groups.length()} groups with role ${roleId}`);
    return groups;
}

// Check if a specific permission exists by name (useful for validation)
public isolated function permissionExists(string permissionName) returns boolean|error {
    log:printDebug(string `Checking if permission exists: ${permissionName}`);

    int count = check dbClient->queryRow(
        `SELECT COUNT(*) as count
         FROM permissions
         WHERE permission_name = ${permissionName}`
    );

    return count > 0;
}

// Get group-role mappings for a specific group (returns full mapping details including scope)
// Get a single group-role mapping by ID
public isolated function getGroupRoleMappingById(int mappingId) returns types:GroupRoleMapping|error {
    log:printDebug(string `Fetching group-role mapping with ID: ${mappingId}`);

    types:GroupRoleMapping mapping = check dbClient->queryRow(
        `SELECT id, group_id, role_id, org_uuid, project_uuid, env_uuid, integration_uuid, created_at
         FROM group_role_mapping
         WHERE id = ${mappingId}`
    );

    log:printDebug(string `Found mapping: group=${mapping.groupId}, role=${mapping.roleId}`);
    return mapping;
}

public isolated function getGroupRoleMappings(string groupId) returns types:GroupRoleMapping[]|error {
    log:printDebug(string `Fetching role mappings for group: ${groupId}`);

    types:GroupRoleMapping[] mappings = [];
    stream<types:GroupRoleMapping, sql:Error?> mappingStream = dbClient->query(
        `SELECT id, group_id, role_id, org_uuid, project_uuid, env_uuid, integration_uuid, created_at
         FROM group_role_mapping
         WHERE group_id = ${groupId}
         ORDER BY created_at DESC`
    );

    check from types:GroupRoleMapping mapping in mappingStream
        do {
            mappings.push(mapping);
        };

    log:printDebug(string `Found ${mappings.length()} role mappings for group ${groupId}`);
    return mappings;
}

// Get all group-role mappings for a specific role (shows which groups have this role)
public isolated function getRoleMappings(string roleId) returns types:GroupRoleMapping[]|error {
    log:printDebug(string `Fetching group mappings for role: ${roleId}`);

    types:GroupRoleMapping[] mappings = [];
    stream<types:GroupRoleMapping, sql:Error?> mappingStream = dbClient->query(
        `SELECT id, group_id, role_id, org_uuid, project_uuid, env_uuid, integration_uuid, created_at
         FROM group_role_mapping
         WHERE role_id = ${roleId}
         ORDER BY created_at DESC`
    );

    check from types:GroupRoleMapping mapping in mappingStream
        do {
            mappings.push(mapping);
        };

    log:printDebug(string `Found ${mappings.length()} group mappings for role ${roleId}`);
    return mappings;
}

// Get user count in a group
public isolated function getGroupUserCount(string groupId) returns int|error {
    log:printDebug(string `Counting users in group: ${groupId}`);

    int count = check dbClient->queryRow(
        `SELECT COUNT(*) as count
         FROM group_user_mapping
         WHERE group_id = ${groupId}`
    );

    return count;
}

// Get role assignment count (how many groups have this role across all scopes)
public isolated function getRoleAssignmentCount(string roleId) returns int|error {
    log:printDebug(string `Counting role assignments for role: ${roleId}`);

    int count = check dbClient->queryRow(
        `SELECT COUNT(*) as count
         FROM group_role_mapping
         WHERE role_id = ${roleId}`
    );

    return count;
}
