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

import ballerina/http;
import ballerina/jwt;
import ballerina/log;
import ballerina/test;
import ballerina/time;
import icp_server.auth;

// Test configuration
const string AUTH_V2_SERVICE_URL = "https://localhost:9445";
const string SUPER_ADMIN_USERNAME = "admin";
const string SUPER_ADMIN_PASSWORD = "admin";
const string DEFAULT_ORG_HANDLE = "default";
const string SUPER_ADMIN_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

// v1
const string AUTH_SERVICE_URL = "https://localhost:9445";
const string TEST_USERNAME = "admin";
const string TEST_PASSWORD = "admin";
const string INVALID_USERNAME = "nonexistent";
const string INVALID_PASSWORD = "wrongpassword";
const string NEW_USER_USERNAME = "newuser";
const string NEW_USER_PASSWORD = "newuser123";

// HTTP client for testing
final http:Client authClient = check new (AUTH_SERVICE_URL,
    secureSocket = {
        cert: {
            path: truststorePath,
            password: truststorePassword
        }
    }
);

// HTTP client for testing
final http:Client authV2Client = check new (AUTH_V2_SERVICE_URL,
    secureSocket = {
        cert: {
            path: truststorePath,
            password: truststorePassword
        }
    }
);

// Store tokens and IDs for use across tests
string superAdminToken = "";
string testGroupId = "";
string testRoleId = "";
int testMappingId = 0;

// =============================================================================
// Test 1: Login as Super Admin and Verify V2 JWT
// =============================================================================

@test:Config {
    groups: ["auth-v2", "login"]
}
function testSuperAdminLoginWithV2JWT() returns error? {
    // Prepare login request
    json loginRequest = {
        username: SUPER_ADMIN_USERNAME,
        password: SUPER_ADMIN_PASSWORD
    };

    // Send login request
    http:Response response = check authV2Client->post("/auth/login", loginRequest);

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for successful login");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert V2 response structure includes permissions array
    test:assertTrue(responseBody.token is string, "Token should be present in response");
    test:assertTrue(responseBody.permissions is json[], "Permissions array should be present in response");
    test:assertTrue(responseBody.username is string, "Username should be present in response");

    // Store token for subsequent tests
    superAdminToken = check responseBody.token;
    test:assertTrue(superAdminToken.length() > 0, "Token should not be empty");
    log:printInfo("JWT Token: " + superAdminToken);

    // Decode and verify JWT token
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(superAdminToken);

    // Verify JWT claims
    test:assertTrue(payload.sub is string, "Subject should be present in JWT");
    test:assertTrue(payload["username"] is string, "Username should be present in JWT");
    test:assertEquals(payload["username"], SUPER_ADMIN_USERNAME, "Username should match");

    // Verify V2 JWT structure - permissions in scope claim
    test:assertTrue(payload["scope"] is string, "Scope claim should be present in V2 JWT");
    string scopeClaim = check payload["scope"].ensureType();
    test:assertTrue(scopeClaim.includes(auth:PERMISSION_USER_MANAGE_USERS), "Should have user management permission in scope");
    test:assertTrue(scopeClaim.includes(auth:PERMISSION_USER_MANAGE_GROUPS), "Should have group management permission in scope");
    test:assertTrue(scopeClaim.includes(auth:PERMISSION_USER_MANAGE_ROLES), "Should have role management permission in scope");

    // Verify permissions in response body (not in token - only scope claim is used)
    json[] permissionsJsonArray = check responseBody.permissions.ensureType();
    test:assertTrue(permissionsJsonArray.length() > 0, "Permissions array in response should not be empty");
    
    // Verify that all permissions in response are also represented in the scope claim
    foreach json permJson in permissionsJsonArray {
        string permName = check permJson.ensureType();
        test:assertTrue(scopeClaim.includes(permName), string `Permission ${permName} should be in scope claim`);
    }
}

// =============================================================================
// Test 2: Group Management Endpoints
// =============================================================================

@test:Config {
    groups: ["auth-v2", "groups"],
    dependsOn: [testSuperAdminLoginWithV2JWT]
}
function testCreateGroup() returns error? {
    // Prepare create group request
    json groupRequest = {
        groupName: "Test Group V2",
        description: "Test group for RBAC V2"
    };

    // Send create group request
    http:Response response = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups`,
        groupRequest,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 201, "Expected status code 201 for group creation");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.groupId is string, "Group ID should be present");
    test:assertTrue(responseBody.groupName is string, "Group name should be present");
    test:assertEquals(responseBody.groupName, "Test Group V2", "Group name should match");

    // Store group ID for subsequent tests
    testGroupId = check responseBody.groupId;
}

@test:Config {
    groups: ["auth-v2", "groups"],
    dependsOn: [testCreateGroup]
}
function testGetGroupById() returns error? {
    // Send get group request
    http:Response response = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for get group");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertEquals(responseBody.groupId, testGroupId, "Group ID should match");
    test:assertEquals(responseBody.groupName, "Test Group V2", "Group name should match");
    test:assertTrue(responseBody.description is string, "Description should be present");
}

@test:Config {
    groups: ["auth-v2", "groups"],
    dependsOn: [testGetGroupById]
}
function testListGroups() returns error? {
    // Send list groups request
    http:Response response = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for list groups");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response is an array
    test:assertTrue(responseBody is json[], "Response should be an array");
    json[] groups = check responseBody.ensureType();
    test:assertTrue(groups.length() > 0, "Should return at least one group");

    // Verify our test group is in the list
    boolean foundTestGroup = false;
    foreach json group in groups {
        if group.groupId == testGroupId {
            foundTestGroup = true;
            break;
        }
    }
    test:assertTrue(foundTestGroup, "Test group should be in the list");
}

@test:Config {
    groups: ["auth-v2", "groups"],
    dependsOn: [testListGroups]
}
function testUpdateGroup() returns error? {
    // Prepare update group request
    json updateRequest = {
        groupName: "Updated Test Group V2",
        description: "Updated description"
    };

    // Send update group request
    http:Response response = check authV2Client->put(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}`,
        updateRequest,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for group update");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert updated values
    test:assertEquals(responseBody.groupName, "Updated Test Group V2", "Group name should be updated");
    test:assertEquals(responseBody.description, "Updated description", "Description should be updated");
}

// =============================================================================
// Test 2.5: Group-User Mapping Endpoints
// =============================================================================

@test:Config {
    groups: ["auth-v2", "group-users"],
    dependsOn: [testCreateGroup, testSuperAdminLoginWithV2JWT]
}
function testAddUsersToGroup() returns error? {
    // Prepare add users request
    json addUsersRequest = {
        userIds: [SUPER_ADMIN_USER_ID] // Add super admin to the test group
    };

    // Send add users request
    http:Response response = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}/users`,
        addUsersRequest,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for adding users to group");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.message is string, "Message should be present");
    test:assertEquals(responseBody.successCount, 1, "Success count should be 1");
    test:assertEquals(responseBody.failureCount, 0, "Failure count should be 0");
}

@test:Config {
    groups: ["auth-v2", "group-users"],
    dependsOn: [testAddUsersToGroup]
}
function testRemoveUserFromGroup() returns error? {
    // Send remove user request
    http:Response response = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}/users/${SUPER_ADMIN_USER_ID}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for removing user from group");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.message is string, "Message should be present");
    test:assertEquals(responseBody.userId, SUPER_ADMIN_USER_ID, "User ID should match");
    test:assertEquals(responseBody.groupId, testGroupId, "Group ID should match");
}

// =============================================================================
// Test 3: Role Management Endpoints
// =============================================================================

@test:Config {
    groups: ["auth-v2", "roles"],
    dependsOn: [testSuperAdminLoginWithV2JWT]
}
function testCreateRole() returns error? {
    // Prepare create role request
    json roleRequest = {
        roleName: "Test Role V2",
        description: "Test role for RBAC V2",
        permissionIds: [] // Empty for now
    };

    // Send create role request
    http:Response response = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/roles`,
        roleRequest,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 201, "Expected status code 201 for role creation");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.roleId is string, "Role ID should be present");
    test:assertTrue(responseBody.roleName is string, "Role name should be present");
    test:assertEquals(responseBody.roleName, "Test Role V2", "Role name should match");
    test:assertTrue(responseBody.orgId is int, "Org ID should be present");

    // Store role ID for subsequent tests
    testRoleId = check responseBody.roleId;
}

@test:Config {
    groups: ["auth-v2", "roles"],
    dependsOn: [testCreateRole]
}
function testGetRoleById() returns error? {
    // Send get role request
    http:Response response = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/roles/${testRoleId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for get role");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertEquals(responseBody.roleId, testRoleId, "Role ID should match");
    test:assertEquals(responseBody.roleName, "Test Role V2", "Role name should match");
    test:assertTrue(responseBody.permissions is json[], "Permissions array should be present");
}

@test:Config {
    groups: ["auth-v2", "roles"],
    dependsOn: [testGetRoleById]
}
function testListRoles() returns error? {
    // Send list roles request
    http:Response response = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/roles`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for list roles");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response is an array
    test:assertTrue(responseBody is json[], "Response should be an array");
    json[] roles = check responseBody.ensureType();
    test:assertTrue(roles.length() > 0, "Should return at least one role");

    // Verify our test role is in the list
    boolean foundTestRole = false;
    foreach json role in roles {
        if role.roleId == testRoleId {
            foundTestRole = true;
            break;
        }
    }
    test:assertTrue(foundTestRole, "Test role should be in the list");
}

@test:Config {
    groups: ["auth-v2", "roles"],
    dependsOn: [testListRoles]
}
function testUpdateRole() returns error? {
    // Prepare update role request
    json updateRequest = {
        roleName: "Updated Test Role V2",
        description: "Updated role description",
        permissionIds: []
    };

    // Send update role request
    http:Response response = check authV2Client->put(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/roles/${testRoleId}`,
        updateRequest,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for role update");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert updated values
    test:assertEquals(responseBody.roleName, "Updated Test Role V2", "Role name should be updated");
    test:assertEquals(responseBody.description, "Updated role description", "Description should be updated");
}

// =============================================================================
// Test 3.5: Group-Role Mapping Endpoints
// =============================================================================

@test:Config {
    groups: ["auth-v2", "group-roles"],
    dependsOn: [testCreateGroup, testCreateRole]
}
function testAssignRolesToGroup() returns error? {
    // Prepare assign roles request
    json assignRequest = {
        roleIds: [testRoleId], // Assign the test role to test group
        orgUuid: 1 // Org-level scope
    };

    // Send assign roles request
    http:Response response = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}/roles`,
        assignRequest,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for assigning roles to group");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.message is string, "Message should be present");
    test:assertEquals(responseBody.successCount, 1, "Success count should be 1");
    test:assertEquals(responseBody.failureCount, 0, "Failure count should be 0");
    test:assertTrue(responseBody.mappingIds is json[], "Mapping IDs array should be present");
    
    // Store mapping ID for later tests
    json[] mappingIdsJson = check responseBody.mappingIds.ensureType();
    test:assertTrue(mappingIdsJson.length() > 0, "Should have at least one mapping ID");
    testMappingId = check mappingIdsJson[0].ensureType();
    log:printInfo("Stored test mapping ID", mappingId = testMappingId);
}

@test:Config {
    groups: ["auth-v2", "group-roles"],
    dependsOn: [testAssignRolesToGroup]
}
function testListGroupRoleAssignments() returns error? {
    // Send list role assignments request
    http:Response response = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}/roles`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for listing group role assignments");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertEquals(responseBody.groupId, testGroupId, "Group ID should match");
    test:assertTrue(responseBody.mappings is json[], "Mappings array should be present");
    test:assertTrue(responseBody.count is int, "Count should be present");

    // Verify we have at least one mapping (the one we just created)
    json[] mappings = check responseBody.mappings.ensureType();
    test:assertTrue(mappings.length() >= 1, "Should have at least one role assignment");

    // Verify the mapping structure
    json firstMapping = mappings[0];
    test:assertTrue(firstMapping.id is int, "Mapping ID should be present");
    test:assertEquals(firstMapping.roleId, testRoleId, "Role ID should match");
    test:assertTrue(firstMapping.roleName is string, "Role name should be present");
    test:assertTrue(firstMapping.groupId is string, "Group ID should be present");
    
    log:printInfo("Successfully listed group role assignments", count = mappings.length());
}

@test:Config {
    groups: ["auth-v2", "group-roles"],
    dependsOn: [testListGroupRoleAssignments]
}
function testRemoveRoleFromGroup() returns error? {
    // Send delete request
    http:Response response = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}/roles/${testMappingId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for removing role from group");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.message is string, "Message should be present");
    test:assertEquals(responseBody.mappingId, testMappingId, "Mapping ID should match");
    test:assertEquals(responseBody.groupId, testGroupId, "Group ID should match");

    log:printInfo("Successfully removed role from group", mappingId = testMappingId, groupId = testGroupId);
}

// =============================================================================
// Test 4: Permission Endpoints
// =============================================================================

@test:Config {
    groups: ["auth-v2", "permissions"],
    dependsOn: [testSuperAdminLoginWithV2JWT]
}
function testListAllPermissions() returns error? {
    // Send list permissions request (no org scope - tenant-agnostic)
    http:Response response = check authV2Client->get(
        "/auth/permissions",
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for list permissions");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.groupedByDomain is map<json>, "Response should contain groupedByDomain");
    map<json> permissionsByDomain = check responseBody.groupedByDomain.ensureType();
    
    // Verify expected domains are present
    test:assertTrue(permissionsByDomain["User-Management"] is json[], "User-Management domain should be present");
    test:assertTrue(permissionsByDomain["Integration-Management"] is json[], "Integration-Management domain should be present");
    test:assertTrue(permissionsByDomain["Project-Management"] is json[], "Project-Management domain should be present");

    // Verify permissions structure
    json[] userMgtPermissions = check permissionsByDomain["User-Management"].ensureType();
    test:assertTrue(userMgtPermissions.length() > 0, "User-Management should have permissions");

    // Verify each permission has required fields
    json firstPermission = userMgtPermissions[0];
    test:assertTrue(firstPermission.permissionId is string, "Permission should have ID");
    test:assertTrue(firstPermission.permissionName is string, "Permission should have name");
    test:assertTrue(firstPermission.permissionDomain is string, "Permission should have domain");
}

@test:Config {
    groups: ["auth-v2", "permissions"],
    dependsOn: [testSuperAdminLoginWithV2JWT]
}
function testGetUserEffectivePermissions() returns error? {
    // Get admin user ID from token
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(superAdminToken);
    string? userIdOptional = payload.sub;
    test:assertTrue(userIdOptional is string, "User ID should be present in JWT");
    string userId = <string>userIdOptional;

    // Send get user permissions request (org-scoped)
    http:Response response = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users/${userId}/permissions`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for get user permissions");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.permissions is json[], "Permissions array should be present");
    test:assertTrue(responseBody.permissionNames is json[], "Permission names array should be present");

    // Verify super admin has all permissions
    json[] permissions = check responseBody.permissions.ensureType();
    test:assertTrue(permissions.length() > 0, "Super admin should have permissions");

    json[] permissionNames = check responseBody.permissionNames.ensureType();
    test:assertTrue(permissionNames.length() > 0, "Permission names should not be empty");
    
    // Verify super admin has user management permissions
    string permissionNamesStr = permissionNames.toString();
    test:assertTrue(permissionNamesStr.includes(auth:PERMISSION_USER_MANAGE_USERS), "Should have user management permission");
    test:assertTrue(permissionNamesStr.includes(auth:PERMISSION_USER_MANAGE_GROUPS), "Should have group management permission");
    test:assertTrue(permissionNamesStr.includes(auth:PERMISSION_USER_MANAGE_ROLES), "Should have role management permission");
}

// =============================================================================
// Test 5: User Management Endpoints
// =============================================================================

@test:Config {
    groups: ["auth-v2", "users"],
    dependsOn: [testSuperAdminLoginWithV2JWT]
}
function testListUsers() returns error? {
    // Send list users request
    http:Response response = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for list users");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.users is json[], "Users array should be present");
    test:assertTrue(responseBody.count is int, "Count should be present");

    // Verify we have at least one user (the admin)
    json[] users = check responseBody.users.ensureType();
    test:assertTrue(users.length() >= 1, "Should have at least one user");

    // Verify user structure
    json firstUser = users[0];
    test:assertTrue(firstUser.userId is string, "User ID should be present");
    test:assertTrue(firstUser.username is string, "Username should be present");
    test:assertTrue(firstUser.displayName is string, "Display name should be present");
    test:assertTrue(firstUser.groups is json[], "Groups array should be present");
    test:assertTrue(firstUser.groupCount is int, "Group count should be present");

    log:printInfo("Successfully listed users", count = users.length());
}

@test:Config {
    groups: ["auth-v2", "users"],
    dependsOn: [testListUsers]
}
function testCreateUser() returns error? {
    // First, create a test group for user assignment
    json createGroupPayload = {
        groupName: "User Test Group",
        description: "Test group for user management tests"
    };

    http:Response groupResponse = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups`,
        createGroupPayload,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    test:assertEquals(groupResponse.statusCode, 201, "Expected status code 201 for create group");
    json groupBody = check groupResponse.getJsonPayload();
    string userTestGroupId = check groupBody.groupId;

    // Create user payload with unique username using timestamp
    string uniqueUsername = string `testuser_${time:utcNow()[0]}`;
    json createUserPayload = {
        username: uniqueUsername,
        password: "Test@123",
        displayName: "Test User Created By V2",
        groupIds: [userTestGroupId]
    };

    // Send create user request
    http:Response response = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users`,
        createUserPayload,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 201, "Expected status code 201 for create user");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert user structure
    test:assertTrue(responseBody.userId is string, "User ID should be present");
    test:assertTrue(responseBody.username is string, "Username should be present");
    test:assertEquals(responseBody.username, uniqueUsername, "Username should match");
    test:assertEquals(responseBody.displayName, "Test User Created By V2", "Display name should match");
    test:assertEquals(responseBody.isSuperAdmin, false, "New user should not be super admin");
    test:assertEquals(responseBody.isProjectAuthor, false, "New user should not be project author");
    test:assertTrue(responseBody.groups is json[], "Groups array should be present");
    test:assertTrue(responseBody.groupCount is int, "Group count should be present");

    // Verify user was added to the specified group
    json[] groups = check responseBody.groups.ensureType();
    test:assertEquals(groups.length(), 1, "User should be in one group");
    test:assertEquals(groups[0].groupId, userTestGroupId, "User should be in the test group");

    log:printInfo("Successfully created user", username = uniqueUsername);
}

@test:Config {
    groups: ["auth-v2", "users"],
    dependsOn: [testCreateUser]
}
function testCreateUserDuplicateUsername() returns error? {
    // Try to create user with admin username (guaranteed to exist)
    json createUserPayload = {
        username: "admin",
        password: "Another@123",
        displayName: "Another User"
    };

    // Send create user request
    http:Response response = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users`,
        createUserPayload,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status - should be 400 Bad Request
    test:assertEquals(response.statusCode, 400, "Expected status code 400 for duplicate username");

    // Parse response body
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");

    string message = check responseBody.message;
    test:assertTrue(message.includes("already exists"), "Error message should mention duplicate");

    log:printInfo("Successfully validated duplicate username prevention");
}

@test:Config {
    groups: ["auth-v2", "users"],
    dependsOn: [testCreateUser]
}
function testDeleteUser() returns error? {
    // Create a user specifically for deletion
    string timestamp = time:utcNow()[0].toString();
    string uniqueUsername = string `deleteme_${timestamp}`;

    // Create a test group
    json createGroupPayload = {
        groupName: "Delete Test Group",
        groupDescription: "Group for user deletion test"
    };

    http:Response groupResponse = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups`,
        createGroupPayload,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );
    test:assertEquals(groupResponse.statusCode, 201, "Expected status code 201 for group creation");
    json groupBody = check groupResponse.getJsonPayload();
    string deleteTestGroupId = check groupBody.groupId;

    // Create a user in this group
    json createUserPayload = {
        username: uniqueUsername,
        password: "Delete@123",
        displayName: "User To Delete",
        groupIds: [deleteTestGroupId]
    };

    http:Response createResponse = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users`,
        createUserPayload,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );
    test:assertEquals(createResponse.statusCode, 201, "Expected status code 201 for user creation");
    json createBody = check createResponse.getJsonPayload();
    string userIdToDelete = check createBody.userId;

    log:printInfo("Created user for deletion", userId = userIdToDelete, username = uniqueUsername);

    // Delete the user
    http:Response deleteResponse = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users/${userIdToDelete}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status - should be 204 No Content
    test:assertEquals(deleteResponse.statusCode, 204, "Expected status code 204 for successful deletion");

    // Verify user is deleted by trying to list users
    http:Response listResponse = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );
    test:assertEquals(listResponse.statusCode, 200, "Expected status code 200 for list users");
    
    json listBody = check listResponse.getJsonPayload();
    json[] users = check listBody.users.ensureType();
    
    // User should not be in the list
    boolean userFound = false;
    foreach json user in users {
        string userId = check user.userId;
        if userId == userIdToDelete {
            userFound = true;
            break;
        }
    }
    test:assertFalse(userFound, "Deleted user should not appear in users list");

    // Cleanup: Delete the test group
    _ = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${deleteTestGroupId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`},
        targetType = http:Response
    );

    log:printInfo("Successfully deleted user", userId = userIdToDelete);
}

@test:Config {
    groups: ["auth-v2", "users"],
    dependsOn: [testCreateUser]
}
function testDeleteUserNotFound() returns error? {
    // Try to delete a non-existent user
    string nonExistentUserId = "00000000-0000-0000-0000-000000000000";

    http:Response response = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users/${nonExistentUserId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status - should be 404 Not Found
    test:assertEquals(response.statusCode, 404, "Expected status code 404 for non-existent user");

    // Parse response body
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");

    string message = check responseBody.message;
    test:assertTrue(message.includes("not found"), "Error message should mention user not found");

    log:printInfo("Successfully validated user not found error");
}

@test:Config {
    groups: ["auth-v2", "users"],
    dependsOn: [testCreateUser]
}
function testDeleteSelf() returns error? {
    // Try to delete own user account (super admin trying to delete themselves)
    // We need the super admin's user ID
    // From the init script, super admin has userId: 550e8400-e29b-41d4-a716-446655440000

    string superAdminUserId = "550e8400-e29b-41d4-a716-446655440000";

    http:Response response = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users/${superAdminUserId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status - should be 403 Forbidden
    test:assertEquals(response.statusCode, 403, "Expected status code 403 for self-deletion attempt");

    // Parse response body
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");

    string message = check responseBody.message;
    test:assertTrue(
        message.includes("own user account") || message.includes("system administrator"), 
        "Error message should mention self-deletion or system admin protection"
    );

    log:printInfo("Successfully validated self-deletion prevention");
}

@test:Config {
    groups: ["auth-v2", "users"],
    dependsOn: [testCreateUser]
}
function testDeleteSystemAdmin() returns error? {
    // Create a non-admin user to try to delete the system admin
    // First create a regular user
    string timestamp = time:utcNow()[0].toString();
    string regularUsername = string `regular_${timestamp}`;

    json createUserPayload = {
        username: regularUsername,
        password: "Regular@123",
        displayName: "Regular User"
    };

    http:Response createResponse = check authV2Client->post(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users`,
        createUserPayload,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );
    test:assertEquals(createResponse.statusCode, 201, "Expected status code 201 for user creation");

    json createBody = check createResponse.getJsonPayload();
    string regularUserId = check createBody.userId;

    // Login as the regular user to get their token
    json loginPayload = {
        username: regularUsername,
        password: "Regular@123"
    };

    http:Response loginResponse = check authV2Client->post("/auth/login", loginPayload);
    test:assertEquals(loginResponse.statusCode, 200, "Expected status code 200 for login");
    
    json loginBody = check loginResponse.getJsonPayload();
    string regularUserToken = check loginBody.token;

    // Try to delete system admin (with regular user token)
    string superAdminUserId = "550e8400-e29b-41d4-a716-446655440000";

    http:Response response = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users/${superAdminUserId}`,
        headers = {"Authorization": string `Bearer ${regularUserToken}`}
    );

    // Assert response status - should be 403 Forbidden (due to system admin protection)
    test:assertEquals(response.statusCode, 403, "Expected status code 403 for system admin deletion attempt");

    // Parse response body
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");

    string message = check responseBody.message;
    test:assertTrue(message.includes("system administrator"), "Error message should mention system admin protection");

    // Cleanup: Delete the regular user
    _ = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/users/${regularUserId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`},
        targetType = http:Response
    );

    log:printInfo("Successfully validated system admin deletion prevention");
}

// =============================================================================
// Cleanup: Delete Test Resources
// =============================================================================

@test:Config {
    groups: ["auth-v2", "cleanup"],
    dependsOn: [testUpdateGroup, testUpdateRole, testRemoveRoleFromGroup]
}
function testDeleteGroup() returns error? {
    // Send delete group request
    http:Response response = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for group deletion");

    // Verify group is deleted - trying to get it should return 404
    http:Response getResponse = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/groups/${testGroupId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );
    test:assertEquals(getResponse.statusCode, 404, "Group should not exist after deletion");
}

@test:Config {
    groups: ["auth-v2", "cleanup"],
    dependsOn: [testUpdateRole, testRemoveRoleFromGroup]
}
function testDeleteRole() returns error? {
    // Send delete role request
    http:Response response = check authV2Client->delete(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/roles/${testRoleId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for role deletion");

    // Verify role is deleted - trying to get it should return 404
    http:Response getResponse = check authV2Client->get(
        string `/auth/orgs/${DEFAULT_ORG_HANDLE}/roles/${testRoleId}`,
        headers = {"Authorization": string `Bearer ${superAdminToken}`}
    );
    test:assertEquals(getResponse.statusCode, 404, "Role should not exist after deletion");
}
