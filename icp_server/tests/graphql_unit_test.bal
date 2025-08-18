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

@test:Config {
    groups: ["unit", "types"]
}
function testRuntimeRecordCreation() returns error? {
    // Test RuntimeRecord type creation
    time:Utc currentTime = time:utcNow();

    types:RuntimeRecord runtimeRecord = {
        runtime_id: "test-runtime-123",
        runtime_type: "MI",
        status: "RUNNING",
        environment: "development",
        deployment_type: "standalone",
        version: "1.0.0",
        platform_name: "ballerina",
        platform_version: "2201.7.0",
        platform_home: "/opt/ballerina",
        os_name: "Linux",
        os_version: "Ubuntu 20.04",
        registration_time: currentTime,
        last_heartbeat: currentTime
    };

    test:assertEquals(runtimeRecord.runtime_id, "test-runtime-123", "Runtime ID should match");
    test:assertEquals(runtimeRecord.runtime_type, "MI", "Runtime type should match");
    test:assertEquals(runtimeRecord.status, "RUNNING", "Status should match");
    test:assertTrue(runtimeRecord.registration_time is time:Utc, "Registration time should be UTC");
}

@test:Config {
    groups: ["unit", "types"]
}
function testServiceRecordCreation() returns error? {
    // Test ServiceRecord type creation
    types:ServiceRecord serviceRecord = {
        name: "TestService",
        package: "com.example.test",
        basePath: "/api/v1",
        state: "ENABLED"
    };

    test:assertEquals(serviceRecord.name, "TestService", "Service name should match");
    test:assertEquals(serviceRecord.package, "com.example.test", "Service package should match");
    test:assertEquals(serviceRecord.basePath, "/api/v1", "Base path should match");
    test:assertEquals(serviceRecord.state, "ENABLED", "State should match");
}

@test:Config {
    groups: ["unit", "types"]
}
function testListenerRecordCreation() returns error? {
    // Test ListenerRecord type creation
    types:ListenerRecord listenerRecord = {
        listener_name: "HttpListener",
        listener_package: "com.example.listener",
        protocol: "HTTP",
        state: "ENABLED"
    };

    test:assertEquals(listenerRecord.listener_name, "HttpListener", "Listener name should match");
    test:assertEquals(listenerRecord.listener_package, "com.example.listener", "Listener package should match");
    test:assertEquals(listenerRecord.protocol, "HTTP", "Protocol should match");
    test:assertEquals(listenerRecord.state, "ENABLED", "State should match");
}

@test:Config {
    groups: ["unit", "types"]
}
function testResourceRecordCreation() returns error? {
    // Test ResourceRecord type creation
    types:ResourceRecord resourceRecord = {
        resource_url: "/api/users/{id}",
        methods: "[\"GET\", \"PUT\", \"DELETE\"]"
    };

    test:assertEquals(resourceRecord.resource_url, "/api/users/{id}", "Resource URL should match");
    test:assertEquals(resourceRecord.methods, "[\"GET\", \"PUT\", \"DELETE\"]", "Methods should match");
}

@test:Config {
    groups: ["unit", "types"]
}
function testRuntimeTypeCreation() returns error? {
    // Test Runtime GraphQL response type creation
    types:Runtime runtime = {
        runtimeId: "test-runtime-456",
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
        services: [],
        listeners: []
    };

    test:assertEquals(runtime.runtimeId, "test-runtime-456", "Runtime ID should match");
    test:assertEquals(runtime.runtimeType, "BI", "Runtime type should match");
    test:assertEquals(runtime.status, "RUNNING", "Status should match");
    test:assertEquals(runtime.services.length(), 0, "Services array should be empty");
    test:assertEquals(runtime.listeners.length(), 0, "Listeners array should be empty");
}

@test:Config {
    groups: ["unit", "types"]
}
function testServiceTypeWithResources() returns error? {
    // Test Service GraphQL response type with resources
    types:Resource[] resources = [
        {
            url: "/api/users",
            methods: ["GET", "POST"]
        },
        {
            url: "/api/users/{id}",
            methods: ["GET", "PUT", "DELETE"]
        }
    ];

    types:Service serviceType = {
        name: "UserService",
        package: "com.example.user",
        basePath: "/api",
        state: "ENABLED",
        resources: resources
    };

    test:assertEquals(serviceType.name, "UserService", "Service name should match");
    test:assertEquals(serviceType.package, "com.example.user", "Service package should match");
    test:assertEquals(serviceType.basePath, "/api", "Base path should match");
    test:assertEquals(serviceType.resources.length(), 2, "Should have 2 resources");
    test:assertEquals(serviceType.resources[0].url, "/api/users", "First resource URL should match");
    test:assertEquals(serviceType.resources[1].methods.length(), 3, "Second resource should have 3 methods");
}

@test:Config {
    groups: ["unit", "types"]
}
function testListenerType() returns error? {
    // Test Listener GraphQL response type
    types:Listener listenerType = {
        name: "HTTPSListener",
        package: "com.example.https",
        protocol: "HTTPS",
        state: "ENABLED"
    };

    test:assertEquals(listenerType.name, "HTTPSListener", "Listener name should match");
    test:assertEquals(listenerType.package, "com.example.https", "Listener package should match");
    test:assertEquals(listenerType.protocol, "HTTPS", "Protocol should match");
    test:assertEquals(listenerType.state, "ENABLED", "State should match");
}

@test:Config {
    groups: ["unit", "validation"]
}
function testRuntimeTypeValidation() returns error? {
    // Test runtime type validation
    types:Runtime runtime = {
        runtimeId: "test-runtime-validation",
        runtimeType: "MI", // Valid runtime type
        status: "RUNNING", // Valid status
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

    test:assertTrue(runtime.runtimeType == "MI" || runtime.runtimeType == "BI",
            "Runtime type should be MI or BI");
    test:assertTrue(runtime.status is string, "Status should be a string");
    test:assertTrue(runtime.runtimeId.length() > 0, "Runtime ID should not be empty");
}

@test:Config {
    groups: ["unit", "validation"]
}
function testStatusValidation() returns error? {
    // Test valid status values
    string[] validStatuses = ["RUNNING", "FAILED", "DISABLED", "OFFLINE", "STOPPED"];

    foreach string status in validStatuses {
        types:Runtime runtime = {
            runtimeId: "test-runtime-" + status.toLowerAscii(),
            runtimeType: "MI",
            status: status,
            services: [],
            listeners: [],
            deploymentType: "standalone",
            environment: "test",
            lastHeartbeat: "2024-01-01T12:00:00Z",
            osName: "Test OS",
            osVersion: "1.0",
            platformHome: "/test/home",
            platformName: "Test Platform",
            platformVersion: "1.0.0",
            registrationTime: "2024-01-01T10:00:00Z",
            version: "1.0.0"
        };

        test:assertEquals(runtime.status, status, "Status should match the set value");
        test:assertTrue(validStatuses.indexOf(runtime.status) != (),
                "Status should be one of the valid values");
    }
}

@test:Config {
    groups: ["unit", "json"]
}
function testJSONMethodsParsing() returns error? {
    // Test parsing JSON methods string to array
    string methodsJsonString = "[\"GET\", \"POST\", \"PUT\", \"DELETE\"]";

    json methodsJson = check methodsJsonString.fromJsonString();
    string[] methods = check methodsJson.cloneWithType();

    test:assertEquals(methods.length(), 4, "Should have 4 methods");
    test:assertEquals(methods[0], "GET", "First method should be GET");
    test:assertEquals(methods[1], "POST", "Second method should be POST");
    test:assertEquals(methods[2], "PUT", "Third method should be PUT");
    test:assertEquals(methods[3], "DELETE", "Fourth method should be DELETE");
}

@test:Config {
    groups: ["unit", "json"]
}
function testEmptyJSONMethodsParsing() returns error? {
    // Test parsing empty JSON methods array
    string methodsJsonString = "[]";

    json methodsJson = check methodsJsonString.fromJsonString();
    string[] methods = check methodsJson.cloneWithType();

    test:assertEquals(methods.length(), 0, "Empty methods array should have length 0");
}

@test:Config {
    groups: ["unit", "json"]
}
function testInvalidJSONMethodsParsing() returns error? {
    // Test invalid JSON methods string
    string invalidMethodsJsonString = "invalid json";

    json|error methodsJson = invalidMethodsJsonString.fromJsonString();
    test:assertTrue(methodsJson is error, "Invalid JSON should result in error");
}

@test:Config {
    groups: ["unit", "edge-cases"]
}
function testEmptyRuntimeId() returns error? {
    // Test with empty runtime ID
    types:Runtime runtime = {
        runtimeId: "",
        runtimeType: "MI",
        status: "RUNNING",
        services: [],
        listeners: [],
        deploymentType: "standalone",
        environment: "test",
        lastHeartbeat: "2024-01-01T12:00:00Z",
        osName: "Test OS",
        osVersion: "1.0",
        platformHome: "/test/home",
        platformName: "Test Platform",
        platformVersion: "1.0.0",
        registrationTime: "2024-01-01T10:00:00Z",
        version: "1.0.0"
    };

    test:assertEquals(runtime.runtimeId, "", "Runtime ID should be empty string");
    test:assertEquals(runtime.runtimeId.length(), 0, "Runtime ID length should be 0");
}

@test:Config {
    groups: ["unit", "edge-cases"]
}
function testNullableFields() returns error? {
    // Test nullable fields in RuntimeRecord
    types:RuntimeRecord runtimeRecord = {
        runtime_id: "test-runtime-null-fields",
        runtime_type: "BI",
        status: "RUNNING",
        environment: (), // null
        deployment_type: (), // null
        version: (), // null
        platform_name: (), // null
        platform_version: (), // null
        platform_home: (), // null
        os_name: (), // null
        os_version: (), // null
        registration_time: (), // null
        last_heartbeat: () // null
    };

    test:assertEquals(runtimeRecord.runtime_id, "test-runtime-null-fields", "Runtime ID should match");
    test:assertTrue(runtimeRecord.environment is (), "Environment should be null");
    test:assertTrue(runtimeRecord.version is (), "Version should be null");
    test:assertTrue(runtimeRecord.registration_time is (), "Registration time should be null");
}

@test:Config {
    groups: ["unit", "edge-cases"]
}
function testLargeDataSets() returns error? {
    // Test with large number of services and listeners
    types:Service[] services = [];
    types:Listener[] listeners = [];

    // Create 100 services
    foreach int i in 0 ... 99 {
        types:Service serviceType = {
            name: "Service" + i.toString(),
            package: "com.example.service" + i.toString(),
            basePath: "/api/v" + i.toString(),
            state: "ENABLED",
            resources: []
        };
        services.push(serviceType);
    }

    // Create 50 listeners
    foreach int i in 0 ... 49 {
        types:Listener listenerType = {
            name: "Listener" + i.toString(),
            package: "com.example.listener" + i.toString(),
            protocol: "HTTP",
            state: "ENABLED"
        };
        listeners.push(listenerType);
    }

    types:Runtime runtime = {
        runtimeId: "test-runtime-large",
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
        services: services,
        listeners: listeners
    };

    test:assertEquals(runtime.services.length(), 100, "Should have 100 services");
    test:assertEquals(runtime.listeners.length(), 50, "Should have 50 listeners");
}
