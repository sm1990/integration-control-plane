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
import ballerina/uuid;

final DatabaseConnectionManager dbManager = check new (dbType);
public final sql:Client dbClient = dbManager.getClient();

// Cache for storing runtime hash values
final cache:Cache hashCache = new (capacity = 1000, evictionFactor = 0.2);

// Heartbeat timeout in seconds from main module config
configurable int heartbeatTimeoutSeconds = 300;

// Get all environments from the environments table
public isolated function getEnvironments() returns types:Environment[]|error {
    types:Environment[] environments = [];
    stream<types:Environment, sql:Error?> envStream = dbClient->query(`SELECT environment_id, name , description, is_production, created_at, updated_at, created_by, updated_by
                                                                       FROM environments ORDER BY name ASC`);
    check from types:Environment env in envStream
        do {
            environments.push({
                environmentId: env.environmentId,
                description: env.description,
                name: env.name,
                isProduction: env.isProduction,
                createdAt: env.createdAt
            });
        };
    return environments;
}

// Get environments by specific environment IDs (for admin environment filtering)
public isolated function getEnvironmentsByIds(string[] environmentIds) returns types:Environment[]|error {
    // Return empty array if no environment IDs provided
    if environmentIds.length() == 0 {
        return [];
    }
    
    types:Environment[] environments = [];
    
    // Build WHERE clause to filter by environment IDs
    sql:ParameterizedQuery query = `SELECT environment_id, name, description, is_production, created_at, updated_at, created_by, updated_by
                                     FROM environments 
                                     WHERE environment_id IN (`;
    
    // Add environment IDs to the IN clause
    foreach int i in 0 ..< environmentIds.length() {
        if i > 0 {
            query = sql:queryConcat(query, `, `);
        }
        query = sql:queryConcat(query, `${environmentIds[i]}`);
    }
    
    query = sql:queryConcat(query, `) ORDER BY name ASC`);
    
    stream<types:Environment, sql:Error?> envStream = dbClient->query(query);
    
    check from types:Environment env in envStream
        do {
            environments.push({
                environmentId: env.environmentId,
                description: env.description,
                name: env.name,
                isProduction: env.isProduction,
                createdAt: env.createdAt,
                updatedAt: env.updatedAt,
                createdBy: env.createdBy,
                updatedBy: env.updatedBy
            });
        };
    
    log:printInfo("Retrieved environments by IDs", environmentCount = environments.length());
    
    return environments;
}

// Get environment by ID
public isolated function getEnvironmentById(string environmentId) returns types:Environment|error {
    stream<record {|string environment_id; string name; string? description; boolean is_production; string? created_at; string? updated_at;|}, sql:Error?> envStream =
        dbClient->query(`SELECT environment_id, name, description, is_production, created_at, updated_at FROM environments WHERE environment_id = ${environmentId}`);

    record {|string environment_id; string name; string? description; boolean is_production; string? created_at; string? updated_at;|}[] envRecords =
        check from record {|string environment_id; string name; string? description; boolean is_production; string? created_at; string? updated_at;|} env in envStream
        select env;

    if envRecords.length() == 0 {
        return error(string `Environment ${environmentId} not found.`);
    }

    record {|string environment_id; string name; string? description; boolean is_production; string? created_at; string? updated_at;|} env = envRecords[0];
    return {
        environmentId: env.environment_id,
        name: env.name,
        description: env.description,
        isProduction: env.is_production,
        createdAt: env.created_at,
        updatedAt: env.updated_at
    };
}

// Insert a list of environments into the environments table
public isolated function createEnvironment(types:EnvironmentInput environment) returns types:Environment|error? {
    log:printInfo(string `Register environment : ${environment.toString()}`);
    string envId = uuid:createRandomUuid();
    boolean isProduction = environment.isProduction ?: false;
    sql:ParameterizedQuery insertQuery = `INSERT INTO environments (environment_id, name, description, is_production) VALUES (${envId}, ${environment.name}, ${environment.description}, ${isProduction})`;
    var result = dbClient->execute(insertQuery);
    if result is sql:Error {
        // If error is not duplicate entry, log and return
        if !result.toString().toLowerAscii().includes("duplicate") {
            log:printError(string `Failed to insert environment: ${environment.name}`, result);
            return result;
        }
        return ();
    }

    // Return the created environment
    return check getEnvironmentById(envId);
}

// Update environment name and/or description
public isolated function updateEnvironment(string environmentId, string? name, string? description) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE environment_id = ${environmentId} `;
    sql:ParameterizedQuery updateFields = ` SET updated_at = CURRENT_TIMESTAMP `;

    if name is string {
        updateFields = sql:queryConcat(updateFields, `, name = ${name} `);
    }
    if description is string {
        updateFields = sql:queryConcat(updateFields, `, description = ${description} `);
    }

    sql:ParameterizedQuery updateQuery = sql:queryConcat(`UPDATE environments `, updateFields, whereClause);
    var result = dbClient->execute(updateQuery);
    if result is sql:Error {
        log:printError(string `Failed to update environment ${environmentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully updated environment ${environmentId}`);
    return ();
}

// Update environment production status
public isolated function updateEnvironmentProductionStatus(string environmentId, boolean isProduction) returns error? {
    sql:ParameterizedQuery updateQuery = `UPDATE environments SET is_production = ${isProduction}, updated_at = CURRENT_TIMESTAMP WHERE environment_id = ${environmentId}`;
    var result = dbClient->execute(updateQuery);
    if result is sql:Error {
        log:printError(string `Failed to update environment production status ${environmentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully updated environment production status ${environmentId}`);
    return ();
}

// Get environment ID by name
public isolated function getEnvironmentIdByName(string environmentName) returns string|error {
    stream<record {|string environment_id;|}, sql:Error?> envStream = dbClient->query(`
        SELECT environment_id FROM environments WHERE name = ${environmentName}
    `);

    record {|string environment_id;|}[] envRecords = check from record {|string environment_id;|} env in envStream
        select env;

    if envRecords.length() == 0 {
        return error(string `Environment ${environmentName} not found.`);
    }
    return envRecords[0].environment_id;
}

// Get component ID by name
public isolated function getComponentIdByName(string componentName) returns string|error {
    stream<record {|string component_id;|}, sql:Error?> componentStream = dbClient->query(`
        SELECT component_id FROM components WHERE name = ${componentName}
    `);

    record {|string component_id;|}[] componentRecords = check from record {|string component_id;|} component in componentStream
        select component;

    if componentRecords.length() == 0 {
        return error(string `Component ${componentName} not found.`);
    }
    return componentRecords[0].component_id;
}

// Get project ID by name
public isolated function getProjectIdByName(string projectName) returns string|error {
    stream<record {|string project_id;|}, sql:Error?> projectStream = dbClient->query(`
        SELECT project_id FROM projects WHERE name = ${projectName}
    `);

    record {|string project_id;|}[] projectRecords = check from record {|string project_id;|} project in projectStream
        select project;

    if projectRecords.length() == 0 {
        return error(string `Project ${projectName} not found.`);
    }
    return projectRecords[0].project_id;
}

// Delete an environment by ID
public isolated function deleteEnvironment(string environmentId) returns error? {
    sql:ParameterizedQuery deleteQuery = `DELETE FROM environments WHERE environment_id = ${environmentId}`;
    var result = dbClient->execute(deleteQuery);
    if result is sql:Error {
        log:printError(string `Failed to delete environment ${environmentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully deleted environment ${environmentId}`);
    return ();
}

// Get all runtimes with optional filtering
public isolated function getRuntimes(string? status, string? runtimeType, string? environmentId, string? projectId, string? componentId) returns types:Runtime[]|error {
    types:Runtime[] runtimeList = [];
    sql:ParameterizedQuery whereClause = ` WHERE 1=1 `;
    sql:ParameterizedQuery whereConditions = ` `;
    if status is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND status = ${status} `);
    }
    if runtimeType is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND runtime_type = ${runtimeType} `);
    }
    if environmentId is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND environment_id = ${environmentId} `);
    }
    if projectId is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND project_id = ${projectId} `);
    }
    if componentId is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND component_id = ${componentId} `);
    }
    sql:ParameterizedQuery selectClause = ` SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version, 
                 platform_name, platform_version, platform_home, os_name, os_version, 
                 registration_time, last_heartbeat FROM runtimes `;
    sql:ParameterizedQuery orderByClause = ` ORDER BY registration_time DESC `;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, whereClause, whereConditions, orderByClause);
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(query);

    check from types:RuntimeDBRecord runtime in runtimeStream
        do {
            runtimeList.push(check mapToRuntime(runtime));
        };

    return runtimeList;
}

// Get all runtimes for multiple project+environment combinations (RBAC-aware batch query)
public isolated function getRuntimesByAccessibleEnvironments(types:RoleInfo[] roles) returns types:Runtime[]|error {
    // Return empty array if no roles provided
    if roles.length() == 0 {
        return [];
    }
    
    types:Runtime[] runtimeList = [];
    
    // Build WHERE clause for multiple project+environment combinations
    // We need: WHERE (project_id = ? AND environment_id = ?) OR (project_id = ? AND environment_id = ?) ...
    sql:ParameterizedQuery selectClause = ` SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version, 
                 platform_name, platform_version, platform_home, os_name, os_version, 
                 registration_time, last_heartbeat FROM runtimes WHERE `;
    
    // Build OR conditions for each role
    sql:ParameterizedQuery whereClause = ``;
    foreach int i in 0 ..< roles.length() {
        if i > 0 {
            whereClause = sql:queryConcat(whereClause, ` OR `);
        }
        whereClause = sql:queryConcat(whereClause, 
            `(project_id = ${roles[i].projectId} AND environment_id = ${roles[i].environmentId})`);
    }
    
    sql:ParameterizedQuery orderByClause = ` ORDER BY registration_time DESC`;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, whereClause, orderByClause);
    
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(query);
    
    check from types:RuntimeDBRecord runtime in runtimeStream
        do {
            runtimeList.push(check mapToRuntime(runtime));
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
        return;
    }

    return check mapToRuntime(runtimeRecords[0]);
}

// Delete a runtime by ID
public isolated function deleteRuntime(string runtimeId) returns error? {
    sql:ParameterizedQuery deleteQuery = `DELETE FROM runtimes WHERE runtime_id = ${runtimeId}`;
    var result = dbClient->execute(deleteQuery);
    if result is sql:Error {
        log:printError(string `Failed to delete runtime ${runtimeId}`, result);
        return result;
    }
    log:printInfo(string `Successfully deleted runtime ${runtimeId}`);
}

// Get services for a specific runtime
public isolated function getServicesForRuntime(string runtimeId) returns types:Service[]|error {
    types:Service[] serviceList = [];
    stream<types:Service, sql:Error?> serviceStream = dbClient->query(`
        SELECT service_name, service_package, base_path, state 
        FROM runtime_services 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:Service serviceRecord in serviceStream
        do {

            serviceList.push(check mapToService(serviceRecord, runtimeId));
        };

    return serviceList;
}

// Get listeners for a specific runtime
public isolated function getListenersForRuntime(string runtimeId) returns types:Listener[]|error {
    types:Listener[] listenerList = [];
    stream<types:Listener, sql:Error?> listenerStream = dbClient->query(`
        SELECT listener_name, listener_package, protocol, state 
        FROM runtime_listeners 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:Listener listenerRecord in listenerStream
        do {
            listenerList.push(listenerRecord);
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
        environment: check getEnvironmentById(runtimeRecord.environment_id),
        component: check getComponentById(runtimeRecord.component_id),
        version: runtimeRecord.version,
        platformName: runtimeRecord.platform_name,
        platformVersion: runtimeRecord.platform_version,
        platformHome: runtimeRecord.platform_home,
        osName: runtimeRecord.os_name,
        osVersion: runtimeRecord.os_version,
        registrationTime: registrationTimeStr,
        lastHeartbeat: lastHeartbeatStr,
        artifacts: {
            listeners: listenerList,
            services: serviceList
        }
    };
}

// Helper function to map service record and get resources
public isolated function mapToService(types:Service serviceRecord, string runtimeId) returns types:Service|error {
    types:Resource[] resourceList = [];
    stream<types:ResourceRecord, sql:Error?> resourceStream = dbClient->query(`
        SELECT resource_url, methods 
        FROM service_resources 
        WHERE runtime_id = ${runtimeId} AND service_name = ${serviceRecord.name}
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
        name: serviceRecord.name,
        package: serviceRecord.package,
        basePath: serviceRecord.basePath,
        resources: resourceList
    };
}

// Helper function to convert time:Utc to MySQL datetime format
isolated function utcToMySQLDateTime(time:Utc utcTime) returns string|error {
    time:Civil civilTime = time:utcToCivil(utcTime);
    // Ensure seconds is between 0-59 by truncating instead of rounding
    int seconds = <int>civilTime.second;
    if seconds > 59 {
        seconds = 59;
    }
    // Format: YYYY-MM-DD HH:MM:SS
    string formattedTime = string `${civilTime.year}-${civilTime.month.toString().padStart(2, "0")}-${civilTime.day.toString().padStart(2, "0")} ${civilTime.hour.toString().padStart(2, "0")}:${civilTime.minute.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
    if deltaHeartbeat.runtime.trim().length() == 0 {
        return error("Runtime ID cannot be empty");
    }

    time:Utc currentTime = time:utcNow();
    string currentTimeStr = check utcToMySQLDateTime(currentTime);
    types:ControlCommand[] pendingCommands = [];
    boolean hashMatches = false;

    if hashCache.hasKey(deltaHeartbeat.runtime) {
        any|error cachedHash = hashCache.get(deltaHeartbeat.runtime);
        hashMatches = cachedHash is string && cachedHash == deltaHeartbeat.runtimeHash;
        log:printInfo(string `Hash for runtime ${deltaHeartbeat.runtime} matches: ${hashMatches}`);
    }

    if !hashMatches {
        // Hash doesn't match or runtime not in cache, request full heartbeat
        log:printInfo(string `Hash mismatch for runtime ${deltaHeartbeat.runtime}, requesting full heartbeat`);

        // Still update the timestamp to show runtime is alive
        transaction {
            sql:ExecutionResult _ = check dbClient->execute(`
                UPDATE runtimes 
                SET last_heartbeat = ${currentTimeStr}, status = 'RUNNING'
                WHERE runtime_id = ${deltaHeartbeat.runtime}
            `);

            check commit;
        } on fail error e {
            log:printError(string `Failed to update timestamp for runtime ${deltaHeartbeat.runtime}`, e);
            return error(string `Failed to process delta heartbeat for runtime ${deltaHeartbeat.runtime}`, e);
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
            SET last_heartbeat = ${currentTimeStr}, status = 'RUNNING'
            WHERE runtime_id = ${deltaHeartbeat.runtime}
        `);

        // Retrieve pending control commands for this runtime
        stream<types:ControlCommand, sql:Error?> commandStream = dbClient->query(`
            SELECT command_id, runtime_id, target_artifact, action, issued_at, status
            FROM control_commands 
            WHERE runtime_id = ${deltaHeartbeat.runtime} 
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
                ${deltaHeartbeat.runtime}, 'DELTA_HEARTBEAT', 
                ${string `Delta heartbeat processed with hash ${deltaHeartbeat.runtimeHash}`},
                ${currentTimeStr}
            )
        `);

        check commit;
        log:printInfo(string `Successfully processed delta heartbeat for runtime ${deltaHeartbeat.runtime}`);

    } on fail error e {
        log:printError(string `Failed to process delta heartbeat for runtime ${deltaHeartbeat.runtime}`, e);
        return error(string `Failed to process delta heartbeat for runtime ${deltaHeartbeat.runtime}`, e);
    }

    return {
        acknowledged: true,
        fullHeartbeatRequired: false,
        commands: pendingCommands
    };
}

// Validation function for heartbeat data
isolated function validateHeartbeatData(types:Heartbeat heartbeat) returns error? {
    // Validate required fields
    if heartbeat.runtime.trim().length() == 0 {
        return error("Runtime ID cannot be empty");
    }

    if heartbeat.runtime.length() > 100 {
        return error("Runtime ID cannot exceed 100 characters");
    }
    //validate component and project
    if heartbeat.component.trim().length() == 0 {
        return error("Component name cannot be empty");
    }

    if heartbeat.project.trim().length() == 0 {
        return error("Project name cannot be empty");
    }

    string|error envId = getEnvironmentIdByName(heartbeat.environment);
    if envId is error {
        return error(string `Invalid environment configuration detected: ${heartbeat.environment}`, envId);
    }
    heartbeat.environment = envId;

    string|error projectId = getProjectIdByName(heartbeat.project);
    if projectId is error {
        return error(string `Invalid project configuration detected: ${heartbeat.project}`, projectId);
    }
    heartbeat.project = projectId;

    string|error componentId = getComponentIdByName(heartbeat.component);
    if componentId is error {
        return error(string `Invalid component configuration detected: ${heartbeat.component}`, componentId);
    }
    heartbeat.component = componentId;

    // Validate that all runtimes in the same component have consistent services and listeners
    // check validateComponentRuntimeConsistency(componentId, heartbeat.artifacts);
}

// Validation function to ensure all runtimes in the same component have the same services and listeners
isolated function validateComponentRuntimeConsistency(string componentId, types:Artifacts newArtifacts) returns error? {
    // Get all existing runtimes for this component
    stream<record {|string runtime_id;|}, sql:Error?> runtimeStream = dbClient->query(`
        SELECT runtime_id FROM runtimes WHERE component_id = ${componentId}
    `);

    record {|string runtime_id;|}[] existingRuntimes = check from record {|string runtime_id;|} runtime in runtimeStream
        select runtime;

    // If no existing runtimes, this is the first one, so it's valid
    if existingRuntimes.length() == 0 {
        return;
    }

    // Get services and listeners from the first existing runtime as the reference
    string referenceRuntimeId = existingRuntimes[0].runtime_id;
    types:Service[] referenceServices = check getServicesForRuntime(referenceRuntimeId);
    types:Listener[] referenceListeners = check getListenersForRuntime(referenceRuntimeId);

    // Compare new artifacts with reference
    error? servicesValidation = validateServicesConsistency(referenceServices, newArtifacts.services);
    if servicesValidation is error {
        return error(string `Service inconsistency detected in component ${componentId}: ${servicesValidation.message()}`);
    }

    error? listenersValidation = validateListenersConsistency(referenceListeners, newArtifacts.listeners);
    if listenersValidation is error {
        return error(string `Listener inconsistency detected in component ${componentId}: ${listenersValidation.message()}`);
    }

}

// Helper function to validate services consistency
isolated function validateServicesConsistency(types:Service[] referenceServices, types:Service[] newServices) returns error? {
    // Check if the number of services matches
    if referenceServices.length() != newServices.length() {
        return error(string `Expected ${referenceServices.length()} services, but got ${newServices.length()}`);
    }

    // Create maps for easier comparison
    map<types:Service> referenceServiceMap = {};
    foreach types:Service svc in referenceServices {
        referenceServiceMap[svc.name] = svc;
    }

    // Validate each new service
    foreach types:Service newService in newServices {
        if !referenceServiceMap.hasKey(newService.name) {
            return error(string `Service '${newService.name}' not found in reference runtime`);
        }

        types:Service? refServiceOpt = referenceServiceMap[newService.name];
        if refServiceOpt is () {
            return error(string `Service '${newService.name}' not found in reference runtime`);
        }
        types:Service refService = refServiceOpt;

        // Validate package
        if refService.package != newService.package {
            return error(string `Service '${newService.name}' package mismatch. Expected: ${refService.package}, Got: ${newService.package}`);
        }

        // Validate base path
        if refService.basePath != newService.basePath {
            return error(string `Service '${newService.name}' base path mismatch. Expected: ${refService.basePath}, Got: ${newService.basePath}`);
        }

        // Validate resources
        error? resourceValidation = validateResourcesConsistency(refService.resources, newService.resources);
        if resourceValidation is error {
            return error(string `Service '${newService.name}' resource mismatch: ${resourceValidation.message()}`);
        }
    }

}

// Helper function to validate listeners consistency
isolated function validateListenersConsistency(types:Listener[] referenceListeners, types:Listener[] newListeners) returns error? {
    // Check if the number of listeners matches
    if referenceListeners.length() != newListeners.length() {
        return error(string `Expected ${referenceListeners.length()} listeners, but got ${newListeners.length()}`);
    }

    // Create maps for easier comparison
    map<types:Listener> referenceListenerMap = {};
    foreach types:Listener listenerItem in referenceListeners {
        referenceListenerMap[listenerItem.name] = listenerItem;
    }

    // Validate each new listener
    foreach types:Listener newListener in newListeners {
        if !referenceListenerMap.hasKey(newListener.name) {
            return error(string `Listener '${newListener.name}' not found in reference runtime`);
        }

        types:Listener? refListenerOpt = referenceListenerMap[newListener.name];
        if refListenerOpt is () {
            return error(string `Listener '${newListener.name}' not found in reference runtime`);
        }
        types:Listener refListener = refListenerOpt;

        // Validate package
        if refListener.package != newListener.package {
            return error(string `Listener '${newListener.name}' package mismatch. Expected: ${refListener.package}, Got: ${newListener.package}`);
        }

        // Validate protocol
        if refListener.protocol != newListener.protocol {
            return error(string `Listener '${newListener.name}' protocol mismatch. Expected: ${refListener.protocol}, Got: ${newListener.protocol}`);
        }
    }

}

// Helper function to validate resources consistency
isolated function validateResourcesConsistency(types:Resource[] referenceResources, types:Resource[] newResources) returns error? {
    // Check if the number of resources matches
    if referenceResources.length() != newResources.length() {
        return error(string `Expected ${referenceResources.length()} resources, but got ${newResources.length()}`);
    }

    // Create maps for easier comparison
    map<types:Resource> referenceResourceMap = {};
    foreach types:Resource resourceItem in referenceResources {
        referenceResourceMap[resourceItem.url] = resourceItem;
    }

    // Validate each new resource
    foreach types:Resource newResource in newResources {
        if !referenceResourceMap.hasKey(newResource.url) {
            return error(string `Resource with URL '${newResource.url}' not found in reference runtime`);
        }

        types:Resource? refResourceOpt = referenceResourceMap[newResource.url];
        if refResourceOpt is () {
            return error(string `Resource with URL '${newResource.url}' not found in reference runtime`);
        }
        types:Resource refResource = refResourceOpt;

        // Validate methods (order doesn't matter, but content should match)
        if refResource.methods.length() != newResource.methods.length() {
            return error(string `Resource '${newResource.url}' methods count mismatch. Expected: ${refResource.methods.length()}, Got: ${newResource.methods.length()}`);
        }

        // Convert to sets for comparison (order-independent)
        map<boolean> refMethodsSet = {};
        foreach string method in refResource.methods {
            refMethodsSet[method] = true;
        }

        foreach string method in newResource.methods {
            if !refMethodsSet.hasKey(method) {
                return error(string `Resource '${newResource.url}' has unexpected method '${method}'`);
            }
        }
    }

    return ();
}

// Heartbeat processing that handles both registration and updates
public isolated function processHeartbeat(types:Heartbeat heartbeat) returns types:HeartbeatResponse|error {
    check validateHeartbeatData(heartbeat);
    time:Utc currentTime = time:utcNow();
    string currentTimeStr = check utcToMySQLDateTime(currentTime);
    boolean isNewRegistration = false;
    types:ControlCommand[] pendingCommands = [];

    // Start transaction for heartbeat processing
    transaction {
        // Check if runtime exists
        stream<record {|string runtime_id;|}, sql:Error?> existingRuntimeStream = dbClient->query(`
            SELECT runtime_id FROM runtimes WHERE runtime_id = ${heartbeat.runtime}
        `);

        record {|string runtime_id;|}[] existingRuntimes = check from record {|string runtime_id;|} existingRuntime in existingRuntimeStream
            select existingRuntime;

        isNewRegistration = existingRuntimes.length() == 0;

        if isNewRegistration {
            // Register new runtime
            sql:ExecutionResult _ = check dbClient->execute(`
                INSERT INTO runtimes (
                    runtime_id, name, runtime_type, status, version, 
                    environment_id, project_id, component_id,
                    platform_name, platform_version, platform_home, 
                    os_name, os_version, 
                    registration_time, last_heartbeat
                ) VALUES (
                    ${heartbeat.runtime}, ${heartbeat.runtime},${heartbeat.runtimeType}, ${heartbeat.status}, ${heartbeat.version},
                    ${heartbeat.environment}, ${heartbeat.project}, ${heartbeat.component},
                    ${heartbeat.nodeInfo.platformName},${heartbeat.nodeInfo.platformVersion},${heartbeat.nodeInfo.ballerinaHome},
                    ${heartbeat.nodeInfo.osName}, ${heartbeat.nodeInfo.osVersion}, 
                    ${currentTimeStr}, ${currentTimeStr}
                )
            `);

            // TODO: Uncomment the following lines when https://github.com/ballerina-platform/ballerina-lang/issues/44219 fixed
            // if insertResult.affectedRowCount == 0 {
            //     rollback;
            //     return error(string `Failed to register runtime ${heartbeat.runtimeId}`);
            // }

            log:printInfo(string `Registered new runtime via heartbeat: ${heartbeat.runtime}`);
        } else {
            // Update existing runtime
            sql:ExecutionResult _ = check dbClient->execute(`
                UPDATE runtimes 
                SET status = ${heartbeat.status}, 
                    runtime_type = ${heartbeat.runtimeType},
                    environment_id = ${heartbeat.environment},
                    version = ${heartbeat.version},
                    platform_name = ${heartbeat.nodeInfo.platformName},
                    platform_version = ${heartbeat.nodeInfo.platformVersion},
                    platform_home = ${heartbeat.nodeInfo.ballerinaHome},
                    os_name = ${heartbeat.nodeInfo.osName},
                    os_version = ${heartbeat.nodeInfo.osVersion},
                    last_heartbeat = ${currentTimeStr}
                WHERE runtime_id = ${heartbeat.runtime}
            `);

            // TODO: Uncomment the following lines when https://github.com/ballerina-platform/ballerina-lang/issues/44219 fixed
            // if updateResult.affectedRowCount == 0 {
            //     rollback;
            //     return error(string `Failed to update runtime ${heartbeat.runtimeId}`);
            // }
            log:printInfo(string `Updated runtime via heartbeat: ${heartbeat.runtime}`);
        }

        // Update artifacts information (services and listeners)
        // First, delete existing artifacts for this runtime
        _ = check dbClient->execute(`
            DELETE FROM runtime_services WHERE runtime_id = ${heartbeat.runtime}
        `);

        _ = check dbClient->execute(`
            DELETE FROM runtime_listeners WHERE runtime_id = ${heartbeat.runtime}
        `);

        _ = check dbClient->execute(`
            DELETE FROM service_resources WHERE runtime_id = ${heartbeat.runtime}
        `);

        // Insert updated services
        foreach types:Service serviceDetail in heartbeat.artifacts.services {
            _ = check dbClient->execute(`
                INSERT INTO runtime_services (
                    runtime_id, service_name, service_package, base_path, state
                ) VALUES (
                    ${heartbeat.runtime}, ${serviceDetail.name}, 
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
                        ${heartbeat.runtime}, ${serviceDetail.name}, 
                        ${resourceDetail.url}, ${methodsJson}
                    )
                `);
            }
        }

        // Insert updated listeners
        foreach types:Listener listenerDetail in heartbeat.artifacts.listeners {
            _ = check dbClient->execute(`
                INSERT INTO runtime_listeners (
                    runtime_id, listener_name, listener_package, protocol, state
                ) VALUES (
                    ${heartbeat.runtime}, ${listenerDetail.name}, 
                    ${listenerDetail.package}, ${listenerDetail.protocol}, 
                    ${listenerDetail.state}
                )
            `);
        }

        // Validate runtime consistency within component (only for new registrations)
        if isNewRegistration {
            error? validationResult = validateComponentRuntimeConsistency(heartbeat.component, heartbeat.artifacts);
            if validationResult is error {
                log:printWarn(string `Component consistency validation failed for runtime ${heartbeat.runtime}`, validationResult);
            }
        }

        // Retrieve pending control commands for this runtime
        stream<types:ControlCommand, sql:Error?> commandStream = dbClient->query(`
            SELECT command_id, runtime_id, target_artifact, action, issued_at, status
            FROM control_commands 
            WHERE runtime_id = ${heartbeat.runtime} 
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
                ${heartbeat.runtime}, ${action}, 
                ${string `Runtime ${action.toLowerAscii()} processed with ${heartbeat.artifacts.services.length()} services and ${heartbeat.artifacts.listeners.length()} listeners`},
                ${currentTimeStr}
            )
        `);
        check commit;
        log:printInfo(string `Successfully processed ${action.toLowerAscii()} for runtime ${heartbeat.runtime} with ${heartbeat.artifacts.services.length()} services and ${heartbeat.artifacts.listeners.length()} listeners`);

    } on fail error e {
        // In case of error, the transaction block is rolled back automatically.
        log:printError(string `Failed to process heartbeat for runtime ${heartbeat.runtime}`, e);
        return error(string `Failed to process heartbeat for runtime ${heartbeat.runtime}`, e);
    }

    // Cache the runtime hash value after successful processing (outside transaction)
    error? cacheResult = hashCache.put(heartbeat.runtime, heartbeat.runtimeHash);
    if cacheResult is error {
        log:printWarn(string `Failed to cache runtime hash for ${heartbeat.runtime}`, cacheResult);
    } else {
        log:printDebug(string `Cached runtime hash for ${heartbeat.runtime}: ${heartbeat.runtimeHash}`);
    }

    // Return heartbeat response with pending commands (outside transaction)
    return {
        acknowledged: true,
        commands: pendingCommands
    };
}

// Create a new project in the projects table
public isolated function createProject(types:ProjectInput project, types:UserContext userContext) returns types:Project|error? {
    string projectId = uuid:createType1AsString();
    string userId = userContext.userId;
    string displayName = userContext.displayName;
    
    transaction {
        // Insert project with owner_id and created_by (display name)
        sql:ParameterizedQuery insertQuery = `INSERT INTO projects (project_id, name, description, owner_id, created_by) 
                                              VALUES (${projectId}, ${project.name}, ${project.description}, ${userId}, ${displayName})`;
        sql:ExecutionResult _ = check dbClient->execute(insertQuery);
        
        log:printInfo(string `Created project: ${project.name}`, 
            projectId = projectId, 
            ownerId = userId, 
            createdBy = displayName);
        
        // Auto-assign admin roles to the creating user for all environments
        types:Environment[] environments = check getEnvironments();
        
        if environments.length() == 0 {
            log:printWarn("No environments found. User will not get any roles for this project.", projectId = projectId);
        } else {
            foreach types:Environment env in environments {
                // Get or create role for this project-environment-admin combination
                string roleId = check getOrCreateRole(projectId, env.environmentId, types:ADMIN);
                
                // Assign role to creating user
                sql:ExecutionResult _ = check dbClient->execute(
                    `INSERT INTO user_roles (user_id, role_id, assigned_by)
                     VALUES (${userId}, ${roleId}, ${userId})`
                );
                
                log:printInfo(string `Assigned admin role to project creator`, 
                    userId = userId, 
                    projectId = projectId, 
                    environmentId = env.environmentId);
            }
        }
        
        check commit;
        log:printInfo(string `Successfully created project and assigned admin roles`, 
            projectId = projectId, 
            owner = displayName);
    }
    
    return getProjectById(projectId);
}

// Get all projects
public isolated function getProjects() returns types:Project[]|error {
    types:Project[] projects = [];
    
    sql:ParameterizedQuery query = `SELECT project_id, name, description, owner_id, created_by, created_at, updated_at, updated_by 
                                   FROM projects 
                                   ORDER BY name ASC`;
    
    stream<types:Project, sql:Error?> projectStream = dbClient->query(query);

    check from types:Project project in projectStream
        do {
            projects.push({
                ...project
            });
        };
    
    log:printInfo("Retrieved all projects", projectCount = projects.length());
    
    return projects;
}

// Get projects by specific project IDs (for admin project filtering)
public isolated function getProjectsByIds(string[] projectIds) returns types:Project[]|error {
    // Return empty array if no project IDs provided
    if projectIds.length() == 0 {
        return [];
    }
    
    types:Project[] projects = [];
    
    // Build WHERE clause to filter by project IDs
    sql:ParameterizedQuery query = `SELECT project_id, name, description, owner_id, created_by, created_at, updated_at, updated_by 
                                     FROM projects 
                                     WHERE project_id IN (`;
    
    // Add project IDs to the IN clause
    foreach int i in 0 ..< projectIds.length() {
        if i > 0 {
            query = sql:queryConcat(query, `, `);
        }
        query = sql:queryConcat(query, `${projectIds[i]}`);
    }
    
    query = sql:queryConcat(query, `) ORDER BY name ASC`);
    
    stream<types:Project, sql:Error?> projectStream = dbClient->query(query);

    check from types:Project project in projectStream
        do {
            projects.push({
                ...project
            });
        };
    
    log:printInfo("Retrieved projects by IDs", projectCount = projects.length());
    
    return projects;
}

// Get a specific project by ID
public isolated function getProjectById(string projectId) returns types:Project|error {
    stream<types:Project, sql:Error?> projectStream =
        dbClient->query(`SELECT project_id, name, description, owner_id, created_by, created_at, updated_at, updated_by FROM projects WHERE project_id = ${projectId}`);

    types:Project[] projectRecords =
        check from types:Project project in projectStream
        select project;

    if projectRecords.length() == 0 {
        return error(string `Project with ID ${projectId} not found`);
    }

    return projectRecords[0];
}

// Update project name and/or description
public isolated function updateProject(string projectId, string? name, string? description) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE project_id = ${projectId} `;
    sql:ParameterizedQuery updateFields = ` SET `;
    boolean hasUpdates = false;

    if name is string {
        updateFields = sql:queryConcat(updateFields, ` name = ${name} `);
        hasUpdates = true;
    }
    if description is string {
        if hasUpdates {
            updateFields = sql:queryConcat(updateFields, `, description = ${description} `);
        } else {
            updateFields = sql:queryConcat(updateFields, ` description = ${description} `);
            hasUpdates = true;
        }
    }

    if !hasUpdates {
        return error("No fields to update");
    }

    sql:ParameterizedQuery updateQuery = sql:queryConcat(`UPDATE projects `, updateFields, whereClause);
    var result = dbClient->execute(updateQuery);
    if result is sql:Error {
        log:printError(string `Failed to update project ${projectId}`, result);
        return result;
    }
    log:printInfo(string `Successfully updated project ${projectId}`);
    return ();
}

// Delete a project by ID (this will cascade delete all components and runtimes)
public isolated function deleteProject(string projectId) returns error? {
    sql:ParameterizedQuery deleteQuery = `DELETE FROM projects WHERE project_id = ${projectId}`;
    var result = dbClient->execute(deleteQuery);
    if result is sql:Error {
        log:printError(string `Failed to delete project ${projectId}`, result);
        return result;
    }
    log:printInfo(string `Successfully deleted project ${projectId}`);
    return ();
}

// Create a new component in the components table
public isolated function createComponent(types:ComponentInput component) returns types:Component|error? {
    string componentId = uuid:createType1AsString();
    sql:ParameterizedQuery insertQuery = `INSERT INTO components (component_id, project_id, name, description) 
                                          VALUES (${componentId}, ${component.projectId}, ${component.name}, ${component.description})`;
    var result = dbClient->execute(insertQuery);
    if result is sql:Error {
        return result;
    }
    return getComponentById(componentId);

}

// Get all components with optional project filter
public isolated function getComponents(string? projectId) returns types:Component[]|error {
    types:Component[] components = [];
    sql:ParameterizedQuery whereClause = ` WHERE 1=1 `;
    sql:ParameterizedQuery whereConditions = ` `;

    if projectId is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND c.project_id = ${projectId} `);
    }

    sql:ParameterizedQuery selectClause = `SELECT c.component_id, c.project_id, c.name as component_name, c.description as component_description, 
                                                  c.created_by as component_created_by, c.created_at as component_created_at, c.updated_at as component_updated_at,
                                                  c.updated_by as component_updated_by,
                                                  p.name as project_name, p.description as project_description, p.created_by as project_created_by, 
                                                  p.created_at as project_created_at, p.updated_at as project_updated_at, p.updated_by as project_updated_by
                                           FROM components c 
                                           JOIN projects p ON c.project_id = p.project_id `;
    sql:ParameterizedQuery orderByClause = ` ORDER BY c.name ASC `;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, whereClause, whereConditions, orderByClause);

    stream<types:ComponentInDB, sql:Error?> componentStream =
        dbClient->query(query);

    check from types:ComponentInDB component in componentStream
        do {
            components.push({
                componentId: component.component_id,
                project: {
                    projectId: component.project_id,
                    name: component.project_name,
                    description: component.project_description,
                    createdBy: component.project_created_by,
                    createdAt: component.project_created_at,
                    updatedAt: component.project_updated_at,
                    updatedBy: component.project_updated_by
                },
                name: component.component_name,
                description: component.component_description,
                createdBy: component.component_created_by,
                createdAt: component.component_created_at,
                updatedAt: component.component_updated_at,
                updatedBy: component.component_updated_by
            });
        };
    return components;
}

// Get all components for multiple projects (RBAC-aware batch query)
public isolated function getComponentsByProjectIds(string[] projectIds) returns types:Component[]|error {
    // Return empty array if no project IDs provided
    if projectIds.length() == 0 {
        return [];
    }
    
    types:Component[] components = [];
    
    // Build WHERE IN clause for multiple project IDs
    sql:ParameterizedQuery selectClause = `SELECT c.component_id, c.project_id, c.name as component_name, c.description as component_description, 
                                                  c.created_by as component_created_by, c.created_at as component_created_at, c.updated_at as component_updated_at,
                                                  c.updated_by as component_updated_by,
                                                  p.name as project_name, p.description as project_description, p.created_by as project_created_by, 
                                                  p.created_at as project_created_at, p.updated_at as project_updated_at, p.updated_by as project_updated_by
                                           FROM components c 
                                           JOIN projects p ON c.project_id = p.project_id 
                                           WHERE c.project_id IN (`;
    
    // Build the IN clause with parameterized values
    sql:ParameterizedQuery inClause = ``;
    foreach int i in 0 ..< projectIds.length() {
        if i > 0 {
            inClause = sql:queryConcat(inClause, `, `);
        }
        inClause = sql:queryConcat(inClause, `${projectIds[i]}`);
    }
    
    sql:ParameterizedQuery orderByClause = `) ORDER BY c.name ASC`;
    
    // Concatenate all parts
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, inClause, orderByClause);
    
    stream<types:ComponentInDB, sql:Error?> componentStream =
        dbClient->query(query);
    
    check from types:ComponentInDB component in componentStream
        do {
            components.push({
                componentId: component.component_id,
                project: {
                    projectId: component.project_id,
                    name: component.project_name,
                    description: component.project_description,
                    createdBy: component.project_created_by,
                    createdAt: component.project_created_at,
                    updatedAt: component.project_updated_at,
                    updatedBy: component.project_updated_by
                },
                name: component.component_name,
                description: component.component_description,
                createdBy: component.component_created_by,
                createdAt: component.component_created_at,
                updatedAt: component.component_updated_at,
                updatedBy: component.component_updated_by
            });
        };
    
    return components;
}

// Get a specific component by ID
public isolated function getComponentById(string componentId) returns types:Component|error {
    stream<types:ComponentInDB, sql:Error?> componentStream =
        dbClient->query(`SELECT c.component_id, c.project_id, c.name as component_name, c.description as component_description, 
                                c.created_by as component_created_by, c.created_at as component_created_at, c.updated_at as component_updated_at,
                                c.updated_by as component_updated_by,
                                p.name as project_name, p.description as project_description, 
                                p.created_by as project_created_by, p.created_at as project_created_at, p.updated_at as project_updated_at,
                                p.updated_by as project_updated_by
                         FROM components c 
                         JOIN projects p ON c.project_id = p.project_id 
                         WHERE c.component_id = ${componentId}`);

    types:ComponentInDB[] componentRecords =
        check from types:ComponentInDB component in componentStream
        select component;

    if componentRecords.length() == 0 {
        log:printError(string `Component with id ${componentId} not found`);
        return error(string `Component with id ${componentId} not found`);
    }

    types:ComponentInDB component = componentRecords[0];
    return {
        componentId: component.component_id,
        project: {
            projectId: component.project_id,
            name: component.project_name,
            description: component.project_description,
            createdBy: component.project_created_by,
            createdAt: component.project_created_at,
            updatedAt: component.project_updated_at,
            updatedBy: component.project_updated_by
        },
        name: component.component_name,
        description: component.component_description,
        createdBy: component.component_created_by,
        createdAt: component.component_created_at,
        updatedAt: component.component_updated_at,
        updatedBy: component.component_updated_by
    };
}

// Delete a component by ID (this will cascade delete all runtimes)
public isolated function deleteComponent(string componentId) returns error? {
    sql:ParameterizedQuery deleteQuery = `DELETE FROM components WHERE component_id = ${componentId}`;
    var result = dbClient->execute(deleteQuery);
    if result is sql:Error {
        log:printError(string `Failed to delete component ${componentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully deleted component ${componentId}`);
    return ();
}

// Update component name and/or description
public isolated function updateComponent(string componentId, string? name, string? description) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE component_id = ${componentId} `;
    sql:ParameterizedQuery updateFields = ` SET updated_at = CURRENT_TIMESTAMP `;

    if name is string {
        updateFields = sql:queryConcat(updateFields, `, name = ${name} `);
    }
    if description is string {
        updateFields = sql:queryConcat(updateFields, `, description = ${description} `);
    }

    sql:ParameterizedQuery updateQuery = sql:queryConcat(`UPDATE components `, updateFields, whereClause);
    var result = dbClient->execute(updateQuery);
    if result is sql:Error {
        log:printError(string `Failed to update component ${componentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully updated component ${componentId}`);
    return ();
}

// Get user details by user ID
public isolated function getUserDetailsById(string userId) returns types:User|error {
    log:printDebug(string `Fetching user details for userId: ${userId}`);
    types:User|sql:Error user = dbClient->queryRow(
        `SELECT user_id, username, display_name, is_super_admin, is_project_author, created_at, updated_at 
         FROM users 
         WHERE user_id = ${userId}`
    );

    if user is sql:Error {
        log:printError(string `Failed to get user details for ${userId}`, user);
        return user;
    }

    return user;
}

// Create a new user
public isolated function createUser(string userId, string username, string displayName) returns error? {
    log:printDebug(string `Creating user: ${username} with userId: ${userId}`);
    sql:ExecutionResult|sql:Error result = dbClient->execute(
        `INSERT INTO users (user_id, username, display_name) 
         VALUES (${userId}, ${username}, ${displayName})`
    );

    if result is sql:Error {
        log:printError(string `Failed to create user ${username}`, result);
        return result;
    }

    log:printInfo(string `Successfully created user ${username}`);
    return ();
}

// Get user roles by user ID
public isolated function getUserRoles(string userId) returns types:Role[]|error {
    log:printDebug(string `Fetching roles for user: ${userId}`);
    types:Role[] roles = [];
    stream<types:Role, sql:Error?> roleStream = dbClient->query(
        `SELECT r.role_id, r.project_id, r.environment_id, r.privilege_level, r.role_name, r.created_at, r.updated_at
         FROM roles r
         JOIN user_roles ur ON r.role_id = ur.role_id
         WHERE ur.user_id = ${userId}`
    );

    check from types:Role role in roleStream
        do {
            roles.push(role);
        };

    return roles;
}

// Get or create a role for a specific project-environment-privilege combination
isolated function getOrCreateRole(string projectId, string environmentId, types:PrivilegeLevel privilegeLevel) returns string|error {
    // First try to get existing role
    stream<record {|string role_id;|}, sql:Error?> roleStream = dbClient->query(
        `SELECT role_id FROM roles 
         WHERE project_id = ${projectId} 
         AND environment_id = ${environmentId} 
         AND privilege_level = ${privilegeLevel}`
    );
    
    record {|string role_id;|}[] existingRoles = check from record {|string role_id;|} role in roleStream
        select role;
    
    if existingRoles.length() > 0 {
        return existingRoles[0].role_id;
    }
    
    // Role doesn't exist, create it
    string roleId = uuid:createRandomUuid();
    
    // Get project and environment names for role_name
    types:Project project = check getProjectById(projectId);
    types:Environment environment = check getEnvironmentById(environmentId);
    
    // Replace spaces with underscores in names
    string projectName = re `\s+`.replaceAll(project.name, "_");
    string environmentName = re `\s+`.replaceAll(environment.name, "_");
    
    string roleName = string `${projectName}:${environmentName}:${privilegeLevel}`;
    
    sql:ExecutionResult _ = check dbClient->execute(
        `INSERT INTO roles (role_id, project_id, environment_id, privilege_level, role_name)
         VALUES (${roleId}, ${projectId}, ${environmentId}, ${privilegeLevel}, ${roleName})`
    );
    
    log:printInfo(string `Created new role: ${roleName}`);
    return roleId;
}

// Update user roles - replaces all existing roles with the provided set
public isolated function updateUserRoles(string userId, types:RoleAssignment[] roleAssignments) returns error? {
    log:printDebug(string `Updating roles for user: ${userId}`);
    
    transaction {
        // First, delete all existing user_roles for this user
        sql:ExecutionResult _ = check dbClient->execute(
            `DELETE FROM user_roles WHERE user_id = ${userId}`
        );
        
        // Insert new role assignments
        foreach types:RoleAssignment assignment in roleAssignments {
            // Get or create the role
            string roleId = check getOrCreateRole(
                assignment.projectId,
                assignment.environmentId,
                assignment.privilegeLevel
            );
            
            // Assign role to user
            sql:ExecutionResult _ = check dbClient->execute(
                `INSERT INTO user_roles (user_id, role_id)
                 VALUES (${userId}, ${roleId})`
            );
        }
        
        check commit;
        log:printInfo(string `Successfully updated roles for user ${userId} with ${roleAssignments.length()} assignments`);
    } on fail error e {
        log:printError(string `Transaction failed while updating roles for user ${userId}`, e);
        return error(string `Failed to update user roles for ${userId}`, e);
    }
    
    return ();
}

// Update user's project author flag (super admin only)
public isolated function updateUserProjectAuthor(string userId, boolean isProjectAuthor) returns error? {
    log:printDebug(string `Updating project author flag for user: ${userId} to ${isProjectAuthor}`);
    
    sql:ExecutionResult result = check dbClient->execute(
        `UPDATE users 
         SET is_project_author = ${isProjectAuthor}
         WHERE user_id = ${userId}`
    );
    
    if result.affectedRowCount == 0 {
        return error(string `User not found: ${userId}`);
    }
    
    log:printInfo(string `Successfully updated project author flag for user ${userId} to ${isProjectAuthor}`);
    return ();
}

// Get all users with their roles
public isolated function getAllUsers() returns types:UserWithRoles[]|error {
    log:printDebug("Fetching all users with roles");
    types:UserWithRoles[] users = [];
    
    // Get all users (including is_super_admin flag)
    stream<types:User, sql:Error?> userStream = dbClient->query(
        `SELECT user_id, username, display_name, is_super_admin, is_project_author, created_at, updated_at
         FROM users
         ORDER BY username ASC`
    );

    check from types:User user in userStream
        do {
            // Get roles for each user
            types:Role[] userRoles = [];
            types:Role[]|error rolesResult = getUserRoles(user.userId);
            if rolesResult is error {
                log:printError(string `Failed to get roles for user ${user.userId}`, rolesResult);
            } else {
                userRoles = rolesResult;
            }
            
            types:UserWithRoles userWithRoles = {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                isSuperAdmin: user.isSuperAdmin,
                isProjectAuthor: user.isProjectAuthor,
                createdAt: user?.createdAt,
                updatedAt: user?.updatedAt,
                roles: userRoles
            };
            users.push(userWithRoles);
        };

    log:printInfo(string `Successfully fetched ${users.length()} users`);
    return users;
}

// Get users who have roles in specified projects (RBAC-aware for admin users)
public isolated function getUsersByProjectIds(string[] projectIds) returns types:UserWithRoles[]|error {
    // Return empty array if no project IDs provided
    if projectIds.length() == 0 {
        return [];
    }
    
    log:printDebug(string `Fetching users with roles in ${projectIds.length()} projects`);
    types:UserWithRoles[] users = [];
    
    // Build query to get distinct user IDs who have roles in the specified projects
    // Need to join through user_roles -> roles to get project_id
    sql:ParameterizedQuery selectClause = `SELECT DISTINCT u.user_id, u.username, u.display_name, u.is_super_admin, u.is_project_author, u.created_at, u.updated_at
         FROM users u
         INNER JOIN user_roles ur ON u.user_id = ur.user_id
         INNER JOIN roles r ON ur.role_id = r.role_id
         WHERE r.project_id IN (`;
    
    // Build the IN clause with parameterized values
    sql:ParameterizedQuery inClause = ``;
    foreach int i in 0 ..< projectIds.length() {
        if i > 0 {
            inClause = sql:queryConcat(inClause, `, `);
        }
        inClause = sql:queryConcat(inClause, `${projectIds[i]}`);
    }
    
    sql:ParameterizedQuery orderByClause = `) ORDER BY u.username ASC`;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, inClause, orderByClause);
    
    stream<types:User, sql:Error?> userStream = dbClient->query(query);
    
    check from types:User user in userStream
        do {
            // Get roles for each user
            types:Role[] userRoles = [];
            types:Role[]|error rolesResult = getUserRoles(user.userId);
            if rolesResult is error {
                log:printError(string `Failed to get roles for user ${user.userId}`, rolesResult);
            } else {
                userRoles = rolesResult;
            }
            
            types:UserWithRoles userWithRoles = {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                isSuperAdmin: user.isSuperAdmin,
                isProjectAuthor: user.isProjectAuthor,
                createdAt: user?.createdAt,
                updatedAt: user?.updatedAt,
                roles: userRoles
            };
            users.push(userWithRoles);
        };
    
    log:printInfo(string `Successfully fetched ${users.length()} users for specified projects`);
    return users;
}

// Create a new user with credentials (password will be hashed)
public isolated function createUserWithCredentials(string username, string displayName, string passwordHash) returns types:User|error {
    log:printDebug(string `Creating user with credentials: ${username}`);
    string userId = uuid:createRandomUuid();
    
    transaction {
        // Insert into users table
        sql:ExecutionResult _ = check dbClient->execute(
            `INSERT INTO users (user_id, username, display_name) 
             VALUES (${userId}, ${username}, ${displayName})`
        );
        
        // Insert into user_credentials table
        sql:ExecutionResult _ = check dbClient->execute(
            `INSERT INTO user_credentials (user_id, username, display_name, password_hash) 
             VALUES (${userId}, ${username}, ${displayName}, ${passwordHash})`
        );
        
        check commit;
        log:printInfo(string `Successfully created user ${username} with userId ${userId}`);
    } on fail error e {
        log:printError(string `Transaction failed while creating user ${username}`, e);
        return error(string `Failed to create user ${username}`, e);
    }
    
    // Return the created user
    return check getUserDetailsById(userId);
}

// Delete a user by ID
public isolated function deleteUserById(string userId) returns error? {
    log:printDebug(string `Deleting user: ${userId}`);
    
    transaction {
        // Delete from user_credentials table (explicit delete, though FK might handle it)
        sql:ExecutionResult _ = check dbClient->execute(
            `DELETE FROM user_credentials WHERE user_id = ${userId}`
        );
        
        // Delete from users table (will cascade to user_roles)
        sql:ExecutionResult _ = check dbClient->execute(
            `DELETE FROM users WHERE user_id = ${userId}`
        );
        
        check commit;
        log:printInfo(string `Successfully deleted user ${userId}`);
    } on fail error e {
        log:printError(string `Transaction failed while deleting user ${userId}`, e);
        return error(string `Failed to delete user ${userId}`, e);
    }
    
    return ();
}
