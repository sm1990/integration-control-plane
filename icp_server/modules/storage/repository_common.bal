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

import ballerina/http;
import ballerina/jwt;
import ballerina/log;
import ballerina/sql;
import ballerina/uuid;

// Shared database connection manager and client
final DatabaseConnectionManager dbManager = check new (dbType);
public final sql:Client dbClient = dbManager.getClient();

// Constants for artifact management
const string ICP_ARTIFACTS_PATH = "/icp/artifacts";

// Record type for artifact lookup
type ArtifactInfoRecord record {|
    string artifact_name;
    string artifact_type;
|};

// Look up artifact info (name and type) by artifact_id
isolated function getArtifactInfoById(string artifactId) returns ArtifactInfoRecord?|error {
    // Search each artifact table for the artifact_id using UNION ALL
    stream<ArtifactInfoRecord, sql:Error?> resultStream = dbClient->query(`
        SELECT api_name AS artifact_name, 'apis' AS artifact_type FROM runtime_apis WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT proxy_name AS artifact_name, 'proxy-services' AS artifact_type FROM runtime_proxy_services WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT endpoint_name AS artifact_name, 'endpoints' AS artifact_type FROM runtime_endpoints WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT inbound_name AS artifact_name, 'inbound-endpoints' AS artifact_type FROM runtime_inbound_endpoints WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT sequence_name AS artifact_name, 'sequences' AS artifact_type FROM runtime_sequences WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT task_name AS artifact_name, 'tasks' AS artifact_type FROM runtime_tasks WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT processor_name AS artifact_name, 'message-processors' AS artifact_type FROM runtime_message_processors WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT entry_name AS artifact_name, 'local-entries' AS artifact_type FROM runtime_local_entries WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT service_name AS artifact_name, 'data-services' AS artifact_type FROM runtime_data_services WHERE artifact_id = ${artifactId}
        UNION ALL
        SELECT connector_name AS artifact_name, 'connectors' AS artifact_type FROM runtime_connectors WHERE artifact_id = ${artifactId}
    `);

    record {|ArtifactInfoRecord value;|}|sql:Error? result = resultStream.next();
    check resultStream.close();

    if result is record {|ArtifactInfoRecord value;|} {
        return result.value;
    }
    return ();
}

// Async worker function to send MI control command
isolated function sendMIControlCommand(string runtimeId, string artifactType, string artifactName, string action) {
    do {
        // Get runtime details
        types:Runtime? runtime = check getRuntimeById(runtimeId);
        if runtime is () {
            log:printWarn(string `Runtime ${runtimeId} not found, cannot send MI control command`);
            return;
        }

        string baseUrl = check buildManagementBaseUrl(runtime.managementHostname, runtime.managementPort);

        http:Client|error mgmtClientResult = artifactsApiAllowInsecureTLS
            ? new (baseUrl, {secureSocket: {enable: false}})
            : new (baseUrl);

        if mgmtClientResult is error {
            log:printError("Failed to create management API client for MI command", runtimeId = runtimeId, 'error = mgmtClientResult);
            return;
        }

        http:Client mgmtClient = mgmtClientResult;
        string hmacToken = check issueRuntimeHmacToken();

        string artifactPath;
        json payload;

        // Determine API endpoint and payload based on action type
        if action == types:ARTIFACT_ENABLE || action == types:ARTIFACT_DISABLE {
            // Status change: active/inactive
            string status = action == types:ARTIFACT_ENABLE ? "active" : "inactive";
            payload = {
                "type": artifactType,
                "name": artifactName,
                "status": status
            };
            artifactPath = string `${ICP_ARTIFACTS_PATH}/status`;
        } else if action == types:ARTIFACT_ENABLE_TRACING || action == types:ARTIFACT_DISABLE_TRACING {
            // Tracing change: enable/disable
            string trace = action == types:ARTIFACT_ENABLE_TRACING ? "enable" : "disable";
            payload = {
                "type": artifactType,
                "name": artifactName,
                "trace": trace
            };
            artifactPath = string `${ICP_ARTIFACTS_PATH}/tracing`;
        } else {
            log:printWarn(string `Unknown MI control action: ${action}`, runtimeId = runtimeId);
            return;
        }

        log:printDebug("Sending MI control command (fire and forget)",
                runtimeId = runtimeId,
                url = string `${baseUrl}${artifactPath}`,
                artifactType = artifactType,
                artifactName = artifactName,
                action = action);

        http:Response|error resp = mgmtClient->post(artifactPath, payload, {
            "Authorization": string `Bearer ${hmacToken}`,
            "Content-Type": "application/json"
        });

        if resp is error {
            log:printError("MI control command HTTP request failed", runtimeId = runtimeId, 'error = resp);
        } else if resp.statusCode != http:STATUS_OK && resp.statusCode != http:STATUS_ACCEPTED {
            string|error errPayload = resp.getTextPayload();
            string errMsg = errPayload is string ? errPayload : "Unknown error";
            log:printError("MI control command failed",
                    runtimeId = runtimeId,
                    statusCode = resp.statusCode,
                    response = errMsg);
        } else {
            log:printDebug("MI control command sent successfully", runtimeId = runtimeId);
        }
    } on fail error e {
        log:printError(string `Failed to send MI control command for runtime ${runtimeId}`, e);
    }
}

// Helper function to get display name by user ID
isolated function getDisplayNameById(string? userId) returns string? {
    if userId is () {
        return ();
    }

    types:User|error user = getUserDetailsById(userId);
    if user is types:User {
        return user.displayName;
    }

    // Return user ID if display name not found
    return userId;
}

// Helper function to get count from a query
isolated function getCount(sql:ParameterizedQuery query) returns int|error {
    stream<record {|int count;|}, sql:Error?> countStream = dbClient->query(query);
    record {|int count;|}[] results = check from record {|int count;|} count in countStream
        select count;

    if results.length() > 0 {
        return results[0].count;
    }
    return 0;
}

// Get component type for a runtime
isolated function getComponentTypeByRuntimeId(string runtimeId) returns string?|error {
    stream<record {|string component_type;|}, sql:Error?> componentStream = dbClient->query(`
        SELECT c.component_type
        FROM runtimes r
        JOIN components c ON r.component_id = c.component_id
        WHERE r.runtime_id = ${runtimeId}
    `);

    record {|record {|string component_type;|} value;|}|sql:Error? streamRecord = componentStream.next();
    check componentStream.close();

    if streamRecord is record {|record {|string component_type;|} value;|} {
        return streamRecord.value.component_type;
    }

    return ();
}

// Retrieve and mark BI control commands as sent (within transaction)
// Caller must ensure the runtime belongs to a BI component before calling this function
isolated function sendPendingBIControlCommands(string runtimeId) returns types:ControlCommand[]|error {
    types:ControlCommand[] pendingCommands = [];

    // Retrieve pending control commands for this BI runtime
    stream<types:ControlCommandDBRecord, sql:Error?> commandStream = dbClient->query(`
        SELECT command_id, runtime_id, target_artifact, action, issued_at, status
        FROM bi_runtime_control_commands
        WHERE runtime_id = ${runtimeId}
        AND status = 'pending'
        ORDER BY issued_at ASC
    `);

    check from types:ControlCommandDBRecord dbCommand in commandStream
        do {
            types:ControlCommand command = {
                commandId: dbCommand.command_id,
                runtimeId: dbCommand.runtime_id,
                targetArtifact: {name: dbCommand.target_artifact},
                action: dbCommand.action == "START" ? types:START : types:STOP,
                issuedAt: dbCommand.issued_at,
                status: convertToControlCommandStatus(dbCommand.status)
            };
            pendingCommands.push(command);
        };

    // Mark retrieved commands as 'sent'
    if pendingCommands.length() > 0 {
        foreach types:ControlCommand command in pendingCommands {
            _ = check dbClient->execute(`
                UPDATE bi_runtime_control_commands
                SET status = 'sent'
                WHERE command_id = ${command.commandId}
            `);
        }
    }

    return pendingCommands;
}

// Retrieve and mark MI control commands as sent (within transaction)
// Caller must ensure the runtime belongs to an MI component before calling this function
// MI commands are executed immediately via runtime management API calls (fire and forget)
isolated function sendPendingMIControlCommands(string runtimeId) returns types:MIRuntimeControlCommand[]|error {
    types:MIRuntimeControlCommand[] processedCommands = [];

    // Retrieve pending control commands for this MI runtime
    stream<types:MIRuntimeControlCommandDBRecord, sql:Error?> commandStream = dbClient->query(`
        SELECT runtime_id, component_id, artifact_id, action, status, issued_at, sent_at, acknowledged_at, completed_at, error_message, issued_by
        FROM mi_runtime_control_commands
        WHERE runtime_id = ${runtimeId}
        AND status = 'pending'
        ORDER BY issued_at ASC
    `);

    types:MIRuntimeControlCommandDBRecord[] pendingCommands = check from types:MIRuntimeControlCommandDBRecord cmd in commandStream
        select cmd;

    if pendingCommands.length() == 0 {
        log:printDebug(string `No pending MI control commands for runtime ${runtimeId}`);
        return processedCommands;
    }

    // Fire API calls and mark commands as sent
    foreach types:MIRuntimeControlCommandDBRecord dbCommand in pendingCommands {
        // Look up artifact info (name and type) for the API call
        ArtifactInfoRecord? artifactInfo = check getArtifactInfoById(dbCommand.artifact_id);

        if artifactInfo is ArtifactInfoRecord {
            // Fire the API call asynchronously (fire and forget)
            sendMIControlCommand(
                    dbCommand.runtime_id,
                    artifactInfo.artifact_type,
                    artifactInfo.artifact_name,
                    dbCommand.action
            );
        } else {
            log:printWarn(string `Artifact info not found for artifact_id ${dbCommand.artifact_id}, skipping API call`);
        }

        // Mark command as sent in DB regardless of API call
        _ = check dbClient->execute(`
            UPDATE mi_runtime_control_commands
            SET status = 'sent',
                sent_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE runtime_id = ${dbCommand.runtime_id}
            AND component_id = ${dbCommand.component_id}
            AND artifact_id = ${dbCommand.artifact_id}
        `);

        types:MIRuntimeControlCommand command = {
            runtimeId: dbCommand.runtime_id,
            componentId: dbCommand.component_id,
            artifactId: dbCommand.artifact_id,
            action: convertToMIControlAction(dbCommand.action),
            status: convertToControlCommandStatus(dbCommand.status),
            issuedAt: dbCommand.issued_at,
            sentAt: dbCommand?.sent_at,
            acknowledgedAt: dbCommand?.acknowledged_at,
            completedAt: dbCommand?.completed_at,
            errorMessage: dbCommand?.error_message,
            issuedBy: dbCommand?.issued_by
        };
        processedCommands.push(command);
    }

    log:printInfo(string `Marked ${pendingCommands.length()} MI control commands as sent for runtime ${runtimeId}`);

    return processedCommands;
}

// Convert database status string to ControlCommandStatus enum
isolated function convertToControlCommandStatus(string status) returns types:ControlCommandStatus {
    match status {
        "pending" => {
            return types:PENDING;
        }
        "sent" => {
            return types:SENT;
        }
        "acknowledged" => {
            return types:ACKNOWLEDGED;
        }
        "failed" => {
            return types:FAILED;
        }
        "completed" => {
            return types:COMPLETED;
        }
        _ => {
            return types:PENDING;
        }
    }
}

// Convert database action string to MIControlAction enum
isolated function convertToMIControlAction(string action) returns types:MIControlAction {
    match action {
        "ARTIFACT_ENABLE" => {
            return types:ARTIFACT_ENABLE;
        }
        "ARTIFACT_DISABLE" => {
            return types:ARTIFACT_DISABLE;
        }
        "ARTIFACT_ENABLE_TRACING" => {
            return types:ARTIFACT_ENABLE_TRACING;
        }
        "ARTIFACT_DISABLE_TRACING" => {
            return types:ARTIFACT_DISABLE_TRACING;
        }
        _ => {
            return types:ARTIFACT_ENABLE;
        }
    }
}

// Count total artifacts in heartbeat
isolated function countTotalArtifacts(types:Artifacts artifacts) returns int {
    int totalArtifacts = artifacts.services.length() + artifacts.listeners.length();

    totalArtifacts += (<types:RestApi[]>artifacts.apis).length();

    totalArtifacts += (<types:ProxyService[]>artifacts.proxyServices).length();

    totalArtifacts += (<types:Endpoint[]>artifacts.endpoints).length();

    totalArtifacts += (<types:InboundEndpoint[]>artifacts.inboundEndpoints).length();

    totalArtifacts += (<types:Sequence[]>artifacts.sequences).length();

    totalArtifacts += (<types:Task[]>artifacts.tasks).length();

    totalArtifacts += (<types:Template[]>artifacts.templates).length();

    totalArtifacts += (<types:MessageStore[]>artifacts.messageStores).length();

    totalArtifacts += (<types:MessageProcessor[]>artifacts.messageProcessors).length();

    totalArtifacts += (<types:LocalEntry[]>artifacts.localEntries).length();

    totalArtifacts += (<types:DataService[]>artifacts.dataServices).length();

    totalArtifacts += (<types:CarbonApp[]>artifacts.carbonApps).length();

    totalArtifacts += (<types:DataSource[]>artifacts.dataSources).length();

    totalArtifacts += (<types:Connector[]>artifacts.connectors).length();

    totalArtifacts += (<types:RegistryResource[]>artifacts.registryResources).length();

    return totalArtifacts;
}

// Insert a control command for a runtime
public isolated function insertControlCommand(
        string runtimeId,
        string targetArtifact,
        types:ControlAction action,
        string? issuedBy = ()
) returns string|error {
    // Generate a unique command ID
    string commandId = uuid:createType1AsString();

    // Convert action enum to string
    string actionStr = action.toString();

    // Insert control command
    _ = check dbClient->execute(`
        INSERT INTO bi_runtime_control_commands (
            command_id, runtime_id, target_artifact, action, status, issued_at, issued_by
        ) VALUES (
            ${commandId}, ${runtimeId}, ${targetArtifact}, ${actionStr}, 'pending', CURRENT_TIMESTAMP, ${issuedBy}
        )
    `);

    return commandId;
}

// Upsert BI artifact intended state for a component
public isolated function upsertBIArtifactIntendedState(string componentId, string targetArtifact, string action, string? issuedBy = ()) returns error? {
    if dbType == MSSQL {
        _ = check dbClient->execute(`
            MERGE INTO bi_artifact_intended_state AS target
            USING (VALUES (${componentId}, ${targetArtifact}, ${action}, ${issuedBy}))
                   AS source (component_id, target_artifact, action, issued_by)
            ON (target.component_id = source.component_id AND target.target_artifact = source.target_artifact)
            WHEN MATCHED THEN
                UPDATE SET action = source.action, issued_at = CURRENT_TIMESTAMP, 
                           issued_by = source.issued_by, updated_at = CURRENT_TIMESTAMP
            WHEN NOT MATCHED THEN
                INSERT (component_id, target_artifact, action, issued_by)
                VALUES (source.component_id, source.target_artifact, source.action, source.issued_by);
        `);
    } else if dbType == POSTGRESQL {
        _ = check dbClient->execute(`
            INSERT INTO bi_artifact_intended_state (
                component_id, target_artifact, action, issued_by
            ) VALUES (
                ${componentId}, ${targetArtifact}, ${action}, ${issuedBy}
            )
            ON CONFLICT (component_id, target_artifact) DO UPDATE SET
                action = EXCLUDED.action,
                issued_at = CURRENT_TIMESTAMP,
                issued_by = EXCLUDED.issued_by,
                updated_at = CURRENT_TIMESTAMP
        `);
    } else {
        _ = check dbClient->execute(`
            INSERT INTO bi_artifact_intended_state (
                component_id, target_artifact, action, issued_by
            ) VALUES (
                ${componentId}, ${targetArtifact}, ${action}, ${issuedBy}
            )
            ON DUPLICATE KEY UPDATE
                action = VALUES(action),
                issued_at = CURRENT_TIMESTAMP,
                issued_by = VALUES(issued_by),
                updated_at = CURRENT_TIMESTAMP
        `);
    }
}

// Get BI artifact intended states for a component
public isolated function getBIIntendedStatesForComponent(string componentId) returns map<string>|error {
    map<string> intendedStates = {};

    stream<record {|string target_artifact; string action;|}, sql:Error?> stateStream = dbClient->query(`
        SELECT target_artifact, action
        FROM bi_artifact_intended_state
        WHERE component_id = ${componentId}
    `);

    check from record {|string target_artifact; string action;|} state in stateStream
        do {
            intendedStates[state.target_artifact] = state.action;
        };

    return intendedStates;
}

// Delete BI artifact intended state
public isolated function deleteBIArtifactIntendedState(
        string componentId,
        string targetArtifact
) returns error? {
    _ = check dbClient->execute(`
        DELETE FROM bi_artifact_intended_state
        WHERE component_id = ${componentId}
        AND target_artifact = ${targetArtifact}
    `);
}

// Get MI artifact intended states for a component
public isolated function getMIIntendedStatesForComponent(string componentId) returns map<string>|error {
    map<string> intendedStates = {};

    stream<record {|string artifact_id; string action;|}, sql:Error?> stateStream = dbClient->query(`
        SELECT artifact_id, action
        FROM mi_artifact_intended_state
        WHERE component_id = ${componentId}
    `);

    check from record {|string artifact_id; string action;|} state in stateStream
        do {
            intendedStates[state.artifact_id] = state.action;
        };

    return intendedStates;
}

// Insert MI control command
public isolated function insertMIControlCommand(
        string runtimeId,
        string componentId,
        string artifactId,
        types:MIControlAction action,
        string? issuedBy = ()
) returns error? {
    // Convert action enum to string
    string actionStr = action.toString();

    // Insert MI control command
    _ = check dbClient->execute(`
        INSERT INTO mi_runtime_control_commands (
            runtime_id, component_id, artifact_id, action, status, issued_at, issued_by
        ) VALUES (
            ${runtimeId}, ${componentId}, ${artifactId}, ${actionStr}, 'pending', CURRENT_TIMESTAMP, ${issuedBy}
        )
    `);
}

// Artifact ID lookup record type
type ArtifactIdRecord record {|
    string artifact_name;
    string artifact_id;
|};

// Get artifact ID by artifact name and type for a component
// This queries all runtimes of the component to find the artifact
public isolated function getArtifactIdByNameAndType(string componentId, string artifactName, string artifactType) returns string?|error {
    // Use UNION ALL to search across all artifact tables for this component
    stream<record {|string artifact_id;|}, sql:Error?> resultStream = dbClient->query(`
        SELECT artifact_id FROM runtime_apis 
        WHERE component_id = ${componentId} AND api_name = ${artifactName}
        AND ${artifactType} IN ('apis', 'RestApi')
        UNION ALL
        SELECT artifact_id FROM runtime_proxy_services 
        WHERE component_id = ${componentId} AND proxy_name = ${artifactName}
        AND ${artifactType} IN ('proxy-services', 'ProxyService')
        UNION ALL
        SELECT artifact_id FROM runtime_endpoints 
        WHERE component_id = ${componentId} AND endpoint_name = ${artifactName}
        AND ${artifactType} IN ('endpoints', 'Endpoint')
        UNION ALL
        SELECT artifact_id FROM runtime_inbound_endpoints 
        WHERE component_id = ${componentId} AND inbound_name = ${artifactName}
        AND ${artifactType} IN ('inbound-endpoints', 'InboundEndpoint')
        UNION ALL
        SELECT artifact_id FROM runtime_sequences 
        WHERE component_id = ${componentId} AND sequence_name = ${artifactName}
        AND ${artifactType} IN ('sequences', 'Sequence')
        UNION ALL
        SELECT artifact_id FROM runtime_tasks 
        WHERE component_id = ${componentId} AND task_name = ${artifactName}
        AND ${artifactType} IN ('tasks', 'Task')
        UNION ALL
        SELECT artifact_id FROM runtime_message_processors 
        WHERE component_id = ${componentId} AND processor_name = ${artifactName}
        AND ${artifactType} IN ('message-processors', 'MessageProcessor')
        UNION ALL
        SELECT artifact_id FROM runtime_local_entries 
        WHERE component_id = ${componentId} AND entry_name = ${artifactName}
        AND ${artifactType} IN ('local-entries', 'LocalEntry')
        UNION ALL
        SELECT artifact_id FROM runtime_data_services 
        WHERE component_id = ${componentId} AND service_name = ${artifactName}
        AND ${artifactType} IN ('data-services', 'DataService')
        UNION ALL
        SELECT artifact_id FROM runtime_connectors 
        WHERE component_id = ${componentId} AND connector_name = ${artifactName}
        AND ${artifactType} IN ('connectors', 'Connector')
        LIMIT 1
    `);

    record {|record {|string artifact_id;|} value;|}|sql:Error? result = resultStream.next();
    check resultStream.close();

    if result is record {|record {|string artifact_id;|} value;|} {
        return result.value.artifact_id;
    }

    return ();
}

// Get all artifact IDs for a runtime in a single optimized query
// Returns a map of artifact_name -> artifact_id
isolated function getAllArtifactIdsForRuntime(string runtimeId) returns map<string>|error {
    map<string> artifactIds = {};

    // Use UNION ALL to fetch all artifact IDs in a single query
    stream<ArtifactIdRecord, sql:Error?> resultStream = dbClient->query(`
        SELECT api_name AS artifact_name, artifact_id FROM runtime_apis WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT proxy_name AS artifact_name, artifact_id FROM runtime_proxy_services WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT endpoint_name AS artifact_name, artifact_id FROM runtime_endpoints WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT inbound_name AS artifact_name, artifact_id FROM runtime_inbound_endpoints WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT sequence_name AS artifact_name, artifact_id FROM runtime_sequences WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT task_name AS artifact_name, artifact_id FROM runtime_tasks WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT processor_name AS artifact_name, artifact_id FROM runtime_message_processors WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT entry_name AS artifact_name, artifact_id FROM runtime_local_entries WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT service_name AS artifact_name, artifact_id FROM runtime_data_services WHERE runtime_id = ${runtimeId}
        UNION ALL
        SELECT connector_name AS artifact_name, artifact_id FROM runtime_connectors WHERE runtime_id = ${runtimeId}
    `);

    check from ArtifactIdRecord rec in resultStream
        do {
            artifactIds[rec.artifact_name] = rec.artifact_id;
        };

    return artifactIds;
}

// Upsert MI artifact intended state for a component
public isolated function upsertMIArtifactIntendedState(string componentId, string artifactId, string action, string? issuedBy = ()) returns error? {
    if dbType == MSSQL {
        _ = check dbClient->execute(`
            MERGE INTO mi_artifact_intended_state AS target
            USING (VALUES (${componentId}, ${artifactId}, ${action}, ${issuedBy}))
                   AS source (component_id, artifact_id, action, issued_by)
            ON (target.component_id = source.component_id AND target.artifact_id = source.artifact_id)
            WHEN MATCHED THEN
                UPDATE SET action = source.action, issued_at = CURRENT_TIMESTAMP, 
                           issued_by = source.issued_by, updated_at = CURRENT_TIMESTAMP
            WHEN NOT MATCHED THEN
                INSERT (component_id, artifact_id, action, issued_by)
                VALUES (source.component_id, source.artifact_id, source.action, source.issued_by);
        `);
    } else {
        _ = check dbClient->execute(`
            INSERT INTO mi_artifact_intended_state (
                component_id, artifact_id, action, issued_by
            ) VALUES (
                ${componentId}, ${artifactId}, ${action}, ${issuedBy}
            )
            ON DUPLICATE KEY UPDATE
                action = VALUES(action),
                issued_at = CURRENT_TIMESTAMP,
                issued_by = VALUES(issued_by),
                updated_at = CURRENT_TIMESTAMP
        `);
    }
}

// Delete MI artifact intended state
public isolated function deleteMIArtifactIntendedState(
        string componentId,
        string artifactId
) returns error? {
    _ = check dbClient->execute(`
        DELETE FROM mi_artifact_intended_state
        WHERE component_id = ${componentId}
        AND artifact_id = ${artifactId}
    `);
}

public isolated function buildManagementBaseUrl(string? managementHost, string? managementPort) returns string|error {
    if managementHost is () {
        return error("Management hostname not configured for this runtime");
    }
    string baseUrl = string `https://${<string>managementHost}`;
    if managementPort is string {
        baseUrl = string `${baseUrl}:${managementPort}`;
    }
    return baseUrl;
}

// Helper function to send artifact tracing change to a runtime
public isolated function sendArtifactTracingChange(types:Runtime runtime, string artifactType, string artifactName, string trace) returns error? {
    string baseUrl = check buildManagementBaseUrl(runtime.managementHostname, runtime.managementPort);

    http:Client|error mgmtClient = artifactsApiAllowInsecureTLS
        ? new (baseUrl, {secureSocket: {enable: false}})
        : new (baseUrl);

    if mgmtClient is error {
        log:printError("Failed to create management API client for runtime", runtimeId = runtime.runtimeId, 'error = mgmtClient);
        return error("Failed to create management API client");
    }

    string hmacToken = check issueRuntimeHmacToken();

    json payload = {
        "type": artifactType,
        "name": artifactName,
        "trace": trace
    };

    string artifactPath = string `${ICP_ARTIFACTS_PATH}/tracing`;
    log:printDebug("Sending artifact tracing change request",
            runtimeId = runtime.runtimeId,
            url = string `${baseUrl}${artifactPath}`,
            artifactType = artifactType,
            artifactName = artifactName,
            trace = trace);

    http:Response|error resp = mgmtClient->post(artifactPath, payload, {
        "Authorization": string `Bearer ${hmacToken}`,
        "Content-Type": "application/json"
    });

    if resp is error {
        log:printError("HTTP request failed for artifact tracing change", runtimeId = runtime.runtimeId, 'error = resp);
        return error(string `HTTP request failed: ${resp.message()}`);
    }

    if resp.statusCode != http:STATUS_OK && resp.statusCode != http:STATUS_ACCEPTED {
        string|error errPayload = resp.getTextPayload();
        string errMsg = errPayload is string ? errPayload : "Unknown error";
        log:printError("Artifact tracing change failed",
                runtimeId = runtime.runtimeId,
                statusCode = resp.statusCode,
                response = errMsg);
        return error(string `Tracing change failed with status ${resp.statusCode}: ${errMsg}`);
    }

    log:printDebug("Artifact tracing changed successfully on runtime", runtimeId = runtime.runtimeId);
    return;
}

// Helper: generate HMAC JWT used to call ICP internal APIs
public isolated function issueRuntimeHmacToken() returns string|error {
    jwt:IssuerConfig issConfig = {
        username: "icp-artifact-fetcher",
        issuer: jwtIssuer,
        expTime: <decimal>defaultTokenExpiryTime,
        audience: jwtAudience,
        signatureConfig: {algorithm: jwt:HS256, config: defaultRuntimeJwtHMACSecret}
    };
    issConfig.customClaims["scope"] = "runtime_agent";

    string|jwt:Error hmacToken = jwt:issue(issConfig);
    if hmacToken is jwt:Error {
        log:printError("Failed to generate HMAC JWT for internal ICP API", hmacToken);
        return error("Failed to generate authentication token");
    }
    return hmacToken;
}
