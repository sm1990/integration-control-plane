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
    cors: {
        allowOrigins: ["http://localhost:3000", "https://localhost:3000"],
        allowHeaders: ["Content-Type", "Authorization"]
    }
}
service /icp/observability on observabilityListener {

    function init() {
        log:printInfo("Observability service started at " + serverHost + ":" + observabilityServerPort.toString());
    }

    resource function post logs(types:LogRequest logRequest) returns types:LogEntry[]|error {
        // Build the OpenSearch query
        map<json> query = {
            "query": {
                "bool": {
                    "must": []
                }
            },
            "sort": [{"@timestamp": {"order": "desc"}}],
            "size": logRequest.logLimit
        };

        // Get the must array to add filters
        json[] mustFilters = <json[]> check query.query.bool.must;

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
                "term": {
                    "runtime.keyword": runtimeValue
                }
            };
            mustFilters.push(runtimeFilter);
        }

        string? componentValue = logRequest.component;
        if componentValue is string {
            json componentFilter = {
                "term": {
                    "component.keyword": componentValue
                }
            };
            mustFilters.push(componentFilter);
        }

        string? environmentValue = logRequest.environment;
        if environmentValue is string {
            json environmentFilter = {
                "term": {
                    "environment.keyword": environmentValue
                }
            };
            mustFilters.push(environmentFilter);
        }

        string? projectValue = logRequest.project;
        if projectValue is string {
            json projectFilter = {
                "term": {
                    "project.keyword": projectValue
                }
            };
            mustFilters.push(projectFilter);
        }

        string? logLevelValue = logRequest.logLevel;
        if logLevelValue is string {
            json logLevelFilter = {
                "term": {
                    "level.keyword": logLevelValue
                }
            };
            mustFilters.push(logLevelFilter);
        }

        // Convert query to JSON string
        string queryJson = query.toJsonString();

        // Execute the search request
        http:Response response = check opensearchClient->post(path = "/ballerina-application-logs-*/_search",
                                                            message = queryJson,
                                                            headers = {"Content-Type": "application/json"});

        // Get response body and parse it
        string responseBody = check response.getTextPayload();
        log:printInfo("OpenSearch response: " + responseBody);
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
