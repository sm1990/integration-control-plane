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

// Runtime hash cache for delta heartbeat optimization
final cache:Cache hashCache = new (capacity = 1000, evictionFactor = 0.2);

// Process full heartbeat
public isolated function processHeartbeat(types:Heartbeat heartbeat) returns types:HeartbeatResponse|error {
    check validateHeartbeatData(heartbeat);

    boolean isNewRegistration = false;
    types:ControlCommand[] pendingCommands = [];

    // Upsert runtime record
    isNewRegistration = check upsertRuntime(heartbeat);

    if isNewRegistration {
        log:printInfo(string `Registered new runtime via heartbeat: ${heartbeat.runtime}`);
    } else {
        log:printInfo(string `Updated runtime via heartbeat: ${heartbeat.runtime}`);
    }

    // Start transaction for artifact updates and command retrieval
    transaction {
        // Insert all runtime artifacts
        check insertRuntimeArtifacts(heartbeat);

        // Validate runtime consistency within component (only for new registrations)
        if isNewRegistration {
            error? validationResult = validateComponentRuntimeConsistency(heartbeat.component, heartbeat.artifacts);
            if validationResult is error {
                log:printWarn(string `Component consistency validation failed for runtime ${heartbeat.runtime}`, validationResult);
            }
        }

        // Get component type(MI/BI) for this runtime
        string? componentType = check getComponentTypeByRuntimeId(heartbeat.runtime);

        // Process intended states and retrieve pending control commands based on component type
        if isNewRegistration {
            log:printInfo(string `New runtime registration detected - processing intended states for runtime ${heartbeat.runtime}`);
            check processIntendedStates(heartbeat.runtime, heartbeat.component, heartbeat.artifacts, componentType);
        }

        if componentType == types:BI {
            // Retrieve pending BI control commands (works for both new and existing runtimes)
            types:ControlCommand[] existingCommands = check sendPendingBIControlCommands(heartbeat.runtime);
            foreach types:ControlCommand cmd in existingCommands {
                pendingCommands.push(cmd);
            }
        } else if componentType == types:MI {
            // Retrieve and mark MI control commands as sent
            // MI commands are handled via management API, not returned in heartbeat response
            log:printDebug(string `Checking for pending MI control commands for runtime ${heartbeat.runtime}`);
            _ = check sendPendingMIControlCommands(heartbeat.runtime);
        }
        // For other component types or if runtime not found, pendingCommands remains empty

        // Create audit log entry
        string action = isNewRegistration ? "REGISTER" : "HEARTBEAT";
        int totalArtifacts = countTotalArtifacts(heartbeat.artifacts);

        _ = check dbClient->execute(`
            INSERT INTO audit_logs (
                runtime_id, action, details
            ) VALUES (
                ${heartbeat.runtime}, ${action}, 
                ${string `Runtime ${action.toLowerAscii()} processed with ${totalArtifacts} total artifacts (${heartbeat.artifacts.services.length()} services,
                 ${heartbeat.artifacts.listeners.length()} listeners)`}
            )
        `);
        check commit;
        log:printInfo(string `Successfully processed ${action.toLowerAscii()} for runtime ${heartbeat.runtime} with ${totalArtifacts} total artifacts`);

    } on fail error e {
        log:printError(string `Failed to process heartbeat for runtime ${heartbeat.runtime}`, e);
        return error(string `Failed to process heartbeat for runtime ${heartbeat.runtime}`, e);
    }

    // Cache the runtime hash value
    error? cacheResult = hashCache.put(heartbeat.runtime, heartbeat.runtimeHash);
    if cacheResult is error {
        log:printWarn(string `Failed to cache runtime hash for ${heartbeat.runtime}`, cacheResult);
    } else {
        log:printDebug(string `Cached runtime hash for ${heartbeat.runtime}: ${heartbeat.runtimeHash}`);
    }

    return {
        acknowledged: true,
        commands: pendingCommands
    };
}

// Process delta heartbeat with hash validation
public isolated function processDeltaHeartbeat(types:DeltaHeartbeat deltaHeartbeat) returns types:HeartbeatResponse|error {
    // Validate delta heartbeat data
    if deltaHeartbeat.runtime.trim().length() == 0 {
        return error("Runtime ID cannot be empty");
    }

    time:Utc currentTime = time:utcNow();
    string currentTimeStr = check convertUtcToDbDateTime(currentTime);
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
        // Use database's native timestamp function (CURRENT_TIMESTAMP works in both H2 MySQL mode and MySQL)
        sql:ExecutionResult|error result = dbClient->execute(`
            UPDATE runtimes
            SET last_heartbeat = CURRENT_TIMESTAMP, status = 'RUNNING'
            WHERE runtime_id = ${deltaHeartbeat.runtime}
        `);

        if result is error {
            log:printError(string `Failed to update timestamp for runtime ${deltaHeartbeat.runtime}`, result);
            // Don't fail the delta heartbeat just because timestamp update failed
            // Still request full heartbeat
        }

        return {
            acknowledged: true,
            fullHeartbeatRequired: true,
            commands: []
        };
    }

    // Hash matches, process delta heartbeat

    // Update the heartbeat timestamp using database's native timestamp function
    sql:ExecutionResult|error timestampResult = dbClient->execute(`
        UPDATE runtimes
        SET last_heartbeat = CURRENT_TIMESTAMP, status = 'RUNNING'
        WHERE runtime_id = ${deltaHeartbeat.runtime}
    `);

    boolean runtimeExists = true;
    if timestampResult is error {
        log:printError(string `Failed to update timestamp for runtime ${deltaHeartbeat.runtime}`, timestampResult);
        // Determine if runtime is missing; in that case, avoid FK violations when auditing
        runtimeExists = false;
    } else {
        // If no rows were updated, runtime may have been deleted concurrently
        runtimeExists = (timestampResult.affectedRowCount ?: 0) > 0;
    }

    // Handle control commands and audit logging in a transaction
    // Commands are marked as 'sent' atomically with audit log creation
    transaction {
        // Get component type for this runtime
        string? componentType = check getComponentTypeByRuntimeId(deltaHeartbeat.runtime);

        // Retrieve pending control commands based on component type
        if componentType == types:BI {
            pendingCommands = check sendPendingBIControlCommands(deltaHeartbeat.runtime);
        } else if componentType == types:MI {
            _ = check sendPendingMIControlCommands(deltaHeartbeat.runtime);
        }
        // For other component types or if runtime not found, pendingCommands remains empty

        // Create audit log entry
        if runtimeExists {
            sql:ParameterizedQuery auditQuery = sql:queryConcat(
                    `INSERT INTO audit_logs (
                    runtime_id, action, details, timestamp
                ) VALUES (
                    ${deltaHeartbeat.runtime}, 'DELTA_HEARTBEAT',
                    ${string `Delta heartbeat processed with hash ${deltaHeartbeat.runtimeHash}`},
                    `, sql:queryConcat(sqlQueryFromString(timestampCast(currentTimeStr)), `)`)
            );
            _ = check dbClient->execute(auditQuery);
        } else {
            // Runtime was deleted or not yet created; log without FK reference to avoid integrity violation
            sql:ParameterizedQuery auditQuery = sql:queryConcat(
                    `INSERT INTO audit_logs (
                    action, details, timestamp
                ) VALUES (
                    'DELTA_HEARTBEAT',
                    ${string `Delta heartbeat received for missing runtime ${deltaHeartbeat.runtime} with hash ${deltaHeartbeat.runtimeHash}`},
                    `, sql:queryConcat(sqlQueryFromString(timestampCast(currentTimeStr)), `)`)
            );
            _ = check dbClient->execute(auditQuery);
        }

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

// Validate heartbeat data
isolated function validateHeartbeatData(types:Heartbeat heartbeat) returns error? {
    if heartbeat.runtime.trim().length() == 0 {
        return error("Runtime ID cannot be empty");
    }

    if heartbeat.runtime.length() > 100 {
        return error("Runtime ID cannot exceed 100 characters");
    }

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

    string|error projectId = getProjectIdByHandler(heartbeat.project);
    if projectId is error {
        return error(string `Invalid project configuration detected: ${heartbeat.project}`, projectId);
    }
    heartbeat.project = projectId;

    string|error componentId = getComponentIdByName(heartbeat.component);
    if componentId is error {
        return error(string `Invalid component configuration detected: ${heartbeat.component}`, componentId);
    }
    heartbeat.component = componentId;

    types:Component|error componentById = getComponentById(componentId);
    if componentById is error {
        return error(string `Invalid component configuration detected: ${heartbeat.component}`, componentById);
    }
    if componentById.componentType != heartbeat.runtimeType {
        return error(string `Component type mismatch for component ${heartbeat.component}. Expected: ${componentById.componentType}, Got: ${heartbeat.runtimeType}`);
    }
}

// Validate component runtime consistency
isolated function validateComponentRuntimeConsistency(string componentId, types:Artifacts newArtifacts) returns error? {
    stream<record {|string runtime_id;|}, sql:Error?> runtimeStream = dbClient->query(`
        SELECT runtime_id FROM runtimes WHERE component_id = ${componentId}
    `);

    record {|string runtime_id;|}[] existingRuntimes = check from record {|string runtime_id;|} runtime in runtimeStream
        select runtime;

    if existingRuntimes.length() == 0 {
        return;
    }

    string referenceRuntimeId = existingRuntimes[0].runtime_id;
    types:Service[] referenceServices = check getServicesForRuntime(referenceRuntimeId);
    types:Listener[] referenceListeners = check getListenersForRuntime(referenceRuntimeId);

    error? servicesValidation = validateServicesConsistency(referenceServices, newArtifacts.services);
    if servicesValidation is error {
        return error(string `Service inconsistency detected in component ${componentId}: ${servicesValidation.message()}`);
    }

    error? listenersValidation = validateListenersConsistency(referenceListeners, newArtifacts.listeners);
    if listenersValidation is error {
        return error(string `Listener inconsistency detected in component ${componentId}: ${listenersValidation.message()}`);
    }
}

// Validate services consistency
isolated function validateServicesConsistency(types:Service[] referenceServices, types:Service[] newServices) returns error? {
    if referenceServices.length() != newServices.length() {
        return error(string `Expected ${referenceServices.length()} services, but got ${newServices.length()}`);
    }

    map<types:Service> referenceServiceMap = {};
    foreach types:Service svc in referenceServices {
        referenceServiceMap[svc.name] = svc;
    }

    foreach types:Service newService in newServices {
        if !referenceServiceMap.hasKey(newService.name) {
            return error(string `Service '${newService.name}' not found in reference runtime`);
        }

        types:Service? refServiceOpt = referenceServiceMap[newService.name];
        if refServiceOpt is () {
            return error(string `Service '${newService.name}' not found in reference runtime`);
        }
        types:Service refService = refServiceOpt;

        if refService.package != newService.package {
            return error(string `Service '${newService.name}' package mismatch. Expected: ${refService.package}, Got: ${newService.package}`);
        }

        if refService.basePath != newService.basePath {
            return error(string `Service '${newService.name}' base path mismatch. Expected: ${refService.basePath}, Got: ${newService.basePath}`);
        }

        error? resourceValidation = validateResourcesConsistency(refService.resources, newService.resources);
        if resourceValidation is error {
            return error(string `Service '${newService.name}' resource mismatch: ${resourceValidation.message()}`);
        }
    }
}

// Validate listeners consistency
isolated function validateListenersConsistency(types:Listener[] referenceListeners, types:Listener[] newListeners) returns error? {
    if referenceListeners.length() != newListeners.length() {
        return error(string `Expected ${referenceListeners.length()} listeners, but got ${newListeners.length()}`);
    }

    map<types:Listener> referenceListenerMap = {};
    foreach types:Listener listenerItem in referenceListeners {
        referenceListenerMap[listenerItem.name] = listenerItem;
    }

    foreach types:Listener newListener in newListeners {
        if !referenceListenerMap.hasKey(newListener.name) {
            return error(string `Listener '${newListener.name}' not found in reference runtime`);
        }

        types:Listener? refListenerOpt = referenceListenerMap[newListener.name];
        if refListenerOpt is () {
            return error(string `Listener '${newListener.name}' not found in reference runtime`);
        }
        types:Listener refListener = refListenerOpt;

        if refListener.package != newListener.package {
            return error(string `Listener '${newListener.name}' package mismatch. Expected: ${refListener.package}, Got: ${newListener.package}`);
        }

        if refListener.protocol != newListener.protocol {
            return error(string `Listener '${newListener.name}' protocol mismatch. Expected: ${refListener.protocol}, Got: ${newListener.protocol}`);
        }
    }
}

// Validate resources consistency
isolated function validateResourcesConsistency(types:Resource[] referenceResources, types:Resource[] newResources) returns error? {
    if referenceResources.length() != newResources.length() {
        return error(string `Expected ${referenceResources.length()} resources, but got ${newResources.length()}`);
    }

    map<types:Resource> referenceResourceMap = {};
    foreach types:Resource resourceItem in referenceResources {
        referenceResourceMap[resourceItem.url] = resourceItem;
    }

    foreach types:Resource newResource in newResources {
        if !referenceResourceMap.hasKey(newResource.url) {
            return error(string `Resource with URL '${newResource.url}' not found in reference runtime`);
        }

        types:Resource? refResourceOpt = referenceResourceMap[newResource.url];
        if refResourceOpt is () {
            return error(string `Resource with URL '${newResource.url}' not found in reference runtime`);
        }
        types:Resource refResource = refResourceOpt;

        if refResource.methods.length() != newResource.methods.length() {
            return error(string `Resource '${newResource.url}' methods count mismatch. Expected: ${refResource.methods.length()}, Got: ${newResource.methods.length()}`);
        }

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

// Process intended states and insert control commands to DB
isolated function processIntendedStates(string runtimeId, string componentId, types:Artifacts artifacts, string? componentType) returns error? {
    if componentType == types:BI {
        // Check BI intended states and insert control commands to DB
        int|error commandCount = checkBIIntendedStatesAndInsertCommands(
                runtimeId,
                componentId,
                artifacts
        );

        if commandCount is int && commandCount > 0 {
            log:printInfo(string `Inserted ${commandCount} BI control commands from intended states for runtime ${runtimeId}`);
        } else if commandCount is error {
            return commandCount;
        }
    } else if componentType == types:MI {
        // Check MI intended states and insert control commands to DB
        int|error commandCount = checkMIIntendedStatesAndInsertCommands(
                runtimeId,
                componentId,
                artifacts
        );

        if commandCount is int && commandCount > 0 {
            log:printInfo(string `Inserted ${commandCount} MI control commands from intended states for runtime ${runtimeId}`);
        } else if commandCount is error {
            return commandCount;
        }
    }
}

// Check BI artifact intended states and insert control commands to DB
isolated function checkBIIntendedStatesAndInsertCommands(string runtimeId, string componentId, types:Artifacts artifacts) returns int|error {
    int commandCount = 0;

    // Get intended states for this component
    map<string>|error intendedStates = getBIIntendedStatesForComponent(componentId);

    if intendedStates is error {
        log:printWarn(string `Failed to retrieve intended states for component ${componentId}`, intendedStates);
        return commandCount;
    }

    if intendedStates.length() == 0 {
        // No intended states configured, nothing to sync
        return commandCount;
    }

    // Check services against intended states
    foreach types:Service svc in artifacts.services {
        string artifactName = svc.name;
        if intendedStates.hasKey(artifactName) {
            string intendedAction = intendedStates.get(artifactName);
            string currentState = svc.state.toUpperAscii();

            // Determine if command is needed
            boolean needsCommand = false;
            types:ControlAction? actionToIssue = ();

            if intendedAction == "STOP" && currentState == "ENABLED" {
                needsCommand = true;
                actionToIssue = types:STOP;
            } else if intendedAction == "START" && currentState == "DISABLED" {
                needsCommand = true;
                actionToIssue = types:START;
            }

            if needsCommand && actionToIssue is types:ControlAction {
                // Insert control command to DB
                string|error commandId = insertControlCommand(runtimeId, artifactName, actionToIssue);

                if commandId is string {
                    commandCount += 1;
                    log:printInfo(string `Inserted BI control command for service ${artifactName}: ${intendedAction} (current: ${currentState})`);
                }
            }
        }
    }

    // Check listeners against intended states
    foreach types:Listener 'listener in artifacts.listeners {
        string artifactName = 'listener.name;
        if intendedStates.hasKey(artifactName) {
            string intendedAction = intendedStates.get(artifactName);
            string currentState = 'listener.state.toUpperAscii();

            // Determine if command is needed
            boolean needsCommand = false;
            types:ControlAction? actionToIssue = ();

            if intendedAction == "STOP" && currentState == "ENABLED" {
                needsCommand = true;
                actionToIssue = types:STOP;
            } else if intendedAction == "START" && currentState == "DISABLED" {
                needsCommand = true;
                actionToIssue = types:START;
            }

            if needsCommand && actionToIssue is types:ControlAction {
                // Insert control command to DB
                string|error commandId = insertControlCommand(runtimeId, artifactName, actionToIssue);

                if commandId is string {
                    commandCount += 1;
                    log:printInfo(string `Inserted BI control command for listener ${artifactName}: ${intendedAction} (current: ${currentState})`);
                }
            }
        }
    }

    return commandCount;
}

// Check MI artifact intended states and insert control commands to DB
isolated function checkMIIntendedStatesAndInsertCommands(
        string runtimeId,
        string componentId,
        types:Artifacts artifacts
) returns int|error {
    int commandCount = 0;

    log:printInfo(string `Starting MI intended state sync for runtime ${runtimeId}, component ${componentId}`);

    // Get intended states for this component
    types:MIArtifactIntendedStateDBRecord[]|error intendedStates = getMIIntendedStatesForComponent(componentId);

    if intendedStates is error {
        log:printWarn(string `Failed to retrieve MI intended states for component ${componentId}`, intendedStates);
        return commandCount;
    }

    if intendedStates.length() == 0 {
        // No intended states configured, nothing to sync
        log:printInfo(string `No MI intended states configured for component ${componentId}`);
        return commandCount;
    }

    log:printInfo(string `Found ${intendedStates.length()} intended state(s) for component ${componentId}`);

    // Iterate through intended states and process each one
    foreach types:MIArtifactIntendedStateDBRecord intendedState in intendedStates {
        string artifactName = intendedState.artifact_name;
        string artifactType = intendedState.artifact_type;
        string intendedAction = intendedState.action;

        log:printInfo(string `Processing intended state: artifact=${artifactName}, type=${artifactType}, action=${intendedAction}`);

        // Query the appropriate table based on artifact type and get artifact details
        types:ArtifactQueryResult|error? artifactDetails = getArtifactDetailsByTypeAndName(runtimeId, artifactName, artifactType);

        if artifactDetails is error {
            log:printError(string `Error querying artifact ${artifactName} of type ${artifactType}`, artifactDetails);
            continue;
        }

        if artifactDetails is () {
            log:printWarn(string `Artifact '${artifactName}' of type '${artifactType}' not found in runtime ${runtimeId}`);
            continue;
        }

        // Get the intended action

        // Process the control command
        log:printInfo(string `Found artifact '${artifactName}' (type=${artifactType}, state=${artifactDetails.state}, tracing=${artifactDetails.tracing ?: "N/A"})`);
        commandCount = check processMIControlCommand(
                runtimeId,
                componentId,
                artifactName,
                artifactType,
                artifactDetails.state,
                artifactDetails.tracing,
                artifactDetails.statistics,
                intendedAction,
                commandCount
        );
    }

    log:printInfo(string `Completed MI intended state sync for runtime ${runtimeId}: inserted ${commandCount} control command(s)`);
    return commandCount;
}

// Record type for artifact details
type MIArtifactDetails record {|
    string artifactId;
    string currentState;
|};

// Get artifact details by type and name from the appropriate runtime table
isolated function getArtifactDetailsByTypeAndName(string runtimeId, string artifactName, string artifactType) returns types:ArtifactQueryResult|error? {
    log:printDebug(string `Querying artifact: name=${artifactName}, type=${artifactType}, runtime=${runtimeId}`);

    ArtifactTableMetadata? metadata = resolveArtifactTableMetadata(artifactType);
    if metadata is () {
        log:printWarn(string `Unknown artifact type: ${artifactType}`);
        return ();
    }

    // Build SELECT clause: include tracing/statistics columns only for tables that have them
    string selectClause;
    if metadata.hasTracing && metadata.hasStatistics {
        selectClause = string `SELECT artifact_id, ${metadata.stateColumn} AS state, tracing, statistics FROM ${metadata.tableName}`;
    } else if metadata.hasTracing {
        selectClause = string `SELECT artifact_id, ${metadata.stateColumn} AS state, tracing FROM ${metadata.tableName}`;
    } else {
        selectClause = string `SELECT artifact_id, ${metadata.stateColumn} AS state FROM ${metadata.tableName}`;
    }

    sql:ParameterizedQuery query = sql:queryConcat(
            sqlQueryFromString(selectClause),
            ` WHERE runtime_id = ${runtimeId} AND `,
            sqlQueryFromString(metadata.nameColumn),
            ` = ${artifactName} LIMIT 1`
    );

    stream<types:ArtifactQueryResult, sql:Error?> resultStream = dbClient->query(query);
    types:ArtifactQueryResult[] results = check from types:ArtifactQueryResult state in resultStream
        select state;
    check resultStream.close();

    if results.length() > 0 {
        return results[0];
    }
    return ();
}

// Helper function to process MI control command
isolated function processMIControlCommand(
        string runtimeId,
        string componentId,
        string artifactName,
        string artifactType,
        string currentState,
        string? currentTracingState,
        string? currentStatisticsState,
        string intendedAction,
        int currentCommandCount
) returns int|error {
    int commandCount = currentCommandCount;

    log:printDebug(string `Processing MI control command for ${artifactType} '${artifactName}': intendedAction=${intendedAction}, currentState=${currentState}, currentTracing=${currentTracingState ?: "N/A"}, currentStatistics=${currentStatisticsState ?: "N/A"}`);

    // Determine if command is needed
    boolean needsCommand = false;
    types:MIControlAction? actionToIssue = ();

    if intendedAction == "ARTIFACT_DISABLE" && currentState == "enabled" {
        needsCommand = true;
        actionToIssue = types:ARTIFACT_DISABLE;
        log:printInfo(string `Command needed for ${artifactType} '${artifactName}': DISABLE (intended=ARTIFACT_DISABLE, current=enabled)`);
    } else if intendedAction == "ARTIFACT_ENABLE" && currentState == "disabled" {
        needsCommand = true;
        actionToIssue = types:ARTIFACT_ENABLE;
        log:printInfo(string `Command needed for ${artifactType} '${artifactName}': ENABLE (intended=ARTIFACT_ENABLE, current=disabled)`);
    } else if intendedAction == "ARTIFACT_ENABLE_TRACING" {
        string tracingState = currentTracingState ?: "disabled";
        if tracingState == "disabled" {
            needsCommand = true;
            actionToIssue = types:ARTIFACT_ENABLE_TRACING;
            log:printInfo(string `Command needed for ${artifactType} '${artifactName}': ENABLE_TRACING (intended=ARTIFACT_ENABLE_TRACING, currentTracing=${tracingState})`);
        }
    } else if intendedAction == "ARTIFACT_DISABLE_TRACING" {
        string tracingState = currentTracingState ?: "disabled";
        if tracingState == "enabled" {
            needsCommand = true;
            actionToIssue = types:ARTIFACT_DISABLE_TRACING;
            log:printInfo(string `Command needed for ${artifactType} '${artifactName}': DISABLE_TRACING (intended=ARTIFACT_DISABLE_TRACING, currentTracing=${tracingState})`);
        }
    } else if intendedAction == "ARTIFACT_ENABLE_STATISTICS" {
        string statisticsState = currentStatisticsState ?: "disabled";
        if statisticsState == "disabled" {
            needsCommand = true;
            actionToIssue = types:ARTIFACT_ENABLE_STATISTICS;
            log:printInfo(string `Command needed for ${artifactType} '${artifactName}': ENABLE_STATISTICS (intended=ARTIFACT_ENABLE_STATISTICS, currentStatistics=${statisticsState})`);
        }
    } else if intendedAction == "ARTIFACT_DISABLE_STATISTICS" {
        string statisticsState = currentStatisticsState ?: "disabled";
        if statisticsState == "enabled" {
            needsCommand = true;
            actionToIssue = types:ARTIFACT_DISABLE_STATISTICS;
            log:printInfo(string `Command needed for ${artifactType} '${artifactName}': DISABLE_STATISTICS (intended=ARTIFACT_DISABLE_STATISTICS, currentStatistics=${statisticsState})`);
        }
    }

    if !needsCommand {
        log:printDebug(string `No command needed for ${artifactType} '${artifactName}': already in desired state (intended=${intendedAction}, currentState=${currentState}, currentTracing=${currentTracingState ?: "N/A"}, currentStatistics=${currentStatisticsState ?: "N/A"})`);
    }

    if needsCommand && actionToIssue is types:MIControlAction {
        // Insert MI control command to DB
        log:printInfo(string `Inserting MI control command: runtime=${runtimeId}, component=${componentId}, artifact=${artifactName}, action=${actionToIssue}`);
        error? insertResult = insertMIControlCommand(runtimeId, componentId, artifactName, artifactType, actionToIssue);

        if insertResult is () {
            commandCount += 1;
            log:printInfo(string `Successfully inserted MI control command for ${artifactType} '${artifactName}' : ${actionToIssue} (intended=${intendedAction}, currentState=${currentState}, currentTracing=${currentTracingState ?: "N/A"})`);
        } else {
            log:printError(string `Failed to insert MI control command for ${artifactType} '${artifactName}'`, insertResult);
        }
    }

    return commandCount;
}

// Upsert runtime record
isolated function upsertRuntime(types:Heartbeat heartbeat) returns boolean|error {
    // Use default values if management hostname and port are not provided
    string runtimeHostname = heartbeat.runtimeHostname ?: "";
    string runtimePort = heartbeat.runtimePort ?: "";

    sql:ExecutionResult|error insertRes = dbClient->execute(`
        INSERT INTO runtimes (
            runtime_id, name, runtime_type, status, version,
            runtime_hostname, runtime_port,
            environment_id, project_id, component_id,
            platform_name, platform_version, platform_home,
            os_name, os_version,
            carbon_home, java_vendor, java_version, 
            total_memory, free_memory, max_memory, used_memory,
            os_arch, server_name, last_heartbeat
        ) VALUES (
            ${heartbeat.runtime}, ${heartbeat.runtime}, ${heartbeat.runtimeType}, ${heartbeat.status}, ${heartbeat.version},
            ${runtimeHostname}, ${runtimePort},
            ${heartbeat.environment}, ${heartbeat.project}, ${heartbeat.component},
            ${heartbeat.nodeInfo.platformName}, ${heartbeat.nodeInfo.platformVersion}, ${heartbeat.nodeInfo.platformHome},
            ${heartbeat.nodeInfo.osName}, ${heartbeat.nodeInfo.osVersion},
            ${heartbeat.nodeInfo.carbonHome}, ${heartbeat.nodeInfo.javaVendor}, ${heartbeat.nodeInfo.javaVersion}, 
            ${heartbeat.nodeInfo.totalMemory}, ${heartbeat.nodeInfo.freeMemory}, ${heartbeat.nodeInfo.maxMemory}, ${heartbeat.nodeInfo.usedMemory},
            ${heartbeat.nodeInfo.osArch}, ${heartbeat.nodeInfo.platformName}, CURRENT_TIMESTAMP
        )
    `);

    if insertRes is sql:ExecutionResult {
        int? rows = insertRes.affectedRowCount;
        return rows == 1;
    }

    _ = check dbClient->execute(`
        UPDATE runtimes SET
            name = ${heartbeat.runtime},
            runtime_type = ${heartbeat.runtimeType},
            status = ${heartbeat.status},
            version = ${heartbeat.version},
            runtime_hostname = ${runtimeHostname},
            runtime_port = ${runtimePort},
            environment_id = ${heartbeat.environment},
            project_id = ${heartbeat.project},
            component_id = ${heartbeat.component},
            platform_name = ${heartbeat.nodeInfo.platformName},
            platform_version = ${heartbeat.nodeInfo.platformVersion},
            platform_home = ${heartbeat.nodeInfo.platformHome},
            os_name = ${heartbeat.nodeInfo.osName},
            os_version = ${heartbeat.nodeInfo.osVersion},
            carbon_home = ${heartbeat.nodeInfo.carbonHome},
            java_vendor = ${heartbeat.nodeInfo.javaVendor},
            java_version = ${heartbeat.nodeInfo.javaVersion},
            total_memory = ${heartbeat.nodeInfo.totalMemory},
            free_memory = ${heartbeat.nodeInfo.freeMemory},
            max_memory = ${heartbeat.nodeInfo.maxMemory},
            used_memory = ${heartbeat.nodeInfo.usedMemory},
            os_arch = ${heartbeat.nodeInfo.osArch},
            server_name = ${heartbeat.nodeInfo.platformName},
            last_heartbeat = CURRENT_TIMESTAMP
        WHERE runtime_id = ${heartbeat.runtime}
    `);

    return false;
}

// Insert all runtime artifacts
isolated function insertRuntimeArtifacts(types:Heartbeat heartbeat) returns error? {
    // Insert services with UPSERT logic
    foreach types:Service serviceDetail in heartbeat.artifacts.services {
        if dbType == MSSQL {
            _ = check dbClient->execute(`
                MERGE INTO runtime_services AS target
                USING (VALUES (${heartbeat.runtime}, ${serviceDetail.name}, ${serviceDetail.package}, 
                       ${serviceDetail.basePath}, ${serviceDetail.state})) 
                       AS source (runtime_id, service_name, service_package, base_path, state)
                ON (target.runtime_id = source.runtime_id AND target.service_name = source.service_name 
                    AND target.service_package = source.service_package)
                WHEN MATCHED THEN
                    UPDATE SET base_path = source.base_path, state = source.state, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, service_name, service_package, base_path, state)
                    VALUES (source.runtime_id, source.service_name, source.service_package, source.base_path, source.state);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_services (
                    runtime_id, service_name, service_package, base_path, state
                ) VALUES (
                    ${heartbeat.runtime}, ${serviceDetail.name},
                    ${serviceDetail.package}, ${serviceDetail.basePath},
                    ${serviceDetail.state}
                )
                ON CONFLICT (runtime_id, service_name, service_package) DO UPDATE SET
                    base_path = EXCLUDED.base_path,
                    state = EXCLUDED.state,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_services (
                    runtime_id, service_name, service_package, base_path, state
                ) VALUES (
                    ${heartbeat.runtime}, ${serviceDetail.name},
                    ${serviceDetail.package}, ${serviceDetail.basePath},
                    ${serviceDetail.state}
                )
                ON DUPLICATE KEY UPDATE
                    base_path = VALUES(base_path),
                    state = VALUES(state),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }

        // Upsert resources for this service
        foreach types:Resource resourceDetail in serviceDetail.resources {
            string methodsJson = resourceDetail.methods.toJsonString();
            if dbType == MSSQL {
                _ = check dbClient->execute(`
                    MERGE INTO service_resources AS target
                    USING (VALUES (${heartbeat.runtime}, ${serviceDetail.name}, ${resourceDetail.url}, ${methodsJson}))
                           AS source (runtime_id, service_name, resource_url, methods)
                    ON (target.runtime_id = source.runtime_id AND target.service_name = source.service_name 
                        AND target.resource_url = source.resource_url)
                    WHEN MATCHED THEN
                        UPDATE SET methods = source.methods, updated_at = CURRENT_TIMESTAMP
                    WHEN NOT MATCHED THEN
                        INSERT (runtime_id, service_name, resource_url, methods)
                        VALUES (source.runtime_id, source.service_name, source.resource_url, source.methods);
                `);
            } else if dbType == POSTGRESQL {
                _ = check dbClient->execute(`
                    INSERT INTO service_resources (
                        runtime_id, service_name, resource_url, methods
                    ) VALUES (
                        ${heartbeat.runtime}, ${serviceDetail.name},
                        ${resourceDetail.url}, ${methodsJson}::jsonb
                    )
                    ON CONFLICT (runtime_id, service_name, resource_url) DO UPDATE SET
                        methods = EXCLUDED.methods,
                        updated_at = CURRENT_TIMESTAMP
                `);
            } else {
                _ = check dbClient->execute(`
                    INSERT INTO service_resources (
                        runtime_id, service_name, resource_url, methods
                    ) VALUES (
                        ${heartbeat.runtime}, ${serviceDetail.name},
                        ${resourceDetail.url}, ${methodsJson}
                    )
                    ON DUPLICATE KEY UPDATE
                        methods = VALUES(methods),
                        updated_at = CURRENT_TIMESTAMP
                `);
            }
        }
    }

    // Insert listeners with UPSERT logic
    foreach types:Listener listenerDetail in heartbeat.artifacts.listeners {
        string? host = listenerDetail?.host;
        int? port = listenerDetail?.port;
        if dbType == MSSQL {
            _ = check dbClient->execute(`
                MERGE INTO runtime_listeners AS target
                USING (VALUES (${heartbeat.runtime}, ${listenerDetail.name}, ${listenerDetail.package}, 
                       ${listenerDetail.protocol}, ${host}, ${port}, ${listenerDetail.state})) 
                       AS source (runtime_id, listener_name, listener_package, protocol, listener_host, listener_port, state)
                ON (target.runtime_id = source.runtime_id AND target.listener_name = source.listener_name)
                WHEN MATCHED THEN
                    UPDATE SET listener_package = source.listener_package, protocol = source.protocol,
                               listener_host = source.listener_host, listener_port = source.listener_port,
                               state = source.state, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, listener_name, listener_package, protocol, listener_host, listener_port, state)
                    VALUES (source.runtime_id, source.listener_name, source.listener_package, source.protocol,
                            source.listener_host, source.listener_port, source.state);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_listeners (
                    runtime_id, listener_name, listener_package, protocol, listener_host, listener_port, state
                ) VALUES (
                    ${heartbeat.runtime}, ${listenerDetail.name},
                    ${listenerDetail.package}, ${listenerDetail.protocol},
                    ${host}, ${port},
                    ${listenerDetail.state}
                )
                ON CONFLICT (runtime_id, listener_name) DO UPDATE SET
                    listener_package = EXCLUDED.listener_package,
                    protocol = EXCLUDED.protocol,
                    listener_host = EXCLUDED.listener_host,
                    listener_port = EXCLUDED.listener_port,
                    state = EXCLUDED.state,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_listeners (
                    runtime_id, listener_name, listener_package, protocol, listener_host, listener_port, state
                ) VALUES (
                    ${heartbeat.runtime}, ${listenerDetail.name},
                    ${listenerDetail.package}, ${listenerDetail.protocol},
                    ${host}, ${port},
                    ${listenerDetail.state}
                )
                ON DUPLICATE KEY UPDATE
                    listener_package = VALUES(listener_package),
                    protocol = VALUES(protocol),
                    listener_host = VALUES(listener_host),
                    listener_port = VALUES(listener_port),
                    state = VALUES(state),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    check insertMIArtifacts(heartbeat);
    check insertAdditionalMIArtifacts(heartbeat);
}

// Delete existing artifacts
isolated function deleteExistingArtifacts(string runtimeId) returns error? {
    _ = check dbClient->execute(`DELETE FROM runtime_services WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_listeners WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM service_resources WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_api_resources WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_apis WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_proxy_services WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_proxy_service_endpoints WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_endpoints WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_endpoint_attributes WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_inbound_endpoints WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_sequences WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_tasks WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_templates WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_message_stores WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_message_processors WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_local_entries WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_data_services WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_carbon_apps WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_data_sources WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_connectors WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_registry_resources WHERE runtime_id = ${runtimeId}`);
}

// Insert MI artifacts
isolated function insertMIArtifacts(types:Heartbeat heartbeat) returns error? {
    foreach types:RestApi api in <types:RestApi[]>heartbeat.artifacts.apis {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = api?.carbonApp;
        if dbType == MSSQL {
            _ = check dbClient->execute(`
                MERGE INTO runtime_apis AS target
                USING (VALUES (${heartbeat.runtime}, ${api.name}, ${artifactId}, ${api.url}, ${api.context},
                       ${api.version}, ${api.state}, ${api.tracing}, ${api.statistics}, ${carbonApp}))
                       AS source (runtime_id, api_name, artifact_id, url, context, version, state, tracing, [statistics], carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.api_name = source.api_name)
                WHEN MATCHED THEN
                    UPDATE SET url = source.url, context = source.context, version = source.version,
                               state = source.state, tracing = source.tracing, [statistics] = source.[statistics], carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, api_name, artifact_id, url, context, version, state, tracing, [statistics], carbon_app)
                    VALUES (source.runtime_id, source.api_name, source.artifact_id, source.url, source.context, source.version, source.state, source.tracing, source.[statistics], source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_apis (
                    runtime_id, api_name, url, context, version, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${api.name}, ${api.url},
                    ${api.context}, ${api.version}, ${api.state}, ${api.tracing}, ${api.statistics}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, api_name) DO UPDATE SET
                    url = EXCLUDED.url,
                    context = EXCLUDED.context,
                    version = EXCLUDED.version,
                    state = EXCLUDED.state,
                    tracing = EXCLUDED.tracing,
                    statistics = EXCLUDED.statistics,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_apis (
                    runtime_id, api_name, artifact_id, url, context, version, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${api.name}, ${artifactId}, ${api.url},
                    ${api.context}, ${api.version}, ${api.state}, ${api.tracing}, ${api.statistics}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    url = VALUES(url),
                    context = VALUES(context),
                    version = VALUES(version),
                    state = VALUES(state),
                    tracing = VALUES(tracing),
                    statistics = VALUES(statistics),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }

        // Insert API resources for this API
        foreach types:ApiResource apiResource in api.resources {
            // MI sends methods as a single string (e.g., "POST"), store as-is
            if dbType == MSSQL {
                _ = check dbClient->execute(`
                    MERGE INTO runtime_api_resources AS target
                    USING (VALUES (${heartbeat.runtime}, ${api.name}, ${apiResource.path}, ${apiResource.methods})) 
                           AS source (runtime_id, api_name, resource_path, methods)
                    ON (target.runtime_id = source.runtime_id AND target.api_name = source.api_name 
                        AND target.resource_path = source.resource_path)
                    WHEN MATCHED THEN
                        UPDATE SET methods = source.methods, updated_at = CURRENT_TIMESTAMP
                    WHEN NOT MATCHED THEN
                        INSERT (runtime_id, api_name, resource_path, methods)
                        VALUES (source.runtime_id, source.api_name, source.resource_path, source.methods);
                `);
            } else if dbType == POSTGRESQL {
                _ = check dbClient->execute(`
                    INSERT INTO runtime_api_resources (
                        runtime_id, api_name, resource_path, methods
                    ) VALUES (
                        ${heartbeat.runtime}, ${api.name},
                        ${apiResource.path}, ${apiResource.methods}
                    )
                    ON CONFLICT (runtime_id, api_name, resource_path) DO UPDATE SET
                        methods = EXCLUDED.methods,
                        updated_at = CURRENT_TIMESTAMP
                `);
            } else {
                _ = check dbClient->execute(`
                    INSERT INTO runtime_api_resources (
                        runtime_id, api_name, resource_path, methods
                    ) VALUES (
                        ${heartbeat.runtime}, ${api.name},
                        ${apiResource.path}, ${apiResource.methods}
                    )
                    ON DUPLICATE KEY UPDATE
                        methods = VALUES(methods),
                        updated_at = CURRENT_TIMESTAMP
                `);
            }
        }
    }

    foreach types:ProxyService proxy in <types:ProxyService[]>heartbeat.artifacts.proxyServices {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = proxy?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_proxy_services AS target
                USING (VALUES (${heartbeat.runtime}, ${proxy.name}, ${artifactId}, ${proxy.state}, ${proxy.tracing}, ${proxy.statistics}, ${carbonApp}))
                       AS source (runtime_id, proxy_name, artifact_id, state, tracing, [statistics], carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.proxy_name = source.proxy_name)
                WHEN MATCHED THEN
                    UPDATE SET state = source.state, tracing = source.tracing, [statistics] = source.[statistics], carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, proxy_name, artifact_id, state, tracing, [statistics], carbon_app)
                    VALUES (source.runtime_id, source.proxy_name, source.artifact_id, source.state, source.tracing, source.[statistics], source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_proxy_services (
                    runtime_id, proxy_name, artifact_id, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${proxy.name}, ${artifactId}, ${proxy.state}, ${proxy.tracing}, ${proxy.statistics}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, proxy_name) DO UPDATE SET
                    state = EXCLUDED.state,
                    tracing = EXCLUDED.tracing,
                    statistics = EXCLUDED.statistics,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_proxy_services (
                    runtime_id, proxy_name, artifact_id, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${proxy.name}, ${artifactId}, ${proxy.state}, ${proxy.tracing}, ${proxy.statistics}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    state = VALUES(state),
                    tracing = VALUES(tracing),
                    statistics = VALUES(statistics),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }

        // Persist endpoints if present
        if proxy.endpoints is string[] {
            foreach string ep in <string[]>proxy.endpoints {
                if isMSSQL() {
                    _ = check dbClient->execute(`
                        MERGE INTO runtime_proxy_service_endpoints AS target
                        USING (VALUES (${heartbeat.runtime}, ${proxy.name}, ${ep}))
                               AS source (runtime_id, proxy_name, endpoint_url)
                        ON (target.runtime_id = source.runtime_id AND target.proxy_name = source.proxy_name AND target.endpoint_url = source.endpoint_url)
                        WHEN MATCHED THEN
                            UPDATE SET updated_at = CURRENT_TIMESTAMP
                        WHEN NOT MATCHED THEN
                            INSERT (runtime_id, proxy_name, endpoint_url)
                            VALUES (source.runtime_id, source.proxy_name, source.endpoint_url);
                    `);
                } else if dbType == POSTGRESQL {
                    _ = check dbClient->execute(`
                        INSERT INTO runtime_proxy_service_endpoints (
                            runtime_id, proxy_name, endpoint_url
                        ) VALUES (
                            ${heartbeat.runtime}, ${proxy.name}, ${ep}
                        )
                        ON CONFLICT (runtime_id, proxy_name, endpoint_url) DO UPDATE SET
                            updated_at = CURRENT_TIMESTAMP
                    `);
                } else {
                    _ = check dbClient->execute(`
                        INSERT INTO runtime_proxy_service_endpoints (
                            runtime_id, proxy_name, endpoint_url
                        ) VALUES (
                            ${heartbeat.runtime}, ${proxy.name}, ${ep}
                        )
                        ON DUPLICATE KEY UPDATE
                            updated_at = CURRENT_TIMESTAMP
                    `);
                }
            }
        }
    }

    foreach types:Endpoint endpoint in <types:Endpoint[]>heartbeat.artifacts.endpoints {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = endpoint?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_endpoints AS target
                USING (VALUES (${heartbeat.runtime}, ${endpoint.name}, ${artifactId}, ${endpoint.'type}, ${endpoint.state}, ${endpoint.tracing}, ${endpoint.statistics}, ${carbonApp}))
                       AS source (runtime_id, endpoint_name, artifact_id, endpoint_type, state, tracing, [statistics], carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.endpoint_name = source.endpoint_name)
                WHEN MATCHED THEN
                    UPDATE SET endpoint_type = source.endpoint_type, state = source.state, tracing = source.tracing, [statistics] = source.[statistics], carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, endpoint_name, artifact_id, endpoint_type, state, tracing, [statistics], carbon_app)
                    VALUES (source.runtime_id, source.endpoint_name, source.artifact_id, source.endpoint_type, source.state, source.tracing, source.[statistics], source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_endpoints (
                    runtime_id, endpoint_name, artifact_id, endpoint_type, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${endpoint.name}, ${artifactId}, ${endpoint.'type},
                    ${endpoint.state}, ${endpoint.tracing}, ${endpoint.statistics}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, endpoint_name) DO UPDATE SET
                    endpoint_type = EXCLUDED.endpoint_type,
                    state = EXCLUDED.state,
                    tracing = EXCLUDED.tracing,
                    statistics = EXCLUDED.statistics,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_endpoints (
                    runtime_id, endpoint_name, artifact_id, endpoint_type, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${endpoint.name}, ${artifactId}, ${endpoint.'type},
                    ${endpoint.state}, ${endpoint.tracing}, ${endpoint.statistics}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    endpoint_type = VALUES(endpoint_type),
                    state = VALUES(state),
                    tracing = VALUES(tracing),
                    statistics = VALUES(statistics),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }

        // Persist endpoint attributes if present
        var attrsVal = endpoint?.attributes;
        if attrsVal is types:EndpointAttribute[] {
            foreach types:EndpointAttribute attr in attrsVal {
                if isMSSQL() {
                    _ = check dbClient->execute(`
                        MERGE INTO runtime_endpoint_attributes AS target
                        USING (VALUES (${heartbeat.runtime}, ${endpoint.name}, ${attr.name}, ${attr?.value}))
                               AS source (runtime_id, endpoint_name, attribute_name, attribute_value)
                        ON (target.runtime_id = source.runtime_id AND target.endpoint_name = source.endpoint_name AND target.attribute_name = source.attribute_name)
                        WHEN MATCHED THEN
                            UPDATE SET attribute_value = source.attribute_value, updated_at = CURRENT_TIMESTAMP
                        WHEN NOT MATCHED THEN
                            INSERT (runtime_id, endpoint_name, attribute_name, attribute_value)
                            VALUES (source.runtime_id, source.endpoint_name, source.attribute_name, source.attribute_value);
                    `);
                } else if dbType == POSTGRESQL {
                    _ = check dbClient->execute(`
                        INSERT INTO runtime_endpoint_attributes (
                            runtime_id, endpoint_name, attribute_name, attribute_value
                        ) VALUES (
                            ${heartbeat.runtime}, ${endpoint.name}, ${attr.name}, ${attr?.value}
                        )
                        ON CONFLICT (runtime_id, endpoint_name, attribute_name) DO UPDATE SET
                            attribute_value = EXCLUDED.attribute_value,
                            updated_at = CURRENT_TIMESTAMP
                    `);
                } else {
                    _ = check dbClient->execute(`
                        INSERT INTO runtime_endpoint_attributes (
                            runtime_id, endpoint_name, attribute_name, attribute_value
                        ) VALUES (
                            ${heartbeat.runtime}, ${endpoint.name}, ${attr.name}, ${attr?.value}
                        )
                        ON DUPLICATE KEY UPDATE
                            attribute_value = VALUES(attribute_value),
                            updated_at = CURRENT_TIMESTAMP
                    `);
                }
            }
        }
    }
}

// Insert additional MI artifacts
isolated function insertAdditionalMIArtifacts(types:Heartbeat heartbeat) returns error? {
    foreach types:InboundEndpoint inbound in <types:InboundEndpoint[]>heartbeat.artifacts.inboundEndpoints {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = inbound?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_inbound_endpoints AS target
                USING (VALUES (${heartbeat.runtime}, ${inbound.name}, ${artifactId}, ${inbound.protocol}, ${inbound.sequence}, ${inbound.state}, ${inbound.statistics}, ${inbound.onError}, ${inbound.tracing}, ${carbonApp}))
                       AS source (runtime_id, inbound_name, artifact_id, protocol, sequence, state, [statistics], on_error, tracing, carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.inbound_name = source.inbound_name)
                WHEN MATCHED THEN
                    UPDATE SET protocol = source.protocol, sequence = source.sequence, state = source.state, [statistics] = source.[statistics], on_error = source.on_error, tracing = source.tracing, carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, inbound_name, artifact_id, protocol, sequence, state, [statistics], on_error, tracing, carbon_app)
                    VALUES (source.runtime_id, source.inbound_name, source.artifact_id, source.protocol, source.sequence, source.state, source.[statistics], source.on_error, source.tracing, source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_inbound_endpoints (
                    runtime_id, inbound_name, protocol, sequence, state, statistics, on_error, tracing, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${inbound.name}, ${inbound.protocol},
                    ${inbound.sequence}, ${inbound.state}, ${inbound.statistics}, ${inbound.onError}, ${inbound.tracing}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, inbound_name) DO UPDATE SET
                    protocol = EXCLUDED.protocol,
                    sequence = EXCLUDED.sequence,
                    state = EXCLUDED.state,
                    statistics = EXCLUDED.statistics,
                    on_error = EXCLUDED.on_error,
                    tracing = EXCLUDED.tracing,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_inbound_endpoints (
                    runtime_id, inbound_name, artifact_id, protocol, sequence, state, statistics, on_error, tracing, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${inbound.name}, ${artifactId}, ${inbound.protocol},
                    ${inbound.sequence}, ${inbound.state}, ${inbound.statistics}, ${inbound.onError}, ${inbound.tracing}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    protocol = VALUES(protocol),
                    sequence = VALUES(sequence),
                    state = VALUES(state),
                    statistics = VALUES(statistics),
                    on_error = VALUES(on_error),
                    tracing = VALUES(tracing),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:Sequence sequence in <types:Sequence[]>heartbeat.artifacts.sequences {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = sequence?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_sequences AS target
                USING (VALUES (${heartbeat.runtime}, ${sequence.name}, ${artifactId}, ${sequence.'type}, ${sequence.container}, ${sequence.state}, ${sequence.tracing}, ${sequence.statistics}, ${carbonApp}))
                       AS source (runtime_id, sequence_name, artifact_id, sequence_type, container, state, tracing, [statistics], carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.sequence_name = source.sequence_name)
                WHEN MATCHED THEN
                    UPDATE SET sequence_type = source.sequence_type, container = source.container, state = source.state, tracing = source.tracing, [statistics] = source.[statistics], carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, sequence_name, artifact_id, sequence_type, container, state, tracing, [statistics], carbon_app)
                    VALUES (source.runtime_id, source.sequence_name, source.artifact_id, source.sequence_type, source.container, source.state, source.tracing, source.[statistics], source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_sequences (
                    runtime_id, sequence_name, sequence_type, container, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${sequence.name}, ${sequence.'type},
                    ${sequence.container}, ${sequence.state}, ${sequence.tracing}, ${sequence.statistics}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, sequence_name) DO UPDATE SET
                    sequence_type = EXCLUDED.sequence_type,
                    container = EXCLUDED.container,
                    state = EXCLUDED.state,
                    tracing = EXCLUDED.tracing,
                    statistics = EXCLUDED.statistics,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_sequences (
                    runtime_id, sequence_name, artifact_id, sequence_type, container, state, tracing, statistics, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${sequence.name}, ${artifactId}, ${sequence.'type},
                    ${sequence.container}, ${sequence.state}, ${sequence.tracing}, ${sequence.statistics}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    sequence_type = VALUES(sequence_type),
                    container = VALUES(container),
                    state = VALUES(state),
                    tracing = VALUES(tracing),
                    statistics = VALUES(statistics),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:Task task in <types:Task[]>heartbeat.artifacts.tasks {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = task?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_tasks AS target
                USING (VALUES (${heartbeat.runtime}, ${task.name}, ${artifactId}, ${task.'class}, ${task.group}, ${task.state}, ${carbonApp}))
                       AS source (runtime_id, task_name, artifact_id, task_class, task_group, state, carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.task_name = source.task_name)
                WHEN MATCHED THEN
                    UPDATE SET task_class = source.task_class, task_group = source.task_group, state = source.state, carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, task_name, artifact_id, task_class, task_group, state, carbon_app)
                    VALUES (source.runtime_id, source.task_name, source.artifact_id, source.task_class, source.task_group, source.state, source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_tasks (
                    runtime_id, task_name, task_class, task_group, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${task.name}, ${task.'class},
                    ${task.group}, ${task.state}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, task_name) DO UPDATE SET
                    task_class = EXCLUDED.task_class,
                    task_group = EXCLUDED.task_group,
                    state = EXCLUDED.state,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_tasks (
                    runtime_id, task_name, artifact_id, task_class, task_group, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${task.name}, ${artifactId}, ${task.'class},
                    ${task.group}, ${task.state}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    task_class = VALUES(task_class),
                    task_group = VALUES(task_group),
                    state = VALUES(state),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:Template template in <types:Template[]>heartbeat.artifacts.templates {
        string? carbonApp = template?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_templates AS target
                USING (VALUES (${heartbeat.runtime}, ${template.name}, ${template.'type}, ${carbonApp}))
                       AS source (runtime_id, template_name, template_type, carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.template_name = source.template_name)
                WHEN MATCHED THEN
                    UPDATE SET template_type = source.template_type, carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, template_name, template_type, carbon_app)
                    VALUES (source.runtime_id, source.template_name, source.template_type, source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_templates (
                    runtime_id, template_name, template_type, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${template.name}, ${template.'type}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, template_name) DO UPDATE SET
                    template_type = EXCLUDED.template_type,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_templates (
                    runtime_id, template_name, template_type, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${template.name}, ${template.'type}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    template_type = VALUES(template_type),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:MessageStore store in <types:MessageStore[]>heartbeat.artifacts.messageStores {
        string? carbonApp = store?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_message_stores AS target
                USING (VALUES (${heartbeat.runtime}, ${store.name}, ${store.'type}, ${store.size}, ${carbonApp}))
                       AS source (runtime_id, store_name, store_type, size, carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.store_name = source.store_name)
                WHEN MATCHED THEN
                    UPDATE SET store_type = source.store_type, size = source.size, carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, store_name, store_type, size, carbon_app)
                    VALUES (source.runtime_id, source.store_name, source.store_type, source.size, source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_message_stores (
                    runtime_id, store_name, store_type, size, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${store.name}, ${store.'type}, ${store.size}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, store_name) DO UPDATE SET
                    store_type = EXCLUDED.store_type,
                    size = EXCLUDED.size,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_message_stores (
                    runtime_id, store_name, store_type, size, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${store.name}, ${store.'type}, ${store.size}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    store_type = VALUES(store_type),
                    size = VALUES(size),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:MessageProcessor processor in <types:MessageProcessor[]>heartbeat.artifacts.messageProcessors {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = processor?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_message_processors AS target
                USING (VALUES (${heartbeat.runtime}, ${processor.name}, ${artifactId}, ${processor.'type}, ${processor.'class}, ${processor.state}, ${carbonApp}))
                       AS source (runtime_id, processor_name, artifact_id, processor_type, processor_class, state, carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.processor_name = source.processor_name)
                WHEN MATCHED THEN
                    UPDATE SET processor_type = source.processor_type, processor_class = source.processor_class, state = source.state, carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, processor_name, artifact_id, processor_type, processor_class, state, carbon_app)
                    VALUES (source.runtime_id, source.processor_name, source.artifact_id, source.processor_type, source.processor_class, source.state, source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_message_processors (
                    runtime_id, processor_name, processor_type, processor_class, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${processor.name}, ${processor.'type},
                    ${processor.'class}, ${processor.state}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, processor_name) DO UPDATE SET
                    processor_type = EXCLUDED.processor_type,
                    processor_class = EXCLUDED.processor_class,
                    state = EXCLUDED.state,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_message_processors (
                    runtime_id, processor_name, artifact_id, processor_type, processor_class, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${processor.name}, ${artifactId}, ${processor.'type},
                    ${processor.'class}, ${processor.state}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    processor_type = VALUES(processor_type),
                    processor_class = VALUES(processor_class),
                    state = VALUES(state),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:LocalEntry entry in <types:LocalEntry[]>heartbeat.artifacts.localEntries {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = entry?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_local_entries AS target
                USING (VALUES (${heartbeat.runtime}, ${entry.name}, ${artifactId}, ${entry.'type}, ${entry.value}, ${entry.state}, ${carbonApp}))
                       AS source (runtime_id, entry_name, artifact_id, entry_type, entry_value, state, carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.entry_name = source.entry_name)
                WHEN MATCHED THEN
                    UPDATE SET entry_type = source.entry_type, entry_value = source.entry_value, state = source.state, carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, entry_name, artifact_id, entry_type, entry_value, state, carbon_app)
                    VALUES (source.runtime_id, source.entry_name, source.artifact_id, source.entry_type, source.entry_value, source.state, source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_local_entries (
                    runtime_id, entry_name, entry_type, entry_value, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${entry.name}, ${entry.'type},
                    ${entry.value}, ${entry.state}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, entry_name) DO UPDATE SET
                    entry_type = EXCLUDED.entry_type,
                    entry_value = EXCLUDED.entry_value,
                    state = EXCLUDED.state,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_local_entries (
                    runtime_id, entry_name, artifact_id, entry_type, entry_value, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${entry.name}, ${artifactId}, ${entry.'type},
                    ${entry.value}, ${entry.state}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    entry_type = VALUES(entry_type),
                    entry_value = VALUES(entry_value),
                    state = VALUES(state),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:DataService dataService in <types:DataService[]>heartbeat.artifacts.dataServices {
        string artifactId = uuid:createType4AsString();
        string? carbonApp = dataService?.carbonApp;
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_data_services AS target
                USING (VALUES (${heartbeat.runtime}, ${dataService.name}, ${artifactId}, ${dataService.description}, ${dataService.wsdl}, ${dataService.state}, ${carbonApp}))
                       AS source (runtime_id, service_name, artifact_id, description, wsdl, state, carbon_app)
                ON (target.runtime_id = source.runtime_id AND target.service_name = source.service_name)
                WHEN MATCHED THEN
                    UPDATE SET description = source.description, wsdl = source.wsdl, state = source.state, carbon_app = source.carbon_app, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, service_name, artifact_id, description, wsdl, state, carbon_app)
                    VALUES (source.runtime_id, source.service_name, source.artifact_id, source.description, source.wsdl, source.state, source.carbon_app);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_data_services (
                    runtime_id, service_name, description, wsdl, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${dataService.name}, ${dataService.description},
                    ${dataService.wsdl}, ${dataService.state}, ${carbonApp}
                )
                ON CONFLICT (runtime_id, service_name) DO UPDATE SET
                    description = EXCLUDED.description,
                    wsdl = EXCLUDED.wsdl,
                    state = EXCLUDED.state,
                    carbon_app = EXCLUDED.carbon_app,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_data_services (
                    runtime_id, service_name, artifact_id, description, wsdl, state, carbon_app
                ) VALUES (
                    ${heartbeat.runtime}, ${dataService.name}, ${artifactId}, ${dataService.description},
                    ${dataService.wsdl}, ${dataService.state}, ${carbonApp}
                )
                ON DUPLICATE KEY UPDATE
                    description = VALUES(description),
                    wsdl = VALUES(wsdl),
                    state = VALUES(state),
                    carbon_app = VALUES(carbon_app),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:CarbonApp app in <types:CarbonApp[]>heartbeat.artifacts.carbonApps {
        string? artifactsJson = app.artifacts is types:CarbonAppArtifact[]
            ? (<types:CarbonAppArtifact[]>app.artifacts).toJsonString()
            : ();
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_carbon_apps AS target
                USING (VALUES (${heartbeat.runtime}, ${app.name}, ${app.version}, ${app.state}, ${artifactsJson}))
                       AS source (runtime_id, app_name, version, state, artifacts)
                ON (target.runtime_id = source.runtime_id AND target.app_name = source.app_name)
                WHEN MATCHED THEN
                    UPDATE SET version = source.version, state = source.state, artifacts = source.artifacts, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, app_name, version, state, artifacts)
                    VALUES (source.runtime_id, source.app_name, source.version, source.state, source.artifacts);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_carbon_apps (
                    runtime_id, app_name, version, state, artifacts
                ) VALUES (
                    ${heartbeat.runtime}, ${app.name}, ${app.version}, ${app.state}, ${artifactsJson}
                )
                ON CONFLICT (runtime_id, app_name) DO UPDATE SET
                    version = EXCLUDED.version,
                    state = EXCLUDED.state,
                    artifacts = EXCLUDED.artifacts,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_carbon_apps (
                    runtime_id, app_name, version, state, artifacts
                ) VALUES (
                    ${heartbeat.runtime}, ${app.name}, ${app.version}, ${app.state}, ${artifactsJson}
                )
                ON DUPLICATE KEY UPDATE
                    version = VALUES(version),
                    state = VALUES(state),
                    artifacts = VALUES(artifacts),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:DataSource dataSource in <types:DataSource[]>heartbeat.artifacts.dataSources {
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_data_sources AS target
                USING (VALUES (${heartbeat.runtime}, ${dataSource.name}, ${dataSource.'type}, ${dataSource.driver}, ${dataSource.url}, ${dataSource.username}, ${dataSource.state}))
                       AS source (runtime_id, datasource_name, datasource_type, driver, url, username, state)
                ON (target.runtime_id = source.runtime_id AND target.datasource_name = source.datasource_name)
                WHEN MATCHED THEN
                    UPDATE SET datasource_type = source.datasource_type, driver = source.driver, url = source.url, username = source.username, state = source.state, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, datasource_name, datasource_type, driver, url, username, state)
                    VALUES (source.runtime_id, source.datasource_name, source.datasource_type, source.driver, source.url, source.username, source.state);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_data_sources (
                    runtime_id, datasource_name, datasource_type, driver, url, username, state
                ) VALUES (
                    ${heartbeat.runtime}, ${dataSource.name}, ${dataSource.'type}, ${dataSource.driver},
                    ${dataSource.url}, ${dataSource.username}, ${dataSource.state}
                )
                ON CONFLICT (runtime_id, datasource_name) DO UPDATE SET
                    datasource_type = EXCLUDED.datasource_type,
                    driver = EXCLUDED.driver,
                    url = EXCLUDED.url,
                    username = EXCLUDED.username,
                    state = EXCLUDED.state,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_data_sources (
                    runtime_id, datasource_name, datasource_type, driver, url, username, state
                ) VALUES (
                    ${heartbeat.runtime}, ${dataSource.name}, ${dataSource.'type}, ${dataSource.driver},
                    ${dataSource.url}, ${dataSource.username}, ${dataSource.state}
                )
                ON DUPLICATE KEY UPDATE
                    datasource_type = VALUES(datasource_type),
                    driver = VALUES(driver),
                    url = VALUES(url),
                    username = VALUES(username),
                    state = VALUES(state),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:Connector connector in <types:Connector[]>heartbeat.artifacts.connectors {
        string artifactId = uuid:createType4AsString();
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_connectors AS target
                USING (VALUES (${heartbeat.runtime}, ${connector.name}, ${artifactId}, ${connector.package}, ${connector.version}, ${connector.state}))
                       AS source (runtime_id, connector_name, artifact_id, package, version, state)
                ON (target.runtime_id = source.runtime_id AND target.connector_name = source.connector_name)
                WHEN MATCHED THEN
                    UPDATE SET version = source.version, state = source.state, updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, connector_name, artifact_id, package, version, state)
                    VALUES (source.runtime_id, source.connector_name, source.artifact_id, source.package, source.version, source.state);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_connectors (
                    runtime_id, connector_name, package, version, state
                ) VALUES (
                    ${heartbeat.runtime}, ${connector.name}, ${connector.package},
                    ${connector.version}, ${connector.state}
                )
                ON CONFLICT (runtime_id, connector_name, package) DO UPDATE SET
                    version = EXCLUDED.version,
                    state = EXCLUDED.state,
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_connectors (
                    runtime_id, connector_name, artifact_id, package, version, state
                ) VALUES (
                    ${heartbeat.runtime}, ${connector.name}, ${artifactId}, ${connector.package},
                    ${connector.version}, ${connector.state}
                )
                ON DUPLICATE KEY UPDATE
                    version = VALUES(version),
                    state = VALUES(state),
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }

    foreach types:RegistryResource registryResource in <types:RegistryResource[]>heartbeat.artifacts.registryResources {
        if isMSSQL() {
            _ = check dbClient->execute(`
                MERGE INTO runtime_registry_resources AS target
                USING (VALUES (${heartbeat.runtime}, ${registryResource.name}, ${registryResource.'type}))
                       AS source (runtime_id, resource_name, resource_type)
                ON (target.runtime_id = source.runtime_id AND target.resource_name = source.resource_name)
                WHEN MATCHED THEN
                    UPDATE SET updated_at = CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (runtime_id, resource_name, resource_type)
                    VALUES (source.runtime_id, source.resource_name, source.resource_type);
            `);
        } else if dbType == POSTGRESQL {
            _ = check dbClient->execute(`
                INSERT INTO runtime_registry_resources (
                    runtime_id, resource_name, resource_type
                ) VALUES (
                    ${heartbeat.runtime}, ${registryResource.name}, ${registryResource.'type}
                )
                ON CONFLICT (runtime_id, resource_name) DO UPDATE SET
                    updated_at = CURRENT_TIMESTAMP
            `);
        } else {
            _ = check dbClient->execute(`
                INSERT INTO runtime_registry_resources (
                    runtime_id, resource_name, resource_type
                ) VALUES (
                    ${heartbeat.runtime}, ${registryResource.name}, ${registryResource.'type}
                )
                ON DUPLICATE KEY UPDATE
                    updated_at = CURRENT_TIMESTAMP
            `);
        }
    }
}
