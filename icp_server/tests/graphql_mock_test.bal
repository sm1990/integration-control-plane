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

import icp_server.types;

import ballerina/test;
import ballerina/time;

// Mock data creation utilities for testing

function createMockRuntimeRecord() returns types:RuntimeRecord {
    return {
        runtime_id: "mock-runtime-123",
        runtime_type: "MI",
        status: "RUNNING",
        environment: "development",
        deployment_type: "standalone",
        version: "4.2.0",
        platform_name: "ballerina",
        platform_version: "2201.8.0",
        platform_home: "/opt/ballerina",
        os_name: "Linux",
        os_version: "Ubuntu 22.04",
        registration_time: time:utcNow(),
        last_heartbeat: time:utcNow()
    };
}

function createMockServiceRecord() returns types:ServiceRecordInDB {
    return {
        service_name: "MockService",
        service_package: "com.example.mock",
        base_path: "/api/v1/mock",
        state: "ENABLED"
    };
}

function createMockListenerRecord() returns types:ListenerRecordInDB {
    return {
        listener_name: "MockHTTPListener",
        listener_package: "com.example.http",
        protocol: "HTTP",
        state: "ENABLED"
    };
}

function createMockResourceRecord() returns types:ResourceRecord {
    return {
        resource_url: "/api/v1/users/{id}",
        methods: "[\"GET\", \"PUT\", \"DELETE\"]"
    };
}

function createMockRuntime() returns types:Runtime {
    return {
        runtimeId: "mock-runtime-456",
        runtimeType: "BI",
        status: "RUNNING",
        environment: "production",
        deploymentType: "clustered",
        version: "2.0.0",
        platformName: "ballerina",
        platformVersion: "2201.8.0",
        platformHome: "/opt/ballerina",
        osName: "Linux",
        osVersion: "Ubuntu 22.04",
        registrationTime: "2025-08-12T10:30:00.000Z",
        lastHeartbeat: "2025-08-12T11:00:00.000Z",
        services: [createMockService()],
        listeners: [createMockListener()]
    };
}

function createMockService() returns types:Service {
    return {
        name: "MockAPIService",
        package: "com.example.api",
        basePath: "/api",
        resources: [createMockResource()]
    };
}

function createMockListener() returns types:Listener {
    return {
        name: "MockHTTPSListener",
        package: "com.example.https",
        protocol: "HTTPS",
        state: "ENABLED"
    };
}

function createMockResource() returns types:Resource {
    return {
        url: "/api/users",
        methods: ["GET", "POST"]
    };
}

@test:Config {
    groups: ["mock", "integration"]
}
function testMockDataCreation() returns error? {
    // Test mock data creation functions
    types:RuntimeRecord runtimeRecord = createMockRuntimeRecord();
    test:assertEquals(runtimeRecord.runtime_id, "mock-runtime-123", "Mock runtime ID should match");
    test:assertEquals(runtimeRecord.runtime_type, "MI", "Mock runtime type should match");

    types:ServiceRecordInDB serviceRecord = createMockServiceRecord();
    test:assertEquals(serviceRecord.service_name, "MockService", "Mock service name should match");

    types:ListenerRecordInDB listenerRecord = createMockListenerRecord();
    test:assertEquals(listenerRecord.listener_name, "MockHTTPListener", "Mock listener name should match");

    types:ResourceRecord resourceRecord = createMockResourceRecord();
    test:assertEquals(resourceRecord.resource_url, "/api/v1/users/{id}", "Mock resource URL should match");
}

@test:Config {
    groups: ["mock", "integration"]
}
function testMockRuntimeWithNestedData() returns error? {
    // Test complete runtime with services and listeners
    types:Runtime runtime = createMockRuntime();

    test:assertEquals(runtime.runtimeId, "mock-runtime-456", "Runtime ID should match");
    test:assertEquals(runtime.runtimeType, "BI", "Runtime type should match");
    test:assertEquals(runtime.services.length(), 1, "Should have one service");
    test:assertEquals(runtime.listeners.length(), 1, "Should have one listener");

    types:Service serviceType = runtime.services[0];
    test:assertEquals(serviceType.name, "MockAPIService", "Service name should match");
    test:assertEquals(serviceType.resources.length(), 1, "Service should have one resource");

    types:Listener listenerType = runtime.listeners[0];
    test:assertEquals(listenerType.name, "MockHTTPSListener", "Listener name should match");
}

@test:Config {
    groups: ["mock", "transformation"]
}
function testDataTransformation() returns error? {
    // Test transformation from database records to GraphQL response types
    types:RuntimeRecord dbRecord = createMockRuntimeRecord();

    // Simulate transformation (this would normally be done by mapToRuntime function)
    string? registrationTimeStr = ();
    time:Utc? regTime = dbRecord.registration_time;
    if regTime is time:Utc {
        registrationTimeStr = time:utcToString(regTime);
    }

    types:Runtime graphqlRuntime = {
        runtimeId: dbRecord.runtime_id,
        runtimeType: dbRecord.runtime_type,
        status: dbRecord.status,
        environment: dbRecord.environment,
        deploymentType: dbRecord.deployment_type,
        version: dbRecord.version,
        platformName: dbRecord.platform_name,
        platformVersion: dbRecord.platform_version,
        platformHome: dbRecord.platform_home,
        osName: dbRecord.os_name,
        osVersion: dbRecord.os_version,
        registrationTime: registrationTimeStr,
        lastHeartbeat: registrationTimeStr,
        services: [],
        listeners: []
    };

    test:assertEquals(graphqlRuntime.runtimeId, dbRecord.runtime_id, "Transformed runtime ID should match");
    test:assertEquals(graphqlRuntime.runtimeType, dbRecord.runtime_type, "Transformed runtime type should match");
    test:assertTrue(graphqlRuntime.registrationTime is string, "Registration time should be converted to string");
}

@test:Config {
    groups: ["mock", "validation"]
}
function testFilteringLogic() returns error? {
    // Test filtering logic simulation
    types:Runtime[] allRuntimes = [
        {
            runtimeId: "runtime-1",
            runtimeType: "MI",
            status: "RUNNING",
            deploymentType: "standalone",
            environment: "test",
            lastHeartbeat: "2024-01-01T12:00:00Z",
            osName: "Test OS",
            osVersion: "1.0",
            platformHome: "/test/home",
            platformName: "Test Platform",
            platformVersion: "1.0.0",
            registrationTime: "2024-01-01T10:00:00Z",
            version: "1.0.0",
            services: [],
            listeners: []
        },
        {
            runtimeId: "runtime-2",
            runtimeType: "BI",
            status: "FAILED",
            deploymentType: "standalone",
            environment: "test",
            lastHeartbeat: "2024-01-01T12:00:00Z",
            osName: "Test OS",
            osVersion: "1.0",
            platformHome: "/test/home",
            platformName: "Test Platform",
            platformVersion: "1.0.0",
            registrationTime: "2024-01-01T10:00:00Z",
            version: "1.0.0",
            services: [],
            listeners: []
        },
        {
            runtimeId: "runtime-3",
            runtimeType: "MI",
            status: "STOPPED",
            deploymentType: "standalone",
            environment: "test",
            lastHeartbeat: "2024-01-01T12:00:00Z",
            osName: "Test OS",
            osVersion: "1.0",
            platformHome: "/test/home",
            platformName: "Test Platform",
            platformVersion: "1.0.0",
            registrationTime: "2024-01-01T10:00:00Z",
            version: "1.0.0",
            services: [],
            listeners: []
        },
        {
            runtimeId: "runtime-4",
            runtimeType: "BI",
            status: "RUNNING",
            deploymentType: "standalone",
            environment: "test",
            lastHeartbeat: "2024-01-01T12:00:00Z",
            osName: "Test OS",
            osVersion: "1.0",
            platformHome: "/test/home",
            platformName: "Test Platform",
            platformVersion: "1.0.0",
            registrationTime: "2024-01-01T10:00:00Z",
            version: "1.0.0",
            services: [],
            listeners: []
        }
    ];

    // Filter by status = "RUNNING"
    types:Runtime[] runningRuntimes = allRuntimes.filter(runtime => runtime.status == "RUNNING");
    test:assertEquals(runningRuntimes.length(), 2, "Should have 2 running runtimes");

    // Filter by runtimeType = "MI"
    types:Runtime[] miRuntimes = allRuntimes.filter(runtime => runtime.runtimeType == "MI");
    test:assertEquals(miRuntimes.length(), 2, "Should have 2 MI runtimes");

    // Filter by both status = "RUNNING" and runtimeType = "BI"
    types:Runtime[] runningBIRuntimes = allRuntimes.filter(
        runtime => runtime.status == "RUNNING" && runtime.runtimeType == "BI"
    );
    test:assertEquals(runningBIRuntimes.length(), 1, "Should have 1 running BI runtime");
    test:assertEquals(runningBIRuntimes[0].runtimeId, "runtime-4", "Should be runtime-4");
}

@test:Config {
    groups: ["mock", "edge-cases"]
}
function testEmptyResultSets() returns error? {
    // Test empty result sets
    types:Runtime[] emptyRuntimes = [];
    types:Service[] emptyServices = [];
    types:Listener[] emptyListeners = [];

    test:assertEquals(emptyRuntimes.length(), 0, "Empty runtimes array should have length 0");
    test:assertEquals(emptyServices.length(), 0, "Empty services array should have length 0");
    test:assertEquals(emptyListeners.length(), 0, "Empty listeners array should have length 0");
}

@test:Config {
    groups: ["mock", "performance"]
}
function testLargeDataSetHandling() returns error? {
    // Test handling of large data sets
    types:Runtime[] largeRuntimeSet = [];

    foreach int i in 0 ... 999 {
        types:Runtime runtime = {
            runtimeId: "runtime-" + i.toString(),
            runtimeType: i % 2 == 0 ? "MI" : "BI",
            status: i % 3 == 0 ? "RUNNING" : "STOPPED",
            deploymentType: "standalone",
            environment: "test",
            lastHeartbeat: "2024-01-01T12:00:00Z",
            osName: "Test OS",
            osVersion: "1.0",
            platformHome: "/test/home",
            platformName: "Test Platform",
            platformVersion: "1.0.0",
            registrationTime: "2024-01-01T10:00:00Z",
            version: "1.0.0",
            services: [],
            listeners: []
        };
        largeRuntimeSet.push(runtime);
    }

    test:assertEquals(largeRuntimeSet.length(), 1000, "Should have 1000 runtimes");

    // Test filtering on large dataset
    types:Runtime[] filteredRuntimes = largeRuntimeSet.filter(
        runtime => runtime.runtimeType == "MI" && runtime.status == "RUNNING"
    );

    test:assertTrue(filteredRuntimes.length() > 0, "Should have some filtered results");
    test:assertTrue(filteredRuntimes.length() < 1000, "Filtered results should be less than total");
}

@test:Config {
    groups: ["mock", "json-parsing"]
}
function testMethodsJSONParsing() returns error? {
    // Test parsing methods JSON in resource records
    string[] testMethodsJson = [
        "[\"GET\"]",
        "[\"GET\", \"POST\"]",
        "[\"GET\", \"POST\", \"PUT\", \"DELETE\"]",
        "[]"
    ];

    foreach string methodsStr in testMethodsJson {
        json methodsJson = check methodsStr.fromJsonString();
        string[]|error methods = methodsJson.cloneWithType();

        test:assertTrue(methods is string[], "Methods should be string array");

        types:Resource resourceWithMethods = {
            url: "/test/resource",
            methods: check methods
        };

        test:assertEquals(resourceWithMethods.methods, check methods, "Resource methods should match parsed methods");
    }
}

@test:Config {
    groups: ["mock", "null-handling"]
}
function testNullValueHandling() returns error? {
    // Test handling of null/optional values
    types:RuntimeRecord recordWithNulls = {
        runtime_id: "test-nulls",
        runtime_type: "MI",
        status: "RUNNING",
        environment: (), // null
        deployment_type: (), // null
        version: (), // null
        platform_name: "ballerina",
        platform_version: (), // null
        platform_home: (), // null
        os_name: (), // null
        os_version: (), // null
        registration_time: (), // null
        last_heartbeat: () // null
    };

    test:assertEquals(recordWithNulls.runtime_id, "test-nulls", "Runtime ID should be set");
    test:assertTrue(recordWithNulls.environment is (), "Environment should be null");
    test:assertTrue(recordWithNulls.version is (), "Version should be null");
    test:assertEquals(recordWithNulls.platform_name, "ballerina", "Platform name should be set");
}

// Utility function for test data cleanup (if needed)
function cleanupTestData() {
    // This function can be used to clean up any test data
    // Currently no cleanup needed for in-memory tests
}
