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

import ballerina/crypto;
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

    isolated resource function post login(types:Credentials credentials) returns http:Ok|http:Unauthorized|http:InternalServerError|error {
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

        jwt:IssuerConfig issuerConfig = {
            username: userDetails.userId,
            issuer: frontendJwtIssuer,
            expTime: <decimal>defaultTokenExpiryTime,
            audience: frontendJwtAudience,
            signatureConfig: jwtSignatureConfig
        };

        issuerConfig.customClaims["roles"] = userRoles.toJson();
        issuerConfig.customClaims["username"] = username;
        issuerConfig.customClaims["displayName"] = displayName;

        string|jwt:Error jwtToken = jwt:issue(issuerConfig);
        if jwtToken is jwt:Error {
            log:printError("Error generating JWT token", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }

        log:printInfo("Login successful for user", username = username);
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                username: username,
                roles: userRoles
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

    // Get all users with their roles
    isolated resource function get users() returns http:Ok|http:InternalServerError {
        log:printInfo("Fetching all users");
        
        types:UserWithRoles[]|error users = storage:getAllUsers();
        if users is error {
            log:printError("Error fetching users", users);
            return utils:createInternalServerError("Failed to fetch users");
        }
        
        log:printInfo(string `Successfully fetched ${users.length()} users`);
        return <http:Ok>{
            body: users
        };
    }
    
    // Create a new user with credentials
    isolated resource function post users(types:CreateUserInput request) returns http:Created|http:BadRequest|http:InternalServerError {
        log:printInfo("Creating new user", username = request.username);
        
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
        
        // Hash the password using bcrypt
        string|crypto:Error passwordHash = crypto:hashBcrypt(request.password);
        if passwordHash is crypto:Error {
            log:printError("Error hashing password", passwordHash);
            return utils:createInternalServerError("Failed to process password");
        }
        
        // Create user with hashed password
        types:User|error user = storage:createUserWithCredentials(
            request.username,
            request.displayName,
            passwordHash
        );
        
        if user is error {
            log:printError("Error creating user", user, username = request.username);
            // Check if it's a duplicate username error
            if user.toString().toLowerAscii().includes("duplicate") {
                return utils:createBadRequestError("Username already exists");
            }
            return utils:createInternalServerError("Failed to create user");
        }
        
        log:printInfo("User created successfully", username = request.username);
        return <http:Created>{
            body: user
        };
    }
    
    // Delete a user by ID
    isolated resource function delete users/[string userId]() returns http:Ok|http:NotFound|http:InternalServerError {
        log:printInfo("Deleting user", userId = userId);
        
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
        
        log:printInfo("User deleted successfully", userId = userId);
        return <http:Ok>{
            body: {
                message: "User deleted successfully"
            }
        };
    }
    
    // Update user roles
    isolated resource function put users/[string userId]/roles(types:RoleAssignment[] roles) returns http:Ok|http:NotFound|http:BadRequest|http:InternalServerError {
        log:printInfo("Updating roles for user", userId = userId);
        
        // Check if user exists
        types:User|error existingUser = storage:getUserDetailsById(userId);
        if existingUser is error {
            if existingUser is sql:NoRowsError {
                log:printWarn("User not found for role update", userId = userId);
                return <http:NotFound>{
                    body: {
                        message: "User not found"
                    }
                };
            }
            log:printError("Error checking user existence", existingUser);
            return utils:createInternalServerError("Error checking user");
        }
        
        // Validate role assignments
        if roles.length() == 0 {
            log:printDebug("Removing all roles for user", userId = userId);
        }
        
        // Update roles
        error? updateResult = storage:updateUserRoles(userId, roles);
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
        
        log:printInfo("User roles updated successfully", userId = userId);
        return <http:Ok>{
            body: {
                message: "User roles updated successfully",
                roles: updatedRoles
            }
        };
    }

    // OIDC Login endpoint - exchanges authorization code for ICP token
    isolated resource function post login/oidc(types:OIDCCallbackRequest request) returns http:Ok|http:Unauthorized|http:BadRequest|http:InternalServerError {
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
                
                // TODO: Handle roles for new OIDC users
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
        
        // Issue ICP JWT token
        jwt:IssuerConfig issuerConfig = {
            username: userDetails.userId,
            issuer: frontendJwtIssuer,
            expTime: <decimal>defaultTokenExpiryTime,
            audience: frontendJwtAudience,
            signatureConfig: jwtSignatureConfig
        };
        
        issuerConfig.customClaims["roles"] = userRoles.toJson();
        issuerConfig.customClaims["username"] = userInfo.username;
        issuerConfig.customClaims["displayName"] = userInfo.displayName;
        
        string|jwt:Error jwtToken = jwt:issue(issuerConfig);
        if jwtToken is jwt:Error {
            log:printError("Error generating JWT token for OIDC user", jwtToken);
            return utils:createInternalServerError("Error generating JWT token");
        }
        
        // Return login response
        log:printInfo("OIDC login successful", username = userInfo.username);
        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                username: userInfo.username,
                roles: userRoles
            }
        };
    }
}

