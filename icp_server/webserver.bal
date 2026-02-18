// Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
//
// WSO2 Inc. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ballerina/file;
import ballerina/http;
import ballerina/io;
import ballerina/log;

service / on httpListener {

    function init() {
        // Update config.json with runtime configuration
        error? updateResult = updateFrontendConfig();
        if updateResult is error {
            log:printWarn("Failed to update frontend config.json: " + updateResult.message());
        }

        log:printInfo("Starting console on " + serverHost + ":" + serverPort.toString());
        log:printInfo("--------------------------------");
        log:printInfo("WSO2 Integrator: ICP Console started at https://localhost:" + serverPort.toString());
        log:printInfo("--------------------------------");
    }

    // Serve static files from build directory
    resource function get [string... path](http:Request req) returns http:Response|error {
        http:Response response = new;

        // Build file path
        string filePath = path.length() == 0 ? "index.html" : string:'join("/", ...path);

        // Security: Reject paths containing ".." to prevent path traversal attacks
        if filePath.includes("..") {
            response.statusCode = 400;
            response.setTextPayload("Invalid path");
            log:printWarn("Path traversal attempt detected: " + filePath);
            return response;
        }

        // If path is a directory, serve index.html
        if filePath.endsWith("/") {
            filePath = filePath + "index.html";
        }

        // Security: Normalize paths and ensure they stay within the base directory
        string baseDir = check file:getAbsolutePath("../www");
        string fullPath = check file:getAbsolutePath("../www/" + filePath);

        // Ensure resolved path is within base directory
        if !fullPath.startsWith(baseDir) {
            response.statusCode = 403;
            response.setTextPayload("Access denied");
            log:printWarn("Directory traversal attempt blocked: " + fullPath);
            return response;
        }

        // Check if file exists
        boolean fileExists = check file:test(fullPath, file:EXISTS);

        if !fileExists {
            // For SPA routing: if file doesn't exist and path doesn't have an extension,
            // serve index.html to let client-side router handle it
            if filePath.indexOf(".") is () {
                string indexPath = "../www/index.html";
                boolean indexExists = check file:test(indexPath, file:EXISTS);

                if indexExists {
                    byte[] fileContent = check io:fileReadBytes(indexPath);
                    response.setHeader("Content-Type", "text/html; charset=utf-8");
                    response.setBinaryPayload(fileContent);
                    return response;
                }
            }

            response.statusCode = 404;
            response.setTextPayload("File not found: " + filePath);
            log:printError("File not found: " + fullPath);
            return response;
        }

        // Read file content
        byte[] fileContent = check io:fileReadBytes(fullPath);

        // Set content type based on file extension
        string contentType = getContentType(filePath);
        response.setHeader("Content-Type", contentType);
        response.setBinaryPayload(fileContent);

        return response;
    }

}

// Helper function to determine content type
function getContentType(string filePath) returns string {
    if filePath.endsWith(".html") {
        return "text/html; charset=utf-8";
    } else if filePath.endsWith(".css") {
        return "text/css; charset=utf-8";
    } else if filePath.endsWith(".js") {
        return "application/javascript; charset=utf-8";
    } else if filePath.endsWith(".json") {
        return "application/json; charset=utf-8";
    } else if filePath.endsWith(".png") {
        return "image/png";
    } else if filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") {
        return "image/jpeg";
    } else if filePath.endsWith(".svg") {
        return "image/svg+xml";
    } else if filePath.endsWith(".ico") {
        return "image/x-icon";
    } else if filePath.endsWith(".woff") {
        return "font/woff";
    } else if filePath.endsWith(".woff2") {
        return "font/woff2";
    } else if filePath.endsWith(".ttf") {
        return "font/ttf";
    } else if filePath.endsWith(".eot") {
        return "application/vnd.ms-fontobject";
    } else if filePath.endsWith(".map") {
        return "application/json";
    } else if filePath.endsWith(".txt") {
        return "text/plain; charset=utf-8";
    } else {
        return "application/octet-stream";
    }
}

// Update frontend config.json with runtime backend URLs
function updateFrontendConfig() returns error? {
    string configPath = "../www/config.json";

    // Create config JSON with runtime values
    json configJson = {
        "VITE_GRAPHQL_URL": backendGraphqlEndpoint,
        "VITE_AUTH_BASE_URL": backendAuthBaseUrl,
        "VITE_OBSERVABILITY_URL": backendObservabilityEndpoint
    };

    // Write to config.json
    check io:fileWriteJson(configPath, configJson);
    log:printInfo("Updated frontend config.json with backend URLs");
}
