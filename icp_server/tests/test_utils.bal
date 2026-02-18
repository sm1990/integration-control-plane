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
import icp_server.auth;

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
    adminToken = check generateV2Token(
        "550e8400-e29b-41d4-a716-446655440000", 
        "admin", 
        [
            auth:PERMISSION_INTEGRATION_VIEW,
            auth:PERMISSION_INTEGRATION_EDIT,
            auth:PERMISSION_INTEGRATION_MANAGE,
            auth:PERMISSION_ENVIRONMENT_MANAGE,
            auth:PERMISSION_ENVIRONMENT_MANAGE_NONPROD,
            auth:PERMISSION_PROJECT_VIEW,
            auth:PERMISSION_PROJECT_EDIT,
            auth:PERMISSION_PROJECT_MANAGE,
            auth:PERMISSION_OBSERVABILITY_VIEW_LOGS,
            auth:PERMISSION_OBSERVABILITY_VIEW_INSIGHTS,
            auth:PERMISSION_USER_MANAGE_USERS,
            auth:PERMISSION_USER_UPDATE_USERS,
            auth:PERMISSION_USER_MANAGE_GROUPS,
            auth:PERMISSION_USER_MANAGE_ROLES,
            auth:PERMISSION_USER_UPDATE_GROUP_ROLES
        ]
    );
    
    // Generate regular user token (test user with some roles)
    regularUserToken = check generateV2Token(
        "770e8400-e29b-41d4-a716-446655440001",
        "orgdev",
        [auth:PERMISSION_INTEGRATION_VIEW, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_PROJECT_VIEW]
    );
    
    // Generate project admin token (admin in project-1 only)
    projectAdminToken = check generateV2Token(
        "770e8400-e29b-41d4-a716-446655440002",
        "projectadmin",
        [auth:PERMISSION_INTEGRATION_VIEW, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE, auth:PERMISSION_PROJECT_VIEW, auth:PERMISSION_PROJECT_MANAGE]
    );
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
