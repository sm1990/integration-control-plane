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
import ballerina/test;
import icp_server.types;

// HTTP client for testing - matches configuration from auth_tests.bal
const string AUTH_SERVICE_URL = "https://localhost:9445";

final http:Client testAuthClient = check new (AUTH_SERVICE_URL,
    secureSocket = {
        cert: {
            path: truststorePath,
            password: truststorePassword
        }
    }
);

// JWT configuration for test token generation
final readonly & jwt:IssuerSignatureConfig testJwtConfig = {
    algorithm: jwt:HS256,
    config: defaultJwtHMACSecret
};

// Shared test tokens - generated once in BeforeSuite and reused
public string adminToken = "";
public string regularUserToken = "";
public string projectAdminToken = "";

// Initialize test tokens before running tests
@test:BeforeSuite
function initializeTestTokens() returns error? {
    // Generate admin token (super admin with full access)
    adminToken = check generateTestToken(
        "550e8400-e29b-41d4-a716-446655440000", // Admin user ID from seed data
        "admin",
        "Admin User",
        [
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-1",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            }
        ],
        isSuperAdmin = true,
        isProjectAuthor = true
    );
    
    // Generate regular user token (test user with some roles)
    regularUserToken = check generateTestToken(
        "660e8400-e29b-41d4-a716-446655440002", // Test user ID
        "testuser",
        "Test User",
        [
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            }
        ],
        isSuperAdmin = false,
        isProjectAuthor = false
    );
    
    // Generate project admin token (admin in project-1 only)
    projectAdminToken = check generateTestToken(
        "550e8400-e29b-41d4-a716-446655440002", // Another test user
        "projectadmin",
        "Project Admin",
        [
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:ADMIN
            }
        ],
        isSuperAdmin = false,
        isProjectAuthor = false
    );
}

// Generate a test JWT token with custom claims
public function generateTestToken(
    string userId,
    string username,
    string displayName,
    types:RoleInfo[] roles = [],
    boolean isSuperAdmin = false,
    boolean isProjectAuthor = false,
    decimal expTime = 3600
) returns string|error {
    
    // Build minimal role info for JWT (no roleId or roleName in token)
    json[] rolesClaim = [];
    foreach types:RoleInfo role in roles {
        rolesClaim.push({
            projectId: role.projectId,
            environmentType: role.environmentType,
            privilegeLevel: role.privilegeLevel
        });
    }
    
    jwt:IssuerConfig issuerConfig = {
        username: userId,
        issuer: frontendJwtIssuer,
        expTime: expTime,
        audience: frontendJwtAudience,
        signatureConfig: testJwtConfig,
        customClaims: {
            "username": username,
            "displayName": displayName,
            "roles": rolesClaim,
            "isSuperAdmin": isSuperAdmin,
            "isProjectAuthor": isProjectAuthor
        }
    };
    
    return jwt:issue(issuerConfig);
}

// Generate an expired test JWT token
// Note: Since we can't create a token that's already expired at creation time,
// this test might not work as expected. We'll skip this test or modify it.
public function generateExpiredToken(string userId, string username) returns string|error {
    // Create a token with 1 second expiration
    jwt:IssuerConfig issuerConfig = {
        username: userId,
        issuer: frontendJwtIssuer,
        expTime: 0.001, // Very short expiration (1 millisecond)
        audience: frontendJwtAudience,
        signatureConfig: testJwtConfig,
        customClaims: {
            "username": username,
            "displayName": "Test User",
            "roles": [],
            "isSuperAdmin": false,
            "isProjectAuthor": false
        }
    };
    
    return jwt:issue(issuerConfig);
}

// Assert HTTP status code
public function assertStatusCode(int actual, int expected, string message = "") {
    if message.length() > 0 {
        test:assertEquals(actual, expected, message);
    } else {
        test:assertEquals(actual, expected, string `Expected status code ${expected} but got ${actual}`);
    }
}

// Create authorization header from token
public function createAuthHeader(string token) returns string {
    return string `Bearer ${token}`;
}

// Get a real authenticated token by logging in (for endpoints that require actual authentication)
public function getAuthenticatedToken(string username, string password) returns string|error {
    json loginRequest = {
        username: username,
        password: password
    };
    
    http:Response response = check testAuthClient->post("/auth/login", loginRequest);
    
    if response.statusCode != 200 {
        return error(string `Login failed with status ${response.statusCode}`);
    }
    
    json responseBody = check response.getJsonPayload();
    json token = check responseBody.token;
    return check token.ensureType();
}
