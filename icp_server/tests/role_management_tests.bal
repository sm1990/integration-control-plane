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
import icp_server.types;

// Test user IDs from seed data (matching mysql_init.sql)
const string SUPER_ADMIN_USER_ID = "550e8400-e29b-41d4-a716-446655440000"; // admin
const string ROLE_TEST_USER_ID = "660e8400-e29b-41d4-a716-446655440002"; // testuser (can be project admin)
const string TARGET_USER_ID = "660e8400-e29b-41d4-a716-446655440003"; // targetuser (target for role updates)
const string ROLE_PROJECT_1 = "650e8400-e29b-41d4-a716-446655440001"; // sample_project
const string ROLE_PROJECT_2 = "650e8400-e29b-41d4-a716-446655440002";

// Test: Super admin can update any user's roles
@test:Config {
    groups: ["role-management"]
}
function testUpdateRolesAsSuperAdmin() returns error? {
    log:printInfo("Test: Super admin can update roles");
    
    // Use pre-generated admin token
    string authHeader = createAuthHeader(adminToken);
    
    // Prepare role update request
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    // Update roles for target user
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Debug: Log response if not 200
    if (response.statusCode != 200) {
        json|error responseBody = response.getJsonPayload();
        if (responseBody is json) {
            log:printError("Update roles failed", statusCode = response.statusCode, body = responseBody);
        }
    }
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for successful role update");
    
    // Parse response body
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Success message should be present");
    test:assertTrue(responseBody.roles is json[], "Roles should be present in response");
    
    log:printInfo("Test passed: Super admin updated roles successfully");
}

// Test: Project admin can assign roles in their own project
@test:Config {
    groups: ["role-management"],
    dependsOn: [testUpdateRolesAsSuperAdmin]
}
function testUpdateRolesAsProjectAdmin() returns error? {
    log:printInfo("Test: Project admin can assign roles in their project");
    
    // Generate project admin token for ROLE_TEST_USER_ID (admin in project-1)
    string testToken = check generateTestToken(
        ROLE_TEST_USER_ID,
        "testuser",
        "Test User",
        [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: types:PROD,
                privilegeLevel: types:ADMIN
            }
        ],
        isSuperAdmin = false // Not a super admin
    );
    
    string authHeader = createAuthHeader(testToken);
    
    // Prepare role update request for the same project
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    // Update roles for test user
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for project admin");
    
    log:printInfo("Test passed: Project admin assigned roles in their project");
}

// Test: Non-admin user cannot assign roles
@test:Config {
    groups: ["role-management", "negative"]
}
function testUpdateRolesWithoutAdminAccess() returns error? {
    log:printInfo("Test: Non-admin cannot assign roles");
    
    // Generate token for user with developer privileges only
    string testToken = check generateTestToken(
        ROLE_TEST_USER_ID,
        "testuser",
        "Test User",
        [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            }
        ],
        isSuperAdmin = false
    );
    
    string authHeader = createAuthHeader(testToken);
    
    // Try to assign roles
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    // Attempt to update roles for another user
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 for non-admin user");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Non-admin cannot assign roles");
}

// Test: User cannot assign roles in projects where they're not admin
@test:Config {
    groups: ["role-management", "negative"]
}
function testUpdateRolesInUnauthorizedProject() returns error? {
    log:printInfo("Test: Cannot assign roles in unauthorized project");
    
    // Generate token for ROLE_TEST_USER_ID who is admin in project-1 but not project-2
    string testToken = check generateTestToken(
        ROLE_TEST_USER_ID,
        "testuser",
        "Test User",
        [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: types:PROD,
                privilegeLevel: types:ADMIN
            }
        ],
        isSuperAdmin = false
    );
    
    string authHeader = createAuthHeader(testToken);
    
    // Try to assign roles in project-2 (where user is not admin)
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_2,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 for unauthorized project");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    string message = check responseBody.message;
    test:assertTrue(
        message.toLowerAscii().includes("access denied") || message.toLowerAscii().includes("admin"),
        "Error message should indicate access denied"
    );
    
    log:printInfo("Test passed: Cannot assign roles in unauthorized project");
}

// Test: Update roles for non-existent user returns 404
@test:Config {
    groups: ["role-management", "negative"]
}
function testUpdateRolesForNonExistentUser() returns error? {
    log:printInfo("Test: Update roles for non-existent user");
    
    string authHeader = createAuthHeader(adminToken);
    
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    // Try to update roles for non-existent user
    http:Response response = check authClient->put(
        "/auth/users/non-existent-user-id-12345/roles",
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 404 Not Found)
    assertStatusCode(response.statusCode, 404, "Expected status code 404 for non-existent user");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Update roles returns 404 for non-existent user");
}

// Test: Remove all roles by providing empty array
@test:Config {
    groups: ["role-management"]
}
function testUpdateRolesWithEmptyArray() returns error? {
    log:printInfo("Test: Remove all roles with empty array");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Remove all roles
    json rolesRequest = {
        roles: []
    };
    
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for removing all roles");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.roles is json[], "Roles should be present in response");
    
    json roles = check responseBody.roles;
    json[] rolesArray = check roles.ensureType();
    test:assertEquals(rolesArray.length(), 0, "User should have no roles");
    
    log:printInfo("Test passed: All roles removed successfully");
}

// Test: Non-super-admin cannot edit super admin's roles
@test:Config {
    groups: ["role-management", "negative"]
}
function testUpdateRolesForSuperAdminByNonSuperAdmin() returns error? {
    log:printInfo("Test: Non-super-admin cannot edit super admin");
    
    // Generate token for non-super-admin who is project admin
    string testToken = check generateTestToken(
        ROLE_TEST_USER_ID,
        "testuser",
        "Test User",
        [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: types:PROD,
                privilegeLevel: types:ADMIN
            }
        ],
        isSuperAdmin = false
    );
    
    string authHeader = createAuthHeader(testToken);
    
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    // Try to update roles for super admin user
    http:Response response = check authClient->put(
        string `/auth/users/${SUPER_ADMIN_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 when editing super admin");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    string message = check responseBody.message;
    test:assertTrue(
        message.toLowerAscii().includes("super admin"),
        "Error message should mention super admin restriction"
    );
    
    log:printInfo("Test passed: Non-super-admin cannot edit super admin");
}

// Test: Super admin can update isProjectAuthor flag
@test:Config {
    groups: ["role-management"]
}
function testUpdateProjectAuthorFlagAsSuperAdmin() returns error? {
    log:printInfo("Test: Super admin can update isProjectAuthor flag");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Update project author flag
    json rolesRequest = {
        roles: [],
        isProjectAuthor: true
    };
    
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for updating project author flag");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Success message should be present");
    
    log:printInfo("Test passed: Super admin updated project author flag");
}

// Test: Non-super-admin cannot update isProjectAuthor flag
@test:Config {
    groups: ["role-management", "negative"],
    dependsOn: [testUpdateProjectAuthorFlagAsSuperAdmin]
}
function testUpdateProjectAuthorFlagAsNonSuperAdmin() returns error? {
    log:printInfo("Test: Non-super-admin cannot update isProjectAuthor flag");
    
    // Generate token for project admin (not super admin)
    string testToken = check generateTestToken(
        ROLE_TEST_USER_ID,
        "testuser",
        "Test User",
        [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: types:PROD,
                privilegeLevel: types:ADMIN
            }
        ],
        isSuperAdmin = false
    );
    
    string authHeader = createAuthHeader(testToken);
    
    // Try to update project author flag
    json rolesRequest = {
        roles: [],
        isProjectAuthor: true
    };
    
    http:Response response = check authClient->put(
        string `/auth/users/${SUPER_ADMIN_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 for non-super-admin");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    string message = check responseBody.message;
    test:assertTrue(
        message.toLowerAscii().includes("super admin") || message.toLowerAscii().includes("project author"),
        "Error message should mention super admin restriction"
    );
    
    log:printInfo("Test passed: Non-super-admin cannot update project author flag");
}

// Test: Assign roles in multiple projects
@test:Config {
    groups: ["role-management"]
}
function testUpdateRolesInMultipleProjects() returns error? {
    log:printInfo("Test: Assign roles in multiple projects");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Assign roles in multiple projects
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "prod",
                privilegeLevel: "admin"
            },
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "non-prod",
                privilegeLevel: "developer"
            },
            {
                projectId: ROLE_PROJECT_2,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest,
        {
            "Authorization": authHeader
        }
    );
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for multiple role assignments");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.roles is json[], "Roles should be present in response");
    
    json roles = check responseBody.roles;
    json[] rolesArray = check roles.ensureType();
    test:assertTrue(rolesArray.length() >= 3, "User should have at least 3 roles");
    
    log:printInfo("Test passed: Roles assigned in multiple projects");
}

// Test: Roles are reflected in refreshed token
@test:Config {
    groups: ["role-management"],
    dependsOn: [testUpdateRolesInMultipleProjects]
}
function testUpdateRolesVerifyTokenRefresh() returns error? {
    log:printInfo("Test: Updated roles are reflected in refreshed token");
    
    // Get authenticated token for test user 
    string testToken = check getAuthenticatedToken("targetuser", "targetuser123");
    string authHeader = createAuthHeader(testToken);
    
    // Refresh token to get updated roles
    http:Response response = check authClient->post("/auth/renew-token", {}, {
        "Authorization": authHeader
    });
    
    assertStatusCode(response.statusCode, 200, "Expected successful token refresh");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.roles is json[], "Roles should be in response");
    
    json roles = check responseBody.roles;
    json[] rolesArray = check roles.ensureType();
    test:assertTrue(rolesArray.length() > 0, "Refreshed token should contain updated roles");
    
    log:printInfo("Test passed: Updated roles reflected in refreshed token");
}

// Test: Update roles without authorization header
@test:Config {
    groups: ["role-management", "negative"]
}
function testUpdateRolesWithoutAuthHeader() returns error? {
    log:printInfo("Test: Update roles without auth header");
    
    json rolesRequest = {
        roles: [
            {
                projectId: ROLE_PROJECT_1,
                environmentType: "prod",
                privilegeLevel: "developer"
            }
        ]
    };
    
    http:Response response = check authClient->put(
        string `/auth/users/${TARGET_USER_ID}/roles`,
        rolesRequest
    );
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 without auth header");
    
    log:printInfo("Test passed: Update roles rejected without auth header");
}
