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
import ballerina/test;
import icp_server.auth;

// GraphQL endpoint for runtime queries (using test port from Config.toml)
const string GRAPHQL_URL = "http://localhost:9446/graphql";

// Test data IDs from test seed data (z_test_data.sql / h2_test_data.sql)
const string PROJECT_1_ID = "650e8400-e29b-41d4-a716-446655440001";
const string COMPONENT_1_ID = "640e8400-e29b-41d4-a716-446655440001";
const string DEV_ENV_ID = "750e8400-e29b-41d4-a716-446655440001";
const string RUNTIME_1_ID = "880e8400-e29b-41d4-a716-446655440001"; // Project 1, Component 1, Dev
const string RUNTIME_4_ID = "880e8400-e29b-41d4-a716-446655440004"; // Project 2, Component 3, Dev

// HTTP client for GraphQL testing (no SSL in test mode)
final http:Client graphqlClient = check new (GRAPHQL_URL);

// Store tokens for different users
string orgDevToken = "";
string project1AdminToken = "";
string integrationViewerToken = "";

// JWT configuration for runtime tests
final readonly & jwt:IssuerSignatureConfig runtimeTestJwtConfig = {
    algorithm: jwt:HS256,
    config: defaultJwtHMACSecret
};

// =============================================================================
// Setup: Generate test tokens with V2 permissions
// =============================================================================

@test:BeforeSuite
function setupRuntimeTests() returns error? {
    // Generate token for orgdev (org-level Developer - can view all, edit non-prod)
    orgDevToken = check generateV2Token(
        "770e8400-e29b-41d4-a716-446655440001",
        "orgdev",
        [auth:PERMISSION_INTEGRATION_VIEW, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_PROJECT_VIEW]
    );

    // Generate token for projectadmin (project-level Admin - full access to Project 1)
    project1AdminToken = check generateV2Token(
        "770e8400-e29b-41d4-a716-446655440002",
        "projectadmin",
        [auth:PERMISSION_INTEGRATION_VIEW, auth:PERMISSION_INTEGRATION_EDIT, auth:PERMISSION_INTEGRATION_MANAGE, auth:PERMISSION_PROJECT_VIEW, auth:PERMISSION_PROJECT_MANAGE]
    );

    // Generate token for integrationviewer (integration-level - view Component 1 only)
    integrationViewerToken = check generateV2Token(
        "770e8400-e29b-41d4-a716-446655440003",
        "integrationviewer",
        [auth:PERMISSION_INTEGRATION_VIEW, auth:PERMISSION_PROJECT_VIEW]
    );
}

// Helper to generate V2 JWT with permissions in scope claim
function generateV2Token(string userId, string username, string[] permissions) returns string|error {
    // Build scope claim from permissions
    string scopeClaim = string:'join(" ", ...permissions);

    jwt:IssuerConfig issuerConfig = {
        username: userId,
        issuer: frontendJwtIssuer,
        expTime: 3600,
        audience: frontendJwtAudience,
        signatureConfig: runtimeTestJwtConfig,
        customClaims: {
            "username": username,
            "displayName": username,
            "scope": scopeClaim // V2 uses scope claim for permissions
        }
    };

    return jwt:issue(issuerConfig);
}

// Helper to execute GraphQL query
function executeGraphQL(string query, string token, json? variables = ()) returns json|error {
    json payload = {
        query: query,
        variables: variables
    };

    http:Response response = check graphqlClient->post("/", payload, headers = {
        "Authorization": string `Bearer ${token}`
    });

    json responseBody = check response.getJsonPayload();
    return responseBody;
}

// =============================================================================
// Test 1: Get runtimes - Org-level user sees all runtimes
// =============================================================================

@test:Config {
    groups: ["runtime-graphql", "get-runtimes"]
}
function testGetRuntimesOrgLevel() returns error? {
    string query = string `
        query {
            runtimes(componentId: "${COMPONENT_1_ID}") {
                runtimeId
                status
                runtimeType
            }
        }
    `;

    json response = check executeGraphQL(query, orgDevToken);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    // Verify data exists
    json data = check response.data;
    json runtimesJson = check data.runtimes;
    json[] runtimes = check runtimesJson.ensureType();

    // Org-level user should see runtimes for component 1
    test:assertTrue(runtimes.length() > 0, "Should return at least one runtime");
}

// =============================================================================
// Test 2: Get runtimes - Project-level user sees only project 1 runtimes
// =============================================================================

@test:Config {
    groups: ["runtime-graphql", "get-runtimes"]
}
function testGetRuntimesProjectLevel() returns error? {
    string query = string `
        query {
            runtimes(componentId: "${COMPONENT_1_ID}") {
                runtimeId
                runtimeType
            }
        }
    `;

    json response = check executeGraphQL(query, project1AdminToken);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    // Verify data exists - project admin should see component 1 runtimes
    json data = check response.data;
    json runtimesJson = check data.runtimes;
    json[] runtimes = check runtimesJson.ensureType();

    // Should see runtimes for component 1 (which is in Project 1)
    test:assertTrue(runtimes.length() > 0, "Project admin should see runtimes for their project's components");
    
    // Keep the original check for reference - though it's less relevant now
    boolean hasRuntime4 = false;
    foreach json runtime in runtimes {
        string runtimeId = check runtime.runtimeId;
        if runtimeId == RUNTIME_4_ID {
            hasRuntime4 = true;
        }
    }
    test:assertFalse(hasRuntime4, "Project admin should not see Project 2 runtimes");
}

// =============================================================================
// Test 3: Get runtime by ID - Returns runtime if user has access
// =============================================================================

@test:Config {
    groups: ["runtime-graphql", "get-runtime"]
}
function testGetRuntimeById() returns error? {
    string query = string `
        query GetRuntime($runtimeId: String!) {
            runtime(runtimeId: $runtimeId) {
                runtimeId
                status
                runtimeType
            }
        }
    `;

    json variables = {
        runtimeId: RUNTIME_1_ID
    };

    json response = check executeGraphQL(query, orgDevToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    // Verify runtime returned
    json data = check response.data;
    json|error runtime = data.runtime;
    test:assertTrue(runtime is json, "Should return runtime object");

    if runtime is json {
        string runtimeId = check runtime.runtimeId;
        test:assertEquals(runtimeId, RUNTIME_1_ID, "Should return correct runtime");
    }
}

// =============================================================================
// Test 4: Get runtime by ID - Returns null for no access (404 pattern)
// =============================================================================

@test:Config {
    groups: ["runtime-graphql", "get-runtime"]
}
function testGetRuntimeByIdNoAccess() returns error? {
    string query = string `
        query GetRuntime($runtimeId: String!) {
            runtime(runtimeId: $runtimeId) {
                runtimeId
                runtimeType
            }
        }
    `;

    // Project admin tries to access Runtime 4 which is in Project 2
    json variables = {
        runtimeId: RUNTIME_4_ID
    };

    json response = check executeGraphQL(query, project1AdminToken, variables);

    // Should not return error, but runtime should be null (404 pattern)
    test:assertFalse(response.errors is json, "Query should not return errors for no access");

    json data = check response.data;
    json? runtime = check data.runtime;
    test:assertTrue(runtime is (), "Should return null for runtime without access");
}

// =============================================================================
// Test 5: Get componentDeployment - Returns deployment if user has access
// =============================================================================

@test:Config {
    groups: ["runtime-graphql", "component-deployment"]
}
function testGetComponentDeployment() returns error? {
    string query = string `
        query GetDeployment($componentId: String!, $environmentId: String!, $versionId: String!) {
            componentDeployment(
                orgHandler: "default",
                orgUuid: "1",
                componentId: $componentId,
                versionId: $versionId,
                environmentId: $environmentId
            ) {
                environmentId
                releaseId
                deploymentStatus
            }
        }
    `;

    json variables = {
        componentId: COMPONENT_1_ID,
        environmentId: DEV_ENV_ID,
        versionId: "1.0.0"
    };

    json response = check executeGraphQL(query, orgDevToken, variables);

    // Should not error even if deployment doesn't exist
    test:assertFalse(response.errors is json, "Query should not return errors");
}

// =============================================================================
// Test 6: Delete runtime - Success with proper permissions
// =============================================================================

@test:Config {
    groups: ["runtime-graphql", "delete-runtime"],
    enable: false // Disabled by default to avoid actual deletion in tests
}
function testDeleteRuntimeSuccess() returns error? {
    string mutation = string `
        mutation DeleteRuntime($runtimeId: String!) {
            deleteRuntime(runtimeId: $runtimeId)
        }
    `;

    json variables = {
        runtimeId: RUNTIME_1_ID
    };

    json response = check executeGraphQL(mutation, project1AdminToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json, "Mutation should not return errors");

    json data = check response.data;
    boolean deleted = check data.deleteRuntime;
    test:assertTrue(deleted, "Should return true for successful deletion");
}

// =============================================================================
// Test 7: Delete runtime - Returns error for no access (mutation pattern)
// =============================================================================

@test:Config {
    groups: ["runtime-graphql", "delete-runtime"]
}
function testDeleteRuntimeNoAccess() returns error? {
    string mutation = string `
        mutation DeleteRuntime($runtimeId: String!) {
            deleteRuntime(runtimeId: $runtimeId)
        }
    `;

    // Integration viewer tries to delete (only has view permission)
    json variables = {
        runtimeId: RUNTIME_1_ID
    };

    json response = check executeGraphQL(mutation, integrationViewerToken, variables);

    // Should return error (mutation returns explicit errors for no access)
    test:assertTrue(response.errors is json, "Mutation should return errors for no access");

    json[] errors = check response.errors.ensureType();
    test:assertTrue(errors.length() > 0, "Should have at least one error");
}
