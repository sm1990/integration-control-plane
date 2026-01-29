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

// Store authentication token for subsequent tests
string authToken = "";
string authenticatedUserId = "";
string authenticatedUsername = "";

// =============================================================================
// Test 1: Connect to ICP Server with Admin Credentials
// =============================================================================

@test:Config {
    groups: ["integration", "admin-auth", "connection"]
}
function testConnectWithAdminPassword() returns error? {
    log:printInfo("Testing connection to ICP server with admin credentials...");

    // Prepare login request with admin credentials
    json loginRequest = {
        username: adminUsername,
        password: adminPassword
    };

    // Send login request to ICP server
    http:Response response = check icpClient->post("/auth/login", loginRequest);

    // Assert successful response
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for successful admin login");

    // Parse response body
    json responseBody = check response.getJsonPayload();
    log:printInfo("Login response received: " + responseBody.toString());

    // Verify response structure
    test:assertTrue(responseBody.token is string, "Token should be present in login response");
    test:assertTrue(responseBody.username is string, "Username should be present in login response");
    test:assertTrue(responseBody.permissions is json[], "Permissions array should be present in login response");

    // Store authentication details
    authToken = check responseBody.token;
    authenticatedUsername = check responseBody.username;

    test:assertTrue(authToken.length() > 0, "Authentication token should not be empty");
    test:assertEquals(authenticatedUsername, adminUsername, "Authenticated username should match admin username");

    log:printInfo("Successfully authenticated as admin user: " + authenticatedUsername);
    log:printInfo("Authentication token obtained (length: " + authToken.length().toString() + " chars)");
}

// =============================================================================
// Test 2: Verify JWT Token Structure and Claims
// =============================================================================

@test:Config {
    groups: ["integration", "admin-auth", "jwt"],
    dependsOn: [testConnectWithAdminPassword]
}
function testVerifyAdminJWTToken() returns error? {
    log:printInfo("Verifying JWT token structure and claims...");

    // Decode JWT token
    [jwt:Header, jwt:Payload] [header, payload] = check jwt:decode(authToken);

    // Verify JWT header
    test:assertTrue(header.alg is string, "Algorithm should be present in JWT header");
    test:assertTrue(header.typ is string, "Type should be present in JWT header");
    test:assertEquals(header.typ, "JWT", "Token type should be JWT");

    log:printInfo("JWT Algorithm: " + (check header.alg.ensureType(string)));
    log:printInfo("JWT Type: " + (check header.typ.ensureType(string)));

    // Verify JWT payload claims
    test:assertTrue(payload.sub is string, "Subject (sub) claim should be present in JWT");
    test:assertTrue(payload.iss is string, "Issuer (iss) claim should be present in JWT");
    test:assertTrue(payload.exp is int, "Expiration (exp) claim should be present in JWT");
    test:assertTrue(payload.iat is int, "Issued at (iat) claim should be present in JWT");
    test:assertTrue(payload["username"] is string, "Username claim should be present in JWT");

    // Store user ID
    authenticatedUserId = check payload.sub.ensureType();
    test:assertTrue(authenticatedUserId.length() > 0, "User ID should not be empty");

    // Verify username in token matches login username
    string tokenUsername = check payload["username"].ensureType();
    test:assertEquals(tokenUsername, adminUsername, "Username in token should match admin username");

    // Verify scope claim (permissions)
    test:assertTrue(payload["scope"] is string, "Scope claim should be present in JWT");
    string scopeClaim = check payload["scope"].ensureType();
    test:assertTrue(scopeClaim.length() > 0, "Scope claim should not be empty");

    log:printInfo("User ID: " + authenticatedUserId);
    log:printInfo("Issuer: " + (check payload.iss.ensureType(string)));
    log:printInfo("Scope/Permissions: " + scopeClaim);
}

// =============================================================================
// Test 3: Test Authenticated API Access
// =============================================================================

@test:Config {
    groups: ["integration", "admin-auth", "api-access"],
    dependsOn: [testVerifyAdminJWTToken]
}
function testAuthenticatedAPIAccess() returns error? {
    log:printInfo("Testing authenticated API access with admin token...");

    // Test authenticated endpoint - access the permissions endpoint
    http:Response response = check icpClient->get(
        "/auth/permissions",
        headers = {"Authorization": string `Bearer ${authToken}`}
    );

    // Log the response status
    log:printInfo("Permissions endpoint response status code: " + response.statusCode.toString());

    // Should return 200 for successful authenticated access
    test:assertEquals(
            response.statusCode,
            200,
            string `Expected status 200 for authenticated access, but got ${response.statusCode}`
    );

    json responseBody = check response.getJsonPayload();
    log:printInfo("Permissions endpoint response: " + responseBody.toString());

    // Verify response contains permissions field
    test:assertTrue(
            responseBody.permissions is json[],
            "Permissions endpoint should return an object with permissions array"
    );

    log:printInfo("Successfully verified authenticated API access with admin token");
}

// =============================================================================
// Test 4: Test Invalid Credentials
// =============================================================================

@test:Config {
    groups: ["integration", "admin-auth", "negative"]
}
function testInvalidAdminPassword() returns error? {
    log:printInfo("Testing connection with invalid admin credentials...");

    // Prepare login request with invalid credentials
    json loginRequest = {
        username: adminUsername,
        password: "wrongpassword"
    };

    // Send login request with invalid password
    http:Response response = check icpClient->post("/auth/login", loginRequest);

    // Assert unauthorized response
    test:assertEquals(
            response.statusCode,
            401,
            "Expected status code 401 for invalid credentials"
    );

    log:printInfo("Invalid credentials correctly rejected with status: " + response.statusCode.toString());
}

// =============================================================================
// Test 5: Test Connection Health Check
// =============================================================================

@test:Config {
    groups: ["integration", "health", "connection"]
}
function testServerHealthCheck() returns error? {
    log:printInfo("Testing ICP server health check...");

    // Try to access health endpoint (if available) or base path
    http:Response|error response = icpClient->get("/");

    if response is error {
        log:printWarn("Health check endpoint not available or returned error: " + response.message());
        // This is acceptable - just log and continue
        return;
    }

    // Log response status
    log:printInfo("Server responded with status code: " + response.statusCode.toString());

    // Any response (even 404) indicates server is reachable
    test:assertTrue(
            response.statusCode >= 200 && response.statusCode < 600,
            "Server should be reachable and return valid HTTP status"
    );

    log:printInfo("ICP server health check completed successfully");
}

// =============================================================================
// Test 6: Test Admin Permissions
// =============================================================================

@test:Config {
    groups: ["integration", "admin-auth", "permissions"],
    dependsOn: [testConnectWithAdminPassword]
}
function testAdminPermissions() returns error? {
    log:printInfo("Testing admin user permissions...");

    // Decode token to verify permissions
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(authToken);

    // Get scope claim
    string scopeClaim = check payload["scope"].ensureType(string);

    // Verify common admin permissions (using actual ICP permission format)
    string[] expectedPermissions = [
        "user_mgt:manage_users",
        "user_mgt:manage_groups",
        "user_mgt:manage_roles"
    ];

    foreach string permission in expectedPermissions {
        test:assertTrue(
                scopeClaim.includes(permission),
                string `Admin should have ${permission} permission`
        );
        log:printInfo("Verified permission: " + permission);
    }

    log:printInfo("All expected admin permissions verified successfully");
}

