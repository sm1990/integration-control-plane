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

// HTTP client for OpenSearch with SSL verification disabled
final http:Client observabilityClient = check new (observabilityBackendURL,
    config = {
        secureSocket: {
            enable: false
        }
    }
);

// HTTP service configuration
listener http:Listener observabilityListener = new (observabilityServerPort,
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

@http:ServiceConfig {
    auth: [
        {
            jwtValidatorConfig: {
                issuer: frontendJwtIssuer,
                audience: frontendJwtAudience,
                signatureConfig: {
                    secret: defaultobservabilityJwtHMACSecret
                }
            }
        }
    ],
    cors: {
        allowOrigins: ["*"],
        allowHeaders: ["Content-Type", "Authorization"]
    }
}
service /icp/observability on observabilityListener {

    function init() {
        log:printInfo("Observability service started at " + serverHost + ":" + observabilityServerPort.toString());
    }

    resource function post logs(http:Request request, types:ICPLogEntryRequest logRequest) returns types:LogEntriesResponse|error {
        log:printInfo("Received log request: " + logRequest.toString());

        // Transform ICPLogEntryRequest to LogEntryRequest by resolving component/environment filters to runtime IDs
        string[] runtimeIdList = check resolveRuntimeIds(logRequest);

        // If component/environment filters were provided but no runtimes found, return empty result
        boolean hasFilters = logRequest.componentId is string ||
                            (logRequest.componentIdList is string[] && (<string[]>logRequest.componentIdList).length() > 0) ||
                            logRequest.environmentId is string ||
                            (logRequest.environmentList is string[] && (<string[]>logRequest.environmentList).length() > 0);

        if (hasFilters && runtimeIdList.length() == 0) {
            log:printInfo("No runtimes found for the given component/environment filters. Returning empty result.");
            return {
                columns: [],
                rows: []
            };
        }

        // Construct LogEntryRequest with resolved runtime IDs and copy other filter fields
        types:LogEntryRequest adaptorRequest = {
            runtimeIdList: runtimeIdList,
            logLevels: logRequest.logLevels,
            region: logRequest.region,
            searchPhrase: logRequest.searchPhrase,
            regexPhrase: logRequest.regexPhrase,
            startTime: logRequest.startTime,
            endTime: logRequest.endTime,
            'limit: logRequest.'limit,
            sort: logRequest.sort
        };

        log:printInfo("Invoking observability adapter with " + runtimeIdList.length().toString() + " runtime IDs");

        // Invoke observability adapter service
        return check observabilityClient->post("/observability/logs/", adaptorRequest);
    }
}

// Resolve component/environment filters to runtime IDs by querying the storage layer
isolated function resolveRuntimeIds(types:ICPLogEntryRequest logRequest) returns string[]|error {
    string[] runtimeIds = [];

    // Build list of component IDs to query
    string[] componentIds = [];
    if logRequest.componentId is string {
        componentIds.push(<string>logRequest.componentId);
    }
    if logRequest.componentIdList is string[] {
        componentIds.push(...<string[]>logRequest.componentIdList);
    }

    // Build list of environment IDs to query
    string[] environmentIds = [];
    if logRequest.environmentId is string {
        environmentIds.push(<string>logRequest.environmentId);
    }
    if logRequest.environmentList is string[] {
        environmentIds.push(...<string[]>logRequest.environmentList);
    }

    // Query runtimes based on filters
    if componentIds.length() > 0 || environmentIds.length() > 0 {
        // If both component and environment filters exist, query for each component-environment combination
        if componentIds.length() > 0 && environmentIds.length() > 0 {
            foreach string componentId in componentIds {
                foreach string environmentId in environmentIds {
                    types:Runtime[] runtimes = check storage:getRuntimes((), (), environmentId, (), componentId);
                    foreach types:Runtime runtime in runtimes {
                        runtimeIds.push(runtime.runtimeId);
                    }
                }
            }
        }
        // If only component IDs, query by component
        else if componentIds.length() > 0 {
            foreach string componentId in componentIds {
                types:Runtime[] runtimes = check storage:getRuntimes((), (), (), (), componentId);
                foreach types:Runtime runtime in runtimes {
                    runtimeIds.push(runtime.runtimeId);
                }
            }
        }
        // If only environment IDs, query by environment
        else {
            foreach string environmentId in environmentIds {
                types:Runtime[] runtimes = check storage:getRuntimes((), (), environmentId, (), ());
                foreach types:Runtime runtime in runtimes {
                    runtimeIds.push(runtime.runtimeId);
                }
            }
        }
    }

    log:printInfo("Resolved " + runtimeIds.length().toString() + " runtime IDs from component/environment filters");
    return runtimeIds;
}
