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
import ballerina/test;

// Test configuration
const GRAPHQL_ENDPOINT = "http://localhost:9090/graphql";

// Initialize test client
http:Client testClient = check new (GRAPHQL_ENDPOINT);

function getTestClient() returns http:Client|error {
    return new (GRAPHQL_ENDPOINT);
}

@test:Config {
    groups: ["graphql", "unit"]
}
function testGraphQLEndpointHealth() returns error? {
    // Simple health check query
    json query = {
        "query": "query { __typename }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "GraphQL endpoint should be accessible");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload is json, "Response should be valid JSON");
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testGetAllRuntimes() returns error? {
    // GraphQL query to get all runtimes
    json query = {
        "query": "query { runtimes { runtimeId runtimeType status } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");

    json dataField = check payload.data;
    test:assertTrue(dataField.runtimes is json[], "Runtimes should be an array");
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testGetRuntimesWithFilters() returns error? {
    // Test various filter combinations
    string[] queries = [
        "query { runtimes(status: \"RUNNING\") { runtimeId status } }",
        "query { runtimes(runtimeType: \"MI\") { runtimeId runtimeType } }",
        "query { runtimes(status: \"RUNNING\", runtimeType: \"BI\") { runtimeId status runtimeType } }"
    ];

    foreach string queryString in queries {
        json query = {"query": queryString};
        http:Response response = check testClient->post("/", query);
        test:assertEquals(response.statusCode, 200, "Response status should be 200 for filtered query");

        json payload = check response.getJsonPayload();
        test:assertTrue(payload.data is json, "Response should contain data field");
    }
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testGetRuntimeById() returns error? {
    // GraphQL query to get runtime by ID (using a placeholder ID)
    json query = {
        "query": "query { runtime(runtimeId: \"test-runtime-123\") { runtimeId runtimeType status } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");

    json dataField = check payload.data;
    // Runtime may be null if not found, which is expected behavior
    test:assertTrue(dataField.runtime is json|(), "Runtime field should exist");
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testGetServicesForRuntime() returns error? {
    // GraphQL query to get services for a runtime
    json query = {
        "query": "query { services(runtimeId: \"test-runtime-123\") { name package basePath state } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");

    json dataField = check payload.data;
    test:assertTrue(dataField.services is json[], "Services should be an array");
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testGetListenersForRuntime() returns error? {
    // GraphQL query to get listeners for a runtime
    json query = {
        "query": "query { listeners(runtimeId: \"test-runtime-123\") { name package protocol state } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");

    json dataField = check payload.data;
    test:assertTrue(dataField.listeners is json[], "Listeners should be an array");
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testComplexNestedQuery() returns error? {
    // Complex nested GraphQL query
    json query = {
        "query": string `query { 
            runtimes { 
                runtimeId 
                runtimeType 
                status 
                environment 
                version 
                services { 
                    name 
                    package 
                    basePath 
                    state 
                    resources { 
                        url 
                        methods 
                    } 
                } 
                listeners { 
                    name 
                    package 
                    protocol 
                    state 
                } 
            } 
        }`
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");

    json dataField = check payload.data;
    test:assertTrue(dataField.runtimes is json[], "Runtimes should be an array");
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testGraphQLWithVariables() returns error? {
    // GraphQL query with variables
    json query = {
        "query": "query GetRuntimes($status: String) { runtimes(status: $status) { runtimeId status } }",
        "variables": {
            "status": "RUNNING"
        }
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");
}

@test:Config {
    groups: ["graphql", "integration"]
}
function testGraphQLIntrospection() returns error? {
    // GraphQL introspection query
    json query = {
        "query": "query { __schema { queryType { name } } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");

    json dataField = check payload.data;
    test:assertTrue(dataField.__schema is json, "Schema should be returned");
}

@test:Config {
    groups: ["graphql", "error"]
}
function testInvalidGraphQLSyntax() returns error? {
    // Invalid GraphQL syntax
    json query = {
        "query": "query { invalidField { nonExistentField } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    // Should contain errors for invalid query
    test:assertTrue(payload.errors is json[] || payload.data is json, "Response should contain errors or data");
}

@test:Config {
    groups: ["graphql", "error"]
}
function testMalformedJSON() returns error? {
    // Test malformed JSON request
    string malformedJson = "{ invalid json }";

    http:Response response = check testClient->post("/", malformedJson,
        headers = {"Content-Type": "application/json"});

    // Should return 400 or 500 for malformed JSON
    test:assertTrue(response.statusCode >= 400, "Should return error status for malformed JSON");
}

@test:Config {
    groups: ["graphql", "performance"]
}
function testMultipleSimultaneousRequests() returns error? {
    // Test multiple requests in sequence to check for concurrency issues
    json query = {
        "query": "query { runtimes { runtimeId runtimeType status } }"
    };

    http:Response[] responses = [];

    // Send multiple requests
    foreach int i in 0 ... 4 {
        http:Response response = check testClient->post("/", query);
        responses.push(response);
    }

    // Verify all responses are successful
    foreach http:Response response in responses {
        test:assertEquals(response.statusCode, 200, "All concurrent requests should succeed");
        json payload = check response.getJsonPayload();
        test:assertTrue(payload.data is json, "All responses should contain data field");
    }
}

@test:Config {
    groups: ["graphql", "boundary"]
}
function testEmptyFilters() returns error? {
    // Test with empty string filters
    json query = {
        "query": "query { runtimes(status: \"\") { runtimeId status } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json || payload.errors is json[],
            "Response should contain data or errors");
}

@test:Config {
    groups: ["graphql", "boundary"]
}
function testNullFilters() returns error? {
    // Test with null filters
    json query = {
        "query": "query { runtimes(status: null) { runtimeId status } }"
    };

    http:Response response = check testClient->post("/", query);
    test:assertEquals(response.statusCode, 200, "Response status should be 200");

    json payload = check response.getJsonPayload();
    test:assertTrue(payload.data is json, "Response should contain data field");
}
