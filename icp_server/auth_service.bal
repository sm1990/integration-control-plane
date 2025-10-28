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
import icp_server.types as types;
import icp_server.utils;

import ballerina/http;
import ballerina/jwt;
import ballerina/log;
import ballerina/sql;

// HTTP client to call the authentication backend
final http:Client authBackendClient = check new (authBackendUrl,
    secureSocket = {
        cert: {
            path: truststorePath,
            password: truststorePassword
        }
    }
);

final readonly & jwt:IssuerSignatureConfig jwtSignatureConfig = {
    algorithm: jwt:HS256,
    config: defaultJwtHMACSecret
};

@http:ServiceConfig {
    cors: {
        allowOrigins: ["*"]
    }
}
service /auth on httpListener {

    isolated resource function post login(types:Credentials credentials, http:Request req) returns http:Ok|http:Unauthorized|http:InternalServerError|error {
        log:printInfo("Login attempt for user", username = credentials.username);
        // Call the authentication backend to verify credentials
        http:Response|error authResponse = authBackendClient->post("/authenticate", credentials, {
            "X-API-Key": authBackendApiKey
        });

        if authResponse is error {
            log:printError("Error calling authentication backend", authResponse);
            return utils:createInternalServerError("Authentication service unavailable");
        }

        // Check status code before parsing response
        if authResponse.statusCode == http:STATUS_UNAUTHORIZED {
            log:printError("Authentication failed for user", username = credentials.username);
            return utils:createUnauthorizedError("Invalid credentials");
        } else if authResponse.statusCode != http:STATUS_OK {
            log:printError("Unexpected status code from authentication backend", statusCode = authResponse.statusCode);
            return utils:createInternalServerError("Authentication service error");
        }

        // Parse response body
        json|error authPayload = authResponse.getJsonPayload();
        if authPayload is error {
            log:printError("JSON payload not present in authentication response", authPayload);
            return utils:createInternalServerError("Invalid response from authentication service");
        }

        types:AuthenticateResponse|error authResult = authPayload.cloneWithType();
        if authResult is error {
            log:printError("Authentication response payload does not match expected type", authResult);
            return utils:createInternalServerError("Invalid response from authentication service");
        }

        if !authResult.authenticated {
            log:printError("Authentication failed for user", username = credentials.username);
            return utils:createUnauthorizedError("Invalid credentials");
        }

        // Validate that auth backend returned required user claims
        if authResult.userId is () || authResult.displayName is () {
            log:printError("Authentication backend did not return required user claims", username = credentials.username);
            return utils:createInternalServerError("Invalid response from authentication service");
        }

        string userId = <string>authResult.userId;
        string displayName = <string>authResult.displayName;
        // Use username from the original request credentials
        string username = credentials.username;

        types:User|error userDetails = storage:getUserDetailsById(userId);
        if userDetails is error {
            if userDetails is sql:NoRowsError {
                // New user
                log:printInfo(string `User ${username} authenticated but not found in users table, creating user record`);
                error? createResult = storage:createUser(userId, username, displayName);
                if createResult is error {
                    log:printError("Error creating user in database", createResult, username = username);
                    return utils:createInternalServerError("Error creating user record");
                }

                // Fetch the newly created user details
                userDetails = storage:getUserDetailsById(userId);
                if userDetails is error {
                    log:printError("Error getting newly created user details", userDetails);
                    return utils:createInternalServerError("Error getting user details");
                }

                //TODO Handle roles for new users
            } else {
                log:printError("Error getting user details", userDetails);
                return utils:createInternalServerError("Error getting user details");
            }
        }

        types:Role[]|error userRoles = storage:getUserRoles(userDetails.userId);
        if userRoles is error {
            log:printError("Error getting user roles", userRoles);
            return utils:createInternalServerError("Error getting user roles");
        }

        // Generate JWT token using utility function
        string|error jwtToken = utils:generateJWTToken(
            userDetails,
            userRoles,
            frontendJwtIssuer,
            defaultTokenExpiryTime,
            frontendJwtAudience,
            jwtSignatureConfig
        );
        
        if jwtToken is error {
            log:printError("Error generating JWT token", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }

        // Generate refresh token
        string refreshToken = utils:generateRefreshToken();
        string tokenId = utils:generateTokenId();
        string tokenHash = utils:hashRefreshToken(refreshToken);
        
        // Extract user agent and IP address from request
        string|http:HeaderNotFoundError userAgentHeader = req.getHeader("User-Agent");
        string? userAgent = userAgentHeader is string ? userAgentHeader : ();
        
        string|http:HeaderNotFoundError ipAddressHeader = req.getHeader("X-Forwarded-For");
        string? ipAddress = ipAddressHeader is string ? ipAddressHeader : ();
        if ipAddress is () {
            // Fallback to X-Real-IP if X-Forwarded-For is not present
            string|http:HeaderNotFoundError realIpHeader = req.getHeader("X-Real-IP");
            ipAddress = realIpHeader is string ? realIpHeader : ();
        }
        
        // Store refresh token in database
        error? storeResult = storage:storeRefreshToken(
            tokenId,
            userId,
            tokenHash,
            refreshTokenExpiryTime,
            userAgent,
            ipAddress
        );
        
        if storeResult is error {
            log:printError("Error storing refresh token", storeResult, userId = userId);
            return utils:createInternalServerError("Error storing refresh token");
        }

        log:printInfo("Login successful for user", username = username, isSuperAdmin = userDetails.isSuperAdmin, isProjectAuthor = userDetails.isProjectAuthor);
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                refreshToken: refreshToken,
                refreshTokenExpiresIn: refreshTokenExpiryTime,
                username: username,
                displayName: userDetails.displayName,
                roles: userRoles,
                isSuperAdmin: userDetails.isSuperAdmin,
                isProjectAuthor: userDetails.isProjectAuthor,
                isOidcUser: false
            }
        };
    }

    // OIDC Login endpoint - exchanges authorization code for ICP token
    isolated resource function post login/oidc(types:OIDCCallbackRequest request, http:Request req) returns http:Ok|http:Unauthorized|http:BadRequest|http:InternalServerError {
        log:printInfo("OIDC login attempt - exchanging authorization code");

        // Get SSO configuration
        types:SSOConfig ssoConfig = getSSOConfig();

        // Validate SSO configuration
        error? validationError = validateSSOConfig(ssoConfig);
        if validationError is error {
            log:printError("SSO configuration validation failed", validationError);
            return utils:createBadRequestError(validationError.message());
        }

        // Check if SSO is enabled
        if !ssoConfig.enabled {
            log:printWarn("OIDC login attempted but SSO is not enabled");
            return utils:createBadRequestError("SSO authentication is not enabled");
        }

        // Exchange authorization code for tokens
        types:OIDCTokenResponse|http:Unauthorized|http:InternalServerError tokenResponse = utils:exchangeCodeForTokens(request.code, ssoConfig);
        
        if tokenResponse is http:Unauthorized|http:InternalServerError {
            return tokenResponse;
        }

        log:printInfo("Successfully exchanged authorization code for tokens");
        
        // Decode and validate ID token
        types:OIDCIdTokenClaims|http:Unauthorized|http:InternalServerError claims = 
            utils:decodeAndValidateIdToken(tokenResponse.id_token, ssoConfig);
        
        if claims is http:Unauthorized|http:InternalServerError {
            return claims;
        }
        
        // Extract user information
        types:ExtractedUserInfo|http:InternalServerError userInfo = utils:extractUserInfo(claims, ssoConfig);
        
        if userInfo is http:InternalServerError {
            return userInfo;
        }
        
        // Check if user exists, create if new
        types:User|error userDetails = storage:getUserDetailsById(userInfo.userId);
        if userDetails is error {
            if userDetails is sql:NoRowsError {
                // New OIDC user - create record
                log:printInfo("New OIDC user, creating user record", 
                    userId = userInfo.userId, 
                    username = userInfo.username);
                
                error? createResult = storage:createUser(userInfo.userId, userInfo.username, userInfo.displayName);
                if createResult is error {
                    log:printError("Error creating OIDC user in database", createResult, 
                        username = userInfo.username);
                    return utils:createInternalServerError("Error creating user record");
                }
                
                // Fetch the newly created user details
                userDetails = storage:getUserDetailsById(userInfo.userId);
                if userDetails is error {
                    log:printError("Error getting newly created OIDC user details", userDetails);
                    return utils:createInternalServerError("Error getting user details");
                }
            } else {
                log:printError("Error getting OIDC user details", userDetails);
                return utils:createInternalServerError("Error getting user details");
            }
        }
        
        // Fetch user roles
        types:Role[]|error userRoles = storage:getUserRoles(userDetails.userId);
        if userRoles is error {
            log:printError("Error getting user roles for OIDC user", userRoles);
            return utils:createInternalServerError("Error getting user roles");
        }
        
        // Generate JWT token using utility function
        string|error jwtToken = utils:generateJWTToken(
            userDetails,
            userRoles,
            frontendJwtIssuer,
            defaultTokenExpiryTime,
            frontendJwtAudience,
            jwtSignatureConfig
        );
        
        if jwtToken is error {
            log:printError("Error generating JWT token for OIDC user", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }
        
        // Generate refresh token
        string refreshToken = utils:generateRefreshToken();
        string tokenId = utils:generateTokenId();
        string tokenHash = utils:hashRefreshToken(refreshToken);
        
        // Extract user agent and IP address from request
        string|http:HeaderNotFoundError userAgentHeader = req.getHeader("User-Agent");
        string? userAgent = userAgentHeader is string ? userAgentHeader : ();
        
        string|http:HeaderNotFoundError ipAddressHeader = req.getHeader("X-Forwarded-For");
        string? ipAddress = ipAddressHeader is string ? ipAddressHeader : ();
        if ipAddress is () {
            // Fallback to X-Real-IP if X-Forwarded-For is not present
            string|http:HeaderNotFoundError realIpHeader = req.getHeader("X-Real-IP");
            ipAddress = realIpHeader is string ? realIpHeader : ();
        }
        
        // Store refresh token in database
        error? storeResult = storage:storeRefreshToken(
            tokenId,
            userDetails.userId,
            tokenHash,
            refreshTokenExpiryTime,
            userAgent,
            ipAddress
        );
        
        if storeResult is error {
            log:printError("Error storing refresh token for OIDC user", storeResult, userId = userDetails.userId);
            return utils:createInternalServerError("Error storing refresh token");
        }
        
        // Return login response
        log:printInfo("OIDC login successful", username = userInfo.username, isSuperAdmin = userDetails.isSuperAdmin, isProjectAuthor = userDetails.isProjectAuthor);
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                refreshToken: refreshToken,
                refreshTokenExpiresIn: refreshTokenExpiryTime,
                username: userInfo.username,
                displayName: userDetails.displayName,
                roles: userRoles,
                isSuperAdmin: userDetails.isSuperAdmin,
                isProjectAuthor: userDetails.isProjectAuthor,
                isOidcUser: true
            }
        };
    }

    // Token renewal endpoint - regenerates JWT with current user roles (without requiring refresh token)
    // Used when user's permissions change (e.g., after creating a project or role updates)
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post 'renew\-token(@http:Header {name: http:AUTH_HEADER} string? authHeader) returns http:Ok|http:Unauthorized|http:InternalServerError {
        log:printInfo("Token renewal requested");
        
        if authHeader is () {
            log:printError("Authorization header missing in token renewal request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        // Extract user context from current token
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context for token renewal", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        // Fetch latest user details and roles from database
        types:User|error userDetails = storage:getUserDetailsById(userContext.userId);
        if userDetails is error {
            log:printError("Error fetching user details for token renewal", userDetails, userId = userContext.userId);
            return utils:createInternalServerError("Failed to fetch user details");
        }
        
        types:Role[]|error userRoles = storage:getUserRoles(userContext.userId);
        if userRoles is error {
            log:printError("Error fetching user roles for token renewal", userRoles, userId = userContext.userId);
            return utils:createInternalServerError("Failed to fetch user roles");
        }
        
        // Generate JWT token using utility function
        string|error jwtToken = utils:generateJWTToken(
            userDetails,
            userRoles,
            frontendJwtIssuer,
            defaultTokenExpiryTime,
            frontendJwtAudience,
            jwtSignatureConfig
        );
        
        if jwtToken is error {
            log:printError("Error generating renewed JWT token", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }
        
        log:printInfo("Token renewed successfully", username = userDetails.username, roleCount = userRoles.length());
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                username: userDetails.username,
                displayName: userDetails.displayName,
                roles: userRoles,
                isSuperAdmin: userDetails.isSuperAdmin,
                isProjectAuthor: userDetails.isProjectAuthor
            }
        };
    }

    // Token refresh endpoint - uses refresh token to generate new access token
    // This endpoint does NOT require JWT authentication - uses refresh token instead
    isolated resource function post 'refresh\-token(types:RefreshTokenRequest request, http:Request req) returns http:Ok|http:Unauthorized|http:BadRequest|http:InternalServerError {
        log:printInfo("Token refresh requested using refresh token");
        
        // Validate request
        if request.refreshToken.trim().length() == 0 {
            log:printWarn("Empty refresh token provided");
            return utils:createBadRequestError("Refresh token is required");
        }
        
        // Hash the provided refresh token to compare with stored hash
        string tokenHash = utils:hashRefreshToken(request.refreshToken);
        
        // Validate refresh token and get user details
        types:User|error userDetails = storage:validateRefreshToken(tokenHash);
        if userDetails is error {
            log:printWarn("Invalid or expired refresh token", userDetails);
            return utils:createUnauthorizedError("Invalid or expired refresh token");
        }
        
        // Fetch user roles
        types:Role[]|error userRoles = storage:getUserRoles(userDetails.userId);
        if userRoles is error {
            log:printError("Error fetching user roles for refresh token", userRoles, userId = userDetails.userId);
            return utils:createInternalServerError("Failed to fetch user roles");
        }
        
        // Generate new JWT access token
        string|error jwtToken = utils:generateJWTToken(
            userDetails,
            userRoles,
            frontendJwtIssuer,
            defaultTokenExpiryTime,
            frontendJwtAudience,
            jwtSignatureConfig
        );
        
        if jwtToken is error {
            log:printError("Error generating JWT token from refresh token", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }
        
        // If rotation is disabled, return response with same refresh token
        if !enableRefreshTokenRotation {
            log:printInfo("Token refreshed without rotation", 
                username = userDetails.username, 
                userId = userDetails.userId);
            return <http:Ok>{
                body: {
                    token: jwtToken,
                    expiresIn: defaultTokenExpiryTime,
                    refreshToken: request.refreshToken,
                    refreshTokenExpiresIn: refreshTokenExpiryTime,
                    username: userDetails.username,
                    displayName: userDetails.displayName,
                    roles: userRoles,
                    isSuperAdmin: userDetails.isSuperAdmin,
                    isProjectAuthor: userDetails.isProjectAuthor
                }
            };
        }
        
        // Rotation is enabled - generate new refresh token
        string newRefreshToken = utils:generateRefreshToken();
        string newTokenId = utils:generateTokenId();
        string newTokenHash = utils:hashRefreshToken(newRefreshToken);
        
        // Extract user agent and IP address from request
        string|http:HeaderNotFoundError userAgentHeader = req.getHeader("User-Agent");
        string? userAgent = userAgentHeader is string ? userAgentHeader : ();
        
        string|http:HeaderNotFoundError ipAddressHeader = req.getHeader("X-Forwarded-For");
        string? ipAddress = ipAddressHeader is string ? ipAddressHeader : ();
        if ipAddress is () {
            // Fallback to X-Real-IP if X-Forwarded-For is not present
            string|http:HeaderNotFoundError realIpHeader = req.getHeader("X-Real-IP");
            ipAddress = realIpHeader is string ? realIpHeader : ();
        }
        
        // Revoke the old refresh token (used for rotation)
        error? revokeResult = storage:revokeRefreshToken(tokenHash);
        if revokeResult is error {
            log:printWarn("Failed to revoke old refresh token", revokeResult, userId = userDetails.userId);
            // Continue anyway - this is not critical
        }
        
        // Store new refresh token
        error? storeResult = storage:storeRefreshToken(
            newTokenId,
            userDetails.userId,
            newTokenHash,
            refreshTokenExpiryTime,
            userAgent,
            ipAddress
        );
        
        if storeResult is error {
            log:printError("Error storing new refresh token", storeResult, userId = userDetails.userId);
            return utils:createInternalServerError("Error storing refresh token");
        }
        
        log:printInfo("Token refreshed with rotation", 
            username = userDetails.username, 
            userId = userDetails.userId);
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                refreshToken: newRefreshToken,
                refreshTokenExpiresIn: refreshTokenExpiryTime,
                username: userDetails.username,
                displayName: userDetails.displayName,
                roles: userRoles,
                isSuperAdmin: userDetails.isSuperAdmin,
                isProjectAuthor: userDetails.isProjectAuthor
            }
        };
    }

    // Token revocation endpoint - revokes refresh token(s) for logout
    // Requires JWT authentication to identify the user
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post 'revoke\-token(@http:Header {name: http:AUTH_HEADER} string? authHeader, types:RevokeTokenRequest request) returns http:Ok|http:Unauthorized|http:BadRequest|http:InternalServerError {
        log:printInfo("Token revocation requested");
        
        if authHeader is () {
            log:printError("Authorization header missing in revoke token request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        // Extract user context from current JWT
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context for token revocation", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        // Check if a specific refresh token was provided
        if request?.refreshToken is string {
            string refreshToken = <string>request?.refreshToken;
            
            if refreshToken.trim().length() == 0 {
                log:printWarn("Empty refresh token provided for revocation", userId = userContext.userId);
                return utils:createBadRequestError("Refresh token cannot be empty");
            }
            
            // Hash the refresh token to match database storage
            string tokenHash = utils:hashRefreshToken(refreshToken);
            
            // Revoke the specific refresh token
            error? revokeResult = storage:revokeRefreshToken(tokenHash);
            if revokeResult is error {
                log:printError("Error revoking specific refresh token", revokeResult, userId = userContext.userId);
                return utils:createInternalServerError("Failed to revoke refresh token");
            }
            
            log:printInfo("Specific refresh token revoked successfully", 
                userId = userContext.userId, 
                username = userContext.username);
            return <http:Ok>{
                body: {
                    message: "Refresh token revoked successfully"
                }
            };
        } 

        // No specific token provided - revoke ALL refresh tokens for this user (logout from all devices)
        error? revokeAllResult = storage:revokeAllUserRefreshTokens(userContext.userId);
        if revokeAllResult is error {
            log:printError("Error revoking all refresh tokens for user", revokeAllResult, userId = userContext.userId);
            return utils:createInternalServerError("Failed to revoke refresh tokens");
        }
        
        log:printInfo("All refresh tokens revoked successfully for user", 
            userId = userContext.userId, 
            username = userContext.username);
        return <http:Ok>{
            body: {
                message: "All refresh tokens revoked successfully. You have been logged out from all devices."
            }
        };
    }

    // OIDC Authorization URL endpoint
    isolated resource function get oidc/'authorize\-url() returns http:Ok|http:BadRequest|http:InternalServerError {
        log:printInfo("OIDC authorization URL requested");

        // Get SSO configuration
        types:SSOConfig ssoConfig = getSSOConfig();

        // Validate SSO configuration
        error? validationError = validateSSOConfig(ssoConfig);
        if validationError is error {
            log:printError("SSO configuration validation failed", validationError);
            return utils:createBadRequestError(validationError.message());
        }

        // Check if SSO is enabled
        if !ssoConfig.enabled {
            log:printWarn("OIDC authorization URL requested but SSO is not enabled");
            return utils:createBadRequestError("SSO authentication is not enabled");
        }

        // Build authorization URL
        string|error authorizationUrl = utils:buildAuthorizationUrl(ssoConfig);
        if authorizationUrl is error {
            log:printError("Error building authorization URL", authorizationUrl);
            return utils:createInternalServerError("Failed to generate authorization URL");
        }

        log:printInfo("OIDC authorization URL generated successfully");
        return <http:Ok>{
            body: {
                authorizationUrl: authorizationUrl
            }
        };
    }

    // Get all users with their roles (filtered by shared project access where caller is admin)
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get users(@http:Header {name: http:AUTH_HEADER} string? authHeader) returns http:Ok|http:Unauthorized|http:InternalServerError {
        log:printInfo("Fetching users with RBAC filtering");

        if authHeader is () {
            log:printError("Authorization header missing in request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        // Extract user context for RBAC
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        types:UserWithRoles[]|error users;
        
        // Super admins can see ALL users (including those without any roles/projects)
        if userContext.isSuperAdmin {
            log:printInfo("Super admin fetching all users", userId = userContext.userId);
            users = storage:getAllUsers();
            if users is error {
                log:printError("Error fetching all users for super admin", users);
                return utils:createInternalServerError("Failed to fetch users");
            }
            
            log:printInfo(string `Successfully fetched ${users.length()} users for super admin`, 
                          userId = userContext.userId);
            return <http:Ok>{
                body: users
            };
        }
        
        // Get projects where the user is an admin (using utility function)
        string[] adminProjectIds = utils:getAdminProjectIds(userContext);
        
        // If user is not admin in any project, return empty list
        if adminProjectIds.length() == 0 {
            log:printInfo("User is not admin in any project, returning empty user list", userId = userContext.userId);
            return <http:Ok>{
                body: []
            };
        }
        
        // Fetch users who have roles in projects where the caller is admin
        users = storage:getUsersByProjectIds(adminProjectIds);
        if users is error {
            log:printError("Error fetching users", users);
            return utils:createInternalServerError("Failed to fetch users");
        }
        
        log:printInfo(string `Successfully fetched ${users.length()} users for admin projects`, 
                      userId = userContext.userId, 
                      adminProjectCount = adminProjectIds.length());
        return <http:Ok>{
            body: users
        };
    }
    
    // Create a new user with credentials
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post users(@http:Header {name: http:AUTH_HEADER} string? authHeader, types:CreateUserInput request) returns http:Created|http:BadRequest|http:Unauthorized|http:InternalServerError {
        log:printInfo("Creating new user", username = request.username);
        
        // Extract user context for RBAC
        if authHeader is () {
            log:printError("Authorization header missing in request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        // Only super admins can create users
        if !userContext.isSuperAdmin {
            log:printWarn("Non-super-admin attempted to create user", 
                callingUser = userContext.userId,
                targetUsername = request.username);
            return utils:createUnauthorizedError("Super admin access required to create users");
        }
        
        // Validate input
        if request.username.trim().length() == 0 {
            return utils:createBadRequestError("Username is required");
        }
        if request.displayName.trim().length() == 0 {
            return utils:createBadRequestError("Display name is required");
        }
        if request.password.trim().length() == 0 {
            return utils:createBadRequestError("Password is required");
        }
        
        // Call authentication backend to create user
        http:Response|error authResponse = authBackendClient->post("/users", request, {
            "X-API-Key": authBackendApiKey
        });

        if authResponse is error {
            log:printError("Error calling authentication backend for user creation", authResponse);
            return utils:createInternalServerError("Authentication service unavailable");
        }

        if authResponse.statusCode == http:STATUS_BAD_REQUEST {
            json|error payload = authResponse.getJsonPayload();
            if payload is map<json> {
                json msg = payload["message"];
                if msg is string {
                    return utils:createBadRequestError(msg);
                }
            }
            return utils:createBadRequestError("Invalid user data");
        } else if authResponse.statusCode == http:STATUS_UNAUTHORIZED {
            log:printError("Invalid API key for auth backend while creating user");
            return utils:createInternalServerError("Invalid API key");
        } else if authResponse.statusCode != http:STATUS_CREATED {
            log:printError("Unexpected status from auth backend", status = authResponse.statusCode);
            return utils:createInternalServerError("Authentication service error");
        }

        // Parse response to get user details
        json|error successPayload = authResponse.getJsonPayload();
        if successPayload is error {
            log:printError("Error parsing auth backend response", successPayload);
            return utils:createInternalServerError("Failed to parse user creation response");
        }

        if successPayload is map<json> {
            json userIdJson = successPayload["userId"];
            json usernameJson = successPayload["username"];
            json displayNameJson = successPayload["displayName"];
            
            if userIdJson is string && usernameJson is string && displayNameJson is string {
                // Create user in users table (auth service manages users table)
                error? createUserResult = storage:createUser(userIdJson, usernameJson, displayNameJson);
                if createUserResult is error {
                    log:printError("Error creating user in users table", createUserResult, username = usernameJson);
                    return utils:createInternalServerError("Failed to create user record");
                }

                // Get the created user details
                types:User|error userDetails = storage:getUserDetailsById(userIdJson);
                if userDetails is error {
                    log:printError("Error getting created user details", userDetails);
                    return utils:createInternalServerError("Failed to get user details");
                }

                log:printInfo("User created successfully by super admin", 
                    username = usernameJson, 
                    userId = userIdJson,
                    createdBy = userContext.userId);
                return <http:Created>{ body: userDetails };
            }
        }

        log:printError("Invalid response format from auth backend");
        return utils:createInternalServerError("Invalid response from authentication service");
    }
    
    // Delete a user by ID
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function delete users/[string userId](@http:Header {name: http:AUTH_HEADER} string? authHeader) returns http:Ok|http:NotFound|http:Forbidden|http:Unauthorized|http:InternalServerError {
        log:printInfo("Deleting user", userId = userId);
        
        // Extract user context for RBAC
        if authHeader is () {
            log:printError("Authorization header missing in request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        // Only super admins can delete users
        if !userContext.isSuperAdmin {
            log:printWarn("Non-super-admin attempted to delete user", 
                callingUser = userContext.userId,
                targetUserId = userId);
            return utils:createUnauthorizedError("Super admin access required to delete users");
        }

        // Super admins cannot delete themselves
        if userContext.userId == userId {
            log:printWarn("Super admin attempted to delete their own user account",
                userId = userId);
            return utils:createForbiddenError("You cannot delete your own user account");
        }
        
        // Check if user exists
        types:User|error existingUser = storage:getUserDetailsById(userId);
        if existingUser is error {
            if existingUser is sql:NoRowsError {
                log:printWarn("User not found for deletion", userId = userId);
                return <http:NotFound>{
                    body: {
                        message: "User not found"
                    }
                };
            }
            log:printError("Error checking user existence", existingUser);
            return utils:createInternalServerError("Error checking user");
        }
        
        // Delete the user
        error? deleteResult = storage:deleteUserById(userId);
        if deleteResult is error {
            log:printError("Error deleting user", deleteResult, userId = userId);
            return utils:createInternalServerError("Failed to delete user");
        }
        
        log:printInfo("User deleted successfully by super admin", 
            userId = userId, 
            deletedBy = userContext.userId);
        return <http:Ok>{
            body: {
                message: "User deleted successfully"
            }
        };
    }
    
    // Update user profile (display name) - users can update their own profile
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function put profile(@http:Header {name: http:AUTH_HEADER} string? authHeader, types:UpdateProfileRequest request) returns http:Ok|http:BadRequest|http:Unauthorized|http:InternalServerError {
        log:printInfo("Updating user profile");
        
        if authHeader is () {
            log:printError("Authorization header missing in request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        // Validate input
        if request.displayName.trim().length() == 0 {
            return utils:createBadRequestError("Display name cannot be empty");
        }
        
        // Update profile
        error? updateResult = storage:updateUserProfile(userContext.userId, request.displayName);
        if updateResult is error {
            log:printError("Error updating user profile", updateResult, userId = userContext.userId);
            return utils:createInternalServerError("Failed to update profile");
        }
        
        // Fetch updated user details
        types:User|error updatedUser = storage:getUserDetailsById(userContext.userId);
        if updatedUser is error {
            log:printError("Error fetching updated user details", updatedUser);
            return utils:createInternalServerError("Failed to fetch updated profile");
        }
        
        log:printInfo("Profile updated successfully", userId = userContext.userId);
        return <http:Ok>{
            body: {
                message: "Profile updated successfully",
                user: updatedUser
            }
        };
    }
    
    // Change password - users can change their own password
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function put password(@http:Header {name: http:AUTH_HEADER} string? authHeader, types:ChangePasswordRequest request) returns http:Ok|http:BadRequest|http:Unauthorized|http:InternalServerError {
        log:printInfo("Changing user password");
        
        if authHeader is () {
            log:printError("Authorization header missing in request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        // Validate input
        if request.currentPassword.trim().length() == 0 {
            return utils:createBadRequestError("Current password is required");
        }
        if request.newPassword.trim().length() == 0 {
            return utils:createBadRequestError("New password is required");
        }
        if request.newPassword.length() < 6 {
            return utils:createBadRequestError("New password must be at least 6 characters long");
        }
        
        // Call the authentication backend to change password
        types:ChangePasswordRequest changePasswordRequest = {
            userId: userContext.userId,
            currentPassword: request.currentPassword,
            newPassword: request.newPassword
        };
        
        http:Response|error authResponse = authBackendClient->post("/change-password", changePasswordRequest, {
            "X-API-Key": authBackendApiKey
        });

        if authResponse is error {
            log:printError("Error calling authentication backend for password change", authResponse);
            return utils:createInternalServerError("Authentication service unavailable");
        }

        // Check status code before parsing response
        if authResponse.statusCode == http:STATUS_BAD_REQUEST {
            log:printError("Password change failed - incorrect current password", userId = userContext.userId);
            return utils:createBadRequestError("Current password is incorrect");
        } else if authResponse.statusCode == http:STATUS_UNAUTHORIZED {
            log:printError("Invalid API key", userId = userContext.userId);
            return utils:createInternalServerError("Invalid API key");
        } else if authResponse.statusCode != http:STATUS_OK {
            log:printError("Unexpected status code from authentication backend", statusCode = authResponse.statusCode);
            return utils:createInternalServerError("Authentication service error");
        }

        log:printInfo("Password changed successfully", userId = userContext.userId);
        return <http:Ok>{
            body: {
                message: "Password changed successfully"
            }
        };
    }
    
    // Update user roles
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function put users/[string userId]/roles(@http:Header {name: http:AUTH_HEADER} string? authHeader, types:UpdateUserRolesRequest request) returns http:Ok|http:NotFound|http:BadRequest|http:Unauthorized|http:InternalServerError|error? {
        log:printInfo("Updating roles for user", userId = userId);
        
        // Extract user context for RBAC
        if authHeader is () {
            log:printError("Authorization header missing in request");
            return utils:createUnauthorizedError("Authorization header required");
        }
        
        types:UserContext|error userContext = utils:extractUserContext(authHeader);
        if userContext is error {
            log:printError("Failed to extract user context", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }
        
        // Check if target user exists and get their details
        types:User|error targetUser = storage:getUserDetailsById(userId);
        if targetUser is error {
            if targetUser is sql:NoRowsError {
                log:printWarn("Target user not found for role update", userId = userId);
                return <http:NotFound>{
                    body: {
                        message: "User not found"
                    }
                };
            }
            log:printError("Error checking target user existence", targetUser);
            return utils:createInternalServerError("Error checking user");
        }
        
        // RBAC: Only super admins can edit super admin permissions
        if targetUser.isSuperAdmin && !userContext.isSuperAdmin {
            log:printWarn("Non-super-admin attempted to edit super admin permissions", 
                callingUser = userContext.userId,
                targetUser = userId);
            return utils:createUnauthorizedError("Only super admins can edit super admin permissions");
        }
        
        // RBAC: Verify the calling user has admin access to ALL project-environment type pairs being assigned
        foreach types:RoleAssignment roleAssignment in request.roles {
            final readonly & types:RoleAssignment roleAssignmentValue = roleAssignment.cloneReadOnly();
            // Check if user has admin access to this project and environment type
            boolean hasAdminAccess = userContext.roles.some(isolated function (types:RoleInfo role) returns boolean { 
                return role.projectId == roleAssignmentValue.projectId && 
                role.environmentType == roleAssignmentValue.environmentType && 
                role.privilegeLevel == types:ADMIN;
        });
            
            if !hasAdminAccess && !userContext.isSuperAdmin {
                log:printWarn("User attempted to assign role without admin access", 
                    callingUser = userContext.userId,
                    targetUser = userId,
                    projectId = roleAssignment.projectId,
                    environmentType = roleAssignment.environmentType);
                return utils:createUnauthorizedError(
                    string `Access denied: You must be an admin in project ${roleAssignment.projectId} and environment type ${roleAssignment.environmentType} to assign roles`
                );
            }
        }
        
        // RBAC: Only super admins can update isProjectAuthor flag
        if request?.isProjectAuthor is boolean {
            if !userContext.isSuperAdmin {
                log:printWarn("Non-super-admin attempted to update project author flag", 
                    callingUser = userContext.userId,
                    targetUser = userId);
                return utils:createUnauthorizedError("Only super admins can update project author permissions");
            }
        }
        
        log:printInfo("RBAC check passed for role assignment", 
            callingUser = userContext.userId,
            targetUser = userId,
            roleCount = request.roles.length());
        
        // Validate role assignments
        if request.roles.length() == 0 {
            log:printDebug("Removing all roles for user", userId = userId);
        }
        
        // Update isProjectAuthor flag if provided (and super admin has approved)
        if request?.isProjectAuthor is boolean {
            boolean isProjectAuthor = check request?.isProjectAuthor.ensureType();
            error? updateAuthorResult = storage:updateUserProjectAuthor(userId, isProjectAuthor);
            if updateAuthorResult is error {
                log:printError("Error updating user project author flag", updateAuthorResult, userId = userId);
                return utils:createInternalServerError("Failed to update project author permission");
            }
            log:printInfo("Updated project author flag", userId = userId, isProjectAuthor = request?.isProjectAuthor);
        }
        
        // Update roles
        error? updateResult = storage:updateUserRoles(userId, request.roles);
        if updateResult is error {
            log:printError("Error updating user roles", updateResult, userId = userId);
            return utils:createInternalServerError("Failed to update user roles");
        }
        
        // Fetch updated user with roles
        types:Role[]|error updatedRoles = storage:getUserRoles(userId);
        if updatedRoles is error {
            log:printError("Error fetching updated roles", updatedRoles);
            return utils:createInternalServerError("Failed to fetch updated roles");
        }
        
        log:printInfo("User roles updated successfully", userId = userId, callingUser = userContext.userId);
        return <http:Ok>{
            body: {
                message: "User roles updated successfully",
                roles: updatedRoles
            }
        };
    }
}

