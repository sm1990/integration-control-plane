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
            log:printError("Authentication failed for user", email = credentials.email);
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
            log:printError("Authentication failed for user", email = credentials.email);
            return createUnauthorizedError("Invalid credentials");
        }

        types:User|error userDetails = storage:getUserDetailsByEmail(credentials.email);
        if userDetails is error {
            if userDetails is sql:NoRowsError {
                // user is authenticated but not found in the database need to prompt sign up
                return <http:Ok>{
                    body: {
                        isNewUser: true
                    }
                };
            } 
            log:printError("Error getting user details", userDetails);
            return createInternalServerError("Error getting user details");
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
        issuerConfig.customClaims["email"] = credentials.email;

        string|jwt:Error jwtToken = jwt:issue(issuerConfig);
        if jwtToken is jwt:Error {
            log:printError("Error generating JWT token", jwtToken);
            return createInternalServerError("Error generating JWT token");
        }

        return <http:Ok>{
            body: {
                token: jwtToken,
                expiresIn: defaultTokenExpiryTime,
                email: credentials.email,
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
