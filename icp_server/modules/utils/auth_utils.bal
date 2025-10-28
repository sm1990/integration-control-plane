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

import icp_server.storage;
import icp_server.types;

import ballerina/crypto;
import ballerina/http;
import ballerina/jwt;
import ballerina/log;
import ballerina/time;
import ballerina/url;
import ballerina/uuid;

// HTTP error response helpers

public isolated function createUnauthorizedError(string message) returns http:Unauthorized => {
    body: {
        message
    }
};

public isolated function createBadRequestError(string message) returns http:BadRequest => {
    body: {
        message
    }
};

public isolated function createForbiddenError(string message) returns http:Forbidden => {
    body: {
        message
    }
};

public isolated function createInternalServerError(string message) returns http:InternalServerError => {
    body: {
        message
    }
};

// OIDC helper functions

// Build OIDC authorization URL with query parameters
public isolated function buildAuthorizationUrl(types:SSOConfig config) returns string|error {
    // Build query parameters
    map<string> params = {
        "response_type": "code",
        "client_id": config.clientId,
        "redirect_uri": config.redirectUri,
        "scope": string:'join(" ", ...config.scopes),
        "state": "default" // TODO Add CSRF protection
    };

    // URL encode each parameter
    string[] queryParts = [];
    foreach var [key, value] in params.entries() {
        string encodedKey = check url:encode(key, "UTF-8");
        string encodedValue = check url:encode(value, "UTF-8");
        queryParts.push(string `${encodedKey}=${encodedValue}`);
    }

    // Construct full authorization URL
    string queryString = string:'join("&", ...queryParts);
    string authorizationUrl = string `${config.authorizationEndpoint}?${queryString}`;

    return authorizationUrl;
}

public isolated function exchangeCodeForTokens(string code, types:SSOConfig config) 
    returns types:OIDCTokenResponse|http:Unauthorized|http:InternalServerError {
    
    log:printInfo("Exchanging authorization code with OIDC provider", tokenEndpoint = config.tokenEndpoint);

    // Create HTTP client on-demand for the token endpoint
    http:Client|error oidcClient = new (config.tokenEndpoint);
    if oidcClient is error {
        log:printError("Failed to create OIDC client", oidcClient);
        return createInternalServerError("Failed to connect to OIDC provider");
    }

    // Prepare token request body (application/x-www-form-urlencoded)
    string tokenRequestBody = string `grant_type=authorization_code&code=${code}&redirect_uri=${config.redirectUri}`;

    // Prepare Basic Auth header (clientId:clientSecret)
    string credentials = string `${config.clientId}:${config.clientSecret}`;
    string encodedCredentials = credentials.toBytes().toBase64();

    // Make token exchange request
    http:Response|error tokenHttpResponse = oidcClient->post("", tokenRequestBody, {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": string `Basic ${encodedCredentials}`
    });

    if tokenHttpResponse is error {
        log:printError("Error calling OIDC token endpoint", tokenHttpResponse);
        return createInternalServerError("Failed to communicate with OIDC provider");
    }

    // Check status code
    int statusCode = tokenHttpResponse.statusCode;
    
    if statusCode == http:STATUS_BAD_REQUEST || statusCode == http:STATUS_UNAUTHORIZED {
        // Get error details from response
        json|error errorPayload = tokenHttpResponse.getJsonPayload();
        string errorMessage = "Invalid authorization code or authentication failed";
        
        if errorPayload is json {
            json|error errorDesc = errorPayload.error_description;
            if errorDesc is string {
                errorMessage = errorDesc;
            }
        }
        
        log:printError("OIDC token exchange failed", statusCode = statusCode, message = errorMessage);
        return createUnauthorizedError(errorMessage);
    }

    if statusCode != http:STATUS_OK {
        log:printError("Unexpected status code from OIDC token endpoint", statusCode = statusCode);
        return createInternalServerError("OIDC provider returned an error");
    }

    // Parse token response
    json|error tokenPayload = tokenHttpResponse.getJsonPayload();
    if tokenPayload is error {
        log:printError("Failed to parse token response from OIDC provider", tokenPayload);
        return createInternalServerError("Invalid response from OIDC provider");
    }

    types:OIDCTokenResponse|error tokenData = tokenPayload.cloneWithType();
    if tokenData is error {
        log:printError("Token response does not match expected schema", tokenData);
        return createInternalServerError("Invalid token response from OIDC provider");
    }

    log:printInfo("Successfully received tokens from OIDC provider");
    return tokenData;
}

// Decode and validate ID token, return claims
public isolated function decodeAndValidateIdToken(string idToken, types:SSOConfig config) 
    returns types:OIDCIdTokenClaims|http:Unauthorized|http:InternalServerError {
    
    log:printInfo("Decoding ID token");
    
    // Decode JWT without signature validation (validation deferred to security hardening)
    [jwt:Header, jwt:Payload]|jwt:Error decodeResult = jwt:decode(idToken);
    if decodeResult is jwt:Error {
        log:printError("Failed to decode ID token", decodeResult);
        return createUnauthorizedError("Invalid ID token");
    }
    
    // Extract payload from decode result
    jwt:Payload payload = decodeResult[1];
    
    // Manually construct OIDCIdTokenClaims from JWT payload
    // This is necessary because jwt:Payload may contain additional fields (like nbf, jti)
    // that are not part of our closed OIDCIdTokenClaims record
    types:OIDCIdTokenClaims|error claims = buildIdTokenClaims(payload);
    if claims is error {
        log:printError("Failed to build ID token claims structure", claims);
        return createUnauthorizedError("Invalid ID token structure");
    }
    
    log:printInfo("Successfully decoded ID token");
    
    // Validate claims
    error? validationError = validateIdTokenClaims(claims, config);
    if validationError is error {
        log:printError("ID token validation failed", validationError);
        return createUnauthorizedError(validationError.message());
    }
    
    log:printInfo("ID token validation successful", sub = claims.sub);
    return claims;
}

// Build OIDCIdTokenClaims from JWT payload
isolated function buildIdTokenClaims(jwt:Payload payload) returns types:OIDCIdTokenClaims|error {
    // Extract required claims
    string|error sub = payload.sub.ensureType();
    if sub is error {
        return error("Missing or invalid 'sub' claim");
    }
    
    string|error iss = payload.iss.ensureType();
    if iss is error {
        return error("Missing or invalid 'iss' claim");
    }
    
    string|string[]|error aud = payload.aud.ensureType();
    if aud is error {
        return error("Missing or invalid 'aud' claim");
    }
    
    int|error exp = payload.exp.ensureType();
    if exp is error {
        return error("Missing or invalid 'exp' claim");
    }
    
    int|error iat = payload.iat.ensureType();
    if iat is error {
        return error("Missing or invalid 'iat' claim");
    }
    
    // Extract optional claims from the payload map
    // Cast payload to map<json> to access additional claims
    map<json> payloadMap = <map<json>>payload.toJson();
    
    string? email = ();
    json emailJson = payloadMap["email"];
    if emailJson is string {
        email = emailJson;
    }
    
    string? name = ();
    json nameJson = payloadMap["name"];
    if nameJson is string {
        name = nameJson;
    }
    
    string? preferredUsername = ();
    json preferredUsernameJson = payloadMap["preferred_username"];
    if preferredUsernameJson is string {
        preferredUsername = preferredUsernameJson;
    }
    
    // Construct OIDCIdTokenClaims record
    types:OIDCIdTokenClaims claims = {
        sub: sub,
        iss: iss,
        aud: aud,
        exp: exp,
        iat: iat,
        email: email,
        name: name,
        preferred_username: preferredUsername
    };
    
    return claims;
}

// Validate ID token claims
isolated function validateIdTokenClaims(types:OIDCIdTokenClaims claims, types:SSOConfig config) returns error? {
    // Validate issuer
    if claims.iss != config.issuer {
        return error(string `Invalid issuer: expected '${config.issuer}', got '${claims.iss}'`);
    }
    
    // Validate audience (can be string or string[])
    boolean validAudience = false;
    if claims.aud is string {
        validAudience = claims.aud == config.clientId;
    } else {
        // aud is string[]
        string[] audiences = <string[]>claims.aud;
        foreach string aud in audiences {
            if aud == config.clientId {
                validAudience = true;
                break;
            }
        }
    }
    
    if !validAudience {
        return error(string `Invalid audience: token not intended for this client`);
    }
    
    // Validate expiry
    time:Utc currentTime = time:utcNow();
    int currentTimestamp = <int>currentTime[0]; // Get seconds from Utc tuple
    
    if claims.exp <= currentTimestamp {
        return error("ID token has expired");
    }
    
    return;
}

// Extract user information from ID token claims
public isolated function extractUserInfo(types:OIDCIdTokenClaims claims, types:SSOConfig config) 
    returns types:ExtractedUserInfo|http:InternalServerError {
    
    log:printInfo("Extracting user information from ID token claims");
    
    // Extract userId (sub claim is required)
    string userId = claims.sub;
    
    // Extract username from configured claim
    string? username = ();
    if config.usernameClaim == "email" {
        username = claims?.email;
    } else if config.usernameClaim == "preferred_username" {
        username = claims?.preferred_username;
    }
    
    if username is () {
        log:printError(string `Required claim '${config.usernameClaim}' not found in ID token`);
        return createInternalServerError(string `ID token missing required claim: ${config.usernameClaim}`);
    }
    
    // Extract displayName with fallback logic
    string displayName = buildDisplayName(claims, username);
    
    log:printInfo("Successfully extracted user info", userId = userId, username = username, displayName = displayName);
    
    return {
        userId: userId,
        username: username,
        displayName: displayName
    };
}

// Build display name with fallback logic: name -> email -> username (strip domain if email)
isolated function buildDisplayName(types:OIDCIdTokenClaims claims, string username) returns string {
    // Priority 1: Use 'name' claim if available
    string? name = claims?.name;
    if name is string && name.trim() != "" {
        return name;
    }
    
    // Priority 2: Use 'email' claim if available
    string? email = claims?.email;
    if email is string && email.trim() != "" {
        return stripEmailDomain(email);
    }
    
    // Priority 3: Use username and strip domain if it's an email
    return stripEmailDomain(username);
}

// Strip domain from email address (part before @)
isolated function stripEmailDomain(string email) returns string {
    if email.includes("@") {
        string[] parts = re `@`.split(email);
        return parts[0];
    }
    return email;
}

// === RBAC User Context Extraction ===

// Extract UserContext from Authorization header (JWT token)
// This function decodes the JWT and extracts user identity and roles for RBAC
public isolated function extractUserContext(string authorizationHeader) returns types:UserContext|error {
    // Remove "Bearer " prefix if present
    string token = authorizationHeader;
    if authorizationHeader.toLowerAscii().startsWith("bearer ") {
        token = authorizationHeader.substring(7);
    }
    
    // Decode JWT token (validation already done by GraphQL auth interceptor)
    [jwt:Header, jwt:Payload]|jwt:Error decodeResult = jwt:decode(token);
    if decodeResult is jwt:Error {
        log:printError("Failed to decode JWT token for user context", decodeResult);
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
    
    // Extract super admin flag from custom claims
    anydata superAdminData = payload["isSuperAdmin"];
    json|error superAdminJson = superAdminData.ensureType();
    boolean isSuperAdmin = superAdminJson is boolean ? superAdminJson : false;
    
    // Extract project author flag from custom claims
    anydata projectAuthorData = payload["isProjectAuthor"];
    json|error projectAuthorJson = projectAuthorData.ensureType();
    boolean isProjectAuthor = projectAuthorJson is boolean ? projectAuthorJson : false;
    
    // Extract roles from custom claims
    anydata rolesData = payload["roles"];
    json|error rolesJson = rolesData.ensureType();
    if rolesJson is error || rolesJson is () {
        log:printWarn("JWT token missing 'roles' claim", userId = userId, isSuperAdmin = isSuperAdmin, isProjectAuthor = isProjectAuthor);
        // Return user context with empty roles (but global flags are set if applicable)
        return {
            userId: userId,
            username: username,
            displayName: displayName,
            roles: [],
            isSuperAdmin: isSuperAdmin,
            isProjectAuthor: isProjectAuthor
        };
    }
    
    // Parse roles array from JWT
    types:RoleInfo[]|error roles = parseRolesFromJWT(rolesJson);
    if roles is error {
        log:printError("Failed to parse roles from JWT", roles, userId = userId);
        return error("Invalid token: malformed roles claim");
    }
    
    log:printInfo("Successfully extracted user context", 
                  userId = userId, 
                  username = username, 
                  roleCount = roles.length(), 
                  isSuperAdmin = isSuperAdmin,
                  isProjectAuthor = isProjectAuthor);
    
    return {
        userId: userId,
        username: username,
        displayName: displayName,
        roles: roles,
        isSuperAdmin: isSuperAdmin,
        isProjectAuthor: isProjectAuthor
    };
}

// Parse roles from JWT payload (roles claim is an array of role objects)
isolated function parseRolesFromJWT(json rolesJson) returns types:RoleInfo[]|error {
    json[] rolesArray = check rolesJson.ensureType();
    types:RoleInfo[] roles = [];
    
    foreach json roleJson in rolesArray {
        // Extract role fields (only what's needed for authorization)
        map<json> roleMap = check roleJson.ensureType();
        
        string projectId = check roleMap["projectId"].ensureType();
        string environmentTypeStr = check roleMap["environmentType"].ensureType();
        string privilegeLevelStr = check roleMap["privilegeLevel"].ensureType();
        
        // Parse environment type and privilege level enums
        types:EnvironmentType environmentType = check environmentTypeStr.ensureType();
        types:PrivilegeLevel privilegeLevel = check privilegeLevelStr.ensureType();
        
        roles.push({
            projectId: projectId,
            environmentType: environmentType,
            privilegeLevel: privilegeLevel
        });
    }
    
    return roles;
}

// Helper function to extract Authorization header from GraphQL context
public isolated function extractAuthHeader(anydata context) returns string|error {
    // The context parameter in GraphQL resolvers has the Authorization header
    // stored using context.set("Authorization", ...) in contextInit
    return check context.ensureType();
}

// === RBAC Authorization Helper Methods ===

// Check if user has access to a specific project
public isolated function hasAccessToProject(types:UserContext userContext, string projectId) returns boolean {
    // Super admins have access to all projects
    if userContext.isSuperAdmin {
        return true;
    }
    return userContext.roles.some(role => role.projectId == projectId);
}

// Check if user has access to a specific environment in a project
public isolated function hasAccessToEnvironment(types:UserContext userContext, string projectId, string environmentId) returns boolean {
    // Super admins have access to all environments
    if userContext.isSuperAdmin {
        return true;
    }
    
    // Get environment details to determine type
    types:Environment|error environment = storage:getEnvironmentById(environmentId);
    if environment is error {
        return false;
    }
    
    final types:EnvironmentType environmentType = environment.isProduction ? types:PROD : types:NON_PROD;
    
    return userContext.roles.some(isolated function (types:RoleInfo role) returns boolean {
        return role.projectId == projectId && role.environmentType == environmentType;
    });
}

// Check if user has admin access to a specific project and environment
public isolated function hasAdminAccess(types:UserContext userContext, string projectId, string environmentId) returns boolean {
    // Super admins have admin access to all environments
    if userContext.isSuperAdmin {
        return true;
    }
    
    // Get environment details to determine type
    types:Environment|error environment = storage:getEnvironmentById(environmentId);
    if environment is error {
        return false;
    }
    
    final types:EnvironmentType environmentType = environment.isProduction ? types:PROD : types:NON_PROD;
    
    return userContext.roles.some(isolated function (types:RoleInfo role) returns boolean {
        return role.projectId == projectId && 
        role.environmentType == environmentType && 
        role.privilegeLevel == types:ADMIN;
    });
}

// Check if user is an admin in any environment of a specific project
public isolated function isAdminInProject(types:UserContext userContext, string projectId) returns boolean {
    // Super admins are admin in all projects
    if userContext.isSuperAdmin {
        return true;
    }
    return userContext.roles.some(role => 
        role.projectId == projectId && 
        role.privilegeLevel == types:ADMIN
    );
}

// Get list of all project IDs the user has access to
public isolated function getAccessibleProjectIds(types:UserContext userContext) returns string[] {
    // Super admins have access to all projects
    if userContext.isSuperAdmin {
        types:Project[]|error allProjects = storage:getProjects();
        if allProjects is error {
            log:printError("Super admin failed to fetch all projects", allProjects);
            return [];
        }
        return from types:Project project in allProjects select project.projectId;
    }
    
    string[] projectIds = [];
    foreach types:RoleInfo role in userContext.roles {
        // Add project ID if not already in list (avoid duplicates)
        boolean exists = false;
        foreach string id in projectIds {
            if id == role.projectId {
                exists = true;
                break;
            }
        }
        if !exists {
            projectIds.push(role.projectId);
        }
    }
    return projectIds;
}

// Get list of all environment IDs the user has access to within a specific project
public isolated function getAccessibleEnvironmentIds(types:UserContext userContext, string projectId) returns string[] {
    // Super admins have access to all environments
    if userContext.isSuperAdmin {
        types:Environment[]|error allEnvironments = storage:getEnvironments();
        if allEnvironments is error {
            log:printError("Super admin failed to fetch all environments", allEnvironments);
            return [];
        }
        return from types:Environment env in allEnvironments select env.environmentId;
    }
    
    // Get all environments and filter by user's access to project and environment types
    types:Environment[]|error allEnvironments = storage:getEnvironments();
    if allEnvironments is error {
        log:printError("Failed to fetch environments for access check", allEnvironments);
        return [];
    }
    
    string[] environmentIds = [];
    foreach types:Environment env in allEnvironments {
        final types:EnvironmentType envType = env.isProduction ? types:PROD : types:NON_PROD;
        boolean hasAccess = userContext.roles.some(isolated function (types:RoleInfo role) returns boolean { 
            return role.projectId == projectId && role.environmentType == envType;
        });
        
        if hasAccess {
            environmentIds.push(env.environmentId);
        }
    }
    
    return environmentIds;
}

// Get list of all project IDs where the user has admin access
public isolated function getAdminProjectIds(types:UserContext userContext) returns string[] {
    // Super admins have admin access to all projects - fetch from database
    if userContext.isSuperAdmin {
        types:Project[]|error allProjects = storage:getProjects();
        if allProjects is error {
            log:printError("Super admin failed to fetch all projects", allProjects);
            return [];
        }
        return from types:Project project in allProjects select project.projectId;
    }
    
    string[] adminProjectIds = [];
    foreach types:RoleInfo role in userContext.roles {
        if role.privilegeLevel == types:ADMIN {
            // Add project ID if not already in list (avoid duplicates)
            boolean exists = false;
            foreach string id in adminProjectIds {
                if id == role.projectId {
                    exists = true;
                    break;
                }
            }
            if !exists {
                adminProjectIds.push(role.projectId);
            }
        }
    }
    return adminProjectIds;
}

// Get list of environment IDs where the user has admin access based on environment types
public isolated function getAdminEnvironmentIdsByType(types:UserContext userContext) returns string[] {
    // Super admins have admin access to all environments - fetch from database
    if userContext.isSuperAdmin {
        types:Environment[]|error allEnvironments = storage:getEnvironments();
        if allEnvironments is error {
            log:printError("Super admin failed to fetch all environments", allEnvironments);
            return [];
        }
        return from types:Environment env in allEnvironments select env.environmentId;
    }
    
    string[] adminEnvironmentIds = [];
    types:Environment[]|error allEnvironments = storage:getEnvironments();
    if allEnvironments is error {
        log:printError("Failed to fetch environments for admin check", allEnvironments);
        return [];
    }
    
    // For each environment, check if user has admin access to its type
    foreach types:Environment env in allEnvironments {
        final types:EnvironmentType envType = env.isProduction ? types:PROD : types:NON_PROD;
        boolean hasAdminAccess = userContext.roles.some(isolated function (types:RoleInfo role) returns boolean {
            return role.environmentType == envType && role.privilegeLevel == types:ADMIN;
        });
        
        if hasAdminAccess {
            adminEnvironmentIds.push(env.environmentId);
        }
    }
    
    return adminEnvironmentIds;
}

// Get list of environment IDs where the user has any role (admin or developer) across all projects
public isolated function getAccessibleEnvironmentIdsByType(types:UserContext userContext) returns string[]|error {
    // Super admins have access to all environments
    if userContext.isSuperAdmin {
        types:Environment[]|error allEnvironments = storage:getEnvironments();
        if allEnvironments is error {
            log:printError("Super admin failed to fetch all environments", allEnvironments);
            return [];
        }
        return from types:Environment env in allEnvironments select env.environmentId;
    }
    
    // Determine which environment types the user has access to
    boolean hasProdAccess = userContext.roles.some(isolated function (types:RoleInfo role) returns boolean {
        return role.environmentType == types:PROD;
    });
    
    boolean hasNonProdAccess = userContext.roles.some(isolated function (types:RoleInfo role) returns boolean {
        return role.environmentType == types:NON_PROD;
    });
    
    // If user has no access to any environment type, return empty array
    if !hasProdAccess && !hasNonProdAccess {
        return [];
    }
    
    // Make targeted database query based on accessible environment types
    return check storage:getEnvironmentIdsByTypes(hasProdAccess, hasNonProdAccess);
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

// ============================================================================
// JWT TOKEN GENERATION
// ============================================================================

// Generate JWT token with user details and roles
public isolated function generateJWTToken(
    types:User userDetails,
    types:Role[] userRoles,
    string jwtIssuer,
    int tokenExpiryTime,
    string jwtAudience,
    jwt:IssuerSignatureConfig signatureConfig
) returns string|error {
    log:printDebug("Generating JWT token", username = userDetails.username, roleCount = userRoles.length());
    
    // Convert roles to RoleInfo format for JWT
    types:RoleInfo[] roleInfos = from types:Role role in userRoles
        select {
            projectId: role.projectId,
            environmentType: role.environmentType,
            privilegeLevel: role.privilegeLevel
        };
    
    // Generate JWT token with updated roles
    // Note: IssuerConfig.username sets the 'sub' claim, which should be the userId (UUID)
    jwt:IssuerConfig issuerConfig = {
        username: userDetails.userId,
        issuer: jwtIssuer,
        expTime: <decimal>tokenExpiryTime,
        audience: jwtAudience,
        signatureConfig: signatureConfig
    };
    
    issuerConfig.customClaims["roles"] = roleInfos.toJson();
    issuerConfig.customClaims["username"] = userDetails.username;
    issuerConfig.customClaims["displayName"] = userDetails.displayName;
    issuerConfig.customClaims["isSuperAdmin"] = userDetails.isSuperAdmin;
    issuerConfig.customClaims["isProjectAuthor"] = userDetails.isProjectAuthor;
    
    string|jwt:Error jwtToken = jwt:issue(issuerConfig);
    if jwtToken is jwt:Error {
        log:printError("Error generating JWT token", jwtToken, username = userDetails.username);
        return error("Failed to generate JWT token", jwtToken);
    }
    
    log:printInfo("JWT token generated successfully", username = userDetails.username, roleCount = userRoles.length());
    return jwtToken;
}

// Check if user is admin in a project (in ANY environment)
public isolated function isAdminInAnyEnvironment(types:UserContext userContext, string projectId) returns boolean {
    if userContext.isSuperAdmin {
        return true;
    }
    
    return userContext.roles.some(role => 
        role.projectId == projectId && 
        role.privilegeLevel == types:ADMIN
    );
}

