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

import ballerina/crypto;
import ballerina/jwt;
import ballerina/log;
import ballerina/uuid;
import icp_server.types as types;

// ============================================================================
// PERMISSION CONSTANTS
// ============================================================================
// These constants match the permission_name values in the permissions table

// Integration Management Permissions
public const string PERMISSION_INTEGRATION_VIEW = "integration_mgt:view";
public const string PERMISSION_INTEGRATION_EDIT = "integration_mgt:edit";
public const string PERMISSION_INTEGRATION_MANAGE = "integration_mgt:manage";

// Environment Management Permissions
public const string PERMISSION_ENVIRONMENT_MANAGE = "environment_mgt:manage";
public const string PERMISSION_ENVIRONMENT_MANAGE_NONPROD = "environment_mgt:manage_nonprod";

// Project Management Permissions
public const string PERMISSION_PROJECT_VIEW = "project_mgt:view";
public const string PERMISSION_PROJECT_EDIT = "project_mgt:edit";
public const string PERMISSION_PROJECT_MANAGE = "project_mgt:manage";

// Observability Management Permissions
public const string PERMISSION_OBSERVABILITY_VIEW_LOGS = "observability_mgt:view_logs";
public const string PERMISSION_OBSERVABILITY_VIEW_INSIGHTS = "observability_mgt:view_insights";

// User Management Permissions
public const string PERMISSION_USER_MANAGE_USERS = "user_mgt:manage_users";
public const string PERMISSION_USER_UPDATE_USERS = "user_mgt:update_users";
public const string PERMISSION_USER_MANAGE_GROUPS = "user_mgt:manage_groups";
public const string PERMISSION_USER_MANAGE_ROLES = "user_mgt:manage_roles";
public const string PERMISSION_USER_UPDATE_GROUP_ROLES = "user_mgt:update_group_roles";

// ============================================================================
// TOKEN GENERATION
// ============================================================================

// Generate JWT token V2 with permissions (RBAC V2)
public isolated function generateJWTTokenV2(
        string userId,
        string username,
        string displayName,
        string jwtIssuer,
        int tokenExpiryTime,
        string jwtAudience,
        jwt:IssuerSignatureConfig signatureConfig
) returns string|error {
    log:printDebug("Generating JWT token V2 with permissions", username = username);

    // Get all permission names for the user (across all scopes)
    string[] permissionNames = check getUserPermissionNames(userId);

    // Create scope string (OAuth2/OIDC standard for permissions)
    string scopeString = string:'join(" ", ...permissionNames);

    // Generate JWT token
    jwt:IssuerConfig issuerConfig = {
        username: userId, // 'sub' claim should be the userId (UUID)
        issuer: jwtIssuer,
        expTime: <decimal>tokenExpiryTime,
        audience: jwtAudience,
        signatureConfig: signatureConfig
    };

    // Add custom claims
    issuerConfig.customClaims["username"] = username;
    issuerConfig.customClaims["displayName"] = displayName;
    issuerConfig.customClaims["scope"] = scopeString; // Space-separated format (OAuth2 standard) - used for declarative validation

    string|jwt:Error jwtToken = jwt:issue(issuerConfig);
    if jwtToken is jwt:Error {
        log:printError("Error generating JWT token V2", jwtToken, username = username);
        return error("Failed to generate JWT token V2", jwtToken);
    }

    log:printInfo("JWT token V2 generated successfully", 
        username = username, 
        permissionCount = permissionNames.length());
    return jwtToken;
}

// Extract UserContextV2 from JWT token (RBAC V2)
// Parses permissions from the 'scope' claim
public isolated function extractUserContextV2(string authorizationHeader) returns types:UserContextV2|error {
    // Remove "Bearer " prefix if present
    string token = authorizationHeader;
    if authorizationHeader.toLowerAscii().startsWith("bearer ") {
        token = authorizationHeader.substring(7);
    }

    // Decode JWT token (validation already done by auth interceptor)
    [jwt:Header, jwt:Payload]|jwt:Error decodeResult = jwt:decode(token);
    if decodeResult is jwt:Error {
        log:printError("Failed to decode JWT token V2 for user context", decodeResult);
        return error("Invalid JWT token");
    }

    jwt:Payload payload = decodeResult[1];

    // Extract user ID (sub claim)
    string|error userId = payload.sub.ensureType();
    if userId is error {
        log:printError("JWT token missing 'sub' claim");
        return error("Invalid token: missing user ID");
    }

    // Extract username from custom claims
    anydata usernameData = payload["username"];
    json|error usernameJson = usernameData.ensureType();
    string username = usernameJson is string ? usernameJson : userId;

    // Extract display name from custom claims
    anydata displayNameData = payload["displayName"];
    json|error displayNameJson = displayNameData.ensureType();
    string displayName = displayNameJson is string ? displayNameJson : username;

    // Extract permissions from 'scope' claim (OAuth2 standard - space-separated string)
    anydata scopeData = payload["scope"];
    json|error scopeJson = scopeData.ensureType();
    string[] permissions = [];
    
    if scopeJson is string {
        // Split space-separated scope string into array
        string scopeString = scopeJson.trim();
        if scopeString.length() > 0 {
            // Split by any whitespace (space, tab, newline)
            permissions = from string perm in re ` +`.split(scopeString)
                          where perm.trim().length() > 0
                          select perm.trim();
        }
    } else {
        log:printWarn("JWT token missing or invalid 'scope' claim", userId = userId);
    }

    log:printInfo("Successfully extracted user context V2",
            userId = userId,
            username = username,
            permissionCount = permissions.length());

    return {
        userId: userId,
        username: username,
        displayName: displayName,
        permissions: permissions
    };
}

// ============================================================================
// REFRESH TOKEN UTILITIES
// ============================================================================

// Generate a cryptographically secure refresh token
// Returns a 256-bit random token encoded as a base64 string
public isolated function generateRefreshToken() returns string {
    log:printDebug("Generating refresh token");

    // Generate a UUID v4 as the base for the refresh token
    // This provides 128 bits of randomness
    string uuid1 = uuid:createType4AsString();
    string uuid2 = uuid:createType4AsString();

    // Combine two UUIDs for 256 bits of randomness and hash with SHA-256
    string combined = uuid1 + uuid2;
    byte[] combinedBytes = combined.toBytes();
    byte[] hashedBytes = crypto:hashSha256(combinedBytes);

    // Encode as base64 for storage and transmission
    string refreshToken = hashedBytes.toBase64();

    log:printDebug("Refresh token generated successfully");
    return refreshToken;
}

// Generate a unique token ID (UUID v4)
public isolated function generateTokenId() returns string {
    return uuid:createType4AsString();
}

// Hash a refresh token using SHA-256
// Tokens should always be hashed before storing in database
public isolated function hashRefreshToken(string token) returns string {
    byte[] tokenBytes = token.toBytes();
    byte[] hashedBytes = crypto:hashSha256(tokenBytes);
    return hashedBytes.toBase64();
}
