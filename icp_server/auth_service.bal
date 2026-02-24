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

import icp_server.auth;
import icp_server.storage as storage;
import icp_server.types as types;
import icp_server.utils as utils;

import ballerina/http;
import ballerina/jwt;
import ballerina/log;
import ballerina/sql;

// Initialized in init() with resolved (decrypted) secrets
final http:Client authBackendClient;
final readonly & jwt:IssuerSignatureConfig jwtSignatureConfig;

@http:ServiceConfig {
    cors: {
        allowOrigins: ["*"]
    }
}
service /auth on httpListener {

    isolated resource function post login(types:Credentials credentials, http:Request req) returns http:Ok|http:Unauthorized|http:InternalServerError|error {
        log:printInfo("Login attempt for user", username = credentials.username);
        // Call the authentication backend to verify credentials
        http:Response|error authResponse = authBackendClient->post("/authenticate", credentials);

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
                json|error? createResult = storage:createUserV2(userId, username, displayName, []);
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

            } else {
                log:printError("Error getting user details", userDetails);
                return utils:createInternalServerError("Error getting user details");
            }
        }

        // Generate JWT token using V2 utility function with permissions
        string|error jwtToken = auth:generateJWTTokenV2(
                userDetails.userId,
                userDetails.username,
                userDetails.displayName,
                frontendJwtIssuer,
                defaultTokenExpiryTime,
                frontendJwtAudience,
                jwtSignatureConfig
        );

        if jwtToken is error {
            log:printError("Error generating JWT token", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }

        // Get user permissions for response
        string[]|error userPermissions = auth:getUserPermissionNames(userDetails.userId);
        if userPermissions is error {
            log:printError("Error getting user permissions", userPermissions, userId = userDetails.userId);
            return utils:createInternalServerError("Error getting user permissions");
        }

        // Generate refresh token
        string refreshToken = auth:generateRefreshToken();
        string tokenId = auth:generateTokenId();
        string tokenHash = auth:hashRefreshToken(refreshToken);

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

        log:printInfo("Login successful for user", username = username, permissionCount = userPermissions.length());
        return <http:Ok>{
            body: {
                userId: userDetails.userId,
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                refreshToken: refreshToken,
                refreshTokenExpiresIn: refreshTokenExpiryTime,
                username: username,
                displayName: userDetails.displayName,
                permissions: userPermissions,
                isOidcUser: false,
                requirePasswordChange: userDetails.requirePasswordChange
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
        types:OIDCTokenResponse|http:Unauthorized|http:InternalServerError tokenResponse = auth:exchangeCodeForTokens(request.code, ssoConfig);

        if tokenResponse is http:Unauthorized|http:InternalServerError {
            return tokenResponse;
        }

        log:printInfo("Successfully exchanged authorization code for tokens");

        // Decode and validate ID token
        types:OIDCIdTokenClaims|http:Unauthorized|http:InternalServerError claims =
            auth:decodeAndValidateIdToken(tokenResponse.id_token, ssoConfig);

        if claims is http:Unauthorized|http:InternalServerError {
            return claims;
        }

        // Extract user information
        types:ExtractedUserInfo|http:InternalServerError userInfo = auth:extractUserInfo(claims, ssoConfig);

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

                json|error? createResult = storage:createUserV2(userInfo.userId, userInfo.username, userInfo.displayName, [], isOidcUser = true);
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

        // Generate JWT token using V2 utility function with permissions
        string|error jwtToken = auth:generateJWTTokenV2(
                userDetails.userId,
                userDetails.username,
                userDetails.displayName,
                frontendJwtIssuer,
                defaultTokenExpiryTime,
                frontendJwtAudience,
                jwtSignatureConfig
        );

        if jwtToken is error {
            log:printError("Error generating JWT token for OIDC user", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }

        // Get user permissions for response
        string[]|error userPermissions = auth:getUserPermissionNames(userDetails.userId);
        if userPermissions is error {
            log:printError("Error getting user permissions for OIDC user", userPermissions, userId = userDetails.userId);
            return utils:createInternalServerError("Error getting user permissions");
        }

        // Generate refresh token
        string refreshToken = auth:generateRefreshToken();
        string tokenId = auth:generateTokenId();
        string tokenHash = auth:hashRefreshToken(refreshToken);

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
        log:printInfo("OIDC login successful", username = userInfo.username, permissionCount = userPermissions.length());
        return <http:Ok>{
            body: {
                userId: userDetails.userId,
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                refreshToken: refreshToken,
                refreshTokenExpiresIn: refreshTokenExpiryTime,
                username: userInfo.username,
                displayName: userDetails.displayName,
                permissions: userPermissions,
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
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post 'renew\-token(http:Request req) returns http:Ok|http:Unauthorized|http:InternalServerError {
        log:printInfo("Token renewal requested");

        // Extract user context from current token (V2)
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            log:printError("Failed to extract user context for token renewal", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }

        // Fetch latest user details from database
        types:User|error userDetails = storage:getUserDetailsById(userContext.userId);
        if userDetails is error {
            log:printError("Error fetching user details for token renewal", userDetails, userId = userContext.userId);
            return utils:createInternalServerError("Failed to fetch user details");
        }

        // Generate JWT token using V2 utility function with fresh permissions
        string|error jwtToken = auth:generateJWTTokenV2(
                userDetails.userId,
                userDetails.username,
                userDetails.displayName,
                frontendJwtIssuer,
                defaultTokenExpiryTime,
                frontendJwtAudience,
                jwtSignatureConfig
        );

        if jwtToken is error {
            log:printError("Error generating renewed JWT token", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }

        // Get user permissions for response
        string[]|error userPermissions = auth:getUserPermissionNames(userDetails.userId);
        if userPermissions is error {
            log:printError("Error getting user permissions for token renewal", userPermissions, userId = userDetails.userId);
            return utils:createInternalServerError("Error getting user permissions");
        }

        log:printInfo("Token renewed successfully", username = userDetails.username, permissionCount = userPermissions.length());
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                username: userDetails.username,
                displayName: userDetails.displayName,
                permissions: userPermissions
            }
        };
    }

    // Change password endpoint - proxies to auth backend
    // Requires JWT authentication to identify the user
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post 'change\-password(@http:Payload types:ChangePasswordRequest request, http:Request req) returns http:Ok|http:BadRequest|http:Unauthorized|http:InternalServerError {
        log:printInfo("Password change requested");

        // Extract user context from current JWT
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            log:printError("Failed to extract user context for password change", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }

        // Forward to auth backend with userId from JWT
        json changePasswordPayload = {
            userId: userContext.userId,
            currentPassword: request.currentPassword,
            newPassword: request.newPassword
        };

        http:Response|error authResponse = authBackendClient->post("/change-password", changePasswordPayload);

        if authResponse is error {
            log:printError("Error calling auth backend for password change", authResponse);
            return utils:createInternalServerError("Password change service unavailable");
        }

        if authResponse.statusCode == http:STATUS_BAD_REQUEST {
            json|error errorBody = authResponse.getJsonPayload();
            if errorBody is json {
                json|error messageField = errorBody.message;
                string message = messageField is string ? messageField : "Invalid password change request";
                return utils:createBadRequestError(message);
            }
            return utils:createBadRequestError("Invalid password change request");
        }

        if authResponse.statusCode == http:STATUS_UNAUTHORIZED {
            return utils:createUnauthorizedError("Current password is incorrect");
        }

        if authResponse.statusCode != http:STATUS_OK {
            log:printError("Unexpected status code from auth backend for password change", statusCode = authResponse.statusCode);
            return utils:createInternalServerError("Password change failed");
        }

        // Clear require_password_change flag if it was set
        error? flagResult = storage:setRequirePasswordChange(userContext.userId, false);
        if flagResult is error {
            log:printWarn("Could not clear require_password_change flag after password change", userId = userContext.userId);
        }

        log:printInfo("Password changed successfully", userId = userContext.userId, username = userContext.username);
        return <http:Ok>{
            body: {
                message: "Password changed successfully"
            }
        };
    }

    // Force change password endpoint - used after admin password reset
    // Requires JWT auth but does NOT require current password. Only available for users with require_password_change flag set to true
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post 'force\-change\-password(@http:Payload types:ForceChangePasswordRequest request, http:Request req) returns http:Ok|http:BadRequest|http:Unauthorized|http:Forbidden|http:InternalServerError {
        log:printInfo("Force password change requested");

        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            log:printError("Failed to extract user context for force password change", userContext);
            return utils:createUnauthorizedError("Invalid authorization token");
        }

        types:User|error userDetails = storage:getUserDetailsById(userContext.userId);
        if userDetails is error {
            log:printError("Failed to fetch user details for force password change", userDetails, userId = userContext.userId);
            return utils:createInternalServerError("Failed to fetch user details");
        }
        if !userDetails.requirePasswordChange {
            log:printWarn("Force password change attempted but require_password_change flag is not set", userId = userContext.userId);
            return utils:createForbiddenError("Password change is not required for this user");
        }

        json payload = {
            newPassword: request.newPassword
        };

        http:Response|error authResponse = authBackendClient->post(string `/force-change-password?userId=${userContext.userId}`, payload);

        if authResponse is error {
            log:printError("Error calling auth backend for force password change", authResponse);
            return utils:createInternalServerError("Password change service unavailable");
        }

        if authResponse.statusCode == http:STATUS_BAD_REQUEST {
            json|error errorBody = authResponse.getJsonPayload();
            if errorBody is json {
                json|error messageField = errorBody.message;
                string message = messageField is string ? messageField : "Invalid request";
                return utils:createBadRequestError(message);
            }
            return utils:createBadRequestError("Invalid request");
        }

        if authResponse.statusCode != http:STATUS_OK {
            log:printError("Unexpected status code from auth backend for force password change", statusCode = authResponse.statusCode);
            return utils:createInternalServerError("Password change failed");
        }

        // Clear require_password_change flag in main DB
        error? flagResult = storage:setRequirePasswordChange(userContext.userId, false);
        if flagResult is error {
            log:printError("Error clearing require_password_change flag", flagResult, userId = userContext.userId);
            // Don't fail the request - the password was already changed successfully
            log:printWarn("Password changed but require_password_change flag could not be cleared");
        }

        log:printInfo("Password force-changed successfully", userId = userContext.userId);
        return <http:Ok>{
            body: {
                message: "Password changed successfully"
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
        string tokenHash = auth:hashRefreshToken(request.refreshToken);

        // Validate refresh token and get user details
        types:User|error userDetails = storage:validateRefreshToken(tokenHash);
        if userDetails is error {
            log:printWarn("Invalid or expired refresh token", userDetails);
            return utils:createUnauthorizedError("Invalid or expired refresh token");
        }

        // Generate new JWT access token using V2 with permissions
        string|error jwtToken = auth:generateJWTTokenV2(
                userDetails.userId,
                userDetails.username,
                userDetails.displayName,
                frontendJwtIssuer,
                defaultTokenExpiryTime,
                frontendJwtAudience,
                jwtSignatureConfig
        );

        if jwtToken is error {
            log:printError("Error generating JWT token from refresh token", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }

        // Get user permissions for response
        string[]|error userPermissions = auth:getUserPermissionNames(userDetails.userId);
        if userPermissions is error {
            log:printError("Error getting user permissions for refresh token", userPermissions, userId = userDetails.userId);
            return utils:createInternalServerError("Error getting user permissions");
        }

        // If rotation is disabled, return response with same refresh token
        if !enableRefreshTokenRotation {
            log:printInfo("Token refreshed without rotation",
                    username = userDetails.username,
                    userId = userDetails.userId,
                    permissionCount = userPermissions.length());
            return <http:Ok>{
                body: {
                    token: jwtToken,
                    expiresIn: defaultTokenExpiryTime,
                    refreshToken: request.refreshToken,
                    refreshTokenExpiresIn: refreshTokenExpiryTime,
                    username: userDetails.username,
                    displayName: userDetails.displayName,
                    permissions: userPermissions
                }
            };
        }

        // Rotation is enabled - generate new refresh token
        string newRefreshToken = auth:generateRefreshToken();
        string newTokenId = auth:generateTokenId();
        string newTokenHash = auth:hashRefreshToken(newRefreshToken);

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
                userId = userDetails.userId,
                permissionCount = userPermissions.length());
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                refreshToken: newRefreshToken,
                refreshTokenExpiresIn: refreshTokenExpiryTime,
                username: userDetails.username,
                displayName: userDetails.displayName,
                permissions: userPermissions
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
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post 'revoke\-token(http:Request req, types:RevokeTokenRequest request) returns http:Ok|http:Unauthorized|http:BadRequest|http:InternalServerError {
        log:printInfo("Token revocation requested");

        // Extract user context from current JWT
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
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
            string tokenHash = auth:hashRefreshToken(refreshToken);

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
    isolated resource function get oidc/'authorize\-url(string? state) returns http:Ok|http:BadRequest|http:InternalServerError {
        log:printInfo("OIDC authorization URL requested", hasState = state is string);

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

        // Build authorization URL with state parameter for CSRF protection
        string|error authorizationUrl = auth:buildAuthorizationUrl(ssoConfig, state);
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

    // RBAC v2: Group Management Endpoints
    // Get all groups for an organization
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get orgs/[string orgHandle]/groups(http:Request req, string? projectId = (), string? integrationId = ()) returns http:Ok|http:BadRequest|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Fetching groups for organization", orgHandle = orgHandle, projectId = projectId ?: "N/A", integrationId = integrationId ?: "N/A");

        // Permission check: user must have any of these permissions at specified scope level
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        
        // Build scope based on provided parameters
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
        if projectId is string {
            scope.projectUuid = projectId;
        }
        if integrationId is string {
            scope.integrationUuid = integrationId;
        }
        
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_GROUP_ROLES, auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE], scope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to list groups"
                }
            };
        }

        // Resolve org handle to org ID
        // TODO : use when multiple tenants are supported
        // int|error orgId = storage:getOrgIdByHandle(orgHandle);
        // if orgId is error {
        //     log:printWarn("Invalid or unknown organization handle", orgHandle = orgHandle, 'error = orgId);
        //     return utils:createBadRequestError("Invalid or unknown organization");
        // }

        // Fetch all groups for the organization
        // TODO: use orgId when multiple tenants are supported
        types:Group[]|error groups = storage:getGroupsByOrgId(storage:DEFAULT_ORG_ID);
        if groups is error {
            log:printError("Error fetching groups", groups, orgHandle = orgHandle);
            return utils:createInternalServerError("Failed to fetch groups");
        }

        log:printInfo(string `Successfully fetched ${groups.length()} groups`, orgHandle = orgHandle);
        return <http:Ok>{
            body: groups
        };
    }

    // POST /auth/orgs/{orgHandle}/groups - Create a new group
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post orgs/[string orgHandle]/groups(@http:Payload types:GroupInput groupInput, http:Request req) returns http:Created|http:BadRequest|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Creating new group", orgHandle = orgHandle, groupName = groupInput.groupName);

        // Permission check: org-level manage groups
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_GROUPS, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to create groups"
                }
            };
        }

        // Resolve org handle to org ID
        // TODO: use when multiple tenants are supported
        // int|error orgId = storage:getOrgIdByHandle(orgHandle);
        // if orgId is error {
        //     log:printWarn("Invalid or unknown organization handle", orgHandle = orgHandle, 'error = orgId);
        //     return utils:createBadRequestError("Invalid or unknown organization");
        // }

        // Set org ID in the input (default to 1 for now)
        types:GroupInput inputWithOrg = {
            groupName: groupInput.groupName,
            description: groupInput.description,
            orgUuid: storage:DEFAULT_ORG_ID
        };

        // Create the group
        string|error groupId = storage:createGroup(inputWithOrg);
        if groupId is error {
            log:printError("Error creating group", groupId, groupName = groupInput.groupName);
            return utils:createInternalServerError("Failed to create group");
        }

        // Fetch the created group
        types:Group|error createdGroup = storage:getGroupById(groupId);
        if createdGroup is error {
            log:printError("Error fetching created group", createdGroup, groupId = groupId);
            return utils:createInternalServerError("Group created but failed to fetch details");
        }

        log:printInfo("Successfully created group", groupId = groupId, groupName = groupInput.groupName);
        return <http:Created>{
            body: createdGroup
        };
    }

    // GET /auth/orgs/{orgHandle}/groups/{groupId} - Get group details
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get orgs/[string orgHandle]/groups/[string groupId](http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Fetching group details", orgHandle = orgHandle, groupId = groupId);

        // Permission check: user must have any of these permissions at any level
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_GROUP_ROLES, auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE], orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to view group details"
                }
            };
        }

        // Fetch group by ID
        types:Group|error group = storage:getGroupById(groupId);
        if group is error {
            log:printWarn("Group not found", groupId = groupId, 'error = group);
            return <http:NotFound>{
                body: {
                    message: "Group not found"
                }
            };
        }

        log:printInfo("Successfully fetched group details", groupId = groupId);
        return <http:Ok>{
            body: group
        };
    }

    // PUT /auth/orgs/{orgHandle}/groups/{groupId} - Update group
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function put orgs/[string orgHandle]/groups/[string groupId](@http:Payload types:GroupInput groupInput, http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Updating group", orgHandle = orgHandle, groupId = groupId);

        // Permission check: org-level manage groups
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_GROUPS, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to update groups"
                }
            };
        }

        // Update the group
        error? updateResult = storage:updateGroup(groupId, groupInput);
        if updateResult is error {
            log:printError("Error updating group", updateResult, groupId = groupId);
            if updateResult.message().includes("not found") {
                return <http:NotFound>{
                    body: {
                        message: "Group not found"
                    }
                };
            }
            return utils:createInternalServerError("Failed to update group");
        }

        // Fetch the updated group
        types:Group|error updatedGroup = storage:getGroupById(groupId);
        if updatedGroup is error {
            log:printError("Error fetching updated group", updatedGroup, groupId = groupId);
            return utils:createInternalServerError("Group updated but failed to fetch details");
        }

        log:printInfo("Successfully updated group", groupId = groupId);
        return <http:Ok>{
            body: updatedGroup
        };
    }

    // DELETE /auth/orgs/{orgHandle}/groups/{groupId} - Delete group
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function delete orgs/[string orgHandle]/groups/[string groupId](http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Deleting group", orgHandle = orgHandle, groupId = groupId);

        // Permission check: org-level manage groups
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_GROUPS, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to delete groups"
                }
            };
        }

        // TODO: Check if group has members or role assignments
        // For now, delete will cascade due to foreign key constraints

        // Delete the group
        error? deleteResult = storage:deleteGroup(groupId);
        if deleteResult is error {
            log:printError("Error deleting group", deleteResult, groupId = groupId);
            if deleteResult.message().includes("not found") {
                return <http:NotFound>{
                    body: {
                        message: "Group not found"
                    }
                };
            }
            return utils:createInternalServerError("Failed to delete group");
        }

        log:printInfo("Successfully deleted group", groupId = groupId);
        return <http:Ok>{
            body: {
                message: "Group deleted successfully",
                groupId: groupId
            }
        };
    }

    // ============================================================================
    // Group-User Mapping Endpoints (RBAC v2)
    // ============================================================================

    // POST /auth/orgs/{orgHandle}/groups/{groupId}/users - Add users to group
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post orgs/[string orgHandle]/groups/[string groupId]/users(types:AddUsersToGroupInput input, http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Adding users to group", orgHandle = orgHandle, groupId = groupId, userCount = input.userIds.length());

        // Permission check: org-level user/group management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_USERS, auth:PERMISSION_USER_MANAGE_USERS], orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to add users to group"
                }
            };
        }

        // Validate input
        if input.userIds.length() == 0 {
            return <http:BadRequest>{
                body: {
                    message: "At least one user ID must be provided"
                }
            };
        }

        // Verify group exists
        types:Group|error existingGroup = storage:getGroupById(groupId);
        if existingGroup is error {
            log:printError("Group not found", existingGroup, groupId = groupId);
            return <http:NotFound>{
                body: {
                    message: "Group not found"
                }
            };
        }

        // Add each user to the group
        int successCount = 0;
        int failureCount = 0;
        string[] errors = [];

        foreach string userId in input.userIds {
            error? addResult = storage:addUserToGroup(userId, groupId);
            if addResult is error {
                failureCount += 1;
                errors.push(string `Failed to add user ${userId}: ${addResult.message()}`);
                log:printError(string `Error adding user ${userId} to group ${groupId}`, addResult);
            } else {
                successCount += 1;
            }
        }

        log:printInfo("Users added to group", groupId = groupId, successCount = successCount, failureCount = failureCount);

        if failureCount > 0 && successCount == 0 {
            // All operations failed
            return utils:createInternalServerError(string `Failed to add all users to group: ${errors[0]}`);
        }

        return <http:Ok>{
            body: {
                message: string `Successfully added ${successCount} user(s) to group`,
                groupId: groupId,
                successCount: successCount,
                failureCount: failureCount,
                errors: errors
            }
        };
    }

    // GET /auth/orgs/{orgHandle}/groups/{groupId}/users - Get users in a group
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get orgs/[string orgHandle]/groups/[string groupId]/users(http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Fetching users for group", orgHandle = orgHandle, groupId = groupId);

        // Permission check: org-level user/group management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_USERS, auth:PERMISSION_USER_MANAGE_USERS], orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to list group users"
                }
            };
        }

        // Verify group exists
        types:Group|error existingGroup = storage:getGroupById(groupId);
        if existingGroup is error {
            log:printError("Group not found", existingGroup, groupId = groupId);
            return <http:NotFound>{
                body: {
                    message: "Group not found"
                }
            };
        }

        // Get user IDs in the group
        string[]|error userIds = storage:getGroupUsers(groupId);
        if userIds is error {
            log:printError("Error fetching group users", userIds, groupId = groupId);
            return utils:createInternalServerError("Failed to fetch group users");
        }

        // Fetch details for each user
        types:User[] users = [];
        foreach string userId in userIds {
            types:User|error user = storage:getUserDetailsById(userId);
            if user is types:User {
                users.push(user);
            } else {
                log:printWarn(string `Failed to fetch details for user ${userId}`, user);
            }
        }

        log:printInfo(string `Successfully fetched ${users.length()} users for group ${groupId}`);
        return <http:Ok>{
            body: {
                users: users,
                count: users.length()
            }
        };
    }

    // DELETE /auth/orgs/{orgHandle}/groups/{groupId}/users/{userId} - Remove user from group
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function delete orgs/[string orgHandle]/groups/[string groupId]/users/[string userId](http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Removing user from group", orgHandle = orgHandle, groupId = groupId, userId = userId);

        // Permission check: org-level user/group management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_USERS, auth:PERMISSION_USER_MANAGE_USERS], orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to remove user from group"
                }
            };
        }

        // Remove user from group
        error? removeResult = storage:removeUserFromGroup(userId, groupId);
        if removeResult is error {
            log:printError("Error removing user from group", removeResult, userId = userId, groupId = groupId);
            if removeResult.message().includes("not found") {
                return <http:NotFound>{
                    body: {
                        message: "User not found in group"
                    }
                };
            }
            return utils:createInternalServerError("Failed to remove user from group");
        }

        log:printInfo("Successfully removed user from group", userId = userId, groupId = groupId);
        return <http:Ok>{
            body: {
                message: "User removed from group successfully",
                groupId: groupId,
                userId: userId
            }
        };
    }

    // PUT /auth/orgs/{orgHandle}/users/{userId}/groups - Replace user's group memberships
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function put orgs/[string orgHandle]/users/[string userId]/groups(@http:Payload types:UpdateUserGroupsInput input, http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Updating groups for user", orgHandle = orgHandle, userId = userId);

        // Permission check: org-level user/group management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_USERS, auth:PERMISSION_USER_MANAGE_USERS], orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to update user groups"
                }
            };
        }

        // Fetch current group memberships
        types:Group[]|error currentGroups = storage:getUserGroups(userId);
        if currentGroups is error {
            log:printError("Failed to fetch current user groups", currentGroups, userId = userId);
            return utils:createInternalServerError("Failed to fetch current user groups");
        }

        string[] currentIds = [];
        foreach types:Group g in currentGroups {
            currentIds.push(g.groupId);
        }

        string[] desiredIds = input.groupIds;

        // Compute differences
        string[] toAdd = [];
        foreach string gid in desiredIds {
            boolean exists = false;
            foreach string cid in currentIds {
                if cid == gid {
                    exists = true;
                    break;
                }
            }
            if !exists {
                toAdd.push(gid);
            }
        }

        string[] toRemove = [];
        foreach string cid in currentIds {
            boolean keep = false;
            foreach string gid in desiredIds {
                if gid == cid {
                    keep = true;
                    break;
                }
            }
            if !keep {
                toRemove.push(cid);
            }
        }

        int added = 0;
        int removed = 0;
        string[] errors = [];

        // Apply removals first
        foreach string gid in toRemove {
            error? rem = storage:removeUserFromGroup(userId, gid);
            if rem is error {
                errors.push(string `Failed removing from ${gid}: ${rem.message()}`);
                log:printError("Error removing user from group", rem, userId = userId, groupId = gid);
            } else {
                removed += 1;
            }
        }

        // Apply additions
        foreach string gid in toAdd {
            error? add = storage:addUserToGroup(userId, gid);
            if add is error {
                errors.push(string `Failed adding to ${gid}: ${add.message()}`);
                log:printError("Error adding user to group", add, userId = userId, groupId = gid);
            } else {
                added += 1;
            }
        }

        // Fetch final groups
        types:Group[]|error finalGroups = storage:getUserGroups(userId);
        if finalGroups is error {
            log:printError("Failed to fetch final user groups", finalGroups, userId = userId);
            return utils:createInternalServerError("Failed to fetch final user groups");
        }

        string[] finalIds = [];
        foreach types:Group g in <types:Group[]>finalGroups {
            finalIds.push(g.groupId);
        }

        return <http:Ok>{
            body: {
                message: string `User groups updated. Added: ${added}, Removed: ${removed}`,
                userId: userId,
                addedCount: added,
                removedCount: removed,
                errors: errors,
                groupIds: finalIds
            }
        };
    }

    // ============================================================================
    // Group-Role Mapping Endpoints (RBAC v2)
    // ============================================================================

    // POST /auth/orgs/{orgHandle}/groups/{groupId}/roles - Assign roles to group with scope
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post orgs/[string orgHandle]/groups/[string groupId]/roles(types:AssignRolesToGroupInput input, http:Request req) returns http:Ok|http:BadRequest|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Assigning roles to group", orgHandle = orgHandle, groupId = groupId, roleCount = input.roleIds.length());

        // Extract user context for granular permission checks
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            log:printError("Failed to extract user context for token revocation", userContext);
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }

        // Note: Basic permission validation is handled by @http:ResourceConfig scopes
        // Additional granular checks below ensure user has permissions at the specified scope level

        // Validate input
        if input.roleIds.length() == 0 {
            return <http:BadRequest>{
                body: {
                    message: "At least one role ID must be provided"
                }
            };
        }

        // Verify group exists
        types:Group|error existingGroup = storage:getGroupById(groupId);
        if existingGroup is error {
            log:printError("Group not found", existingGroup, groupId = groupId);
            return <http:NotFound>{
                body: {
                    message: "Group not found"
                }
            };
        }

        // Validate scope context
        if input.integrationUuid is string && input.projectUuid is () {
            return <http:BadRequest>{
                body: {
                    message: "projectUuid is required when integrationUuid is provided"
                }
            };
        }

        // Granular permission checks based on scope level
        // Check user has appropriate permissions at the specified scope
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
        if input.integrationUuid is string {
            // Integration-level scope - most restrictive
            string integrationUuid = <string>input.integrationUuid;
            string projectUuid = <string>input.projectUuid;
            scope.projectUuid = projectUuid;
            scope.integrationUuid = integrationUuid;
        } else if input.projectUuid is string {
            // Project-level scope
            string projectUuid = <string>input.projectUuid;
            scope.projectUuid = projectUuid;
        } 

        string[] permissionsList = [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_GROUP_ROLES, auth:PERMISSION_USER_MANAGE_USERS];
        if scope.integrationUuid is string {
            permissionsList.push(auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE);
        } else if scope.projectUuid is string {
            permissionsList.push(auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE);
        }
        boolean|error canAssign = auth:hasAnyPermission(userContext.userId, 
            permissionsList, 
            scope
        );
        if canAssign is error {
            log:printError("Error checking project scope permissions", canAssign, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        
        if !canAssign {
            log:printWarn("User lacks permission to assign roles at this scope", 
                userId = userContext.userId, projectUuid = input.projectUuid ?: "N/A", integrationUuid = input.integrationUuid ?: "N/A");
            return <http:Forbidden>{
                body: {
                    message: "You do not have permission to assign roles at this scope"
                }
            };
        }

        // Assign each role to the group with the specified scope
        int successCount = 0;
        int failureCount = 0;
        string[] errors = [];
        int[] mappingIds = [];

        int orgUuid = input.orgUuid ?: 1;

        foreach string roleId in input.roleIds {
            // Verify role exists
            types:RoleV2|error role = storage:getRoleV2ById(roleId);
            if role is error {
                failureCount += 1;
                errors.push(string `Role ${roleId} not found`);
                log:printError(string `Role not found: ${roleId}`, role);
                continue;
            }

            // Create assignment input for this role
            types:AssignRoleToGroupInput assignInput = {
                groupId: groupId,
                roleId: roleId,
                orgUuid: orgUuid,
                projectUuid: input.projectUuid,
                envUuid: input.envUuid,
                integrationUuid: input.integrationUuid
            };

            // Assign role to group
            int|error mappingId = storage:assignRoleToGroup(assignInput);
            if mappingId is error {
                failureCount += 1;
                errors.push(string `Failed to assign role ${roleId}: ${mappingId.message()}`);
                log:printError(string `Error assigning role ${roleId} to group ${groupId}`, mappingId);
            } else {
                successCount += 1;
                mappingIds.push(mappingId);
            }
        }

        log:printInfo("Roles assigned to group", groupId = groupId, successCount = successCount, failureCount = failureCount);

        if failureCount > 0 && successCount == 0 {
            // All operations failed
            return utils:createInternalServerError(string `Failed to assign all roles to group: ${errors[0]}`);
        }

        return <http:Ok>{
            body: {
                message: string `Successfully assigned ${successCount} role(s) to group`,
                groupId: groupId,
                successCount: successCount,
                failureCount: failureCount,
                mappingIds: mappingIds,
                errors: errors
            }
        };
    }

    // DELETE /auth/orgs/{orgHandle}/groups/{groupId}/roles/{mappingId} - Remove role from group
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    resource function delete orgs/[string orgHandle]/groups/[string groupId]/roles/[int mappingId](http:Request req)
            returns http:Ok|http:NotFound|http:Forbidden|http:InternalServerError|http:Unauthorized|error {
        
        log:printInfo("Removing role from group", orgHandle = orgHandle, groupId = groupId, mappingId = mappingId);

        // Extract user context for granular permission checks
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            log:printError("Failed to extract user context for token revocation", userContext);
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }

        // Verify group exists
        types:Group|error existingGroup = storage:getGroupById(groupId);
        if existingGroup is error {
            log:printWarn("Group not found", groupId = groupId, 'error = existingGroup);
            return <http:NotFound>{
                body: {
                    message: string `Group not found: ${groupId}`
                }
            };
        }

        // Get the mapping to determine its scope for permission validation
        types:GroupRoleMapping|error mapping = storage:getGroupRoleMappingById(mappingId);
        if mapping is error {
            log:printWarn("Group-role mapping not found", mappingId = mappingId, 'error = mapping);
            return <http:NotFound>{
                body: {
                    message: string `Group-role mapping not found: ${mappingId}`
                }
            };
        }

        // Verify the mapping belongs to the specified group
        if mapping.groupId != groupId {
            log:printWarn("Mapping does not belong to specified group", 
                mappingId = mappingId, 
                mappingGroupId = mapping.groupId, 
                requestedGroupId = groupId);
            return <http:NotFound>{
                body: {
                    message: string `Group-role mapping ${mappingId} does not belong to group ${groupId}`
                }
            };
        }

        // Granular permission checks based on mapping scope
        // Check user has appropriate permissions at the specified scope
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
        if mapping.integrationUuid is string {
            // Integration-level scope - most restrictive
            string integrationUuid = <string>mapping.integrationUuid;
            string projectUuid = <string>mapping.projectUuid;
            scope.projectUuid = projectUuid;
            scope.integrationUuid = integrationUuid;
        } else if mapping.projectUuid is string {
            // Project-level scope
            string projectUuid = <string>mapping.projectUuid;
            scope.projectUuid = projectUuid;
        } 

        string[] permissionsList = [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_GROUP_ROLES, auth:PERMISSION_USER_MANAGE_USERS];
        if scope.integrationUuid is string {
            permissionsList.push(auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE);
        } 
        if scope.projectUuid is string {
            permissionsList.push(auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE);
        }
        boolean|error canAssign = auth:hasAnyPermission(userContext.userId, 
            permissionsList, 
            scope
        );
        if canAssign is error {
            log:printError("Error checking project scope permissions", canAssign, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        
        if !canAssign {
            log:printWarn("User lacks permission to remove roles at this scope", 
                userId = userContext.userId, projectUuid = mapping.projectUuid ?: "N/A", integrationUuid = mapping.integrationUuid ?: "N/A");
            return <http:Forbidden>{
                body: {
                    message: "You do not have permission to remove roles at this scope"
                }
            };
        }

        // Remove the role mapping
        error? result = storage:removeRoleFromGroup(mappingId);
        if result is error {
            log:printError(string `Failed to remove role mapping ${mappingId}`, result);
            return utils:createInternalServerError(string `Failed to remove role from group: ${result.message()}`);
        }

        log:printInfo("Successfully removed role from group", mappingId = mappingId, groupId = groupId);

        return <http:Ok>{
            body: {
                message: string `Successfully removed role from group`,
                mappingId: mappingId,
                groupId: groupId
            }
        };
    }

    // GET /auth/orgs/{orgHandle}/groups/{groupId}/roles - List group's role assignments
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    resource function get orgs/[string orgHandle]/groups/[string groupId]/roles(http:Request req, string? projectId = (), string? integrationId = ())
            returns http:Ok|http:NotFound|http:Forbidden|http:Unauthorized|http:InternalServerError|error {

        log:printInfo("Fetching role assignments for group", orgHandle = orgHandle, groupId = groupId, projectId = projectId ?: "N/A", integrationId = integrationId ?: "N/A");

        // Permission check at specified scope level
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        
        // Build scope based on provided parameters
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
        if projectId is string {
            scope.projectUuid = projectId;
        }
        if integrationId is string {
            scope.integrationUuid = integrationId;
        }
        
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_GROUP_ROLES, auth:PERMISSION_USER_MANAGE_USERS, auth:PERMISSION_USER_UPDATE_USERS, auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE], scope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to list group role assignments"
                }
            };
        }

        // Verify group exists
        types:Group|error existingGroup = storage:getGroupById(groupId);
        if existingGroup is error {
            log:printWarn("Group not found", groupId = groupId, 'error = existingGroup);
            return <http:NotFound>{
                body: {
                    message: string `Group not found: ${groupId}`
                }
            };
        }

        // Get all role mappings for this group
        types:GroupRoleMapping[]|error mappings = storage:getGroupRoleMappings(groupId);
        if mappings is error {
            log:printError(string `Failed to fetch role mappings for group ${groupId}`, mappings);
            return utils:createInternalServerError(string `Failed to fetch role assignments: ${mappings.message()}`);
        }

        // Enrich mappings with role details
        json[] enrichedMappings = [];
        foreach types:GroupRoleMapping mapping in mappings {
            // Get role details
            types:RoleV2|error role = storage:getRoleV2ById(mapping.roleId);
            if role is error {
                log:printWarn(string `Role not found for mapping ${mapping.id}`, roleId = mapping.roleId);
                // Skip this mapping if role doesn't exist (orphaned mapping)
                continue;
            }

            // Build enriched mapping with role name
            json enrichedMapping = {
                id: mapping.id,
                groupId: mapping.groupId,
                roleId: mapping.roleId,
                roleName: role.roleName,
                roleDescription: role.description,
                // Scope information
                orgUuid: mapping.orgUuid,
                projectUuid: mapping.projectUuid,
                envUuid: mapping.envUuid,
                integrationUuid: mapping.integrationUuid,
                createdAt: mapping.createdAt
            };

            enrichedMappings.push(enrichedMapping);
        }

        log:printInfo(string `Found ${enrichedMappings.length()} role assignments for group ${groupId}`);

        return <http:Ok>{
            body: {
                groupId: groupId,
                mappings: enrichedMappings,
                count: enrichedMappings.length()
            }
        };
    }

    // ============================================================================
    // User Management Endpoints (RBAC v2)
    // ============================================================================

    // GET /auth/orgs/{orgHandle}/users - List all users with group memberships
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    resource function get orgs/[string orgHandle]/users(http:Request req)
            returns http:Ok|http:Forbidden|http:Unauthorized|http:InternalServerError|error {

        log:printInfo("Fetching users for organization", orgHandle = orgHandle);

        // Permission check: org-level user management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_UPDATE_USERS, auth:PERMISSION_USER_MANAGE_USERS], orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to list users"
                }
            };
        }

        // Get all users with their group memberships
        json[]|error users = storage:getAllUsersV2();
        if users is error {
            log:printError("Failed to fetch users", users);
            return utils:createInternalServerError(string `Failed to fetch users: ${users.message()}`);
        }

        log:printInfo(string `Successfully fetched ${users.length()} users`);

        return <http:Ok>{
            body: {
                users: users,
                count: users.length()
            }
        };
    }

    // GET /auth/orgs/{orgHandle}/users/{userId} - Get single user details
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    resource function get orgs/[string orgHandle]/users/[string userId](http:Request req)
            returns http:Ok|http:NotFound|http:Forbidden|http:Unauthorized|http:InternalServerError|error {

        log:printInfo("Fetching user details", orgHandle = orgHandle, userId = userId);

        // Permission check: user can only fetch their own details
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        
        // Verify the requesting user is fetching their own details
        if userContext.userId != userId {
            log:printWarn("User attempted to fetch another user's details", requestingUserId = userContext.userId, targetUserId = userId);
            return <http:Forbidden>{
                body: {
                    message: "You can only view your own user details"
                }
            };
        }

        // Get user details with group memberships
        json|error userDetails = storage:getUserWithGroupsById(userId);
        if userDetails is error {
            log:printWarn("User not found", userId = userId, 'error = userDetails);
            return <http:NotFound>{
                body: {
                    message: string `User not found: ${userId}`
                }
            };
        }

        log:printInfo("Successfully fetched user details", userId = userId);

        return <http:Ok>{
            body: userDetails
        };
    }

    // POST /auth/orgs/{orgHandle}/users - Create a new user
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    resource function post orgs/[string orgHandle]/users(@http:Payload json payload, http:Request req)
            returns http:Created|http:BadRequest|http:Forbidden|http:Unauthorized|http:InternalServerError|error {

        log:printInfo("Creating new user", orgHandle = orgHandle);

        // Permission check: org-level user management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_USERS, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to create users"
                }
            };
        }

        // Extract and validate payload
        string username = check payload.username;
        string password = check payload.password;
        string displayName = check payload.displayName;
        
        // Handle optional groupIds array
        string[] groupIds = [];
        json|error groupIdsField = payload.groupIds;
        if groupIdsField is json[] {
            groupIds = from var id in groupIdsField select id.toString();
        }

        // Validate required fields
        if username.trim().length() == 0 {
            return utils:createBadRequestError("Username is required");
        }
        if password.trim().length() == 0 {
            return utils:createBadRequestError("Password is required");
        }
        if displayName.trim().length() == 0 {
            return utils:createBadRequestError("Display name is required");
        }

        // Call auth backend to create user credentials
        json createUserRequest = {
            username: username,
            password: password,
            displayName: displayName
        };

        http:Response|error authResponse = authBackendClient->post("/users", createUserRequest);

        if authResponse is error {
            log:printError("Failed to create user credentials in auth backend", authResponse);
            return utils:createInternalServerError("Failed to create user credentials");
        }

        if authResponse.statusCode == 400 {
            json|error errorBody = authResponse.getJsonPayload();
            if errorBody is json {
                json|error messageField = errorBody.message;
                string message = messageField is string ? messageField : "Username already exists";
                return utils:createBadRequestError(message);
            }
            return utils:createBadRequestError("Username already exists");
        }

        if authResponse.statusCode != 201 {
            log:printError(string `Auth backend returned error status: ${authResponse.statusCode}`);
            return utils:createInternalServerError("Failed to create user credentials");
        }

        // Get the created user ID from auth backend response
        json authResponseBody = check authResponse.getJsonPayload();
        string userId = check authResponseBody.userId;

        // Create user in main database with group assignments
        json|error createdUser = storage:createUserV2(userId, username, displayName, groupIds);
        if createdUser is error {
            log:printError("Failed to create user in main database", createdUser);
            // TODO: Consider cleanup - delete from credentials DB if main DB creation fails
            return utils:createInternalServerError(string `Failed to create user: ${createdUser.message()}`);
        }

        log:printInfo(string `Successfully created user: ${username}`);

        return <http:Created>{
            body: createdUser
        };
    }

    // DELETE /auth/orgs/{orgHandle}/users/{userId} - Delete a user
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    resource function delete orgs/[string orgHandle]/users/[string userId](http:Request req)
            returns http:NoContent|http:Unauthorized|http:Forbidden|http:NotFound|http:InternalServerError|error {

        log:printInfo("Deleting user", orgHandle = orgHandle, userId = userId);

        // Extract user context for permission checks
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }

        // Permission check: org-level user management
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_USERS, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to delete users"
                }
            };
        }

        // Delete user with safety checks (cannot delete self or system admin)
        error? deleteResult = storage:deleteUserV2(userId, userContext.userId);
        if deleteResult is error {
            string errorMsg = deleteResult.message();
            if errorMsg.includes("system administrator") {
                log:printWarn(string `Attempted to delete system administrator`, userId = userId);
                return utils:createForbiddenError("Cannot delete system administrator");
            }
            if errorMsg.includes("own user account") {
                log:printWarn(string `User attempted to delete own account`, userId = userId);
                return utils:createForbiddenError("Cannot delete your own user account");
            }
            if errorMsg.includes("not found") {
                log:printWarn(string `User not found for deletion`, userId = userId);
                return <http:NotFound>{
                    body: {
                        message: string `User not found: ${userId}`
                    }
                };
            }
            log:printError("Failed to delete user", deleteResult);
            return utils:createInternalServerError(string `Failed to delete user: ${errorMsg}`);
        }

        log:printInfo(string `Successfully deleted user ${userId}`);

        return <http:NoContent>{};
    }

    // POST /auth/orgs/{orgHandle}/users/{userId}/reset-password - Admin password reset
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post orgs/[string orgHandle]/users/[string userId]/'reset\-password(http:Request req) returns http:Ok|http:BadRequest|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Admin password reset requested", orgHandle = orgHandle, targetUserId = userId);

        // Permission check: org-level user management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_USERS, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to reset user passwords"
                }
            };
        }

        // Proxy to auth backend
        json resetPayload = {
            userId: userId
        };

        http:Response|error authResponse = authBackendClient->post("/reset-password", resetPayload);

        if authResponse is error {
            log:printError("Error calling auth backend for password reset", authResponse);
            return utils:createInternalServerError("Password reset service unavailable");
        }

        if authResponse.statusCode == http:STATUS_BAD_REQUEST {
            json|error errorBody = authResponse.getJsonPayload();
            if errorBody is json {
                json|error messageField = errorBody.message;
                string message = messageField is string ? messageField : "Invalid request";
                return utils:createBadRequestError(message);
            }
            return utils:createBadRequestError("Invalid request");
        }

        if authResponse.statusCode != http:STATUS_OK {
            log:printError("Unexpected status from auth backend for password reset", statusCode = authResponse.statusCode);
            return utils:createInternalServerError("Password reset failed");
        }

        // Set require_password_change flag in main DB
        error? flagResult = storage:setRequirePasswordChange(userId, true);
        if flagResult is error {
            log:printError("Error setting require_password_change flag", flagResult, userId = userId);
            return utils:createInternalServerError("Password reset succeeded but failed to set password change flag");
        }

        // Revoke all existing refresh tokens so the user must re-authenticate
        error? revokeResult = storage:revokeAllUserRefreshTokens(userId);
        if revokeResult is error {
            log:printWarn("Failed to revoke refresh tokens after password reset", userId = userId);
        }

        // Return the generated password to the admin
        json|error responseBody = authResponse.getJsonPayload();
        if responseBody is error {
            log:printError("Error reading auth backend response", responseBody);
            return utils:createInternalServerError("Password reset succeeded but failed to read response");
        }

        log:printInfo("Password reset successfully by admin", targetUserId = userId, adminUserId = userContext.userId);
        return <http:Ok>{
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Pragma": "no-cache"
            },
            body: responseBody
        };
    }

    // POST /auth/orgs/{orgHandle}/users/{userId}/revoke-tokens - Revoke all user sessions
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post orgs/[string orgHandle]/users/[string userId]/'revoke\-tokens(http:Request req) returns http:Ok|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Revoke tokens requested", orgHandle = orgHandle, targetUserId = userId);

        // Permission check: org-level user management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_USERS, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to revoke user sessions"
                }
            };
        }

        // Prevent revoking own tokens (admin should use regular logout)
        if userContext.userId == userId {
            return <http:Forbidden>{
                body: {
                    message: "Cannot revoke your own sessions. Use the regular logout instead."
                }
            };
        }

        // Revoke all refresh tokens
        error? revokeResult = storage:revokeAllUserRefreshTokens(userId);
        if revokeResult is error {
            log:printError("Error revoking refresh tokens", revokeResult, userId = userId);
            return utils:createInternalServerError("Failed to revoke user sessions");
        }

        log:printInfo("All sessions revoked successfully", targetUserId = userId, adminUserId = userContext.userId);
        return <http:Ok>{
            body: {
                message: "All sessions revoked successfully"
            }
        };
    }

    // ============================================================================
    // Role Management Endpoints (RBAC v2)
    // ============================================================================

    // GET /auth/orgs/{orgHandle}/roles - List all roles
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get orgs/[string orgHandle]/roles(http:Request req, string? projectId = (), string? integrationId = ()) returns http:Ok|http:BadRequest|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Fetching all roles for organization", orgHandle = orgHandle, projectId = projectId ?: "N/A", integrationId = integrationId ?: "N/A");

        // Permission check: user must have any of these permissions at specified scope level
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        
        // Build scope based on provided parameters
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
        if projectId is string {
            scope.projectUuid = projectId;
        }
        if integrationId is string {
            scope.integrationUuid = integrationId;
        }
        
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_ROLES, auth:PERMISSION_USER_UPDATE_GROUP_ROLES, auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE], scope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to list roles"
                }
            };
        }

        // Resolve org handle to org ID
        // TODO: use when multiple tenants are supported
        // int|error orgId = storage:getOrgIdByHandle(orgHandle);
        // if orgId is error {
        //     log:printWarn("Invalid or unknown organization handle", orgHandle = orgHandle, 'error = orgId);
        //     return utils:createBadRequestError("Invalid or unknown organization");
        // }

        // Fetch all roles for the organization
        // TODO: use orgId when multiple tenants are supported
        types:RoleV2[]|error roles = storage:getAllRolesV2(storage:DEFAULT_ORG_ID);
        if roles is error {
            log:printError("Error fetching roles", roles, orgHandle = orgHandle);
            return utils:createInternalServerError("Failed to fetch roles");
        }

        log:printInfo(string `Successfully fetched ${roles.length()} roles`, orgHandle = orgHandle);
        return <http:Ok>{
            body: roles
        };
    }

    // POST /auth/orgs/{orgHandle}/roles - Create a new role
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function post orgs/[string orgHandle]/roles(@http:Payload types:RoleV2Input roleInput, http:Request req) returns http:Created|http:BadRequest|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Creating new role", orgHandle = orgHandle, roleName = roleInput.roleName);

        // Permission check: org-level role management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_ROLES, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to create roles"
                }
            };
        }

        // Resolve org handle to org ID
        // TODO: use when multiple tenants are supported
        // int|error orgId = storage:getOrgIdByHandle(orgHandle);
        // if orgId is error {
        //     log:printWarn("Invalid or unknown organization handle", orgHandle = orgHandle, 'error = orgId);
        //     return utils:createBadRequestError("Invalid or unknown organization");
        // }

        // Set org ID in the input (default to 1 for now)
        types:RoleV2Input inputWithOrg = {
            roleName: roleInput.roleName,
            description: roleInput.description,
            orgId: storage:DEFAULT_ORG_ID
        };

        // Create the role
        string|error roleId = storage:createRoleV2(inputWithOrg);
        if roleId is error {
            log:printError("Error creating role", roleId, roleName = roleInput.roleName);
            return utils:createInternalServerError("Failed to create role");
        }

        // Assign permissions if provided
        if roleInput.permissionIds is string[] {
            string[] permissionIds = <string[]>roleInput.permissionIds;
            if permissionIds.length() > 0 {
                error? assignResult = storage:assignPermissionsToRole(roleId, permissionIds);
                if assignResult is error {
                    log:printError("Error assigning permissions to role", assignResult, roleId = roleId);
                    return utils:createInternalServerError("Role created but failed to assign permissions");
                }
                log:printInfo("Successfully assigned permissions to role", roleId = roleId, count = permissionIds.length());
            }
        }

        // Fetch the created role
        types:RoleV2|error createdRole = storage:getRoleV2ById(roleId);
        if createdRole is error {
            log:printError("Error fetching created role", createdRole, roleId = roleId);
            return utils:createInternalServerError("Role created but failed to fetch details");
        }

        log:printInfo("Successfully created role", roleId = roleId, roleName = roleInput.roleName);
        return <http:Created>{
            body: createdRole
        };
    }

    // GET /auth/orgs/{orgHandle}/roles/{roleId} - Get role details with permissions
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get orgs/[string orgHandle]/roles/[string roleId](http:Request req, string? projectId = (), string? integrationId = ()) returns http:Ok|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Fetching role details", orgHandle = orgHandle, roleId = roleId, projectId = projectId ?: "N/A", integrationId = integrationId ?: "N/A");

        // Permission check: user must have any of these permissions at specified scope level
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        
        // Build scope based on provided parameters
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
        if projectId is string {
            scope.projectUuid = projectId;
        }
        if integrationId is string {
            scope.integrationUuid = integrationId;
        }
        
        boolean|error hasPermission = auth:hasAnyPermission(userContext.userId, [auth:PERMISSION_USER_MANAGE_ROLES, auth:PERMISSION_USER_UPDATE_GROUP_ROLES, auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE], scope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to view role details"
                }
            };
        }

        // Fetch role by ID
        types:RoleV2|error role = storage:getRoleV2ById(roleId);
        if role is error {
            log:printWarn("Role not found", roleId = roleId, 'error = role);
            return <http:NotFound>{
                body: {
                    message: "Role not found"
                }
            };
        }

        // Fetch role permissions
        types:Permission[]|error permissions = storage:getRolePermissions(roleId);
        if permissions is error {
            log:printError("Error fetching role permissions", permissions, roleId = roleId);
            return utils:createInternalServerError("Failed to fetch role permissions");
        }

        // Build response with role and permissions
        types:RoleV2WithPermissions roleWithPermissions = {
            roleId: role.roleId,
            roleName: role.roleName,
            orgId: role.orgId,
            description: role.description,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
            permissions: permissions
        };

        log:printInfo("Successfully fetched role details", roleId = roleId);
        return <http:Ok>{
            body: roleWithPermissions
        };
    }

    // PUT /auth/orgs/{orgHandle}/roles/{roleId} - Update role
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function put orgs/[string orgHandle]/roles/[string roleId](@http:Payload types:RoleV2Input roleInput, http:Request req) returns http:Ok|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Updating role", orgHandle = orgHandle, roleId = roleId);

        // Permission check: org-level role management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_ROLES, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to update roles"
                }
            };
        }

        // Update the role (name, description)
        error? updateResult = storage:updateRoleV2(roleId, roleInput);
        if updateResult is error {
            log:printError("Error updating role", updateResult, roleId = roleId);
            if updateResult.message().includes("not found") {
                return <http:NotFound>{
                    body: {
                        message: "Role not found"
                    }
                };
            }
            return utils:createInternalServerError("Failed to update role");
        }

        // Update permissions if provided
        if roleInput.permissionIds is string[] {
            string[] newPermissionIds = <string[]>roleInput.permissionIds;
            log:printInfo("Updating role permissions", roleId = roleId, permissionCount = newPermissionIds.length());

            // Get current permissions
            types:Permission[]|error currentPermissions = storage:getRolePermissions(roleId);
            if currentPermissions is error {
                log:printError("Error fetching current permissions", currentPermissions, roleId = roleId);
                return utils:createInternalServerError("Failed to fetch current permissions");
            }

            // Calculate permissions to add and remove
            string[] currentPermissionIds = from var p in currentPermissions
                select p.permissionId;

            // Permissions to add: in new but not in current
            string[] toAdd = from var permId in newPermissionIds
                where !currentPermissionIds.some(id => id == permId)
                select permId;

            // Permissions to remove: in current but not in new
            string[] toRemove = from var permId in currentPermissionIds
                where !newPermissionIds.some(id => id == permId)
                select permId;

            // Remove permissions
            if toRemove.length() > 0 {
                error? removeResult = storage:removePermissionsFromRole(roleId, toRemove);
                if removeResult is error {
                    log:printError("Error removing permissions from role", removeResult, roleId = roleId);
                    return utils:createInternalServerError("Failed to remove permissions from role");
                }
                log:printInfo("Removed permissions from role", roleId = roleId, count = toRemove.length());
            }

            // Add permissions
            if toAdd.length() > 0 {
                error? addResult = storage:assignPermissionsToRole(roleId, toAdd);
                if addResult is error {
                    log:printError("Error adding permissions to role", addResult, roleId = roleId);
                    return utils:createInternalServerError("Failed to add permissions to role");
                }
                log:printInfo("Added permissions to role", roleId = roleId, count = toAdd.length());
            }

            log:printInfo("Successfully updated role permissions", roleId = roleId, added = toAdd.length(), removed = toRemove.length());
        }

        // Fetch the updated role
        types:RoleV2|error updatedRole = storage:getRoleV2ById(roleId);
        if updatedRole is error {
            log:printError("Error fetching updated role", updatedRole, roleId = roleId);
            return utils:createInternalServerError("Role updated but failed to fetch details");
        }

        log:printInfo("Successfully updated role", roleId = roleId);
        return <http:Ok>{
            body: updatedRole
        };
    }

    // DELETE /auth/orgs/{orgHandle}/roles/{roleId} - Delete role
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function delete orgs/[string orgHandle]/roles/[string roleId](http:Request req) returns http:Ok|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Deleting role", orgHandle = orgHandle, roleId = roleId);

        // Permission check: org-level role management
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
        boolean|error hasPermission = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_ROLES, orgScope);
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to delete roles"
                }
            };
        }

        // TODO: Check if role is assigned to any groups
        // For now, delete will cascade due to foreign key constraints

        // Delete the role
        error? deleteResult = storage:deleteRoleV2(roleId);
        if deleteResult is error {
            log:printError("Error deleting role", deleteResult, roleId = roleId);
            if deleteResult.message().includes("not found") {
                return <http:NotFound>{
                    body: {
                        message: "Role not found"
                    }
                };
            }
            return utils:createInternalServerError("Failed to delete role");
        }

        log:printInfo("Successfully deleted role", roleId = roleId);
        return <http:Ok>{
            body: {
                message: "Role deleted successfully",
                roleId: roleId
            }
        };
    }

    // GET /auth/orgs/{orgHandle}/roles/{roleId}/groups - List groups that have this role
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get orgs/[string orgHandle]/roles/[string roleId]/groups(http:Request req, string? projectId = (), string? integrationId = ()) returns http:Ok|http:NotFound|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Fetching group assignments for role", orgHandle = orgHandle, roleId = roleId, projectId = projectId ?: "N/A", integrationId = integrationId ?: "N/A");

        // Permission check at specified scope level
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }
        
        // Build scope based on provided parameters
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};
        if projectId is string {
            scope.projectUuid = projectId;
        }
        if integrationId is string {
            scope.integrationUuid = integrationId;
        }
        
        boolean|error hasPermission = auth:hasAnyPermission(
            userContext.userId,
            [auth:PERMISSION_USER_MANAGE_ROLES, auth:PERMISSION_USER_MANAGE_GROUPS, auth:PERMISSION_USER_UPDATE_GROUP_ROLES,
             auth:PERMISSION_PROJECT_EDIT, auth:PERMISSION_PROJECT_MANAGE,
             auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE],
            scope
        );
        if hasPermission is error {
            log:printError("Error checking permissions", hasPermission, userId = userContext.userId);
            return utils:createInternalServerError("Error checking permissions");
        }
        if !hasPermission {
            return <http:Forbidden>{
                body: {
                    message: "Insufficient permissions to view role group assignments"
                }
            };
        }

        // Verify role exists
        types:RoleV2|error existingRole = storage:getRoleV2ById(roleId);
        if existingRole is error {
            log:printWarn("Role not found", roleId = roleId, 'error = existingRole);
            return <http:NotFound>{
                body: {
                    message: string `Role not found: ${roleId}`
                }
            };
        }

        // Get all group mappings for this role
        types:GroupRoleMapping[]|error mappings = storage:getRoleMappings(roleId);
        if mappings is error {
            log:printError(string `Failed to fetch group mappings for role ${roleId}`, mappings);
            return utils:createInternalServerError(string `Failed to fetch group assignments: ${mappings.message()}`);
        }

        // Enrich mappings with group details
        json[] enrichedMappings = [];
        foreach types:GroupRoleMapping mapping in mappings {
            // Get group details
            types:Group|error group = storage:getGroupById(mapping.groupId);
            if group is error {
                log:printWarn(string `Group not found for mapping ${mapping.id}`, groupId = mapping.groupId);
                // Skip this mapping if group doesn't exist (orphaned mapping)
                continue;
            }

            // Build enriched mapping with group name
            json enrichedMapping = {
                id: mapping.id,
                groupId: mapping.groupId,
                groupName: group.groupName,
                groupDescription: group.description,
                roleId: mapping.roleId,
                // Scope information
                orgUuid: mapping.orgUuid,
                projectUuid: mapping.projectUuid,
                envUuid: mapping.envUuid,
                integrationUuid: mapping.integrationUuid,
                createdAt: mapping.createdAt
            };

            enrichedMappings.push(enrichedMapping);
        }

        log:printInfo(string `Found ${enrichedMappings.length()} group assignments for role ${roleId}`);

        return <http:Ok>{
            body: {
                roleId: roleId,
                roleName: existingRole.roleName,
                mappings: enrichedMappings,
                count: enrichedMappings.length()
            }
        };
    }

    // ============================================================================
    // Permission Endpoints (RBAC v2)
    // ============================================================================

    // GET /auth/permissions - List all available permissions
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
                // No specific scopes required - all authenticated users can see available permissions
            }
        ]
    }
    isolated resource function get permissions() returns http:Ok|http:Unauthorized|http:InternalServerError {
        log:printInfo("Fetching all available permissions");

        // Fetch all permissions
        types:Permission[]|error permissions = storage:getAllPermissions();
        if permissions is error {
            log:printError("Error fetching permissions", permissions);
            return utils:createInternalServerError("Failed to fetch permissions");
        }

        // Group permissions by domain for easier consumption
        map<types:Permission[]> groupedPermissions = {};
        foreach types:Permission permission in permissions {
            string domain = permission.permissionDomain.toString();
            if !groupedPermissions.hasKey(domain) {
                groupedPermissions[domain] = [];
            }
            types:Permission[]? domainPerms = groupedPermissions[domain];
            if domainPerms is types:Permission[] {
                domainPerms.push(permission);
            }
        }

        log:printInfo(string `Successfully fetched ${permissions.length()} permissions across ${groupedPermissions.length()} domains`);
        return <http:Ok>{
            body: {
                permissions: permissions,
                groupedByDomain: groupedPermissions
            }
        };
    }

    // GET /auth/orgs/{orgHandle}/users/{userId}/permissions - Get user's effective permissions
    @http:ResourceConfig {
        auth: [
            {
                jwtValidatorConfig: {
                    issuer: frontendJwtIssuer,
                    audience: frontendJwtAudience,
                    signatureConfig: {
                        secret: resolvedDefaultJwtHMACSecret
                    }
                }
            }
        ]
    }
    isolated resource function get orgs/[string orgHandle]/users/[string userId]/permissions(
        http:Request req,
        string? projectId = (),
        string? integrationId = (),
        string? environmentId = ()
    ) returns http:Ok|http:BadRequest|http:Unauthorized|http:Forbidden|http:InternalServerError|error {
        log:printInfo("Fetching effective permissions for user",
            orgHandle = orgHandle,
            userId = userId,
            projectId = projectId,
            integrationId = integrationId,
            environmentId = environmentId
        );

        // Extract user context from token to verify access
        types:UserContextV2|error userContext = extractUserContextFromRequest(req);
        if userContext is error {
            log:printError("Failed to extract user context", userContext);
            return utils:createUnauthorizedError("Invalid or missing authentication token");
        }

        // Check if user is fetching their own permissions or has admin privileges
        boolean isSelfAccess = userContext.userId == userId;
        if !isSelfAccess {
            types:AccessScope orgScope = {orgUuid: storage:DEFAULT_ORG_ID};
            boolean|error hasAdminAccess = auth:hasPermission(userContext.userId, auth:PERMISSION_USER_MANAGE_USERS, orgScope);
            if hasAdminAccess is error {
                log:printError("Error checking permissions", hasAdminAccess, userId = userContext.userId);
                return utils:createInternalServerError("Error checking permissions");
            }
            if !hasAdminAccess {
                log:printWarn("User attempted to fetch permissions for another user without admin privileges",
                    requestingUserId = userContext.userId,
                    targetUserId = userId
                );
                return <http:Forbidden>{
                    body: {
                        message: "You can only view your own permissions unless you have user management privileges"
                    }
                };
            }
        }

        // Resolve org handle to org ID
        // TODO: use when multiple tenants are supported
        // int|error orgId = storage:getOrgIdByHandle(orgHandle);
        // if orgId is error {
        //     log:printWarn("Invalid or unknown organization handle", orgHandle = orgHandle, 'error = orgId);
        //     return utils:createBadRequestError("Invalid or unknown organization");
        // }

        // Build access scope from query parameters
        types:AccessScope scope = {
            orgUuid: storage:DEFAULT_ORG_ID,
            projectUuid: projectId,
            integrationUuid: integrationId,
            envUuid: environmentId
        };

        // Get user's effective permissions for the given scope
        types:Permission[]|error permissions = storage:getUserEffectivePermissions(userId, scope);
        if permissions is error {
            log:printError("Error fetching user permissions", permissions, userId = userId);
            return utils:createInternalServerError("Failed to fetch user permissions");
        }

        // Extract permission names for easier use
        string[] permissionNames = from types:Permission p in permissions
            select p.permissionName;

        log:printInfo(string `Successfully fetched ${permissions.length()} effective permissions for user`, userId = userId);
        return <http:Ok>{
            body: {
                userId: userId,
                scope: scope,
                permissions: permissions,
                permissionNames: permissionNames
            }
        };
    }
}

isolated function extractUserContextFromRequest(http:Request req) returns types:UserContextV2|error {
    string|http:HeaderNotFoundError authHeader = req.getHeader("Authorization");
    if authHeader is http:HeaderNotFoundError {
        log:printError("Authorization header not found");
        return error("Authorization header not found");
    }

    types:UserContextV2|error userContext = auth:extractUserContextV2(authHeader);
    if userContext is error {
        log:printError("Failed to extract user context", userContext);
        return error("Failed to extract user context");
    }

    return userContext;
}

