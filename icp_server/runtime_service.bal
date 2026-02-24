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

import icp_server.storage as storage;
import icp_server.types as types;

import ballerina/http;
import ballerina/log;

// HTTP service configuration
listener http:Listener httpListener = new (serverPort,
    config = {
        host: serverHost,
        secureSocket: {
            key: {
                path: keystorePath,
                password: keystorePassword
            }
        }
    }
);

// Runtime management service
// JWT configuration
@http:ServiceConfig {
    auth: [
        {
            jwtValidatorConfig: {
                issuer: jwtIssuer,
                audience: jwtAudience,
                clockSkew: jwtClockSkewSeconds,
                signatureConfig: {
                    secret: resolvedDefaultRuntimeJwtHMACSecret
                }
            }
        }
    ]
}
service /icp on httpListener {

    function init() {
        log:printInfo("Runtime service started at " + serverHost + ":" + serverPort.toString());
    }

    // Process heartbeat from runtime
    @http:ResourceConfig {
        auth: {
            scopes: ["runtime_agent"]
        }
    }
    isolated resource function post heartbeat(@http:Payload json heartbeatJson) returns types:HeartbeatResponse|error? {
        do {
            types:Heartbeat heartbeat = check heartbeatJson.cloneWithType(types:Heartbeat);
            // Process heartbeat using the repository (handles both registration and updates)
            types:HeartbeatResponse heartbeatResponse = check storage:processHeartbeat(heartbeat);
            log:printInfo(string `Heartbeat processed successfully for ${heartbeat.runtime}`);
            return heartbeatResponse;

        } on fail error e {
            // Return error response
            log:printError("Failed to process heartbeat", e);
            types:HeartbeatResponse errorResponse = {
                acknowledged: false,
                commands: [],
                errors: [e.message()]
            };
            return errorResponse;
        }
    }

    // Process delta heartbeat from runtime
    @http:ResourceConfig {
        auth: {
            scopes: ["runtime_agent"]
        }
    }
    isolated resource function post deltaHeartbeat(types:DeltaHeartbeat deltaHeartbeat) returns types:HeartbeatResponse|error? {
        do {
            // Process delta heartbeat using the repository
            types:HeartbeatResponse heartbeatResponse = check storage:processDeltaHeartbeat(deltaHeartbeat);
            log:printInfo(string `Delta heartbeat processed successfully for ${deltaHeartbeat.runtime}`);
            return heartbeatResponse;

        } on fail error e {
            // Return error response
            log:printError("Failed to process delta heartbeat", e);
            types:HeartbeatResponse errorResponse = {
                acknowledged: false,
                fullHeartbeatRequired: true,
                commands: []
            };
            return errorResponse;
        }
    }

}

