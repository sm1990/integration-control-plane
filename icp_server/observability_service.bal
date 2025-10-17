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

import icp_server.types as types;

import ballerina/http;
import ballerina/time;
import ballerina/log;
import icp_server.utils;
import icp_server.storage;

// HTTP client for OpenSearch with SSL verification disabled
final http:Client opensearchClient = check new (opensearchUrl,
    config = {
        auth: {
            username: opensearchUsername,
            password: opensearchPassword
        },
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
                        secret: defaultJwtHMACSecret
                    }
                }
            }
        ],
    cors: {
        allowOrigins: ["http://localhost:3000", "https://localhost:3000"],
        allowHeaders: ["Content-Type", "Authorization"]
    }
}
service /icp/observability on observabilityListener {

    function init() {
        log:printInfo("Observability service started at " + serverHost + ":" + observabilityServerPort.toString());
    }

    resource function post logs(http:Request request, types:LogRequest logRequest) returns types:LogEntry[]|error {

        // Get a specific header
        string|http:HeaderNotFoundError authHeader = request.getHeader("Authorization");
        if authHeader is http:HeaderNotFoundError {
            return error("Authorization header is required for fetching logs");
        } 

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);
        log:printInfo(string `Fetching logs for user ${userContext.toString()}`);

        // Build the OpenSearch query
        map<json> query = {
            "query": {
                "bool": {
                    "must": [],
                    "filter": []
                }
            },
            "sort": [{"@timestamp": {"order": "desc"}}],
            "size": logRequest.logLimit
        };

        // Get the must array to add filters
        json[] mustFilters = <json[]> check query.query.bool.must;
        json[] filters = <json[]> check query.query.bool.filter;

        // Add time range filter based on duration
        time:Utc currentTime = time:utcNow();
        time:Utc fromTime = time:utcAddSeconds(currentTime, -logRequest.duration);
        string fromTimeStr = time:utcToString(fromTime);
        string toTimeStr = time:utcToString(currentTime);

        json timeRangeFilter = {
            "range": {
                "@timestamp": {
                    "gte": fromTimeStr,
                    "lte": toTimeStr
                }
            }
        };
        mustFilters.push(timeRangeFilter);

        // Add optional filters
        string? runtimeValue = logRequest.runtime;
        if runtimeValue is string {
            json runtimeFilter = {
                "terms": {
                    "runtime.keyword": [runtimeValue]
                }
            };

            filters.push(runtimeFilter);
        }

        string? componentValue = logRequest.component;
        if componentValue is string {
            json componentFilter = {
                "terms": {
                    "component.keyword": [componentValue]
                }
            };
            filters.push(componentFilter);
        }

        string? environmentValue = logRequest.environment;
        if environmentValue is string {
            json environmentFilter = {
                "terms": {
                    "environment.keyword": [environmentValue]
                }
            };
            filters.push(environmentFilter);
        } else {
            // If no environment is specified, filter by user's accessible environments
            if (!userContext.isSuperAdmin) {
                string[] accessibleProjectIds = utils:getAccessibleProjectIds(userContext);
                string[] allAccessibleEnvironmentIds = [];
                foreach string projectId in accessibleProjectIds {
                    string[] accessibleEnvironmentIds = utils:getAccessibleEnvironmentIds(userContext, projectId);
                    allAccessibleEnvironmentIds.push(...accessibleEnvironmentIds);
                }
                string[] accessibleEnvironments = [];
                foreach string envId in allAccessibleEnvironmentIds {
                    types:Environment env = check storage:getEnvironmentById(envId);
                    accessibleEnvironments.push(env.name);
                }
                log:printInfo(string `Filtering logs for accessible environments: ${accessibleEnvironments.toString()}`);

                json environmentAccessFilter = {
                    "terms": {
                        "environment.keyword": accessibleEnvironments
                    }
                };
                filters.push(environmentAccessFilter);
            }
        }

        string? projectValue = logRequest.project;
        if projectValue is string {
            json projectFilter = {
                "terms": {
                    "project.keyword": [projectValue]
                }
            };
            filters.push(projectFilter);
        } else {
            // If no project is specified, filter by user's accessible projects
            if (!userContext.isSuperAdmin) {
                string[] accessibleProjectIds = utils:getAccessibleProjectIds(userContext);
                string[] accessibleProjects = [];
                foreach string projectId in accessibleProjectIds {
                    types:Project project = check storage:getProjectById(projectId);
                    accessibleProjects.push(project.name);
                }
                log:printInfo(string `Filtering logs for accessible projects: ${accessibleProjects[0]}`);

                json projectAccessFilter = {
                    "terms": {
                        "project.keyword": accessibleProjects
                    }
                };
                filters.push(projectAccessFilter);
            }
        }

        string? logLevelValue = logRequest.logLevel;
        if logLevelValue is string {
            json logLevelFilter = {
                "terms": {
                    "level.keyword": [logLevelValue]
                }
            };
            filters.push(logLevelFilter);
        }

        // Convert query to JSON string
        string queryJson = query.toJsonString();

        // Execute the search request
        http:Response response = check opensearchClient->post(path = "/ballerina-application-logs-*/_search",
                                                            message = queryJson,
                                                            headers = {"Content-Type": "application/json"});

        // Get response body and parse it
        string responseBody = check response.getTextPayload();
        json responseJson = check responseBody.fromJsonString();
        
        // Convert to OpenSearch response record
        types:OpenSearchResponse opensearchResponse = check responseJson.cloneWithType();
        
        // Transform hits to LogEntry array
        types:LogEntry[] logEntries = [];
        
        foreach types:OpenSearchHit hit in opensearchResponse.hits.hits {
            map<string> sourceData = hit._source;
            
            // Extract common fields with safe access
            string timestampValue = sourceData.hasKey("@timestamp") ? sourceData.get("@timestamp") : "";
            string levelValue = sourceData.hasKey("level") ? sourceData.get("level") : "";
            string moduleValue = sourceData.hasKey("module") ? sourceData.get("module") : "";
            string runtimeValueFromSource = sourceData.hasKey("runtime") ? sourceData.get("runtime") : "";
            string componentValueFromSource = sourceData.hasKey("component") ? sourceData.get("component") : "";
            string projectValueFromSource = sourceData.hasKey("project") ? sourceData.get("project") : "";
            string environmentValueFromSource = sourceData.hasKey("environment") ? sourceData.get("environment") : "";
            string messageValue = sourceData.hasKey("message") ? sourceData.get("message") : "";
            
            // Create additional tags map excluding common fields
            map<anydata> additionalTags = {};
            string[] commonFields = ["@timestamp", "level", "module", "runtime", "component", "project", "environment", "message"];
            
            foreach string key in sourceData.keys() {
                if commonFields.indexOf(key) is () {
                    additionalTags[key] = sourceData.get(key);
                }
            }
            
            types:LogEntry logEntry = {
                timestamp: timestampValue,
                level: levelValue,
                module: moduleValue,
                runtime: runtimeValueFromSource,
                component: componentValueFromSource,
                project: projectValueFromSource,
                environment: environmentValueFromSource,
                message: messageValue,
                additionalTags: additionalTags
            };
            
            logEntries.push(logEntry);
        }
        
        return logEntries;
    }
}
