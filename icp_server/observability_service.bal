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
import icp_server.auth;

import ballerina/http;
import ballerina/log;
import ballerina/time;

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

    resource function post logs(http:Request request, types:LogEntryRequest logRequest) returns types:LogEntriesResponse|error {

        // Get authorization header
        string|http:HeaderNotFoundError authHeader = request.getHeader("Authorization");
        if authHeader is http:HeaderNotFoundError {
            return error("Authorization header is required for fetching logs");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Build the base OpenSearch query filters
        map<json> baseQuery = check buildBaseQuery(logRequest, userContext);

        // Get log entries with pagination
        types:LogEntry[] logEntries = check getLogEntries(baseQuery, logRequest.logStartIndex, logRequest.logCount);

        // Get log counts by level
        types:LogCount logCounts = check getLogCounts(baseQuery, logRequest.logLevel);

        // Return combined response
        return {
            logs: logEntries,
            logCounts: logCounts
        };
    }
}

// Build base OpenSearch query with common filters
isolated function buildBaseQuery(types:LogEntryRequest logRequest, types:UserContextV2 userContext) returns map<json>|error {
    map<json> query = {
        "query": {
            "bool": {
                "must": [],
                "filter": []
            }
        }
    };

    // Get the must array and filters array to add filters
    json[] mustFilters = <json[]>check query.query.bool.must;
    json[] filters = <json[]>check query.query.bool.filter;

    json timeRangeFilter = {
        "range": {
            "@timestamp": {
                "gte": logRequest.startTime,
                "lte": logRequest.endTime
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
        // Get all accessible integrations which contain environment info
        types:UserIntegrationAccess[] accessibleIntegrations = 
            check storage:getUserAccessibleIntegrations(userContext.userId);
        
        // Extract unique environment IDs
        string[] accessibleEnvironmentIds = [];
        foreach types:UserIntegrationAccess integration in accessibleIntegrations {
            string? envUuid = integration.envUuid;
            if envUuid is string && accessibleEnvironmentIds.indexOf(envUuid) is () {
                accessibleEnvironmentIds.push(envUuid);
            }
        }
        
        // Convert environment IDs to names for filtering
        string[] accessibleEnvironments = [];
        foreach string envId in accessibleEnvironmentIds {
            types:Environment env = check storage:getEnvironmentById(envId);
            accessibleEnvironments.push(env.name);
        }

        // Only add filter if user has limited access
        if accessibleEnvironments.length() > 0 {
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
        types:UserProjectAccess[] accessibleProjectAccess = 
            check storage:getUserAccessibleProjects(userContext.userId);
        
        string[] accessibleProjects = [];
        foreach types:UserProjectAccess projectAccess in accessibleProjectAccess {
            accessibleProjects.push(projectAccess.projectName);
        }

        // Only add filter if user has limited access
        if accessibleProjects.length() > 0 {
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

    return query;
}

// Parse time string in format "2025-01-15T14:30" to time:Civil
isolated function parseTimeString(string timeStr) returns time:Civil|error {
    // Expected format: "2025-01-15T14:30"
    if timeStr.length() != 16 {
        return error("Invalid time format. Expected format: YYYY-MM-DDTHH:MM");
    }

    string[] dateParts = re `T`.split(timeStr);
    if dateParts.length() != 2 {
        return error("Invalid time format. Expected format: YYYY-MM-DDTHH:MM");
    }

    string datePart = dateParts[0];
    string timePart = dateParts[1];

    // Parse date part (YYYY-MM-DD)
    string[] dateComponents = re `-`.split(datePart);
    if dateComponents.length() != 3 {
        return error("Invalid date format. Expected format: YYYY-MM-DD");
    }

    int year = check int:fromString(dateComponents[0]);
    int month = check int:fromString(dateComponents[1]);
    int day = check int:fromString(dateComponents[2]);

    // Parse time part (HH:MM)
    string[] timeComponents = re `:`.split(timePart);
    if timeComponents.length() != 2 {
        return error("Invalid time format. Expected format: HH:MM");
    }

    int hour = check int:fromString(timeComponents[0]);
    int minute = check int:fromString(timeComponents[1]);

    // Validate ranges
    if year < 1900 || year > 3000 {
        return error("Year must be between 1900 and 3000");
    }
    if month < 1 || month > 12 {
        return error("Month must be between 1 and 12");
    }
    if day < 1 || day > 31 {
        return error("Day must be between 1 and 31");
    }
    if hour < 0 || hour > 23 {
        return error("Hour must be between 0 and 23");
    }
    if minute < 0 || minute > 59 {
        return error("Minute must be between 0 and 59");
    }

    return {
        year: year,
        month: month,
        day: day,
        hour: hour,
        minute: minute,
        second: 0
    };
}

// Get log entries with pagination
isolated function getLogEntries(map<json> baseQuery, int logStartIndex, int logCount) returns types:LogEntry[]|error {
    // Clone base query and add pagination and sorting
    map<json> logQuery = baseQuery.clone();
    logQuery["sort"] = [{"@timestamp": {"order": "desc"}}];
    logQuery["from"] = logStartIndex;
    logQuery["size"] = logCount;

    // Convert query to JSON string
    string queryJson = logQuery.toJsonString();

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
        string runtimeValueFromSource = sourceData.hasKey("runtime") ? sourceData.get("runtime") : "";
        string componentValueFromSource = sourceData.hasKey("component") ? sourceData.get("component") : "";
        string projectValueFromSource = sourceData.hasKey("project") ? sourceData.get("project") : "";
        string environmentValueFromSource = sourceData.hasKey("environment") ? sourceData.get("environment") : "";
        string messageValue = sourceData.hasKey("message") ? sourceData.get("message") : "";

        // Create additional tags map excluding common fields
        map<anydata> additionalTags = {};
        string[] commonFields = ["@timestamp", "level", "runtime", "component", "project", "environment", "message"];

        foreach string key in sourceData.keys() {
            if commonFields.indexOf(key) is () {
                additionalTags[key] = sourceData.get(key);
            }
        }

        types:LogEntry logEntry = {
            time: timestampValue,
            level: levelValue,
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

// Get log counts by level
isolated function getLogCounts(map<json> baseQuery, string? specificLogLevel) returns types:LogCount|error {
    types:LogCount logCount = {
        total: 0,
        info: 0,
        debug: 0,
        warn: 0,
        'error: 0
    };

    // If a specific log level is requested, get only that count
    if specificLogLevel is string {
        // Clone the base query and add the specific log level filter
        map<json> specificQuery = baseQuery.clone();
        json[] specificFilters = <json[]>check specificQuery.query.bool.filter;
        json logLevelFilter = {
            "terms": {
                "level.keyword": [specificLogLevel]
            }
        };
        specificFilters.push(logLevelFilter);

        // Get count for the specific log level
        int count = check executeCountQuery(specificQuery);
        logCount.total = count;

        // Set the specific level count
        match specificLogLevel.toLowerAscii() {
            "info" => {
                logCount.info = count;
            }
            "debug" => {
                logCount.debug = count;
            }
            "warn" => {
                logCount.warn = count;
            }
            "error" => {
                logCount.'error = count;
            }
        }
    } else {
        // Get total count first
        int totalCount = check executeCountQuery(baseQuery);
        logCount.total = totalCount;

        // Get counts for each log level
        string[] logLevels = ["INFO", "DEBUG", "WARN", "ERROR"];
        foreach string level in logLevels {
            // Clone the base query and add the log level filter
            map<json> levelQuery = baseQuery.clone();
            json[] levelFilters = <json[]>check levelQuery.query.bool.filter;
            json levelFilter = {
                "terms": {
                    "level.keyword": [level]
                }
            };
            levelFilters.push(levelFilter);

            // Get count for this log level
            int levelCount = check executeCountQuery(levelQuery);

            match level {
                "INFO" => {
                    logCount.info = levelCount;
                }
                "DEBUG" => {
                    logCount.debug = levelCount;
                }
                "WARN" => {
                    logCount.warn = levelCount;
                }
                "ERROR" => {
                    logCount.'error = levelCount;
                }
            }
        }
    }

    return logCount;
}

// Execute count query against OpenSearch
isolated function executeCountQuery(map<json> query) returns int|error {
    string queryJson = query.toJsonString();

    http:Response response = check opensearchClient->post(path = "/ballerina-application-logs-*/_count",
                                                        message = queryJson,
                                                        headers = {"Content-Type": "application/json"});

    string responseBody = check response.getTextPayload();
    json responseJson = check responseBody.fromJsonString();

    if responseJson is map<json> {
        json countValue = check responseJson.count;
        if countValue is int {
            return countValue;
        }
    }

    return error("Invalid count response from OpenSearch");
}
