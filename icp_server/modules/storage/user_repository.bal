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

// Get user details by user ID
public isolated function getUserDetailsById(string userId) returns types:User|error {
    log:printDebug(string `Fetching user details for userId: ${userId}`);
    types:User|sql:Error user = dbClient->queryRow(
        `SELECT user_id, username, display_name, is_super_admin, is_project_author, is_oidc_user, require_password_change, created_at, updated_at
         FROM users
         WHERE user_id = ${userId}`
        );

    if user is sql:Error {
        log:printError(string `Failed to get user details for ${userId}`, user);
        return user;
    }

    return user;
}

// ============================================================================
// RBAC V2 - User Management Functions
// ============================================================================

// Get single user with group memberships (RBAC v2)
public isolated function getUserWithGroupsById(string userId) returns json|error {
    log:printDebug(string `Fetching user with group memberships for userId: ${userId}`);
    
    // Get user details
    types:User|error user = getUserDetailsById(userId);
    if user is error {
        return user;
    }

    // Build user with groups
    json userWithGroups = {
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        isSuperAdmin: user.isSuperAdmin,
        isProjectAuthor: user.isProjectAuthor,
        isOidcUser: user.isOidcUser,
        groups: check getGroupsForUser(user.userId),
        groupCount: (check getGroupsForUser(user.userId)).length(),
        createdAt: user?.createdAt,
        updatedAt: user?.updatedAt
    };

    log:printInfo(string `Successfully fetched user ${user.username} with group memberships`);
    return userWithGroups;
}

// Get all users with their group memberships (RBAC v2)
public isolated function getAllUsersV2() returns json[]|error {
    log:printDebug("Fetching all users with group memberships (RBAC v2)");
    
    // Get all users
    stream<types:User, sql:Error?> userStream = dbClient->query(
        `SELECT user_id, username, display_name, is_super_admin, is_project_author, is_oidc_user, require_password_change, created_at, updated_at
         FROM users
         ORDER BY username ASC`
    );

    // Collect all users first
    types:User[] users = check from types:User user in userStream
        select user;

    // Build users with groups
    json[] usersWithGroups = from var user in users
        select {
            userId: user.userId,
            username: user.username,
            displayName: user.displayName,
            isSuperAdmin: user.isSuperAdmin,
            isProjectAuthor: user.isProjectAuthor,
            isOidcUser: user.isOidcUser,
            groups: check getGroupsForUser(user.userId),
            groupCount: (check getGroupsForUser(user.userId)).length(),
            createdAt: user?.createdAt,
            updatedAt: user?.updatedAt
        };

    log:printInfo(string `Successfully fetched ${usersWithGroups.length()} users with group memberships`);
    return usersWithGroups;
}

isolated function getGroupsForUser(string userId) returns json[]|error {
    stream<record {|string group_id; string group_name; string description;|}, sql:Error?> groupStream = dbClient->query(
        `SELECT g.group_id, g.group_name, g.description
         FROM user_groups g
         JOIN group_user_mapping gum ON g.group_id = gum.group_id
         WHERE gum.user_uuid = ${userId}
         ORDER BY g.group_name ASC`
    );

    // Collect groups as records
    record {|string group_id; string group_name; string description;|}[] groupRecords = check from var g in groupStream
        select g;

    // Transform to JSON
    return from var g in groupRecords
        select {
            groupId: g.group_id,
            groupName: g.group_name,
            groupDescription: g.description
        };
}

// Create a new user (RBAC v2) with optional group assignments
// Note: This only creates the user record in the main DB. Credentials are managed separately by auth backend.
public isolated function createUserV2(string userId, string username, string displayName, string[] groupIds, boolean isOidcUser = false) returns json|error {
    log:printDebug(string `Creating user (RBAC v2): ${username} with userId: ${userId}`);
    
    // Check if user already exists in main DB
    stream<record {|int count;|}, sql:Error?> countStream = dbClient->query(
        `SELECT COUNT(*) as count FROM users WHERE user_id = ${userId} OR username = ${username}`
    );
    
    record {|int count;|}[] countResult = check from var c in countStream select c;
    if countResult.length() > 0 && countResult[0].count > 0 {
        return error(string `User '${username}' already exists in main database`);
    }
    
    transaction {
        // Insert user into main database
        sql:ExecutionResult _ = check dbClient->execute(
            `INSERT INTO users (user_id, username, display_name, is_super_admin, is_project_author, is_oidc_user)
             VALUES (${userId}, ${username}, ${displayName}, false, false, ${isOidcUser})`
        );
        
        // Add user to groups if specified
        foreach string groupId in groupIds {
            sql:ExecutionResult _ = check dbClient->execute(
                `INSERT INTO group_user_mapping (group_id, user_uuid) VALUES (${groupId}, ${userId})`
            );
            log:printInfo(string `Added user ${userId} to group ${groupId}`);
        }
        
        check commit;
        log:printInfo(string `Successfully created user ${username} with ${groupIds.length()} group assignments`, userId = userId);
    } on fail error e {
        log:printError(string `Transaction failed while creating user ${username}`, 'error = e);
        if e is sql:Error {
            match classifySqlError(e) {
                DUPLICATE_KEY => { return error("A user with this username already exists", e); }
                VALUE_TOO_LONG => { return error("The provided value exceeds the maximum allowed length", e); }
                FOREIGN_KEY_VIOLATION => { return error("The specified group does not exist", e); }
                _ => { return error("An unexpected error occurred. Please contact your administrator.", e); }
            }
        }
        return error("An unexpected error occurred while creating the user. Please contact your administrator.", e);
    }
    
    // Fetch and return the created user with groups
    json[] groups = check getGroupsForUser(userId);
    
    return {
        userId: userId,
        username: username,
        displayName: displayName,
        isSuperAdmin: false,
        isProjectAuthor: false,
        isOidcUser: isOidcUser,
        groups: groups,
        groupCount: groups.length()
    };
}

// Delete a user (RBAC v2)
// Note: This only deletes from main DB. External user stores must be managed separately.
// Safety checks: Cannot delete system admin or self
public isolated function deleteUserV2(string userId, string currentUserId) returns error? {
    log:printDebug(string `Deleting user (RBAC v2): ${userId}`);
    
    // Safety check: Cannot delete system admin
    if userId == "550e8400-e29b-41d4-a716-446655440000" {
        return error("Cannot delete system administrator");
    }
    
    // Safety check: Cannot delete self
    if userId == currentUserId {
        return error("Cannot delete your own user account");
    }
    
    // Check if user exists
    stream<record {|int count;|}, sql:Error?> countStream = dbClient->query(
        `SELECT COUNT(*) as count FROM users WHERE user_id = ${userId}`
    );
    
    record {|int count;|}[] countResult = check from var c in countStream select c;
    if countResult.length() == 0 || countResult[0].count == 0 {
        return error(string `User not found: ${userId}`);
    }
    
    transaction {
        // Delete user from main database (cascades to group_user_mapping via foreign key)
        sql:ExecutionResult result = check dbClient->execute(
            `DELETE FROM users WHERE user_id = ${userId}`
        );
        
        // Revoke all refresh tokens for this user
        sql:ExecutionResult _ = check dbClient->execute(
            `DELETE FROM refresh_tokens WHERE user_id = ${userId}`
        );
        
        check commit;
        
        if result.affectedRowCount == 0 {
            log:printWarn(string `User ${userId} was not found during deletion`);
            return error(string `User not found: ${userId}`);
        }
        
        log:printInfo(string `Successfully deleted user ${userId} from main database`);
    } on fail error e {
        log:printError(string `Transaction failed while deleting user ${userId}`, 'error = e);
        if e is sql:Error {
            match classifySqlError(e) {
                FOREIGN_KEY_VIOLATION => { return error("Cannot delete user because they have dependent resources", e); }
                _ => { return error("An unexpected error occurred. Please contact your administrator.", e); }
            }
        }
        return error("An unexpected error occurred while deleting the user. Please contact your administrator.", e);
    }
}

// Set or clear the require_password_change flag for a user in the main DB
public isolated function setRequirePasswordChange(string userId, boolean requireChange) returns error? {
    log:printDebug(string `Setting require_password_change=${requireChange.toString()} for user: ${userId}`);

    sql:ExecutionResult|sql:Error result = dbClient->execute(
        `UPDATE users
         SET require_password_change = ${requireChange}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ${userId}`
    );

    if result is sql:Error {
        log:printError(string `Failed to update password change flag for user ${userId}`, 'error = result);
        return error("An unexpected error occurred. Please contact your administrator.", result);
    }

    if result.affectedRowCount == 0 {
        return error(string `User not found: ${userId}`);
    }

    log:printInfo(string `Successfully set require_password_change=${requireChange.toString()} for user ${userId}`);
    return ();
}
