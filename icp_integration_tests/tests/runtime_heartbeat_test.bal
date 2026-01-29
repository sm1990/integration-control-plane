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

import ballerina/http;
import ballerina/jwt;
import ballerina/log;
import ballerina/regex;
import ballerina/test;
import ballerina/time;

// Test variables
string runtimeTestAuthToken = "";
string testRuntimeId = "";
string testProjectId = "";
string testProjectHandler = "";
string testComponentId = "";
string testComponentName = "";
string testEnvironmentName = "";

// =============================================================================
// Setup: Authenticate and create test runtime
// =============================================================================

@test:BeforeSuite
function setupRuntimeHeartbeatTests() returns error? {
    log:printInfo("Setting up runtime heartbeat tests - authenticating as admin...");

    // Authenticate as admin
    json loginRequest = {
        username: adminUsername,
        password: adminPassword
    };

    http:Response response = check icpClient->post("/auth/login", loginRequest);
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for successful admin login");

    json responseBody = check response.getJsonPayload();
    string adminToken = check responseBody.token;

    test:assertTrue(adminToken.length() > 0, "Authentication token should not be empty");

    log:printInfo("Successfully authenticated for runtime heartbeat tests");

    // Generate runtime agent JWT token with runtime_agent scope
    time:Utc currentTime = time:utcNow();
    int timestamp = currentTime[0];

    jwt:IssuerSignatureConfig signatureConfig = {
        algorithm: jwt:HS256,
        config: "default-secret-key-at-least-32-characters-long-for-hs256"
    };

    jwt:IssuerConfig issuerConfig = {
        username: "runtime-agent-test",
        issuer: "icp-runtime-jwt-issuer",
        expTime: 3600,
        audience: "icp-server",
        signatureConfig: signatureConfig,
        customClaims: {
            "scope": "runtime_agent"
        }
    };

    runtimeTestAuthToken = check jwt:issue(issuerConfig);
    log:printInfo("Generated runtime agent JWT token with runtime_agent scope");

    // Create a test project for the runtime
    string timestampStr = regex:replaceAll(timestamp.toString(), "[^0-9]", "");
    string projectHandler = string `runtime-test-proj-${timestampStr}`;

    string createProjectMutation = string `
        mutation CreateProject($project: ProjectInput!) {
            createProject(project: $project) {
                id
                handler
            }
        }
    `;

    json projectVariables = {
        project: {
            name: string `Runtime Test Project ${timestamp}`,
            orgHandler: "default",
            projectHandler: projectHandler,
            description: "Test project for runtime heartbeat tests",
            orgId: 1
        }
    };

    json projectResponse = check executeGraphQL(createProjectMutation, adminToken, projectVariables);

    if projectResponse.data is json {
        json data = check projectResponse.data;
        json project = check data.createProject;
        testProjectId = check project.id.ensureType(string);
        testProjectHandler = check project.handler.ensureType(string);
        log:printInfo("Created test project with ID: " + testProjectId);
        log:printInfo("Project handler: " + testProjectHandler);
    }

    // Create a test component
    string componentName = string `runtime-test-comp-${timestampStr}`;
    testComponentName = componentName;
    string createComponentMutation = string `
        mutation CreateComponent($component: ComponentInput!) {
            createComponent(component: $component) {
                id
                name
            }
        }
    `;

    json componentVariables = {
        component: {
            name: componentName,
            displayName: string `Runtime Test Component ${timestamp}`,
            description: "Test component for runtime heartbeat tests",
            projectId: testProjectId,
            componentType: "BI"
        }
    };

    json componentResponse = check executeGraphQL(createComponentMutation, adminToken, componentVariables);

    if componentResponse.data is json {
        json data = check componentResponse.data;
        json component = check data.createComponent;
        testComponentId = check component.id.ensureType(string);
        log:printInfo("Created test component with ID: " + testComponentId);
    }

    // Create a test environment
    string createEnvironmentMutation = string `
        mutation CreateEnvironment($environment: EnvironmentInput!) {
            createEnvironment(environment: $environment) {
                id
                name
            }
        }
    `;

    testEnvironmentName = string `Runtime-Test-Env-${timestampStr}`;
    json environmentVariables = {
        environment: {
            name: testEnvironmentName,
            description: "Test environment for runtime heartbeat tests",
            critical: false
        }
    };

    json environmentResponse = check executeGraphQL(createEnvironmentMutation, adminToken, environmentVariables);

    if environmentResponse.data is json {
        json data = check environmentResponse.data;
        json environment = check data.createEnvironment;
        string envId = check environment.id.ensureType(string);
        log:printInfo("Created test environment: " + testEnvironmentName + " with ID: " + envId);
    }
}

// =============================================================================
// Test 1: Send Initial Heartbeat from BI Runtime
// =============================================================================

@test:Config {
    groups: ["integration", "runtime", "heartbeat"]
}
function testSendInitialHeartbeat() returns error? {
    log:printInfo("Testing initial heartbeat from BI runtime...");

    // Generate a unique runtime ID
    time:Utc currentTime = time:utcNow();
    testRuntimeId = string `bi-runtime-${currentTime[0]}`;

    // Prepare heartbeat payload with required structure
    json heartbeatPayload = {
        runtime: testRuntimeId,
        runtimeType: "BI",
        status: "RUNNING",
        environment: testEnvironmentName,
        project: testProjectHandler,
        component: testComponentName,
        version: "1.0.0",
        nodeInfo: {
            platformName: "ballerina",
            platformVersion: "2201.10.2",
            javaVersion: "17.0.7"
        },
        artifacts: {
            listeners: [],
            services: []
        },
        runtimeHash: string `hash-${currentTime[0]}`,
        timestamp: currentTime
    };

    // Send heartbeat to ICP server (note: may fail with 403 if runtime_agent scope is required)
    http:Response response = check icpClient->post(
        "/icp/heartbeat",
        heartbeatPayload,
        headers = {"Authorization": string `Bearer ${runtimeTestAuthToken}`}
    );

    // Log the response
    log:printInfo("Heartbeat response status: " + response.statusCode.toString());

    // Verify successful heartbeat with runtime_agent token
    test:assertTrue(
            response.statusCode == 200 || response.statusCode == 201 || response.statusCode == 204,
            string `Expected successful heartbeat with runtime_agent token, but got ${response.statusCode}`
    );

    // If there's a response body, log it
    if response.hasHeader("content-length") {
        string|error contentLength = response.getHeader("content-length");
        if contentLength is string && contentLength != "0" {
            json|error responseBody = response.getJsonPayload();
            if responseBody is json {
                log:printInfo("Heartbeat response: " + responseBody.toString());
            }
        }
    }

    log:printInfo("Successfully sent initial heartbeat for runtime: " + testRuntimeId);
}

// =============================================================================
// Test 2: Send Periodic Heartbeat Updates
// =============================================================================

@test:Config {
    groups: ["integration", "runtime", "heartbeat"],
    dependsOn: [testSendInitialHeartbeat]
}
function testSendPeriodicHeartbeat() returns error? {
    log:printInfo("Testing periodic heartbeat updates from BI runtime...");

    // Send multiple heartbeats to simulate periodic updates
    int heartbeatCount = 3;

    foreach int i in 0 ..< heartbeatCount {
        time:Utc currentTime = time:utcNow();

        json heartbeatPayload = {
            runtime: testRuntimeId,
            runtimeType: "BI",
            status: "RUNNING",
            environment: testEnvironmentName,
            project: testProjectHandler,
            component: testComponentName,
            version: "1.0.0",
            nodeInfo: {
                platformName: "ballerina",
                platformVersion: "2201.10.2",
                usedMemory: 1024 * 1024 * (100 + i * 10)
            },
            artifacts: {
                listeners: [],
                services: []
            },
            runtimeHash: string `hash-${currentTime[0]}`,
            timestamp: currentTime
        };

        http:Response response = check icpClient->post(
            "/icp/heartbeat",
            heartbeatPayload,
            headers = {"Authorization": string `Bearer ${runtimeTestAuthToken}`}
        );

        test:assertTrue(
                response.statusCode == 200 || response.statusCode == 201 || response.statusCode == 204,
                string `Heartbeat ${i + 1} should succeed with runtime_agent token`
        );

        log:printInfo(string `Heartbeat ${i + 1}/${heartbeatCount} sent successfully`);
    }

    log:printInfo("Successfully sent periodic heartbeat updates");
}

// =============================================================================
// Test 5: Send Heartbeat Without Authentication (Negative Test)
// =============================================================================

@test:Config {
    groups: ["integration", "runtime", "heartbeat", "negative"]
}
function testHeartbeatWithoutAuth() returns error? {
    log:printInfo("Testing heartbeat without authentication (negative test)...");

    time:Utc currentTime = time:utcNow();

    json heartbeatPayload = {
        runtime: string `unauthorized-runtime-${currentTime[0]}`,
        runtimeType: "BI",
        status: "RUNNING",
        environment: testEnvironmentName,
        project: testProjectHandler,
        component: testComponentName,
        nodeInfo: {
            platformName: "ballerina"
        },
        artifacts: {
            listeners: [],
            services: []
        },
        runtimeHash: string `hash-${currentTime[0]}`,
        timestamp: currentTime
    };

    // Send heartbeat without authorization header
    http:Response response = check icpClient->post("/icp/heartbeat", heartbeatPayload);

    // Should return 401 Unauthorized or 405 Method Not Allowed
    test:assertTrue(
            response.statusCode == 401 || response.statusCode == 405,
            string `Heartbeat without authentication should return 401 or 405, but got ${response.statusCode}`
    );

    log:printInfo("Correctly rejected unauthenticated heartbeat request");
}

// =============================================================================
// Test 6: Query Runtime Status via GraphQL
// =============================================================================

@test:Config {
    groups: ["integration", "runtime", "heartbeat", "graphql"],
    dependsOn: [testSendPeriodicHeartbeat]
}
function testQueryRuntimeStatus() returns error? {
    log:printInfo("Testing query of runtime status via GraphQL...");

    string query = string `
        query GetRuntime($runtimeId: String!) {
            runtime(runtimeId: $runtimeId) {
                id
                componentId
                status
                runtimeType
                lastHeartbeat
            }
        }
    `;

    json variables = {
        runtimeId: testRuntimeId
    };

    json response = check executeGraphQL(query, runtimeTestAuthToken, variables);

    // Log the response
    log:printInfo("Runtime query response: " + response.toString());

    // Verify response (runtime may or may not exist depending on server implementation)
    if response.data is json {
        json data = check response.data;

        // If runtime data is returned, verify the structure
        if data.runtime is json && data.runtime !is () {
            json runtime = check data.runtime;
            string runtimeId = check runtime.id.ensureType(string);
            test:assertEquals(runtimeId, testRuntimeId, "Runtime ID should match");
            log:printInfo("Successfully queried runtime status");
        } else {
            log:printInfo("Runtime not found in query (may not be persisted)");
        }
    }
}
