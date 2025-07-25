import icp_server.types;

import ballerina/log;
import ballerina/sql;
import ballerina/time;

final DatabaseConnectionManager dbManager = check new ("mysql");
final sql:Client dbClient = dbManager.getClient();

public isolated function registerRuntime(types:Runtime runtime) returns types:Runtime|error {
    // Validate runtime data before starting transaction
    error? validationResult = validateRuntimeData(runtime);
    if validationResult is error {
        return validationResult;
    }

    time:Utc currentTime = time:utcNow();
    boolean isUpdate = false;

    // Start transaction
    transaction {
        // Check if runtime already exists
        stream<record {|string runtime_id;|}, sql:Error?> existingRuntimeStream = dbClient->query(`
            SELECT runtime_id FROM runtimes WHERE runtime_id = ${runtime.runtimeId}
        `);

        record {|string runtime_id;|}[] existingRuntimes = check from record {|string runtime_id;|} existingRuntime in existingRuntimeStream
            select existingRuntime;

        isUpdate = existingRuntimes.length() > 0;

        if isUpdate {
            // Update existing runtime
            sql:ExecutionResult _ = check dbClient->execute(`
                UPDATE runtimes SET 
                    runtime_type = ${runtime.runtimeType},
                    status = ${runtime.status},
                    environment = ${runtime.environment},
                    deployment_type = ${runtime.deploymentType},
                    version = ${runtime.version},
                    platform_name = ${runtime.nodeInfo.platformName},
                    platform_version = ${runtime.nodeInfo.platformVersion},
                    platform_home = ${runtime.nodeInfo.platformHome},
                    os_name = ${runtime.nodeInfo.osName},
                    os_version = ${runtime.nodeInfo.osVersion},
                    last_heartbeat = ${currentTime}
                WHERE runtime_id = ${runtime.runtimeId}
            `);

            // if updateResult.affectedRowCount == 0 {
            //     rollback;
            //     return error(string `Failed to update runtime ${runtime.runtimeId}`);
            // }

            log:printInfo(string `Updated existing runtime: ${runtime.runtimeId}`);
        } else {
            // Insert new runtime
            sql:ExecutionResult _ = check dbClient->execute(`
                INSERT INTO runtimes (
                    runtime_id, runtime_type, status, environment,
                    deployment_type, version, platform_name, 
                    platform_version, platform_home, os_name,
                    os_version, registration_time, last_heartbeat
                ) VALUES (
                    ${runtime.runtimeId}, ${runtime.runtimeType}, 
                    ${runtime.status}, ${runtime.environment}, 
                    ${runtime.deploymentType}, ${runtime.version},
                    ${runtime.nodeInfo.platformName}, ${runtime.nodeInfo.platformVersion},
                    ${runtime.nodeInfo.platformHome}, ${runtime.nodeInfo.osName},
                    ${runtime.nodeInfo.osVersion}, ${currentTime},
                    ${currentTime}
                )
            `);

            // if insertResult.affectedRowCount == 0 {
            //     rollback;
            //     return error(string `Failed to register runtime ${runtime.runtimeId}`);
            // }

            log:printInfo(string `Registered new runtime: ${runtime.runtimeId}`);
        }

        // Clear existing artifacts for this runtime (for both insert and update)
        _ = check dbClient->execute(`
            DELETE FROM runtime_services WHERE runtime_id = ${runtime.runtimeId}
        `);

        _ = check dbClient->execute(`
            DELETE FROM runtime_listeners WHERE runtime_id = ${runtime.runtimeId}
        `);

        // Insert services
        foreach types:ServiceDetail serviceDetail in runtime.artifacts.services {
            sql:ExecutionResult _ = check dbClient->execute(`
                INSERT INTO runtime_services (
                    runtime_id, service_name, service_package, base_path, state
                ) VALUES (
                    ${runtime.runtimeId}, ${serviceDetail.name}, 
                    ${serviceDetail.package}, ${serviceDetail.basePath}, 
                    ${serviceDetail.state}
                )
            `);

            // if serviceInsertResult.affectedRowCount == 0 {
            //     return error(string `Failed to register service ${serviceDetail.name} for runtime ${runtime.runtimeId}`);
            // }

            // Insert resources for each service
            foreach types:Resource resourceDetail in serviceDetail.resources {
                string methodsJson = resourceDetail.methods.toJsonString();
                _ = check dbClient->execute(`
                    INSERT INTO service_resources (
                        runtime_id, service_name, resource_url, methods
                    ) VALUES (
                        ${runtime.runtimeId}, ${serviceDetail.name}, 
                        ${resourceDetail.url}, ${methodsJson}
                    )
                `);
            }
        }

        // Insert listeners
        foreach types:ListenerDetail listenerDetail in runtime.artifacts.listeners {
            sql:ExecutionResult _ = check dbClient->execute(`
                INSERT INTO runtime_listeners (
                    runtime_id, listener_name, listener_package, protocol, state
                ) VALUES (
                    ${runtime.runtimeId}, ${listenerDetail.name}, 
                    ${listenerDetail.package}, ${listenerDetail.protocol}, 
                    ${listenerDetail.state}
                )
            `);

            // if listenerInsertResult.affectedRowCount == 0 {
            //     return error(string `Failed to register listener ${listenerDetail.name} for runtime ${runtime.runtimeId}`);
            // }
        }

        // Create audit log entry
        string action = isUpdate ? "UPDATE" : "REGISTER";
        _ = check dbClient->execute(`
            INSERT INTO audit_logs (
                runtime_id, action, details, timestamp
            ) VALUES (
                ${runtime.runtimeId}, ${action}, 
                ${string `Runtime ${action.toLowerAscii()}ed with ${runtime.artifacts.services.length()} services and ${runtime.artifacts.listeners.length()} listeners`},
                ${currentTime}
            )
        `);

        // check commit;
        log:printInfo(string `Successfully ${action.toLowerAscii()}ed runtime ${runtime.runtimeId} with ${runtime.artifacts.services.length()} services and ${runtime.artifacts.listeners.length()} listeners`);
        check commit;

    } on fail error e {
        log:printError(string `Failed to register runtime ${runtime.runtimeId}`, e);
        return error(string `Database operation failed for runtime ${runtime.runtimeId}`, e);
    }

    // Return the runtime with updated timestamps
    types:Runtime updatedRuntime = {
        runtimeId: runtime.runtimeId,
        runtimeType: runtime.runtimeType,
        status: runtime.status,
        environment: runtime.environment,
        deploymentType: runtime.deploymentType,
        version: runtime.version,
        nodeInfo: runtime.nodeInfo,
        artifacts: runtime.artifacts,
        registrationTime: currentTime,
        lastHeartbeat: currentTime
    };

    return updatedRuntime;
}

// Validation function for runtime data
isolated function validateRuntimeData(types:Runtime runtime) returns error? {
    // Validate required fields
    if runtime.runtimeId.trim().length() == 0 {
        return error("Runtime ID cannot be empty");
    }

    if runtime.runtimeId.length() > 100 {
        return error("Runtime ID cannot exceed 100 characters");
    }

    // Validate runtime type
    if runtime.runtimeType != types:MI && runtime.runtimeType != types:BI {
        return error("Invalid runtime type. Must be MI or BI");
    }

    // Validate runtime status
    if runtime.status != types:RUNNING &&
        runtime.status != types:FAILED &&
        runtime.status != types:DISABLED &&
        runtime.status != types:OFFLINE {
        return error("Invalid runtime status");
    }

    // Validate node info
    if runtime.nodeInfo.platformName.trim().length() == 0 {
        return error("Platform name cannot be empty");
    }

    // Validate artifacts
    foreach types:ServiceDetail serviceDetail in runtime.artifacts.services {
        if serviceDetail.name.trim().length() == 0 {
            return error("Service name cannot be empty");
        }
        if serviceDetail.package.trim().length() == 0 {
            return error("Service package cannot be empty");
        }
    }

    foreach types:ListenerDetail listenerDetail in runtime.artifacts.listeners {
        if listenerDetail.name.trim().length() == 0 {
            return error("Listener name cannot be empty");
        }
        if listenerDetail.package.trim().length() == 0 {
            return error("Listener package cannot be empty");
        }
    }

    return ();
}

public isolated function processHeartbeat(types:Heartbeat heartbeat) returns types:HeartbeatResponse|error {
    // Start transaction for heartbeat processing
    transaction {
        // Update runtime status and last heartbeat timestamp
        sql:ExecutionResult updateResult = check dbClient->execute(`
                UPDATE runtimes 
                SET status = ${heartbeat.status}, 
                    last_heartbeat = ${heartbeat.timestamp}
                WHERE runtime_id = ${heartbeat.runtimeId}
            `);

        // Check if runtime exists
        if updateResult.affectedRowCount == 0 {
            rollback;
            return error(string `Runtime ${heartbeat.runtimeId} not found`);
        } else {

            // Update artifacts information (services and listeners)
            // First, delete existing artifacts for this runtime
            _ = check dbClient->execute(`
            DELETE FROM runtime_services WHERE runtime_id = ${heartbeat.runtimeId}
        `);

            _ = check dbClient->execute(`
            DELETE FROM runtime_listeners WHERE runtime_id = ${heartbeat.runtimeId}
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

            types:ControlCommand[] pendingCommands = [];
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

            check commit;

            // Return heartbeat response with pending commands
            return {
                acknowledged: true,
                commands: pendingCommands
            };
        }

    } on fail error e {
        // In case of error, the transaction block is rolled back automatically.
        return error(string `Failed to process heartbeat for runtime ${heartbeat.runtimeId}`, e);
    }
}
