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
            return createInternalServerError("Authentication service unavailable");
        }

        // Check status code before parsing response
        if authResponse.statusCode == http:STATUS_UNAUTHORIZED {
            log:printError("Authentication failed for user", username = credentials.username);
            return createUnauthorizedError("Invalid credentials");
        } else if authResponse.statusCode != http:STATUS_OK {
            log:printError("Unexpected status code from authentication backend", statusCode = authResponse.statusCode);
            return createInternalServerError("Authentication service error");
        }

        // Parse response body
        json|error authPayload = authResponse.getJsonPayload();
        if authPayload is error {
            log:printError("JSON payload not present in authentication response", authPayload);
            return createInternalServerError("Invalid response from authentication service");
        }

        types:AuthenticateResponse|error authResult = authPayload.cloneWithType();
        if authResult is error {
            log:printError("Authentication response payload does not match expected type", authResult);
            return createInternalServerError("Invalid response from authentication service");
        }

        if !authResult.authenticated {
            log:printError("Authentication failed for user", username = credentials.username);
            return createUnauthorizedError("Invalid credentials");
        }

        // Validate that auth backend returned required user claims
        if authResult.userId is () || authResult.displayName is () {
            log:printError("Authentication backend did not return required user claims", username = credentials.username);
            return createInternalServerError("Invalid response from authentication service");
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
                    return createInternalServerError("Error creating user record");
                }

                // Fetch the newly created user details
                userDetails = storage:getUserDetailsById(userId);
                if userDetails is error {
                    log:printError("Error getting newly created user details", userDetails);
                    return createInternalServerError("Error getting user details");
                }

                //TODO Handle roles for new users
            } else {
                log:printError("Error getting user details", userDetails);
                return createInternalServerError("Error getting user details");
            }
        }

        types:Role[]|error userRoles = storage:getUserRoles(userDetails.userId);
        if userRoles is error {
            log:printError("Error getting user roles", userRoles);
            return createInternalServerError("Error getting user roles");
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
            return createInternalServerError("Error generating JWT token");
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
}

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

public isolated function createInternalServerError(string message) returns http:InternalServerError => {
    body: {
        message
    }
};
