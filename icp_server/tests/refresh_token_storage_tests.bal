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

import ballerina/log;
import ballerina/test;
import icp_server.storage;
import icp_server.types;
import icp_server.utils;

// Test: Store refresh token successfully
@test:Config {
    groups: ["refresh-token", "storage"]
}
function testStoreRefreshToken() returns error? {
    log:printInfo("Test: Store refresh token");
    
    // Generate test data
    string tokenId = utils:generateTokenId();
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser from sample data
    string refreshToken = utils:generateRefreshToken();
    string tokenHash = utils:hashRefreshToken(refreshToken);
    int expirySeconds = 604800; // 7 days
    string userAgent = "Test User Agent";
    string ipAddress = "192.168.1.100";
    
    // Store the refresh token
    error? result = storage:storeRefreshToken(
        tokenId,
        userId,
        tokenHash,
        expirySeconds,
        userAgent,
        ipAddress
    );
    
    // Assert no error occurred
    test:assertFalse(result is error, "Should store refresh token without error");
    
    log:printInfo("Test passed: Refresh token stored successfully");
}

// Test: Store refresh token with optional metadata
@test:Config {
    groups: ["refresh-token", "storage"]
}
function testStoreRefreshTokenWithOptionalMetadata() returns error? {
    log:printInfo("Test: Store refresh token with optional metadata");
    
    // Generate test data
    string tokenId = utils:generateTokenId();
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser
    string refreshToken = utils:generateRefreshToken();
    string tokenHash = utils:hashRefreshToken(refreshToken);
    int expirySeconds = 604800;
    
    // Store without user agent and IP (both nullable)
    error? result = storage:storeRefreshToken(
        tokenId,
        userId,
        tokenHash,
        expirySeconds,
        (),
        ()
    );
    
    // Assert no error occurred
    test:assertFalse(result is error, "Should store refresh token with null metadata");
    
    log:printInfo("Test passed: Refresh token stored with optional metadata");
}

// Test: Validate refresh token with valid token
@test:Config {
    groups: ["refresh-token", "storage"],
    dependsOn: [testStoreRefreshToken]
}
function testValidateRefreshTokenValid() returns error? {
    log:printInfo("Test: Validate valid refresh token");
    
    // Generate and store a valid token
    string tokenId = utils:generateTokenId();
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser
    string refreshToken = utils:generateRefreshToken();
    string tokenHash = utils:hashRefreshToken(refreshToken);
    int expirySeconds = 604800; // 7 days - won't expire during test
    
    // Store the token
    error? storeResult = storage:storeRefreshToken(
        tokenId,
        userId,
        tokenHash,
        expirySeconds,
        "Test User Agent",
        "192.168.1.100"
    );
    test:assertFalse(storeResult is error, "Should store token successfully");
    
    // Validate the token
    types:User|error validationResult = storage:validateRefreshToken(tokenHash);
    
    // Assert validation succeeded and returned user
    test:assertFalse(validationResult is error, "Should validate token successfully");
    
    if validationResult is types:User {
        test:assertEquals(validationResult.userId, userId, "Should return correct user ID");
        test:assertEquals(validationResult.username, "testuser", "Should return correct username");
    }
    
    log:printInfo("Test passed: Valid token validated successfully");
}

// Test: Validate refresh token with expired token
@test:Config {
    groups: ["refresh-token", "storage"]
}
function testValidateRefreshTokenExpired() returns error? {
    log:printInfo("Test: Validate expired refresh token");
    
    // Generate and store an expired token
    string tokenId = utils:generateTokenId();
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser
    string refreshToken = utils:generateRefreshToken();
    string tokenHash = utils:hashRefreshToken(refreshToken);
    int expirySeconds = -1; // Expired 1 second ago
    
    // Store the expired token
    error? storeResult = storage:storeRefreshToken(
        tokenId,
        userId,
        tokenHash,
        expirySeconds,
        "Test User Agent",
        "192.168.1.100"
    );
    test:assertFalse(storeResult is error, "Should store expired token successfully");
    
    // Try to validate the expired token
    types:User|error validationResult = storage:validateRefreshToken(tokenHash);
    
    // Assert validation failed
    test:assertTrue(validationResult is error, "Should reject expired token");
    
    if validationResult is error {
        log:printInfo("Test passed: Expired token rejected with error", errorMsg = validationResult.message());
    }
}

// Test: Validate refresh token with revoked token
@test:Config {
    groups: ["refresh-token", "storage"]
}
function testValidateRefreshTokenRevoked() returns error? {
    log:printInfo("Test: Validate revoked refresh token");
    
    // Generate and store a valid token
    string tokenId = utils:generateTokenId();
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser
    string refreshToken = utils:generateRefreshToken();
    string tokenHash = utils:hashRefreshToken(refreshToken);
    int expirySeconds = 604800; // 7 days
    
    // Store the token
    error? storeResult = storage:storeRefreshToken(
        tokenId,
        userId,
        tokenHash,
        expirySeconds,
        "Test User Agent",
        "192.168.1.100"
    );
    test:assertFalse(storeResult is error, "Should store token successfully");
    
    // Revoke the token
    error? revokeResult = storage:revokeRefreshToken(tokenHash);
    test:assertFalse(revokeResult is error, "Should revoke token successfully");
    
    // Try to validate the revoked token
    types:User|error validationResult = storage:validateRefreshToken(tokenHash);
    
    // Assert validation failed
    test:assertTrue(validationResult is error, "Should reject revoked token");
    
    if validationResult is error {
        log:printInfo("Test passed: Revoked token rejected with error", errorMsg = validationResult.message());
    }
}

// Test: Validate refresh token with non-existent token
@test:Config {
    groups: ["refresh-token", "storage"]
}
function testValidateRefreshTokenNotFound() returns error? {
    log:printInfo("Test: Validate non-existent refresh token");
    
    // Generate a hash that doesn't exist in database
    string nonExistentToken = utils:generateRefreshToken();
    string nonExistentHash = utils:hashRefreshToken(nonExistentToken);
    
    // Try to validate non-existent token
    types:User|error validationResult = storage:validateRefreshToken(nonExistentHash);
    
    // Assert validation failed
    test:assertTrue(validationResult is error, "Should reject non-existent token");
    
    if validationResult is error {
        log:printInfo("Test passed: Non-existent token rejected with error", errorMsg = validationResult.message());
    }
}

// Test: Revoke specific refresh token
@test:Config {
    groups: ["refresh-token", "storage"]
}
function testRevokeRefreshToken() returns error? {
    log:printInfo("Test: Revoke specific refresh token");
    
    // Generate and store a valid token
    string tokenId = utils:generateTokenId();
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser
    string refreshToken = utils:generateRefreshToken();
    string tokenHash = utils:hashRefreshToken(refreshToken);
    int expirySeconds = 604800;
    
    // Store the token
    error? storeResult = storage:storeRefreshToken(
        tokenId,
        userId,
        tokenHash,
        expirySeconds,
        "Test User Agent",
        "192.168.1.100"
    );
    test:assertFalse(storeResult is error, "Should store token successfully");
    
    // Revoke the token
    error? revokeResult = storage:revokeRefreshToken(tokenHash);
    test:assertFalse(revokeResult is error, "Should revoke token without error");
    
    // Verify token is revoked by trying to validate
    types:User|error validationResult = storage:validateRefreshToken(tokenHash);
    test:assertTrue(validationResult is error, "Revoked token should not validate");
    
    log:printInfo("Test passed: Refresh token revoked successfully");
}

// Test: Revoke all user refresh tokens
@test:Config {
    groups: ["refresh-token", "storage"]
}
function testRevokeAllUserRefreshTokens() returns error? {
    log:printInfo("Test: Revoke all user refresh tokens");
    
    string userId = "660e8400-e29b-41d4-a716-446655440003"; // targetuser
    
    // Store multiple tokens for the same user
    string token1 = utils:generateRefreshToken();
    string tokenHash1 = utils:hashRefreshToken(token1);
    error? store1 = storage:storeRefreshToken(
        utils:generateTokenId(),
        userId,
        tokenHash1,
        604800,
        "Browser 1",
        "192.168.1.101"
    );
    test:assertFalse(store1 is error, "Should store token 1");
    
    string token2 = utils:generateRefreshToken();
    string tokenHash2 = utils:hashRefreshToken(token2);
    error? store2 = storage:storeRefreshToken(
        utils:generateTokenId(),
        userId,
        tokenHash2,
        604800,
        "Browser 2",
        "192.168.1.102"
    );
    test:assertFalse(store2 is error, "Should store token 2");
    
    string token3 = utils:generateRefreshToken();
    string tokenHash3 = utils:hashRefreshToken(token3);
    error? store3 = storage:storeRefreshToken(
        utils:generateTokenId(),
        userId,
        tokenHash3,
        604800,
        "Mobile App",
        "192.168.1.103"
    );
    test:assertFalse(store3 is error, "Should store token 3");
    
    // Revoke all tokens for the user
    error? revokeAllResult = storage:revokeAllUserRefreshTokens(userId);
    test:assertFalse(revokeAllResult is error, "Should revoke all tokens without error");
    
    // Verify all tokens are revoked
    types:User|error validation1 = storage:validateRefreshToken(tokenHash1);
    types:User|error validation2 = storage:validateRefreshToken(tokenHash2);
    types:User|error validation3 = storage:validateRefreshToken(tokenHash3);
    
    test:assertTrue(validation1 is error, "Token 1 should be revoked");
    test:assertTrue(validation2 is error, "Token 2 should be revoked");
    test:assertTrue(validation3 is error, "Token 3 should be revoked");
    
    log:printInfo("Test passed: All user tokens revoked successfully");
}

// Test: Cleanup expired refresh tokens
@test:Config {
    groups: ["refresh-token", "storage", "cleanup"]
}
function testCleanupExpiredRefreshTokens() returns error? {
    log:printInfo("Test: Cleanup expired refresh tokens");
    
    // Store some expired tokens
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser
    
    // Create multiple expired tokens
    foreach int i in 1...3 {
        string tokenId = utils:generateTokenId();
        string refreshToken = utils:generateRefreshToken();
        string tokenHash = utils:hashRefreshToken(refreshToken);
        
        error? storeResult = storage:storeRefreshToken(
            tokenId,
            userId,
            tokenHash,
            -86400, // Expired 1 day ago
            "Test User Agent",
            "192.168.1.100"
        );
        test:assertFalse(storeResult is error, string `Should store expired token ${i}`);
    }
    
    // Run cleanup
    error? cleanupResult = storage:cleanupExpiredRefreshTokens();
    test:assertFalse(cleanupResult is error, "Should cleanup expired tokens without error");
    
    log:printInfo("Test passed: Expired tokens cleaned up successfully");
}

// Test: Cleanup revoked refresh tokens
@test:Config {
    groups: ["refresh-token", "storage", "cleanup"]
}
function testCleanupRevokedRefreshTokens() returns error? {
    log:printInfo("Test: Cleanup revoked refresh tokens");
    
    // Store and revoke some tokens
    string userId = "660e8400-e29b-41d4-a716-446655440002"; // testuser
    
    // Create tokens and revoke them
    foreach int i in 1...3 {
        string tokenId = utils:generateTokenId();
        string refreshToken = utils:generateRefreshToken();
        string tokenHash = utils:hashRefreshToken(refreshToken);
        
        // Store token
        error? storeResult = storage:storeRefreshToken(
            tokenId,
            userId,
            tokenHash,
            604800, // Valid for 7 days
            "Test User Agent",
            "192.168.1.100"
        );
        test:assertFalse(storeResult is error, string `Should store token ${i}`);
        
        // Revoke it
        error? revokeResult = storage:revokeRefreshToken(tokenHash);
        test:assertFalse(revokeResult is error, string `Should revoke token ${i}`);
    }
    
    // Run cleanup (should remove revoked tokens)
    error? cleanupResult = storage:cleanupExpiredRefreshTokens();
    test:assertFalse(cleanupResult is error, "Should cleanup revoked tokens without error");
    
    log:printInfo("Test passed: Revoked tokens cleaned up successfully");
}
