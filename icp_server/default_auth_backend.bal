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
import ballerina/log;
import ballerina/sql;
import ballerina/time;

configurable int authServicePort = 9447;
configurable string authServiceHost = "0.0.0.0";
configurable string apiKey = "default-api-key";

listener http:Listener defaultAuthServiceListener = new (authServicePort,
    config = {
        host: authServiceHost,
        secureSocket: {
            key: {
                path: keystorePath,
                password: keystorePassword
            }
        }
    }
);

service / on defaultAuthServiceListener {

    function init() {
        log:printInfo("Authentication service started at " + authServiceHost + ":" + authServicePort.toString());
    }

    resource function post authenticate(@http:Header {name: "X-API-Key"} string? apiKeyHeader, types:Credentials request) returns http:Ok|http:BadRequest|http:Unauthorized|error {

        // TODO Validate API key
        if apiKeyHeader is () || apiKeyHeader != apiKey {
            log:printWarn("Authentication attempt with invalid API key");
            return createBadRequestError("Invalid API key");
        }

        // Perform authentication against database
        types:User|error user = authenticateUser(request.username, request.password);
        if user is error {
            log:printError("Error authenticating user", user);
            return createUnauthorizedError("Invalid credentials");
        }

        // Create response timestamp
        string responseTimestamp = time:utcToString(time:utcNow());
        log:printInfo("User authenticated successfully: " + user.username);
        return <http:Ok>{
            body: {
                authenticated: true,
                userId: user.userId,
                displayName: user.displayName,
                timestamp: responseTimestamp
            }
        };
    }
}

isolated function authenticateUser(string username, string password) returns types:User|error {
    sql:Client dbClient = storage:dbClient;
    log:printDebug("Attempting to authenticate user: " + username);
    // Query user credentials table only (auth backend is independent)
    types:UserCredentials|sql:Error credentials = dbClient->queryRow(
        `SELECT user_id as userId, username, display_name as displayName, 
                password_hash as passwordHash, created_at as createdAt, updated_at as updatedAt
         FROM user_credentials 
         WHERE username = ${username}`
    );

    if credentials is sql:Error {
        log:printError("Error getting credentials from database", credentials);
        return error("Invalid credentials");
    }

    // Validate password using bcrypt
    boolean|crypto:Error? matches = crypto:verifyBcrypt(password, credentials.passwordHash);
    if matches is crypto:Error {
        log:printError("Unable to verify password", matches);
        return error("Invalid credentials");
    } else if matches is boolean && !matches {
        log:printError("Invalid password", username = username);
        return error("Invalid credentials");
    }

    // Return user details from credentials (converting UserCredentials to User type)
    types:User user = {
        userId: credentials.userId,
        username: credentials.username,
        displayName: credentials.displayName,
        createdAt: credentials?.createdAt,
        updatedAt: credentials?.updatedAt
    };

    return user;
}

