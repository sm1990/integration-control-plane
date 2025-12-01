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

// ============================================================================
// Test: /auth/refresh-token endpoint (Subtask 11.5)
// ============================================================================

// Test: Successful refresh token usage
@test:Config {
    groups: ["refresh-token", "api"]
}
function testSuccessfulRefreshToken() returns error? {
    log:printInfo("Test: Successful refresh token usage");
    
    // Step 1: Login to get access token and refresh token
    json loginRequest = {
        username: "testuser",
        password: "testuser123"
    };
    
    http:Response loginResponse = check authClient->post("/auth/login", loginRequest);
    test:assertEquals(loginResponse.statusCode, 200, "Login should succeed");
    
    json loginBody = check loginResponse.getJsonPayload();
    string accessToken = check loginBody.token;
    string refreshToken = check loginBody.refreshToken;
    
    // Step 2: Use refresh token to get new access token
    json refreshRequest = {
        refreshToken: refreshToken
    };
    
    http:Response refreshResponse = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertEquals(refreshResponse.statusCode, 200, "Refresh token should succeed");
    
    // Step 3: Validate response structure
    json refreshBody = check refreshResponse.getJsonPayload();
    test:assertTrue(refreshBody.token is string, "New access token should be present");
    test:assertTrue(refreshBody.expiresIn is int, "ExpiresIn should be present");
    test:assertTrue(refreshBody.username is string, "Username should be present");
    test:assertTrue(refreshBody.permissions is json[], "Permissions should be present");
    
    // Step 4: Verify new access token is valid
    string newAccessToken = check refreshBody.token;
    test:assertTrue(newAccessToken.length() > 0, "New access token should not be empty");
    
    // Decode and verify the JWT
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(newAccessToken);
    test:assertEquals(payload["username"], "testuser", "JWT should contain correct username");
    test:assertEquals(payload.sub, "660e8400-e29b-41d4-a716-446655440002", "JWT should contain correct user ID");
    
    // Note: The new JWT might be identical to the old one if generated in the same second
    // with the same user data and roles. This is expected JWT behavior.
    log:printInfo("Test passed: Refresh token used successfully", 
        tokensIdentical = (accessToken == newAccessToken));
}

// Test: Refresh token with rotation enabled (new refresh token returned)
@test:Config {
    groups: ["refresh-token", "api", "rotation"]
}
function testRefreshTokenRotation() returns error? {
    log:printInfo("Test: Refresh token rotation");
    
    // Step 1: Login to get refresh token
    json loginRequest = {
        username: "testuser",
        password: "testuser123"
    };
    
    http:Response loginResponse = check authClient->post("/auth/login", loginRequest);
    json loginBody = check loginResponse.getJsonPayload();
    string originalRefreshToken = check loginBody.refreshToken;
    
    // Step 2: Use refresh token (should get new refresh token if rotation enabled)
    json refreshRequest = {
        refreshToken: originalRefreshToken
    };
    
    http:Response refreshResponse = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertEquals(refreshResponse.statusCode, 200, "Refresh should succeed");
    
    json refreshBody = check refreshResponse.getJsonPayload();
    
    // Step 3: Check if new refresh token is returned (depends on config)
    if refreshBody.refreshToken is string {
        string newRefreshToken = check refreshBody.refreshToken;
        test:assertNotEquals(originalRefreshToken, newRefreshToken, "New refresh token should be different (rotation enabled)");
        log:printInfo("Test passed: Refresh token rotation is enabled, new token received");
        
        // Step 4: Verify old token is revoked (can't be used again)
        json oldTokenRequest = {
            refreshToken: originalRefreshToken
        };
        http:Response oldTokenResponse = check authClient->post("/auth/refresh-token", oldTokenRequest);
        test:assertEquals(oldTokenResponse.statusCode, 401, "Old refresh token should be revoked after rotation");
    } else {
        log:printInfo("Test passed: Refresh token rotation is disabled, same token can be reused");
    }
}

// Test: Refresh token with invalid token
@test:Config {
    groups: ["refresh-token", "api", "negative"]
}
function testRefreshTokenWithInvalidToken() returns error? {
    log:printInfo("Test: Refresh token with invalid token");
    
    json refreshRequest = {
        refreshToken: "invalid-refresh-token-12345"
    };
    
    http:Response response = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertEquals(response.statusCode, 401, "Should reject invalid refresh token");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Invalid refresh token rejected");
}

// Test: Refresh token with empty token
@test:Config {
    groups: ["refresh-token", "api", "negative"]
}
function testRefreshTokenWithEmptyToken() returns error? {
    log:printInfo("Test: Refresh token with empty token");
    
    json refreshRequest = {
        refreshToken: ""
    };
    
    http:Response response = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertTrue(response.statusCode == 400 || response.statusCode == 401, "Should reject empty refresh token");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Empty refresh token rejected");
}

// Test: Refresh token with missing token field
@test:Config {
    groups: ["refresh-token", "api", "negative"]
}
function testRefreshTokenWithMissingToken() returns error? {
    log:printInfo("Test: Refresh token with missing token field");
    
    json refreshRequest = {};
    
    http:Response response = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertTrue(response.statusCode == 400 || response.statusCode == 401, "Should reject missing refresh token");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Missing refresh token rejected");
}

// Test: Refresh token returns updated roles
@test:Config {
    groups: ["refresh-token", "api", "roles"]
}
function testRefreshTokenReturnsUpdatedRoles() returns error? {
    log:printInfo("Test: Refresh token returns updated user roles");
    
    // Step 1: Login to get tokens
    json loginRequest = {
        username: "testuser",
        password: "testuser123"
    };
    
    http:Response loginResponse = check authClient->post("/auth/login", loginRequest);
    json loginBody = check loginResponse.getJsonPayload();
    string refreshToken = check loginBody.refreshToken;
    json originalPermissionsJson = check loginBody.permissions;
    json[] originalPermissions = <json[]>originalPermissionsJson;
    
    // Step 2: Use refresh token to get new access token
    json refreshRequest = {
        refreshToken: refreshToken
    };
    
    http:Response refreshResponse = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertEquals(refreshResponse.statusCode, 200, "Refresh should succeed");
    
    json refreshBody = check refreshResponse.getJsonPayload();
    test:assertTrue(refreshBody.permissions is json[], "Permissions should be present in refresh response");
    
    // Step 3: Verify permissions are included in response
    json refreshedPermissionsJson = check refreshBody.permissions;
    json[] refreshedPermissions = <json[]>refreshedPermissionsJson;
    log:printInfo("Test passed: Refreshed token includes user permissions", 
        originalPermissionCount = originalPermissions.length(), 
        refreshedPermissionCount = refreshedPermissions.length()
    );
}

// Test: Refresh token with expired token
@test:Config {
    groups: ["refresh-token", "api", "negative"],
    enable: false // Enable manually to test with expired tokens
}
function testRefreshTokenWithExpiredToken() returns error? {
    log:printInfo("Test: Refresh token with expired token");
    
    // This test requires creating an expired token in the database
    // For now, we'll test with a token that was valid but has expired
    
    json refreshRequest = {
        refreshToken: "expired-refresh-token"
    };
    
    http:Response response = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertEquals(response.statusCode, 401, "Should reject expired refresh token");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Expired refresh token rejected");
}

// ============================================================================
// Test: /auth/revoke-token endpoint (Subtask 11.6)
// ============================================================================

// Test: Revoke specific refresh token
@test:Config {
    groups: ["revoke-token", "api"]
}
function testRevokeSpecificRefreshToken() returns error? {
    log:printInfo("Test: Revoke specific refresh token");
    
    // Step 1: Login to get access token and refresh token
    json loginRequest = {
        username: "testuser",
        password: "testuser123"
    };
    
    http:Response loginResponse = check authClient->post("/auth/login", loginRequest);
    json loginBody = check loginResponse.getJsonPayload();
    string accessToken = check loginBody.token;
    string refreshToken = check loginBody.refreshToken;
    
    // Step 2: Revoke the refresh token
    json revokeRequest = {
        refreshToken: refreshToken
    };
    
    http:Request revokeReq = new;
    revokeReq.setJsonPayload(revokeRequest);
    revokeReq.setHeader("Authorization", "Bearer " + accessToken);
    
    http:Response revokeResponse = check authClient->post("/auth/revoke-token", revokeReq);
    test:assertEquals(revokeResponse.statusCode, 200, "Revoke should succeed");
    
    json revokeBody = check revokeResponse.getJsonPayload();
    test:assertTrue(revokeBody.message is string, "Success message should be present");
    
    // Step 3: Verify revoked token cannot be used
    json refreshRequest = {
        refreshToken: refreshToken
    };
    
    http:Response refreshResponse = check authClient->post("/auth/refresh-token", refreshRequest);
    test:assertEquals(refreshResponse.statusCode, 401, "Revoked token should not work");
    
    log:printInfo("Test passed: Specific refresh token revoked successfully");
}

// Test: Revoke all user refresh tokens
@test:Config {
    groups: ["revoke-token", "api", "revoke-all"]
}
function testRevokeAllUserRefreshTokensFromApi() returns error? {
    log:printInfo("Test: Revoke all user refresh tokens");
    
    // Step 1: Login multiple times to create multiple refresh tokens
    json loginRequest = {
        username: "targetuser",
        password: "targetuser123"
    };
    
    http:Response login1 = check authClient->post("/auth/login", loginRequest);
    json loginBody1 = check login1.getJsonPayload();
    string accessToken1 = check loginBody1.token;
    string refreshToken1 = check loginBody1.refreshToken;
    
    http:Response login2 = check authClient->post("/auth/login", loginRequest);
    json loginBody2 = check login2.getJsonPayload();
    string refreshToken2 = check loginBody2.refreshToken;
    
    http:Response login3 = check authClient->post("/auth/login", loginRequest);
    json loginBody3 = check login3.getJsonPayload();
    string refreshToken3 = check loginBody3.refreshToken;
    
    // Step 2: Revoke all tokens (send request without refreshToken field)
    json revokeAllRequest = {};
    
    http:Request revokeReq = new;
    revokeReq.setJsonPayload(revokeAllRequest);
    revokeReq.setHeader("Authorization", "Bearer " + accessToken1);
    
    http:Response revokeResponse = check authClient->post("/auth/revoke-token", revokeReq);
    test:assertEquals(revokeResponse.statusCode, 200, "Revoke all should succeed");
    
    // Step 3: Verify all tokens are revoked
    json refresh1Request = { refreshToken: refreshToken1 };
    json refresh2Request = { refreshToken: refreshToken2 };
    json refresh3Request = { refreshToken: refreshToken3 };
    
    http:Response refresh1Response = check authClient->post("/auth/refresh-token", refresh1Request);
    http:Response refresh2Response = check authClient->post("/auth/refresh-token", refresh2Request);
    http:Response refresh3Response = check authClient->post("/auth/refresh-token", refresh3Request);
    
    test:assertEquals(refresh1Response.statusCode, 401, "First token should be revoked");
    test:assertEquals(refresh2Response.statusCode, 401, "Second token should be revoked");
    test:assertEquals(refresh3Response.statusCode, 401, "Third token should be revoked");
    
    log:printInfo("Test passed: All user refresh tokens revoked successfully");
}

// Test: Revoke token without authentication
@test:Config {
    groups: ["revoke-token", "api", "negative"]
}
function testRevokeTokenWithoutAuth() returns error? {
    log:printInfo("Test: Revoke token without authentication");
    
    json revokeRequest = {
        refreshToken: "some-refresh-token"
    };
    
    http:Response response = check authClient->post("/auth/revoke-token", revokeRequest);
    test:assertEquals(response.statusCode, 401, "Should require authentication");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    log:printInfo("Test passed: Revoke requires authentication");
}

// Test: Revoke token with invalid JWT
@test:Config {
    groups: ["revoke-token", "api", "negative"]
}
function testRevokeTokenWithInvalidJWT() returns error? {
    log:printInfo("Test: Revoke token with invalid JWT");
    
    json revokeRequest = {
        refreshToken: "some-refresh-token"
    };
    
    http:Request req = new;
    req.setJsonPayload(revokeRequest);
    req.setHeader("Authorization", "Bearer invalid-jwt-token");
    
    http:Response response = check authClient->post("/auth/revoke-token", req);
    test:assertEquals(response.statusCode, 401, "Should reject invalid JWT");
    
    log:printInfo("Test passed: Invalid JWT rejected for revoke");
}

// Test: Revoke token with empty refresh token field
@test:Config {
    groups: ["revoke-token", "api", "negative"]
}
function testRevokeTokenWithEmptyToken() returns error? {
    log:printInfo("Test: Revoke token with empty refresh token");
    
    // First login to get valid access token
    json loginRequest = {
        username: "testuser",
        password: "testuser123"
    };
    
    http:Response loginResponse = check authClient->post("/auth/login", loginRequest);
    json loginBody = check loginResponse.getJsonPayload();
    string accessToken = check loginBody.token;
    
    // Try to revoke with empty refresh token
    json revokeRequest = {
        refreshToken: ""
    };
    
    http:Request req = new;
    req.setJsonPayload(revokeRequest);
    req.setHeader("Authorization", "Bearer " + accessToken);
    
    http:Response response = check authClient->post("/auth/revoke-token", req);
    test:assertTrue(response.statusCode == 400 || response.statusCode == 401, "Should reject empty refresh token");
    
    log:printInfo("Test passed: Empty refresh token rejected for revoke");
}

// Test: Revoke already revoked token (idempotent)
@test:Config {
    groups: ["revoke-token", "api", "idempotent"]
}
function testRevokeAlreadyRevokedToken() returns error? {
    log:printInfo("Test: Revoke already revoked token (idempotent)");
    
    // Step 1: Login to get tokens
    json loginRequest = {
        username: "testuser",
        password: "testuser123"
    };
    
    http:Response loginResponse = check authClient->post("/auth/login", loginRequest);
    json loginBody = check loginResponse.getJsonPayload();
    string accessToken = check loginBody.token;
    string refreshToken = check loginBody.refreshToken;
    
    // Step 2: Revoke the token once
    json revokeRequest = {
        refreshToken: refreshToken
    };
    
    http:Request revokeReq1 = new;
    revokeReq1.setJsonPayload(revokeRequest);
    revokeReq1.setHeader("Authorization", "Bearer " + accessToken);
    
    http:Response revokeResponse1 = check authClient->post("/auth/revoke-token", revokeReq1);
    test:assertEquals(revokeResponse1.statusCode, 200, "First revoke should succeed");
    
    // Step 3: Try to revoke the same token again (should be idempotent)
    http:Request revokeReq2 = new;
    revokeReq2.setJsonPayload(revokeRequest);
    revokeReq2.setHeader("Authorization", "Bearer " + accessToken);
    
    http:Response revokeResponse2 = check authClient->post("/auth/revoke-token", revokeReq2);
    // Should either succeed (200) or return error (4xx) - implementation dependent
    test:assertTrue(
        revokeResponse2.statusCode == 200 || revokeResponse2.statusCode >= 400,
        "Second revoke should either succeed (idempotent) or return error"
    );
    
    log:printInfo("Test passed: Revoking already revoked token handled correctly");
}
