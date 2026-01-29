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
import ballerina/log;
import ballerina/regex;
import ballerina/test;
import ballerina/time;

// Local variables for created resources
string projectTestCreatedProjectId = "";
string projectTestCreatedProjectHandler = "";
string projectTestCreatedComponentId = "";
string projectTestCreatedEnvironmentId = "";

// Local authentication token
string projectTestAuthToken = "";

// =============================================================================
// Setup: Authenticate and get admin token
// =============================================================================

@test:BeforeSuite
function setupProjectComponentTests() returns error? {
    log:printInfo("Setting up project and component tests - authenticating as admin...");

    // Use shared authentication from admin_connection_test to get token
    projectTestAuthToken = authToken;

    // If authToken is empty, authenticate directly
    if projectTestAuthToken == "" {
        // Prepare login request with admin credentials
        json loginRequest = {
            username: adminUsername,
            password: adminPassword
        };

        // Send login request to ICP server
        http:Response response = check icpClient->post("/auth/login", loginRequest);

        // Assert successful response
        test:assertEquals(response.statusCode, 200, "Expected status code 200 for successful admin login");

        // Parse response body
        json responseBody = check response.getJsonPayload();

        // Store authentication token
        projectTestAuthToken = check responseBody.token;
    }

    test:assertTrue(projectTestAuthToken.length() > 0, "Authentication token should not be empty");

    log:printInfo("Successfully authenticated as admin for project/component tests");
}

// =============================================================================
// Test 1: Create Project with Admin Credentials
// =============================================================================

@test:Config {
    groups: ["integration", "project-creation", "graphql"]
}
function testCreateProject() returns error? {
    log:printInfo("Testing project creation with admin credentials...");

    // Generate a unique project handler using timestamp
    time:Utc currentTime = time:utcNow();
    int timestamp = currentTime[0];
    string timestampStr = regex:replaceAll(timestamp.toString(), "[^0-9]", "");
    projectTestCreatedProjectHandler = string `test-proj-${timestampStr}`;

    // GraphQL mutation to create a project
    string mutation = string `
        mutation CreateProject($project: ProjectInput!) {
            createProject(project: $project) {
                id
                name
                description
                handler
            }
        }
    `;

    json variables = {
        project: {
            name: string `Test Project ${timestamp}`,
            orgHandler: "default",
            projectHandler: projectTestCreatedProjectHandler,
            description: "Test project created by integration tests",
            orgId: 1
        }
    };

    // Execute GraphQL mutation
    json response = check executeGraphQL(mutation, projectTestAuthToken, variables);

    // Log the response
    log:printInfo("Create project response: " + response.toString());

    // Verify no errors
    if response.errors is json[] {
        json[] errors = check response.errors.ensureType();
        test:assertFail(string `Project creation returned errors: ${errors.toString()}`);
    }

    // Verify project was created
    test:assertTrue(response.data is json, "Response should contain data field");
    json data = check response.data;
    test:assertTrue(data.createProject is json, "Response should contain createProject field");

    json project = check data.createProject;

    // Store project ID for cleanup and subsequent tests
    projectTestCreatedProjectId = check project.id.ensureType(string);
    test:assertTrue(projectTestCreatedProjectId.length() > 0, "Project ID should not be empty");

    // Verify project details
    string projectName = check project.name.ensureType(string);
    string projectHandler = check project.handler.ensureType(string);

    test:assertEquals(projectHandler, projectTestCreatedProjectHandler, "Project handler should match");
    test:assertTrue(projectName.includes("Test Project"), "Project name should include 'Test Project'");

    log:printInfo("Project created successfully with ID: " + projectTestCreatedProjectId);
    log:printInfo("Project handler: " + projectHandler);
}

// =============================================================================
// Test 2: Query Created Project
// =============================================================================

@test:Config {
    groups: ["integration", "project-query", "graphql"],
    dependsOn: [testCreateProject]
}
function testQueryCreatedProject() returns error? {
    log:printInfo("Testing query of created project...");

    // GraphQL query to get the created project
    string query = string `
        query GetProject($projectId: String!) {
            project(orgId: 1, projectId: $projectId) {
                id
                name
                description
                handler
            }
        }
    `;

    json variables = {
        projectId: projectTestCreatedProjectId
    };

    // Execute GraphQL query
    json response = check executeGraphQL(query, projectTestAuthToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json[], "Query should not return errors");

    // Verify project data
    json data = check response.data;
    json project = check data.project;

    string projectId = check project.id.ensureType(string);
    test:assertEquals(projectId, projectTestCreatedProjectId, "Project ID should match");

    log:printInfo("Successfully queried project: " + projectId);
}

// =============================================================================
// Test 3: Create Component in Created Project
// =============================================================================

@test:Config {
    groups: ["integration", "component-creation", "graphql"],
    dependsOn: [testCreateProject]
}
function testCreateComponent() returns error? {
    log:printInfo("Testing component creation in the created project...");

    // Generate unique component name
    time:Utc currentTime = time:utcNow();
    int timestamp = currentTime[0];
    string timestampStr = regex:replaceAll(timestamp.toString(), "[^0-9]", "");
    string componentName = string `test-comp-${timestampStr}`;

    // GraphQL mutation to create a component
    string mutation = string `
        mutation CreateComponent($component: ComponentInput!) {
            createComponent(component: $component) {
                id
                name
                displayName
                projectId
                componentType
            }
        }
    `;

    json variables = {
        component: {
            name: componentName,
            displayName: string `Test Integration ${timestamp}`,
            description: "Test component created by integration tests",
            projectId: projectTestCreatedProjectId,
            componentType: "BI" // Ballerina Integration
        }
    };

    // Execute GraphQL mutation
    json response = check executeGraphQL(mutation, projectTestAuthToken, variables);

    // Log the response
    log:printInfo("Create component response: " + response.toString());

    // Verify no errors
    if response.errors is json[] {
        json[] errors = check response.errors.ensureType();
        test:assertFail(string `Component creation returned errors: ${errors.toString()}`);
    }

    // Verify component was created
    test:assertTrue(response.data is json, "Response should contain data field");
    json data = check response.data;
    test:assertTrue(data.createComponent is json, "Response should contain createComponent field");

    json component = check data.createComponent;

    // Store component ID for cleanup
    projectTestCreatedComponentId = check component.id.ensureType(string);
    test:assertTrue(projectTestCreatedComponentId.length() > 0, "Component ID should not be empty");

    // Verify component details
    string name = check component.name.ensureType(string);
    string projectId = check component.projectId.ensureType(string);
    string componentType = check component.componentType.ensureType(string);

    test:assertEquals(name, componentName, "Component name should match");
    test:assertEquals(projectId, projectTestCreatedProjectId, "Component should belong to created project");
    test:assertEquals(componentType, "BI", "Component type should be BI");

    log:printInfo("Component created successfully with ID: " + projectTestCreatedComponentId);
    log:printInfo("Component name: " + name);
    log:printInfo("Component type: " + componentType);
}

// =============================================================================
// Test 4: Query Created Component
// =============================================================================

@test:Config {
    groups: ["integration", "component-query", "graphql"],
    dependsOn: [testCreateComponent]
}
function testQueryCreatedComponent() returns error? {
    log:printInfo("Testing query of created component...");

    // GraphQL query to get the created component
    string query = string `
        query GetComponent($componentId: String!) {
            component(componentId: $componentId) {
                id
                name
                displayName
                projectId
                componentType
            }
        }
    `;

    json variables = {
        componentId: projectTestCreatedComponentId
    };

    // Execute GraphQL query
    json response = check executeGraphQL(query, projectTestAuthToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json[], "Query should not return errors");

    // Verify component data
    json data = check response.data;
    json component = check data.component;

    string componentId = check component.id.ensureType(string);
    string projectId = check component.projectId.ensureType(string);

    test:assertEquals(componentId, projectTestCreatedComponentId, "Component ID should match");
    test:assertEquals(projectId, projectTestCreatedProjectId, "Component should belong to created project");

    log:printInfo("Successfully queried component: " + componentId);
}

// =============================================================================
// Test 5: Create Environment
// =============================================================================

@test:Config {
    dependsOn: [testQueryCreatedComponent]
}
function testCreateEnvironment() returns error? {
    log:printInfo("Testing environment creation...");

    time:Utc currentTime = time:utcNow();
    int timestamp = currentTime[0];

    // GraphQL mutation to create environment
    string createEnvironmentMutation = string `
        mutation CreateEnvironment($environment: EnvironmentInput!) {
            createEnvironment(environment: $environment) {
                id
                name
                description
                critical
            }
        }
    `;

    json variables = {
        environment: {
            name: string `Test Environment ${timestamp}`,
            description: "Test environment created by integration tests",
            critical: false
        }
    };

    // Execute GraphQL mutation
    json response = check executeGraphQL(createEnvironmentMutation, projectTestAuthToken, variables);

    // Log the response for debugging
    log:printInfo("Create environment response: " + response.toString());

    // Verify no errors
    if response.errors is json[] {
        json[] errors = check response.errors.ensureType();
        log:printError("Environment creation returned errors: " + errors.toString());
        test:assertFail(string `Environment creation returned errors: ${errors.toString()}`);
    }

    // Verify environment was created
    json data = check response.data;
    json environment = check data.createEnvironment;

    projectTestCreatedEnvironmentId = check environment.id.ensureType(string);
    string environmentName = check environment.name.ensureType(string);
    boolean critical = check environment.critical.ensureType(boolean);

    test:assertTrue(projectTestCreatedEnvironmentId.length() > 0, "Environment ID should not be empty");
    test:assertEquals(critical, false, "Environment should be non-critical");

    log:printInfo("Environment created successfully with ID: " + projectTestCreatedEnvironmentId);
    log:printInfo("Environment name: " + environmentName);
    log:printInfo("Is critical: " + critical.toString());
}

// =============================================================================
// Test 6: Query Created Environment
// =============================================================================

@test:Config {
    dependsOn: [testCreateEnvironment]
}
function testQueryCreatedEnvironment() returns error? {
    log:printInfo("Testing query of created environment...");

    // GraphQL query to get all environments
    string query = string `
        query GetEnvironments {
            environments {
                id
                name
                description
                critical
            }
        }
    `;

    json variables = {};

    // Execute GraphQL query
    json response = check executeGraphQL(query, projectTestAuthToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json[], "Query should not return errors");

    // Verify environments list
    json data = check response.data;
    json environmentsData = check data.environments;
    json[] environments = check environmentsData.cloneWithType();

    // Find the created environment
    boolean foundEnvironment = false;
    foreach json env in environments {
        string envId = check env.id.ensureType(string);
        if envId == projectTestCreatedEnvironmentId {
            foundEnvironment = true;
            boolean critical = check env.critical.ensureType(boolean);
            test:assertEquals(critical, false, "Environment should be non-critical");
            log:printInfo("Successfully queried environment: " + envId);
            break;
        }
    }

    test:assertTrue(foundEnvironment, "Created environment should be found in environments list");
}
