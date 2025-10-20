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
import ballerina/log;
import ballerina/test;

// Test user IDs from seed data
const string SUPER_ADMIN_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

// ============================================================================
// User Listing Tests
// ============================================================================

// Test: Super admin can list all users
@test:Config {
    groups: ["user-management", "list-users"]
}
function testListUsersAsSuperAdmin() returns error? {
    log:printInfo("Test: Super admin can list all users");
    
    string authHeader = createAuthHeader(adminToken);
    
    http:Response response = check authClient->get("/auth/users", {
        "Authorization": authHeader
    });
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for super admin listing users");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody is json[], "Response should be an array of users");
    
    json[] users = check responseBody.ensureType();
    test:assertTrue(users.length() > 0, "Should return at least one user");
    
    log:printInfo("Test passed: Super admin listed all users", userCount = users.length());
}

// Test: Cannot list users without auth header
@test:Config {
    groups: ["user-management", "list-users", "negative"]
}
function testListUsersWithoutAuth() returns error? {
    log:printInfo("Test: Cannot list users without auth header");
    
    http:Response response = check authClient->get("/auth/users");
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 without auth header");
    
    log:printInfo("Test passed: Cannot list users without auth");
}

// ============================================================================
// User Creation Tests
// ============================================================================

// Test: Super admin can create a new user
@test:Config {
    groups: ["user-management", "create-user"]
}
function testCreateUserAsSuperAdmin() returns error? {
    log:printInfo("Test: Super admin can create a new user");
    
    string authHeader = createAuthHeader(adminToken);
    
    json createUserRequest = {
        username: "newcreateduser",
        displayName: "New Created User",
        password: "password123",
        isSuperAdmin: false,
        isProjectAuthor: false
    };
    
    http:Response response = check authClient->post("/auth/users", createUserRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status
    assertStatusCode(response.statusCode, 201, "Expected status code 201 for successful user creation");
    
    // Parse response body - should be a User object
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.userId is string, "User ID should be present");
    test:assertTrue(responseBody.username is string, "Username should be present");
    test:assertTrue(responseBody.displayName is string, "Display name should be present");
    test:assertTrue(responseBody.isSuperAdmin is boolean, "isSuperAdmin flag should be present");
    test:assertTrue(responseBody.isProjectAuthor is boolean, "isProjectAuthor flag should be present");
    
    // Verify the values match what we sent
    test:assertEquals(responseBody.username, "newcreateduser", "Username should match");
    test:assertEquals(responseBody.displayName, "New Created User", "Display name should match");
    test:assertEquals(responseBody.isSuperAdmin, false, "isSuperAdmin should be false");
    test:assertEquals(responseBody.isProjectAuthor, false, "isProjectAuthor should be false");
    
    log:printInfo("Test passed: Super admin created a new user");
}

// Test: Non-super admin cannot create users
@test:Config {
    groups: ["user-management", "create-user", "negative"]
}
function testCreateUserAsNonSuperAdmin() returns error? {
    log:printInfo("Test: Non-super admin cannot create users");
    
    string authHeader = createAuthHeader(regularUserToken);
    
    json createUserRequest = {
        username: "unauthorizeduser",
        displayName: "Unauthorized User",
        password: "password123",
        isSuperAdmin: false,
        isProjectAuthor: false
    };
    
    http:Response response = check authClient->post("/auth/users", createUserRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 for non-super admin");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Non-super admin cannot create users");
}

// Test: Cannot create user with duplicate username
@test:Config {
    groups: ["user-management", "create-user", "negative"],
    dependsOn: [testCreateUserAsSuperAdmin]
}
function testCreateUserWithDuplicateUsername() returns error? {
    log:printInfo("Test: Cannot create user with duplicate username");
    
    string authHeader = createAuthHeader(adminToken);
    
    json createUserRequest = {
        username: "admin", // Existing username
        displayName: "Duplicate Admin",
        password: "password123",
        isSuperAdmin: false,
        isProjectAuthor: false
    };
    
    http:Response response = check authClient->post("/auth/users", createUserRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request or 409 Conflict)
    test:assertTrue(
        response.statusCode == 400 || response.statusCode == 409,
        "Expected status code 400 or 409 for duplicate username"
    );
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Cannot create user with duplicate username");
}

// Test: Cannot create user with invalid data
@test:Config {
    groups: ["user-management", "create-user", "negative"]
}
function testCreateUserWithInvalidData() returns error? {
    log:printInfo("Test: Cannot create user with invalid data");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Missing required field (username)
    json createUserRequest = {
        displayName: "Invalid User",
        password: "password123"
    };
    
    http:Response response = check authClient->post("/auth/users", createUserRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request)
    assertStatusCode(response.statusCode, 400, "Expected status code 400 for invalid data");
    
    log:printInfo("Test passed: Cannot create user with invalid data");
}

// ============================================================================
// User Deletion Tests
// ============================================================================

// Test: Super admin can delete a user
@test:Config {
    groups: ["user-management", "delete-user"],
    dependsOn: [testCreateUserAsSuperAdmin, testCreateUserWithDuplicateUsername]
}
function testDeleteUserAsSuperAdmin() returns error? {
    log:printInfo("Test: Super admin can delete a user");
    
    string authHeader = createAuthHeader(adminToken);
    
    // First, create a user to delete
    json createUserRequest = {
        username: "usertodelete",
        displayName: "User To Delete",
        password: "password123",
        isSuperAdmin: false,
        isProjectAuthor: false
    };
    
    http:Response createResponse = check authClient->post("/auth/users", createUserRequest, {
        "Authorization": authHeader
    });
    
    assertStatusCode(createResponse.statusCode, 201, "User should be created");
    json createBody = check createResponse.getJsonPayload();
    string userId = check createBody.userId;
    
    // Now delete the user
    http:Response response = check authClient->delete(
        string `/auth/users/${userId}`,
        headers = {
            "Authorization": authHeader
        }
    );
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for successful deletion");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Success message should be present");
    
    log:printInfo("Test passed: Super admin deleted a user");
}

// Test: Cannot delete super admin user
@test:Config {
    groups: ["user-management", "delete-user", "negative"]
}
function testDeleteSuperAdminUser() returns error? {
    log:printInfo("Test: Cannot delete super admin user");
    
    string authHeader = createAuthHeader(adminToken);
    
    http:Response response = check authClient->delete(
        string `/auth/users/${SUPER_ADMIN_USER_ID}`,
        headers = {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 400 or 403)
    test:assertTrue(
        response.statusCode == 400 || response.statusCode == 403,
        "Expected status code 400 or 403 when deleting super admin"
    );
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Cannot delete super admin user");
}

// Test: Non-super admin cannot delete users
@test:Config {
    groups: ["user-management", "delete-user", "negative"]
}
function testDeleteUserAsNonSuperAdmin() returns error? {
    log:printInfo("Test: Non-super admin cannot delete users");
    
    string authHeader = createAuthHeader(regularUserToken);
    
    http:Response response = check authClient->delete(
        string `/auth/users/${TEST_USER_ID}`,
        headers = {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 for non-super admin");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Non-super admin cannot delete users");
}

// Test: Delete non-existent user returns 404
@test:Config {
    groups: ["user-management", "delete-user", "negative"]
}
function testDeleteNonExistentUser() returns error? {
    log:printInfo("Test: Delete non-existent user returns 404");
    
    string authHeader = createAuthHeader(adminToken);
    
    http:Response response = check authClient->delete(
        "/auth/users/non-existent-user-id-12345",
        headers = {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 404 Not Found)
    assertStatusCode(response.statusCode, 404, "Expected status code 404 for non-existent user");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Delete non-existent user returns 404");
}

// ============================================================================
// Profile Update Tests
// ============================================================================

// Test: User can update their own profile
@test:Config {
    groups: ["user-management", "profile"]
}
function testUpdateOwnProfile() returns error? {
    log:printInfo("Test: User can update their own profile");
    
    string authHeader = createAuthHeader(regularUserToken);
    
    json updateRequest = {
        displayName: "Updated Display Name"
    };
    
    http:Response response = check authClient->put("/auth/profile", updateRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for successful profile update");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Success message should be present");
    
    log:printInfo("Test passed: User updated their own profile");
}

// Test: Cannot update profile without auth header
@test:Config {
    groups: ["user-management", "profile", "negative"]
}
function testUpdateProfileWithoutAuth() returns error? {
    log:printInfo("Test: Cannot update profile without auth header");
    
    json updateRequest = {
        displayName: "Should Fail"
    };
    
    http:Response response = check authClient->put("/auth/profile", updateRequest);
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 without auth header");
    
    log:printInfo("Test passed: Cannot update profile without auth");
}

// Test: Cannot update profile with empty display name
@test:Config {
    groups: ["user-management", "profile", "negative"]
}
function testUpdateProfileWithEmptyDisplayName() returns error? {
    log:printInfo("Test: Cannot update profile with empty display name");
    
    string authHeader = createAuthHeader(regularUserToken);
    
    json updateRequest = {
        displayName: ""
    };
    
    http:Response response = check authClient->put("/auth/profile", updateRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request)
    assertStatusCode(response.statusCode, 400, "Expected status code 400 for empty display name");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Cannot update profile with empty display name");
}
