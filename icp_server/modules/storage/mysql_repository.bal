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

import icp_server.types as types;

import ballerina/cache;
import ballerina/log;
import ballerina/sql;
import ballerina/time;

final DatabaseConnectionManager dbManager = check new (dbType);
public final sql:Client dbClient = dbManager.getClient();

// Cache for storing runtime hash values
final cache:Cache hashCache = new (capacity = 1000, evictionFactor = 0.2);

// Heartbeat timeout in seconds from main module config
configurable int heartbeatTimeoutSeconds = 300;

// Get all runtimes with optional filtering
public isolated function getRuntimes(string? status, string? runtimeType, string? environment) returns types:Runtime[]|error {
    types:Runtime[] runtimeList = [];
    sql:ParameterizedQuery whereClause = ` WHERE 1=1 `;
    sql:ParameterizedQuery whereConditions = ` `;
    if status is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND status = ${status} `);
    } else if runtimeType is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND runtime_type = ${runtimeType} `);
    } else if environment is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND environment = ${environment} `);
    }
    sql:ParameterizedQuery selectClause = ` SELECT runtime_id, runtime_type, status, environment, version, 
                 platform_name, platform_version, platform_home, os_name, os_version, 
                 registration_time, last_heartbeat FROM runtimes `;
    sql:ParameterizedQuery orderByClause = ` ORDER BY registration_time DESC `;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, whereClause, whereConditions, orderByClause);
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(query);

    check from types:RuntimeDBRecord runtimeRecord in runtimeStream
        do {
            types:Runtime runtime = check mapToRuntime(runtimeRecord);
            runtimeList.push(runtime);
        };

    return runtimeList;
}

// Get a specific runtime by ID
public isolated function getRuntimeById(string runtimeId) returns types:Runtime?|error {
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(`
        SELECT runtime_id, runtime_type, status, environment, version, 
               platform_name, platform_version, platform_home, os_name, os_version, 
               registration_time, last_heartbeat 
        FROM runtimes 
        WHERE runtime_id = ${runtimeId}
    `);

    types:RuntimeDBRecord[] runtimeRecords = check from types:RuntimeDBRecord runtimeRecord in runtimeStream
        select runtimeRecord;

    if runtimeRecords.length() == 0 {
        return ();
    }

    return check mapToRuntime(runtimeRecords[0]);
}

// Get services for a specific runtime
public isolated function getServicesForRuntime(string runtimeId) returns types:Service[]|error {
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
public isolated function getListenersForRuntime(string runtimeId) returns types:Listener[]|error {
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

// Helper function to map database record to Runtime type
public isolated function mapToRuntime(types:RuntimeDBRecord runtimeRecord) returns types:Runtime|error {
    // Get services for this runtime
    types:Service[] serviceList = check getServicesForRuntime(runtimeRecord.runtime_id);

    // Get listeners for this runtime
    types:Listener[] listenerList = check getListenersForRuntime(runtimeRecord.runtime_id);

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
public isolated function mapToService(types:ServiceRecordInDB serviceRecord, string runtimeId) returns types:Service|error {
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

// Helper function to convert time:Utc to MySQL datetime format
isolated function utcToMySQLDateTime(time:Utc utcTime) returns string|error {
    time:Civil civilTime = time:utcToCivil(utcTime);
    // Format: YYYY-MM-DD HH:MM:SS
    string formattedTime = string `${civilTime.year}-${civilTime.month.toString().padStart(2, "0")}-${civilTime.day.toString().padStart(2, "0")} ${civilTime.hour.toString().padStart(2, "0")}:${civilTime.minute.toString().padStart(2, "0")}:${(<int>civilTime.second).toString().padStart(2, "0")}`;
    return formattedTime;
}

// Periodically mark runtimes as OFFLINE if heartbeat is too old
public isolated function markOfflineRuntimes() returns error? {
    log:printDebug("Marking offline runtimes");
    time:Utc now = time:utcNow();
    // Calculate the threshold timestamp
    time:Utc threshold = time:utcAddSeconds(now, -<decimal>heartbeatTimeoutSeconds);

    // Convert threshold to MySQL datetime format
    string thresholdStr = check utcToMySQLDateTime(threshold);

    // Update all runtimes whose last_heartbeat is too old and not already OFFLINE
    sql:ParameterizedQuery updateQuery = `
        UPDATE runtimes
        SET status = 'OFFLINE'
        WHERE status != 'OFFLINE'
        AND last_heartbeat IS NOT NULL
        AND last_heartbeat < ${thresholdStr}
    `;
    sql:ExecutionResult _ = check dbClient->execute(updateQuery);
}

// Process delta heartbeat with hash validation
public isolated function processDeltaHeartbeat(types:DeltaHeartbeat deltaHeartbeat) returns types:HeartbeatResponse|error {
    // Validate delta heartbeat data
    if deltaHeartbeat.runtimeId.trim().length() == 0 {
        return error("Runtime ID cannot be empty");
    }

    time:Utc currentTime = time:utcNow();
    string currentTimeStr = check utcToMySQLDateTime(currentTime);
    types:ControlCommand[] pendingCommands = [];
    boolean hashMatches = false;

    if hashCache.hasKey(deltaHeartbeat.runtimeId) {
        any|error cachedHash = hashCache.get(deltaHeartbeat.runtimeId);
        hashMatches = cachedHash is string && cachedHash == deltaHeartbeat.runtimeHash;
        log:printInfo(string `Hash for runtime ${deltaHeartbeat.runtimeId} matches: ${hashMatches}`);
    }

    if !hashMatches {
        // Hash doesn't match or runtime not in cache, request full heartbeat
        log:printInfo(string `Hash mismatch for runtime ${deltaHeartbeat.runtimeId}, requesting full heartbeat`);

        // Still update the timestamp to show runtime is alive
        transaction {
            sql:ExecutionResult _ = check dbClient->execute(`
                UPDATE runtimes 
                SET last_heartbeat = ${currentTimeStr}
                WHERE runtime_id = ${deltaHeartbeat.runtimeId}
            `);

            check commit;
        } on fail error e {
            log:printError(string `Failed to update timestamp for runtime ${deltaHeartbeat.runtimeId}`, e);
            return error(string `Failed to process delta heartbeat for runtime ${deltaHeartbeat.runtimeId}`, e);
        }

        return {
            acknowledged: true,
            fullHeartbeatRequired: true,
            commands: []
        };
    }

    // Hash matches, process delta heartbeat
    transaction {
        // Update only the heartbeat timestamp
        sql:ExecutionResult _ = check dbClient->execute(`
            UPDATE runtimes 
            SET last_heartbeat = ${currentTimeStr}
            WHERE runtime_id = ${deltaHeartbeat.runtimeId}
        `);

        // Retrieve pending control commands for this runtime
        stream<types:ControlCommand, sql:Error?> commandStream = dbClient->query(`
            SELECT command_id, runtime_id, target_artifact, action, issued_at, status
            FROM control_commands 
            WHERE runtime_id = ${deltaHeartbeat.runtimeId} 
            AND status = 'pending'
            ORDER BY issued_at ASC
        `);

        check from types:ControlCommand command in commandStream
            do {
                pendingCommands.push(command);
            };

        // Mark retrieved commands as 'sent'
        if pendingCommands.length() > 0 {
            foreach types:ControlCommand command in pendingCommands {
                _ = check dbClient->execute(`
                    UPDATE control_commands 
                    SET status = 'sent' 
                    WHERE command_id = ${command.commandId}
                `);
            }
        }

        // Create audit log entry
        _ = check dbClient->execute(`
            INSERT INTO audit_logs (
                runtime_id, action, details, timestamp
            ) VALUES (
                ${deltaHeartbeat.runtimeId}, 'DELTA_HEARTBEAT', 
                ${string `Delta heartbeat processed with hash ${deltaHeartbeat.runtimeHash}`},
                ${currentTimeStr}
            )
        `);

        check commit;
        log:printInfo(string `Successfully processed delta heartbeat for runtime ${deltaHeartbeat.runtimeId}`);

    } on fail error e {
        log:printError(string `Failed to process delta heartbeat for runtime ${deltaHeartbeat.runtimeId}`, e);
        return error(string `Failed to process delta heartbeat for runtime ${deltaHeartbeat.runtimeId}`, e);
    }

    return {
        acknowledged: true,
        fullHeartbeatRequired: false,
        commands: pendingCommands
    };
}

// Heartbeat processing that handles both registration and updates
public isolated function processHeartbeat(types:Heartbeat heartbeat) returns types:HeartbeatResponse|error {

    time:Utc currentTime = time:utcNow();
    string currentTimeStr = check utcToMySQLDateTime(currentTime);
    boolean isNewRegistration = false;
    types:ControlCommand[] pendingCommands = [];

    // Start transaction for heartbeat processing
    transaction {
        // Check if runtime exists
        stream<record {|string runtime_id;|}, sql:Error?> existingRuntimeStream = dbClient->query(`
            SELECT runtime_id FROM runtimes WHERE runtime_id = ${heartbeat.runtimeId}
        `);

        record {|string runtime_id;|}[] existingRuntimes = check from record {|string runtime_id;|} existingRuntime in existingRuntimeStream
            select existingRuntime;

        isNewRegistration = existingRuntimes.length() == 0;

        if isNewRegistration {
            // Register new runtime
            sql:ExecutionResult _ = check dbClient->execute(`
                INSERT INTO runtimes (
                    runtime_id, runtime_type, status, environment, version, platform_name, 
                    platform_version, platform_home, os_name,
                    os_version, registration_time, last_heartbeat
                ) VALUES (
                    ${heartbeat.runtimeId}, ${heartbeat.runtimeType}, 
                    ${heartbeat.status}, ${heartbeat.environment}, 
                    ${heartbeat.version},
                    ${heartbeat.nodeInfo.platformName}, ${heartbeat.nodeInfo.platformVersion},
                    ${heartbeat.nodeInfo.ballerinaHome}, ${heartbeat.nodeInfo.osName},
                    ${heartbeat.nodeInfo.osVersion}, ${currentTimeStr},
                    ${currentTimeStr}
                )
            `);

            // TODO: Uncomment the following lines when https://github.com/ballerina-platform/ballerina-lang/issues/44219 fixed
            // if insertResult.affectedRowCount == 0 {
            //     rollback;
            //     return error(string `Failed to register runtime ${heartbeat.runtimeId}`);
            // }

            log:printInfo(string `Registered new runtime via heartbeat: ${heartbeat.runtimeId}`);
        } else {
            // Update existing runtime
            sql:ExecutionResult _ = check dbClient->execute(`
                UPDATE runtimes 
                SET status = ${heartbeat.status}, 
                    runtime_type = ${heartbeat.runtimeType},
                    environment = ${heartbeat.environment},
                    version = ${heartbeat.version},
                    platform_name = ${heartbeat.nodeInfo.platformName},
                    platform_version = ${heartbeat.nodeInfo.platformVersion},
                    platform_home = ${heartbeat.nodeInfo.ballerinaHome},
                    os_name = ${heartbeat.nodeInfo.osName},
                    os_version = ${heartbeat.nodeInfo.osVersion},
                    last_heartbeat = ${currentTimeStr}
                WHERE runtime_id = ${heartbeat.runtimeId}
            `);

            // TODO: Uncomment the following lines when https://github.com/ballerina-platform/ballerina-lang/issues/44219 fixed
            // if updateResult.affectedRowCount == 0 {
            //     rollback;
            //     return error(string `Failed to update runtime ${heartbeat.runtimeId}`);
            // }
            log:printInfo(string `Updated runtime via heartbeat: ${heartbeat.runtimeId}`);
        }

        // Update artifacts information (services and listeners)
        // First, delete existing artifacts for this runtime
        _ = check dbClient->execute(`
            DELETE FROM runtime_services WHERE runtime_id = ${heartbeat.runtimeId}
        `);

        _ = check dbClient->execute(`
            DELETE FROM runtime_listeners WHERE runtime_id = ${heartbeat.runtimeId}
        `);

        _ = check dbClient->execute(`
            DELETE FROM service_resources WHERE runtime_id = ${heartbeat.runtimeId}
        `);

        // Insert updated services
        foreach types:ServiceDetail serviceDetail in heartbeat.artifacts.services {
            _ = check dbClient->execute(`
                INSERT INTO runtime_services (
                    runtime_id, service_name, service_package, base_path, state
                ) VALUES (
                    ${heartbeat.runtimeId}, ${serviceDetail.name}, 
                    ${serviceDetail.package}, ${serviceDetail.basePath}, 
                    ${serviceDetail.state}
                )
            `);

            // Insert resources for each service
            foreach types:Resource resourceDetail in serviceDetail.resources {
                string methodsJson = resourceDetail.methods.toJsonString();
                _ = check dbClient->execute(`
                    INSERT INTO service_resources (
                        runtime_id, service_name, resource_url, methods
                    ) VALUES (
                        ${heartbeat.runtimeId}, ${serviceDetail.name}, 
                        ${resourceDetail.url}, ${methodsJson}
                    )
                `);
            }
        }

        // Insert updated listeners
        foreach types:ListenerDetail listenerDetail in heartbeat.artifacts.listeners {
            _ = check dbClient->execute(`
                INSERT INTO runtime_listeners (
                    runtime_id, listener_name, listener_package, protocol, state
                ) VALUES (
                    ${heartbeat.runtimeId}, ${listenerDetail.name}, 
                    ${listenerDetail.package}, ${listenerDetail.protocol}, 
                    ${listenerDetail.state}
                )
            `);
        }

        // Retrieve pending control commands for this runtime
        stream<types:ControlCommand, sql:Error?> commandStream = dbClient->query(`
            SELECT command_id, runtime_id, target_artifact, action, issued_at, status
            FROM control_commands 
            WHERE runtime_id = ${heartbeat.runtimeId} 
            AND status = 'pending'
            ORDER BY issued_at ASC
        `);

        check from types:ControlCommand command in commandStream
            do {
                pendingCommands.push(command);
            };

        // Mark retrieved commands as 'sent'
        if pendingCommands.length() > 0 {
            foreach types:ControlCommand command in pendingCommands {
                _ = check dbClient->execute(`
                    UPDATE control_commands 
                    SET status = 'sent' 
                    WHERE command_id = ${command.commandId}
                `);
            }
        }

        // Create audit log entry
        string action = isNewRegistration ? "REGISTER" : "HEARTBEAT";
        _ = check dbClient->execute(`
            INSERT INTO audit_logs (
                runtime_id, action, details, timestamp
            ) VALUES (
                ${heartbeat.runtimeId}, ${action}, 
                ${string `Runtime ${action.toLowerAscii()} processed with ${heartbeat.artifacts.services.length()} services and ${heartbeat.artifacts.listeners.length()} listeners`},
                ${currentTimeStr}
            )
        `);
        check commit;
        log:printInfo(string `Successfully processed ${action.toLowerAscii()} for runtime ${heartbeat.runtimeId} with ${heartbeat.artifacts.services.length()} services and ${heartbeat.artifacts.listeners.length()} listeners`);

    } on fail error e {
        // In case of error, the transaction block is rolled back automatically.
        log:printError(string `Failed to process heartbeat for runtime ${heartbeat.runtimeId}`, e);
        return error(string `Failed to process heartbeat for runtime ${heartbeat.runtimeId}`, e);
    }

    // Cache the runtime hash value after successful processing (outside transaction)
    error? cacheResult = hashCache.put(heartbeat.runtimeId, heartbeat.runtimeHash);
    if cacheResult is error {
        log:printWarn(string `Failed to cache runtime hash for ${heartbeat.runtimeId}`, cacheResult);
    } else {
        log:printDebug(string `Cached runtime hash for ${heartbeat.runtimeId}: ${heartbeat.runtimeHash}`);
    }

    // Return heartbeat response with pending commands (outside transaction)
    return {
        acknowledged: true,
        commands: pendingCommands
    };
}

// Insert a list of environments into the environments table
public isolated function insertEnvironmentsToDB(string[] environments) returns error? {
    log:printInfo(string `Register environments : ${environments.toString()}`);
    foreach string env in environments {
        sql:ParameterizedQuery insertQuery = `INSERT IGNORE INTO environments (name) VALUES (${env})`;
        var result = dbClient->execute(insertQuery);
        if result is sql:Error {
            // If error is not duplicate entry, log and return
            if !result.toString().toLowerAscii().includes("duplicate") {
                log:printError(string `Failed to insert environment: ${env}`, result);
                return result;
            }
        }
    }
    return ();
}

public isolated function addEnvironments(string[] environments) returns boolean|error {
    var result = insertEnvironmentsToDB(environments);
    if result is error {
        return result;
    }
    return true;
}

