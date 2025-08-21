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

import icp_server.storage;
import icp_server.types;

import ballerina/graphql;
import ballerina/sql;
import ballerina/time;

// GraphQL listener configuration
listener graphql:Listener graphqlListener = new (graphqlPort,
    secureSocket = {
        key: {
            path: keystorePath,
            password: keystorePassword
        }
    }
);

// GraphQL service for runtime details
service /graphql on graphqlListener {

    // Get all runtimes with optional filtering
    isolated resource function get runtimes(string? status, string? runtimeType) returns types:Runtime[]|error {
        sql:Client dbClient = storage:dbClient;
        types:Runtime[] runtimeList = [];

        // Build dynamic query based on filters
        sql:ParameterizedQuery query;

        if status is string && runtimeType is string {
            query = `SELECT runtime_id, runtime_type, status, environment, deployment_type, version, 
                     platform_name, platform_version, platform_home, os_name, os_version, 
                     registration_time, last_heartbeat FROM runtimes 
                     WHERE status = ${status} AND runtime_type = ${runtimeType} 
                     ORDER BY registration_time DESC`;
        } else if status is string {
            query = `SELECT runtime_id, runtime_type, status, environment, deployment_type, version, 
                     platform_name, platform_version, platform_home, os_name, os_version, 
                     registration_time, last_heartbeat FROM runtimes 
                     WHERE status = ${status} 
                     ORDER BY registration_time DESC`;
        } else if runtimeType is string {
            query = `SELECT runtime_id, runtime_type, status, environment, deployment_type, version, 
                     platform_name, platform_version, platform_home, os_name, os_version, 
                     registration_time, last_heartbeat FROM runtimes 
                     WHERE runtime_type = ${runtimeType} 
                     ORDER BY registration_time DESC`;
        } else {
            query = `SELECT runtime_id, runtime_type, status, environment, deployment_type, version, 
                     platform_name, platform_version, platform_home, os_name, os_version, 
                     registration_time, last_heartbeat FROM runtimes 
                     ORDER BY registration_time DESC`;
        }

        stream<types:RuntimeRecord, sql:Error?> runtimeStream = dbClient->query(query);

        check from types:RuntimeRecord runtimeRecord in runtimeStream
            do {
                types:Runtime runtime = check mapToRuntime(runtimeRecord);
                runtimeList.push(runtime);
            };

        return runtimeList;
    }

    // Get a specific runtime by ID
    isolated resource function get runtime(string runtimeId) returns types:Runtime?|error {
        sql:Client dbClient = storage:dbClient;

        stream<types:RuntimeRecord, sql:Error?> runtimeStream = dbClient->query(`
            SELECT runtime_id, runtime_type, status, environment, deployment_type, version, 
                   platform_name, platform_version, platform_home, os_name, os_version, 
                   registration_time, last_heartbeat 
            FROM runtimes 
            WHERE runtime_id = ${runtimeId}
        `);

        types:RuntimeRecord[] runtimeRecords = check from types:RuntimeRecord runtimeRecord in runtimeStream
            select runtimeRecord;

        if runtimeRecords.length() == 0 {
            return ();
        }

        return check mapToRuntime(runtimeRecords[0]);
    }

    // Get services for a specific runtime
    isolated resource function get services(string runtimeId) returns types:Service[]|error {
        sql:Client dbClient = storage:dbClient;
        types:Service[] serviceList = [];

        stream<types:ServiceRecordInDB, sql:Error?> serviceStream = dbClient->query(`
            SELECT service_name, service_package, base_path, state 
            FROM runtime_services 
            WHERE runtime_id = ${runtimeId}
        `);

        check from types:ServiceRecordInDB serviceRecord in serviceStream
            do {
                types:Service serviceItem = check mapToService(serviceRecord, runtimeId);
                serviceList.push(serviceItem);
            };

        return serviceList;
    }

    // Get listeners for a specific runtime
    isolated resource function get listeners(string runtimeId) returns types:Listener[]|error {
        sql:Client dbClient = storage:dbClient;
        types:Listener[] listenerList = [];

        stream<types:ListenerRecordInDB, sql:Error?> listenerStream = dbClient->query(`
            SELECT listener_name, listener_package, protocol, state 
            FROM runtime_listeners 
            WHERE runtime_id = ${runtimeId}
        `);

        check from types:ListenerRecordInDB listenerRecord in listenerStream
            do {
                types:Listener listenerItem = {
                    name: listenerRecord.listener_name,
                    package: listenerRecord.listener_package,
                    protocol: listenerRecord.protocol,
                    state: listenerRecord.state
                };
                listenerList.push(listenerItem);
            };

        return listenerList;
    }
}

// Helper function to map database record to Runtime type
isolated function mapToRuntime(types:RuntimeRecord runtimeRecord) returns types:Runtime|error {
    sql:Client dbClient = storage:dbClient;

    // Get services for this runtime
    types:Service[] serviceList = [];
    stream<types:ServiceRecordInDB, sql:Error?> serviceStream = dbClient->query(`
        SELECT service_name, service_package, base_path, state 
        FROM runtime_services 
        WHERE runtime_id = ${runtimeRecord.runtime_id}
    `);

    check from types:ServiceRecordInDB serviceRecord in serviceStream
        do {
            types:Service serviceItem = check mapToService(serviceRecord, runtimeRecord.runtime_id);
            serviceList.push(serviceItem);
        };

    // Get listeners for this runtime
    types:Listener[] listenerList = [];
    stream<types:ListenerRecordInDB, sql:Error?> listenerStream = dbClient->query(`
        SELECT listener_name, listener_package, protocol, state 
        FROM runtime_listeners 
        WHERE runtime_id = ${runtimeRecord.runtime_id}
    `);

    check from types:ListenerRecordInDB listenerRecord in listenerStream
        do {
            types:Listener listenerItem = {
                name: listenerRecord.listener_name,
                package: listenerRecord.listener_package,
                protocol: listenerRecord.protocol,
                state: listenerRecord.state
            };
            listenerList.push(listenerItem);
        };

    // Convert time values to string format
    string? registrationTimeStr = ();
    time:Utc? regTime = runtimeRecord.registration_time;
    if regTime is time:Utc {
        registrationTimeStr = time:utcToString(regTime);
    }

    string? lastHeartbeatStr = ();
    time:Utc? heartbeatTime = runtimeRecord.last_heartbeat;
    if heartbeatTime is time:Utc {
        lastHeartbeatStr = time:utcToString(heartbeatTime);
    }

    return {
        runtimeId: runtimeRecord.runtime_id,
        runtimeType: runtimeRecord.runtime_type,
        status: runtimeRecord.status,
        environment: runtimeRecord.environment,
        deploymentType: runtimeRecord.deployment_type,
        version: runtimeRecord.version,
        platformName: runtimeRecord.platform_name,
        platformVersion: runtimeRecord.platform_version,
        platformHome: runtimeRecord.platform_home,
        osName: runtimeRecord.os_name,
        osVersion: runtimeRecord.os_version,
        registrationTime: registrationTimeStr,
        lastHeartbeat: lastHeartbeatStr,
        services: serviceList,
        listeners: listenerList
    };
}

// Helper function to map service record and get resources
isolated function mapToService(types:ServiceRecordInDB serviceRecord, string runtimeId) returns types:Service|error {
    sql:Client dbClient = storage:dbClient;

    // Get resources for this service
    types:Resource[] resourceList = [];
    stream<types:ResourceRecord, sql:Error?> resourceStream = dbClient->query(`
        SELECT resource_url, methods 
        FROM service_resources 
        WHERE runtime_id = ${runtimeId} AND service_name = ${serviceRecord.service_name}
    `);

    check from types:ResourceRecord resourceRecord in resourceStream
        do {
            // Parse methods JSON string to array
            json methodsJson = check resourceRecord.methods.fromJsonString();
            string[] methods = check methodsJson.cloneWithType();

            types:Resource resourceItem = {
                url: resourceRecord.resource_url,
                methods: methods
            };
            resourceList.push(resourceItem);
        };
    return {
        name: serviceRecord.service_name,
        package: serviceRecord.service_package,
        basePath: serviceRecord.base_path,
        resources: resourceList
    };
}
