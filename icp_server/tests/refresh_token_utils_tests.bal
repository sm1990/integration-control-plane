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
import ballerina/regex;
import ballerina/test;
import icp_server.auth;

// Test: Generate refresh token returns non-empty string
@test:Config {
    groups: ["refresh-token", "utils"]
}
function testGenerateRefreshToken() returns error? {
    log:printInfo("Test: Generate refresh token");
    
    string refreshToken = auth:generateRefreshToken();
    
    // Assert token is not empty
    test:assertTrue(refreshToken.length() > 0, "Refresh token should not be empty");
    
    // Assert token is sufficiently long (base64 of SHA-256 hash should be 44 characters with padding)
    test:assertTrue(refreshToken.length() >= 40, "Refresh token should be at least 40 characters long");
    
    log:printInfo("Test passed: Refresh token generated successfully", tokenLength = refreshToken.length());
}

// Test: Generate refresh token produces unique tokens
@test:Config {
    groups: ["refresh-token", "utils"]
}
function testGenerateRefreshTokenUniqueness() returns error? {
    log:printInfo("Test: Generate refresh token uniqueness");
    
    // Generate multiple tokens
    string token1 = auth:generateRefreshToken();
    string token2 = auth:generateRefreshToken();
    string token3 = auth:generateRefreshToken();
    
    // Assert all tokens are different (uniqueness)
    test:assertNotEquals(token1, token2, "Token 1 and Token 2 should be different");
    test:assertNotEquals(token2, token3, "Token 2 and Token 3 should be different");
    test:assertNotEquals(token1, token3, "Token 1 and Token 3 should be different");
    
    log:printInfo("Test passed: Generated tokens are unique");
}

// Test: Generate token ID returns valid UUID v4 format
@test:Config {
    groups: ["refresh-token", "utils"]
}
function testGenerateTokenId() returns error? {
    log:printInfo("Test: Generate token ID");
    
    string tokenId = auth:generateTokenId();
    
    // Assert token ID is not empty
    test:assertTrue(tokenId.length() > 0, "Token ID should not be empty");
    
    // Assert token ID follows UUID v4 format (8-4-4-4-12 hexadecimal pattern)
    // Example: 550e8400-e29b-41d4-a716-446655440000
    boolean isValidUuid = regex:matches(tokenId, "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
    test:assertTrue(isValidUuid, "Token ID should be a valid UUID v4 format");
    
    log:printInfo("Test passed: Token ID is valid UUID v4", tokenId = tokenId);
}

// Test: Generate token ID produces unique IDs
@test:Config {
    groups: ["refresh-token", "utils"]
}
function testGenerateTokenIdUniqueness() returns error? {
    log:printInfo("Test: Generate token ID uniqueness");
    
    // Generate multiple token IDs
    string id1 = auth:generateTokenId();
    string id2 = auth:generateTokenId();
    string id3 = auth:generateTokenId();
    
    // Assert all IDs are different (uniqueness)
    test:assertNotEquals(id1, id2, "ID 1 and ID 2 should be different");
    test:assertNotEquals(id2, id3, "ID 2 and ID 3 should be different");
    test:assertNotEquals(id1, id3, "ID 1 and ID 3 should be different");
    
    log:printInfo("Test passed: Generated token IDs are unique");
}

// Test: Hash refresh token returns consistent hash
@test:Config {
    groups: ["refresh-token", "utils"]
}
function testHashRefreshTokenConsistency() returns error? {
    log:printInfo("Test: Hash refresh token consistency");
    
    string testToken = "test-refresh-token-12345";
    
    // Hash the same token multiple times
    string hash1 = auth:hashRefreshToken(testToken);
    string hash2 = auth:hashRefreshToken(testToken);
    string hash3 = auth:hashRefreshToken(testToken);
    
    // Assert all hashes are identical (deterministic hashing)
    test:assertEquals(hash1, hash2, "Hash 1 and Hash 2 should be identical");
    test:assertEquals(hash2, hash3, "Hash 2 and Hash 3 should be identical");
    test:assertEquals(hash1, hash3, "Hash 1 and Hash 3 should be identical");
    
    // Assert hash is not empty
    test:assertTrue(hash1.length() > 0, "Hash should not be empty");
    
    log:printInfo("Test passed: Hash function is deterministic", hashLength = hash1.length());
}

// Test: Hash refresh token produces different hashes for different inputs
@test:Config {
    groups: ["refresh-token", "utils"]
}
function testHashRefreshTokenUniqueness() returns error? {
    log:printInfo("Test: Hash refresh token uniqueness");
    
    string token1 = "test-token-1";
    string token2 = "test-token-2";
    string token3 = "test-token-3";
    
    // Hash different tokens
    string hash1 = auth:hashRefreshToken(token1);
    string hash2 = auth:hashRefreshToken(token2);
    string hash3 = auth:hashRefreshToken(token3);
    
    // Assert all hashes are different (collision resistance)
    test:assertNotEquals(hash1, hash2, "Hash 1 and Hash 2 should be different");
    test:assertNotEquals(hash2, hash3, "Hash 2 and Hash 3 should be different");
    test:assertNotEquals(hash1, hash3, "Hash 1 and Hash 3 should be different");
    
    log:printInfo("Test passed: Different tokens produce different hashes");
}

// Test: Hash refresh token produces expected length
@test:Config {
    groups: ["refresh-token", "utils"]
}
function testHashRefreshTokenLength() returns error? {
    log:printInfo("Test: Hash refresh token length");
    
    string testToken = "test-refresh-token";
    string hash = auth:hashRefreshToken(testToken);
    
    // SHA-256 hash in base64 should be 44 characters (with padding)
    // Or 43 characters without padding, depending on implementation
    test:assertTrue(hash.length() >= 40, "Hash should be at least 40 characters (SHA-256 in base64)");
    test:assertTrue(hash.length() <= 45, "Hash should not exceed 45 characters");
    
    log:printInfo("Test passed: Hash has expected length", hashLength = hash.length());
}

// Test: Hash refresh token handles empty string
@test:Config {
    groups: ["refresh-token", "utils", "edge-cases"]
}
function testHashRefreshTokenEmptyString() returns error? {
    log:printInfo("Test: Hash refresh token with empty string");
    
    string emptyToken = "";
    string hash = auth:hashRefreshToken(emptyToken);
    
    // Even empty string should produce a valid hash
    test:assertTrue(hash.length() > 0, "Hash of empty string should not be empty");
    
    log:printInfo("Test passed: Empty string produces valid hash");
}

// Test: Hash refresh token handles special characters
@test:Config {
    groups: ["refresh-token", "utils", "edge-cases"]
}
function testHashRefreshTokenSpecialCharacters() returns error? {
    log:printInfo("Test: Hash refresh token with special characters");
    
    string specialToken = "token!@#$%^&*()_+-=[]{}|;':\",./<>?";
    string hash = auth:hashRefreshToken(specialToken);
    
    // Assert hash is generated successfully
    test:assertTrue(hash.length() > 0, "Hash should be generated for special characters");
    
    // Hash should be consistent
    string hash2 = auth:hashRefreshToken(specialToken);
    test:assertEquals(hash, hash2, "Hash should be consistent for special characters");
    
    log:printInfo("Test passed: Special characters handled correctly");
}

// Test: Integration - Generate, hash, and verify workflow
@test:Config {
    groups: ["refresh-token", "utils", "integration"]
}
function testRefreshTokenWorkflow() returns error? {
    log:printInfo("Test: Complete refresh token workflow");
    
    // Step 1: Generate token ID
    string tokenId = auth:generateTokenId();
    test:assertTrue(tokenId.length() > 0, "Token ID should be generated");
    
    // Step 2: Generate refresh token
    string refreshToken = auth:generateRefreshToken();
    test:assertTrue(refreshToken.length() > 0, "Refresh token should be generated");
    
    // Step 3: Hash refresh token
    string tokenHash = auth:hashRefreshToken(refreshToken);
    test:assertTrue(tokenHash.length() > 0, "Token hash should be generated");
    
    // Step 4: Verify hashing is consistent (for validation)
    string tokenHash2 = auth:hashRefreshToken(refreshToken);
    test:assertEquals(tokenHash, tokenHash2, "Hash should be consistent for validation");
    
    // Step 5: Verify different token produces different hash
    string differentToken = auth:generateRefreshToken();
    string differentHash = auth:hashRefreshToken(differentToken);
    test:assertNotEquals(tokenHash, differentHash, "Different tokens should produce different hashes");
    
    log:printInfo("Test passed: Complete workflow executed successfully");
}
