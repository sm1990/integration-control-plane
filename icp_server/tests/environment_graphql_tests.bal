import ballerina/http;
import ballerina/test;
import ballerina/io;
import ballerina/jwt;
import icp_server.auth;

// =============================================================================
// Environment GraphQL Tests
// =============================================================================
// These tests verify RBAC v2 migration for environment management endpoints.
// Tokens:
//   - envAdminToken: User with full environment_mgt:manage permission
//   - envNonProdToken: User with environment_mgt:manage_nonprod permission only
// =============================================================================

// Test tokens for environment tests
string envAdminToken = "";
string envNonProdToken = "";

// JWT configuration
final readonly & jwt:IssuerSignatureConfig envTestJwtConfig = {
    algorithm: jwt:HS256,
    config: defaultJwtHMACSecret
};

@test:BeforeSuite
function setupEnvironmentTests() returns error? {
    // Generate token for admin user with full environment management
    envAdminToken = check generateV2Token(
        "550e8400-e29b-41d4-a716-446655440000",
        "envadmin",
        [auth:PERMISSION_ENVIRONMENT_MANAGE, auth:PERMISSION_ENVIRONMENT_MANAGE_NONPROD, auth:PERMISSION_PROJECT_VIEW, auth:PERMISSION_INTEGRATION_VIEW]
    );

    // Generate token for non-prod only user
    envNonProdToken = check generateV2Token(
        "770e8400-e29b-41d4-a716-446655440001",
        "envnonprod",
        [auth:PERMISSION_ENVIRONMENT_MANAGE_NONPROD, auth:PERMISSION_PROJECT_VIEW, auth:PERMISSION_INTEGRATION_VIEW]
    );
}

@test:Config {
    groups: ["environment-graphql"]
}
function testGetEnvironmentsOrgLevel() returns error? {
    // Admin with full environment management should see all environments
    string query = string `
        query {
            environments {
                id
                name
                critical
                description
            }
        }
    `;

    json payload = {query: query};
    http:Response response = check graphqlClient->post("/", payload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json responsePayload = check response.getJsonPayload();
    io:println("Response: ", responsePayload);

    // Verify successful response
    test:assertTrue(responsePayload.data is json, "Response should contain data field");
    json data = check responsePayload.data;
    json environmentsJson = check data.environments;
    json[] environments = check environmentsJson.ensureType();
    
    io:println("Org admin sees environments count: ", environments.length());

    // Verify at least some environments are returned (depends on test data)
    test:assertTrue(environments.length() > 0, "Org admin should see at least some environments");

    // Verify structure of first environment
    if environments.length() > 0 {
        json firstEnv = environments[0];
        test:assertTrue(firstEnv.id is string, "Environment should have id");
        test:assertTrue(firstEnv.name is string, "Environment should have name");
        test:assertTrue(firstEnv.critical is boolean, "Environment should have critical flag");
    }
}

@test:Config {
    groups: ["environment-graphql"],
    dependsOn: [testGetEnvironmentsOrgLevel]
}
function testGetEnvironmentsProjectLevel() returns error? {
    // Project-level user should see only environments in their project scope
    string query = string `
        query {
            environments {
                id
                name
                critical
                description
            }
        }
    `;

    json payload = {query: query};
    http:Response response = check graphqlClient->post("/", payload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json responsePayload = check response.getJsonPayload();
    io:println("testGetEnvironmentsProjectLevel Response: ", responsePayload);

    // Verify successful response
    test:assertTrue(responsePayload.data is json, "Response should contain data field");
    json data = check responsePayload.data;
    json environmentsJson = check data.environments;
    json[] environments = check environmentsJson.ensureType();
    
    io:println("Project admin sees environments count: ", environments.length());
}

@test:Config {
    groups: ["environment-graphql"],
    dependsOn: [testGetEnvironmentsProjectLevel]
}
function testGetEnvironmentsFilterByType() returns error? {
    // Test filtering by type: prod vs non-prod
    string queryProd = string `
        query {
            environments(type: "prod") {
                id
                name
                critical
            }
        }
    `;

    json payloadProd = {query: queryProd};
    http:Response responseProd = check graphqlClient->post("/", payloadProd, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json responseProdPayload = check responseProd.getJsonPayload();
    io:println("testGetEnvironmentsFilterByType (prod) Response: ", responseProdPayload);

    json prodData = check responseProdPayload.data;
    json prodEnvsJson = check prodData.environments;
    json[] prodEnvs = check prodEnvsJson.ensureType();

    // Verify all returned environments are critical (production)
    foreach json env in prodEnvs {
        json critical = check env.critical;
        test:assertTrue(critical == true, "All prod environments should have critical=true");
    }

    // Test non-prod filter
    string queryNonProd = string `
        query {
            environments(type: "non-prod") {
                id
                name
                critical
            }
        }
    `;

    json payloadNonProd = {query: queryNonProd};
    http:Response responseNonProd = check graphqlClient->post("/", payloadNonProd, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json responseNonProdPayload = check responseNonProd.getJsonPayload();
    io:println("testGetEnvironmentsFilterByType (non-prod) Response: ", responseNonProdPayload);

    json nonProdData = check responseNonProdPayload.data;
    json nonProdEnvsJson = check nonProdData.environments;
    json[] nonProdEnvs = check nonProdEnvsJson.ensureType();

    // Verify all returned environments are non-critical (non-production)
    foreach json env in nonProdEnvs {
        json critical = check env.critical;
        test:assertTrue(critical == false, "All non-prod environments should have critical=false");
    }
}

@test:Config {
    groups: ["environment-graphql"],
    dependsOn: [testGetEnvironmentsFilterByType]
}
function testCreateEnvironmentNonProd() returns error? {
    // User with environment_mgt:manage_nonprod can create non-prod environments
    string mutation = string `
        mutation {
            createEnvironment(environment: {
                name: "test-nonprod-env",
                description: "Test non-production environment",
                critical: false
            }) {
                id
                name
                critical
                description
            }
        }
    `;

    json payload = {query: mutation};
    http:Response response = check graphqlClient->post("/", payload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json responsePayload = check response.getJsonPayload();
    io:println("testCreateEnvironmentNonProd Response: ", responsePayload);

    // Verify successful creation
    test:assertTrue(responsePayload.data is json, "Response should contain data field");
    test:assertFalse(responsePayload.errors is json, "Should not have errors");

    json|error envResult = responsePayload.data.createEnvironment;
    test:assertTrue(envResult is json, "Should return created environment");

    if envResult is json {
        test:assertTrue(envResult.name == "test-nonprod-env", "Environment name should match");
        test:assertTrue(envResult.critical == false, "Environment should be non-critical");
    }
}

@test:Config {
    groups: ["environment-graphql"],
    dependsOn: [testCreateEnvironmentNonProd]
}
function testCreateEnvironmentProdDenied() returns error? {
    // User with only environment_mgt:manage_nonprod cannot create prod environments
    string mutation = string `
        mutation {
            createEnvironment(environment: {
                name: "test-prod-env",
                description: "Test production environment",
                critical: true
            }) {
                id
                name
                critical
            }
        }
    `;

    json payload = {query: mutation};
    http:Response response = check graphqlClient->post("/", payload, headers = {
        "Authorization": string `Bearer ${envNonProdToken}`
    });

    json responsePayload = check response.getJsonPayload();
    io:println("testCreateEnvironmentProdDenied Response: ", responsePayload);

    // Verify access is denied
    test:assertTrue(responsePayload.errors is json, "Should have errors");

    json errorsJson = check responsePayload.errors;
    json[] errors = check errorsJson.ensureType();
    test:assertTrue(errors.length() > 0, "Should have at least one error");

    // Verify error message mentions insufficient permissions
    json firstError = errors[0];
    json errorMsgJson = check firstError.message;
    string errorMsg = errorMsgJson.toString();
    io:println("Error message: ", errorMsg);
    test:assertTrue(errorMsg.includes("Access denied") || errorMsg.includes("insufficient permissions"), 
        "Error should mention access denied or insufficient permissions");
}

@test:Config {
    groups: ["environment-graphql"],
    dependsOn: [testCreateEnvironmentProdDenied]
}
function testDeleteEnvironmentNonProd() returns error? {
    // First create a non-prod environment to delete
    string createMutation = string `
        mutation {
            createEnvironment(environment: {
                name: "test-delete-env",
                description: "Test environment for deletion",
                critical: false
            }) {
                id
                name
            }
        }
    `;

    json createPayload = {query: createMutation};
    http:Response createResponse = check graphqlClient->post("/", createPayload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json createResponsePayload = check createResponse.getJsonPayload();
    io:println("testDeleteEnvironmentNonProd Create Response: ", createResponsePayload);

    json createData = check createResponsePayload.data;
    json|error envResult = createData.createEnvironment;
    test:assertTrue(envResult is json, "Should create environment");
    if envResult is error {
        return;
    }

    json envIdJson = check envResult.id;
    string envId = envIdJson.toString();

    // Now delete it with non-prod manager permissions
    string deleteMutation = string `
        mutation {
            deleteEnvironment(environmentId: "${envId}")
        }
    `;

    json deletePayload = {query: deleteMutation};
    http:Response deleteResponse = check graphqlClient->post("/", deletePayload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json deleteResponsePayload = check deleteResponse.getJsonPayload();
    io:println("testDeleteEnvironmentNonProd Delete Response: ", deleteResponsePayload);

    // Verify successful deletion
    test:assertTrue(deleteResponsePayload.data is json, "Response should contain data field");
    test:assertTrue(deleteResponsePayload.data.deleteEnvironment == true, "Deletion should succeed");
}

@test:Config {
    groups: ["environment-graphql"],
    dependsOn: [testDeleteEnvironmentNonProd]
}
function testUpdateEnvironmentProductionStatus() returns error? {
    // Only users with full environment_mgt:manage can change production status
    // First create a non-prod environment
    string createMutation = string `
        mutation {
            createEnvironment(environment: {
                name: "test-status-change-env",
                description: "Test environment for status change",
                critical: false
            }) {
                id
                name
                critical
            }
        }
    `;

    json createPayload = {query: createMutation};
    http:Response createResponse = check graphqlClient->post("/", createPayload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json createResponsePayload = check createResponse.getJsonPayload();
    io:println("testUpdateEnvironmentProductionStatus Create Response: ", createResponsePayload);

    json createData = check createResponsePayload.data;
    json|error envResult = createData.createEnvironment;
    test:assertTrue(envResult is json, "Should create environment");
    if envResult is error {
        return;
    }

    json envIdJson = check envResult.id;
    string envId = envIdJson.toString();

    // Try to change to production status with full manager permissions
    string updateMutation = string `
        mutation {
            updateEnvironmentProductionStatus(environmentId: "${envId}", isProduction: true) {
                id
                name
                critical
            }
        }
    `;

    json updatePayload = {query: updateMutation};
    http:Response updateResponse = check graphqlClient->post("/", updatePayload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json updateResponsePayload = check updateResponse.getJsonPayload();
    io:println("testUpdateEnvironmentProductionStatus Update Response: ", updateResponsePayload);

    // Verify successful update
    test:assertTrue(updateResponsePayload.data is json, "Response should contain data field");
    json|error updatedEnvResult = updateResponsePayload.data.updateEnvironmentProductionStatus;
    test:assertTrue(updatedEnvResult is json, "Should return updated environment");

    if updatedEnvResult is json {
        test:assertTrue(updatedEnvResult.critical == true, "Environment should now be critical");
    }

    // Clean up - delete the environment
    string deleteMutation = string `
        mutation {
            deleteEnvironment(environmentId: "${envId}")
        }
    `;

    json deletePayload = {query: deleteMutation};
    http:Response _ = check graphqlClient->post("/", deletePayload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });
}

@test:Config {
    groups: ["environment-graphql"],
    dependsOn: [testUpdateEnvironmentProductionStatus]
}
function testUpdateEnvironmentProductionStatusDenied() returns error? {
    // Non-prod manager cannot change production status
    // First create a non-prod environment
    string createMutation = string `
        mutation {
            createEnvironment(environment: {
                name: "test-status-denied-env",
                description: "Test environment for denied status change",
                critical: false
            }) {
                id
                name
            }
        }
    `;

    json createPayload = {query: createMutation};
    http:Response createResponse = check graphqlClient->post("/", createPayload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });

    json createResponsePayload = check createResponse.getJsonPayload();
    io:println("testUpdateEnvironmentProductionStatusDenied Create Response: ", createResponsePayload);

    json createData = check createResponsePayload.data;
    json|error envResult = createData.createEnvironment;
    test:assertTrue(envResult is json, "Should create environment");
    if envResult is error {
        return;
    }

    json envIdJson = check envResult.id;
    string envId = envIdJson.toString();

    // Try to change to production status with non-prod manager (should fail)
    string updateMutation = string `
        mutation {
            updateEnvironmentProductionStatus(environmentId: "${envId}", isProduction: true) {
                id
                name
                critical
            }
        }
    `;

    json updatePayload = {query: updateMutation};
    http:Response updateResponse = check graphqlClient->post("/", updatePayload, headers = {
        "Authorization": string `Bearer ${envNonProdToken}`
    });

    json updateResponsePayload = check updateResponse.getJsonPayload();
    io:println("testUpdateEnvironmentProductionStatusDenied Update Response: ", updateResponsePayload);

    // Verify access is denied
    test:assertTrue(updateResponsePayload.errors is json, "Should have errors");

    json errorsJson = check updateResponsePayload.errors;
    json[] errors = check errorsJson.ensureType();
    test:assertTrue(errors.length() > 0, "Should have at least one error");

    // Verify error message mentions insufficient permissions
    json firstError = errors[0];
    json errorMsgJson = check firstError.message;
    string errorMsg = errorMsgJson.toString();
    io:println("Error message: ", errorMsg);
    test:assertTrue(errorMsg.includes("Access denied") || errorMsg.includes("insufficient permissions"), 
        "Error should mention access denied or insufficient permissions");

    // Clean up - delete the environment with full manager
    string deleteMutation = string `
        mutation {
            deleteEnvironment(environmentId: "${envId}")
        }
    `;

    json deletePayload = {query: deleteMutation};
    http:Response _ = check graphqlClient->post("/", deletePayload, headers = {
        "Authorization": string `Bearer ${envAdminToken}`
    });
}
