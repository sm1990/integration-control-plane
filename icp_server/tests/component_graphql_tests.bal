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

import ballerina/test;
import icp_server.auth;

// Test data IDs - these are already defined in runtime_graphql_tests.bal
// const string PROJECT_1_ID = "650e8400-e29b-41d4-a716-446655440001";
// const string COMPONENT_1_ID = "640e8400-e29b-41d4-a716-446655440001";

const string COMPONENT_2_ID = "640e8400-e29b-41d4-a716-446655440002"; // Project 1, Component 2
const string COMPONENT_3_ID = "640e8400-e29b-41d4-a716-446655440003"; // Project 2, Component 3
const string PROJECT_2_ID = "650e8400-e29b-41d4-a716-446655440002";

// Token for read-only viewer (only view permission, no edit/manage)
string readOnlyViewerToken = "";

@test:BeforeSuite
function setupComponentTests() returns error? {
    // Generate token for read-only viewer (view permission only for Component 1)
    readOnlyViewerToken = check generateV2Token(
        "770e8400-e29b-41d4-a716-446655440005",
        "readonlyviewer",
        [auth:PERMISSION_INTEGRATION_VIEW, auth:PERMISSION_PROJECT_VIEW]
    );
}

// =============================================================================
// Test 1: Get components - Org-level user sees all accessible components
// =============================================================================

@test:Config {
    groups: ["component-graphql", "get-components"]
}
function testGetComponentsOrgLevel() returns error? {
    string query = string `
        query {
            components(orgHandler: "default") {
                id
                name
                projectId
            }
        }
    `;

    json response = check executeGraphQL(query, orgDevToken);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    // Verify data exists
    json data = check response.data;
    json componentsJson = check data.components;
    json[] components = check componentsJson.ensureType();

    // Org-level user should see components from all projects
    test:assertTrue(components.length() >= 2, "Should return at least 2 components");
}

// =============================================================================
// Test 2: Get components - Project-level user sees only their project's components
// =============================================================================

@test:Config {
    groups: ["component-graphql", "get-components"]
}
function testGetComponentsProjectLevel() returns error? {
    string query = string `
        query {
            components(orgHandler: "default") {
                id
                name
                projectId
            }
        }
    `;

    json response = check executeGraphQL(query, project1AdminToken);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    // Verify data exists and doesn't include Project 2 components
    json data = check response.data;
    json componentsJson = check data.components;
    json[] components = check componentsJson.ensureType();

    // Should not see Component 3 which is in Project 2
    boolean hasComponent3 = false;
    foreach json component in components {
        string componentId = check component.id;
        if componentId == COMPONENT_3_ID {
            hasComponent3 = true;
        }
    }
    test:assertFalse(hasComponent3, "Project admin should not see Project 2 components");
}

// =============================================================================
// Test 3: Get components with project filter
// =============================================================================

@test:Config {
    groups: ["component-graphql", "get-components"]
}
function testGetComponentsWithProjectFilter() returns error? {
    string query = string `
        query GetComponents($projectId: String) {
            components(orgHandler: "default", projectId: $projectId) {
                id
                name
                projectId
            }
        }
    `;

    json variables = {
        projectId: PROJECT_1_ID
    };

    json response = check executeGraphQL(query, orgDevToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    json data = check response.data;
    json componentsJson = check data.components;
    json[] components = check componentsJson.ensureType();

    // All returned components should belong to Project 1
    foreach json component in components {
        string projectId = check component.projectId;
        test:assertEquals(projectId, PROJECT_1_ID, "All components should be from Project 1");
    }
}

// =============================================================================
// Test 4: Get component by ID - Success with proper permissions
// =============================================================================

@test:Config {
    groups: ["component-graphql", "get-component"]
}
function testGetComponentById() returns error? {
    string query = string `
        query GetComponent($componentId: String!) {
            component(componentId: $componentId) {
                id
                name
                displayName
                projectId
            }
        }
    `;

    json variables = {
        componentId: COMPONENT_1_ID
    };

    json response = check executeGraphQL(query, orgDevToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    // Verify component returned
    json data = check response.data;
    json|error component = data.component;
    test:assertTrue(component is json, "Should return component object");

    if component is json {
        string componentId = check component.id;
        test:assertEquals(componentId, COMPONENT_1_ID, "Should return correct component");
    }
}

// =============================================================================
// Test 5: Get component by ID - Returns null for no access (404 pattern)
// =============================================================================

@test:Config {
    groups: ["component-graphql", "get-component"]
}
function testGetComponentByIdNoAccess() returns error? {
    string query = string `
        query GetComponent($componentId: String!) {
            component(componentId: $componentId) {
                id
                name
            }
        }
    `;

    // Project admin tries to access Component 3 which is in Project 2
    json variables = {
        componentId: COMPONENT_3_ID
    };

    json response = check executeGraphQL(query, project1AdminToken, variables);

    // Should not return error, but component should be null (404 pattern)
    test:assertFalse(response.errors is json, "Query should not return errors for no access");

    json data = check response.data;
    json? component = check data.component;
    test:assertTrue(component is (), "Should return null for component without access");
}

// =============================================================================
// Test 6: Get component by projectId + componentHandler
// =============================================================================

@test:Config {
    groups: ["component-graphql", "get-component"]
}
function testGetComponentByProjectAndHandler() returns error? {
    string query = string `
        query GetComponent($projectId: String!, $componentHandler: String!) {
            component(projectId: $projectId, componentHandler: $componentHandler) {
                id
                name
                projectId
            }
        }
    `;

    json variables = {
        projectId: PROJECT_1_ID,
        componentHandler: "sample-integration"
    };

    json response = check executeGraphQL(query, orgDevToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json, "Query should not return errors");

    // Verify component returned
    json data = check response.data;
    json|error component = data.component;
    test:assertTrue(component is json, "Should return component object");

    if component is json {
        string projectId = check component.projectId;
        test:assertEquals(projectId, PROJECT_1_ID, "Should return component from correct project");
    }
}

// =============================================================================
// Test 7: Create component - Success with manage permission
// =============================================================================

@test:Config {
    groups: ["component-graphql", "create-component"]
}
function testCreateComponentSuccess() returns error? {
    string mutation = string `
        mutation CreateComponent($component: ComponentInput!) {
            createComponent(component: $component) {
                id
                name
                displayName
                projectId
            }
        }
    `;

    json variables = {
        component: {
            name: "test-integration",
            displayName: "Test Integration",
            description: "Test component for GraphQL tests",
            projectId: PROJECT_1_ID,
            componentType: "BI"
        }
    };

    json response = check executeGraphQL(mutation, project1AdminToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json, "Mutation should not return errors");

    json data = check response.data;
    json|error component = data.createComponent;
    test:assertTrue(component is json, "Should return created component");

    if component is json {
        string name = check component.name;
        test:assertEquals(name, "test-integration", "Should return component with correct name");
    }
}

// =============================================================================
// Test 8: Create component - Fails without manage permission
// =============================================================================

@test:Config {
    groups: ["component-graphql", "create-component"]
}
function testCreateComponentNoPermission() returns error? {
    string mutation = string `
        mutation CreateComponent($component: ComponentInput!) {
            createComponent(component: $component) {
                id
                name
            }
        }
    `;

    // Integration viewer only has view permission, not manage
    json variables = {
        component: {
            name: "unauthorized-integration",
            displayName: "Unauthorized",
            projectId: PROJECT_1_ID,
            componentType: "BI"
        }
    };

    json response = check executeGraphQL(mutation, integrationViewerToken, variables);

    // Should return error (mutation returns explicit errors for no access)
    test:assertTrue(response.errors is json, "Mutation should return errors for insufficient permissions");

    json[] errors = check response.errors.ensureType();
    test:assertTrue(errors.length() > 0, "Should have at least one error");
}

// =============================================================================
// Test 9: Update component - Success with edit or manage permission
// =============================================================================

@test:Config {
    groups: ["component-graphql", "update-component"]
}
function testUpdateComponentSuccess() returns error? {
    string mutation = string `
        mutation UpdateComponent($component: ComponentUpdateInput!) {
            updateComponent(component: $component) {
                id
                name
                displayName
                description
            }
        }
    `;

    json variables = {
        component: {
            id: COMPONENT_1_ID,
            displayName: "Updated Display Name",
            description: "Updated description for testing"
        }
    };

    json response = check executeGraphQL(mutation, project1AdminToken, variables);

    // Verify no errors
    test:assertFalse(response.errors is json, "Mutation should not return errors");

    json data = check response.data;
    json|error component = data.updateComponent;
    test:assertTrue(component is json, "Should return updated component");

    if component is json {
        string displayName = check component.displayName;
        test:assertEquals(displayName, "Updated Display Name", "Display name should be updated");
    }
}

// =============================================================================
// Test 10: Update component - Fails without edit/manage permission
// =============================================================================

@test:Config {
    groups: ["component-graphql", "update-component"]
}
function testUpdateComponentNoPermission() returns error? {
    string mutation = string `
        mutation UpdateComponent($component: ComponentUpdateInput!) {
            updateComponent(component: $component) {
                id
                name
            }
        }
    `;

    // Read-only viewer only has view permission (no edit/manage)
    // Try updating Component 1 which they can see but not edit
    json variables = {
        component: {
            id: COMPONENT_1_ID,
            displayName: "Unauthorized Update"
        }
    };

    json response = check executeGraphQL(mutation, readOnlyViewerToken, variables);

    // Should return error (viewer lacks edit/manage permission)
    test:assertTrue(response.errors is json, "Mutation should return errors for insufficient permissions");
}

// =============================================================================
// Test 11: Get componentArtifactTypes - Success with view/edit/manage permission
// =============================================================================

@test:Config {
    groups: ["component-graphql", "artifact-types"]
}
function testGetComponentArtifactTypes() returns error? {
    string query = string `
        query GetArtifactTypes($componentId: String!, $environmentId: String) {
            componentArtifactTypes(componentId: $componentId, environmentId: $environmentId) {
                artifactType
                artifactCount
            }
        }
    `;

    json variables = {
        componentId: COMPONENT_1_ID,
        environmentId: DEV_ENV_ID
    };

    json response = check executeGraphQL(query, orgDevToken, variables);

    // Verify no errors (even if no artifacts exist)
    test:assertFalse(response.errors is json, "Query should not return errors");

    json data = check response.data;
    json artifactTypesJson = check data.componentArtifactTypes;
    json[]|error artifactTypes = artifactTypesJson.ensureType();

    // Should return array (may be empty if no artifacts deployed)
    test:assertTrue(artifactTypes is json[], "Should return artifact types array");
}

// =============================================================================
// Test 12: Get componentArtifactTypes - Fails without permission
// =============================================================================

@test:Config {
    groups: ["component-graphql", "artifact-types"]
}
function testGetComponentArtifactTypesNoPermission() returns error? {
    string query = string `
        query GetArtifactTypes($componentId: String!) {
            componentArtifactTypes(componentId: $componentId) {
                artifactType
                count
            }
        }
    `;

    // Project admin tries to access Component 3 which is in Project 2
    json variables = {
        componentId: COMPONENT_3_ID
    };

    json response = check executeGraphQL(query, project1AdminToken, variables);

    // Should return error (query returns error for artifact operations)
    test:assertTrue(response.errors is json, "Query should return errors for insufficient permissions");
}
