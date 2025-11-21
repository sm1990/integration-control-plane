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

// Get user details by user ID
public isolated function getUserDetailsById(string userId) returns types:User|error {
    log:printDebug(string `Fetching user details for userId: ${userId}`);
    types:User|sql:Error user = dbClient->queryRow(
        `SELECT user_id, username, display_name, is_super_admin, is_project_author, created_at, updated_at 
         FROM users 
         WHERE user_id = ${userId}`
        );

    if user is sql:Error {
        log:printError(string `Failed to get user details for ${userId}`, user);
        return user;
    }

    return user;
}

// Create a new user
public isolated function createUser(string userId, string username, string displayName) returns error? {
    log:printDebug(string `Creating user: ${username} with userId: ${userId}`);
    sql:ExecutionResult|sql:Error result = dbClient->execute(
        `INSERT INTO users (user_id, username, display_name) 
         VALUES (${userId}, ${username}, ${displayName})`
        );

    if result is sql:Error {
        log:printError(string `Failed to create user ${username}`, result);
        return result;
    }

    log:printInfo(string `Successfully created user ${username}`);
    return ();
}

// Get user roles by user ID
public isolated function getUserRoles(string userId) returns types:Role[]|error {
    log:printDebug(string `Fetching roles for user: ${userId}`);
    types:Role[] roles = [];
    stream<types:Role, sql:Error?> roleStream = dbClient->query(
        `SELECT r.role_id, r.project_id, r.environment_type, r.privilege_level, r.role_name, r.created_at, r.updated_at
         FROM roles r
         JOIN user_roles ur ON r.role_id = ur.role_id
         WHERE ur.user_id = ${userId}`
        );

    check from types:Role role in roleStream
        do {
            roles.push(role);
        };

    return roles;
}

// Get or create a role for a specific project-environment-type-privilege combination
isolated function getOrCreateRole(string projectId, types:EnvironmentType environmentType, types:PrivilegeLevel privilegeLevel) returns string|error {
    // First try to get existing role
    stream<record {|string role_id;|}, sql:Error?> roleStream = dbClient->query(
        `SELECT role_id FROM roles 
         WHERE project_id = ${projectId} 
         AND environment_type = ${environmentType} 
         AND privilege_level = ${privilegeLevel}`
        );

    record {|string role_id;|}[] existingRoles = check from record {|string role_id;|} role in roleStream
        select role;

    if existingRoles.length() > 0 {
        return existingRoles[0].role_id;
    }

    // Role doesn't exist, create it
    string roleId = uuid:createType1AsString();

    // Get project name for role naming
    types:Project project = check getProjectById(projectId);
    string projectName = re `\s+`.replaceAll(project.name, "_");
    string roleName = string `${projectName}:${environmentType}:${privilegeLevel}`;

    sql:ExecutionResult _ = check dbClient->execute(
        `INSERT INTO roles (role_id, project_id, environment_type, privilege_level, role_name)
         VALUES (${roleId}, ${projectId}, ${environmentType}, ${privilegeLevel}, ${roleName})`
        );

    log:printInfo(string `Created new role: ${roleName}`, roleId = roleId);
    return roleId;
}

// Update user roles
public isolated function updateUserRoles(string userId, types:RoleAssignment[] roleAssignments) returns error? {
    log:printDebug(string `Updating roles for user: ${userId}`);

    transaction {
        // First, delete all existing user_roles for this user
        sql:ExecutionResult _ = check dbClient->execute(
            `DELETE FROM user_roles WHERE user_id = ${userId}`
            );

        // Insert new role assignments
        foreach types:RoleAssignment assignment in roleAssignments {
            // Get or create the role
            string roleId = check getOrCreateRole(
                        assignment.projectId,
                    assignment.environmentType,
                    assignment.privilegeLevel
                );

            // Assign role to user
            sql:ExecutionResult _ = check dbClient->execute(
                `INSERT INTO user_roles (user_id, role_id)
                 VALUES (${userId}, ${roleId})`
                );
        }

        check commit;
        log:printInfo(string `Successfully updated roles for user ${userId} with ${roleAssignments.length()} assignments`);
    } on fail error e {
        log:printError(string `Transaction failed while updating roles for user ${userId}`, e);
        return error(string `Failed to update user roles for ${userId}`, e);
    }

    return ();
}

// Update user's project author flag (super admin only)
public isolated function updateUserProjectAuthor(string userId, boolean isProjectAuthor) returns error? {
    log:printDebug(string `Updating project author flag for user: ${userId} to ${isProjectAuthor}`);

    sql:ExecutionResult result = check dbClient->execute(
        `UPDATE users 
         SET is_project_author = ${isProjectAuthor}
         WHERE user_id = ${userId}`
        );

    if result.affectedRowCount == 0 {
        return error(string `User not found: ${userId}`);
    }

    log:printInfo(string `Successfully updated project author flag for user ${userId} to ${isProjectAuthor}`);
    return ();
}

// Get all environment IDs where a component has runtimes
public isolated function getEnvironmentIdsWithRuntimes(string componentId) returns string[]|error {
    log:printDebug(string `Fetching environment IDs where component ${componentId} has runtimes`);

    stream<record {|string environment_Id;|}, sql:Error?> envStream = dbClient->query(
        `SELECT DISTINCT environment_id 
         FROM runtimes 
         WHERE component_id = ${componentId}`
        );

    string[] environmentIds = [];
    check from record {|string environment_Id;|} envRecord in envStream
        do {
            environmentIds.push(envRecord.environment_Id);
        };

    log:printInfo(string `Component ${componentId} has runtimes in ${environmentIds.length()} environments`);
    return environmentIds;
}

// Get all users with their roles
public isolated function getAllUsers() returns types:UserWithRoles[]|error {
    log:printDebug("Fetching all users with roles");
    types:UserWithRoles[] users = [];

    stream<types:User, sql:Error?> userStream = dbClient->query(
        `SELECT user_id, username, display_name, is_super_admin, is_project_author, created_at, updated_at
         FROM users
         ORDER BY username ASC`
        );

    check from types:User user in userStream
        do {
            types:Role[] userRoles = [];
            types:Role[]|error rolesResult = getUserRoles(user.userId);
            if rolesResult is error {
                log:printError(string `Failed to get roles for user ${user.userId}`, rolesResult);
            } else {
                userRoles = rolesResult;
            }

            types:UserWithRoles userWithRoles = {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                isSuperAdmin: user.isSuperAdmin,
                isProjectAuthor: user.isProjectAuthor,
                createdAt: user?.createdAt,
                updatedAt: user?.updatedAt,
                roles: userRoles
            };
            users.push(userWithRoles);
        };

    log:printInfo(string `Successfully fetched ${users.length()} users`);
    return users;
}

// Get users who have roles in specified projects (RBAC-aware for admin users)
public isolated function getUsersByProjectIds(string[] projectIds) returns types:UserWithRoles[]|error {
    if projectIds.length() == 0 {
        return [];
    }

    log:printDebug(string `Fetching users with roles in ${projectIds.length()} projects`);
    types:UserWithRoles[] users = [];

    sql:ParameterizedQuery selectClause = `SELECT DISTINCT u.user_id, u.username, u.display_name, u.is_super_admin, u.is_project_author, u.created_at, u.updated_at
         FROM users u
         INNER JOIN user_roles ur ON u.user_id = ur.user_id
         INNER JOIN roles r ON ur.role_id = r.role_id
         WHERE r.project_id IN (`;

    sql:ParameterizedQuery inClause = ``;
    foreach int i in 0 ..< projectIds.length() {
        if i > 0 {
            inClause = sql:queryConcat(inClause, `, `);
        }
        inClause = sql:queryConcat(inClause, `${projectIds[i]}`);
    }

    sql:ParameterizedQuery orderByClause = `) ORDER BY u.username ASC`;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, inClause, orderByClause);

    stream<types:User, sql:Error?> userStream = dbClient->query(query);

    check from types:User user in userStream
        do {
            types:Role[] userRoles = [];
            types:Role[]|error rolesResult = getUserRoles(user.userId);
            if rolesResult is error {
                log:printError(string `Failed to get roles for user ${user.userId}`, rolesResult);
            } else {
                userRoles = rolesResult;
            }

            types:UserWithRoles userWithRoles = {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                isSuperAdmin: user.isSuperAdmin,
                isProjectAuthor: user.isProjectAuthor,
                createdAt: user?.createdAt,
                updatedAt: user?.updatedAt,
                roles: userRoles
            };
            users.push(userWithRoles);
        };

    log:printInfo(string `Successfully fetched ${users.length()} users for specified projects`);
    return users;
}

// Delete a user by ID
public isolated function deleteUserById(string userId) returns error? {
    log:printDebug(string `Deleting user: ${userId}`);

    // Delete from users table (will cascade to user_roles)
    sql:ExecutionResult|error result = check dbClient->execute(`DELETE FROM users WHERE user_id = ${userId}`);
    if result is sql:Error {
        log:printError(string `Failed to delete user ${userId}`, result);
        return result;
    }
    log:printInfo(string `Successfully deleted user ${userId}`);
}

// Update user profile (display name)
public isolated function updateUserProfile(string userId, string displayName) returns error? {
    log:printDebug(string `Updating profile for user: ${userId}`);

    types:User|error existingUser = getUserDetailsById(userId);
    if existingUser is error {
        log:printError(string `User not found: ${userId}`, existingUser);
        return error(string `User not found: ${userId}`);
    }

    sql:ExecutionResult|error result = check dbClient->execute(
    `UPDATE users 
        SET display_name = ${displayName}, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ${userId}`
    );
    if result is error {
        log:printError(string `Failed to update profile for user ${userId}`, result);
        return result;
    }

    log:printInfo(string `Successfully updated profile for user ${userId}`);
}
