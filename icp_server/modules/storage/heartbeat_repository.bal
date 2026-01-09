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

        // Retrieve pending control commands
        pendingCommands = check retrieveAndMarkCommandsAsSent(heartbeat.runtime);

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
        // Retrieve pending control commands for this runtime (no DB-specific locks)
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
        if runtimeExists {
            _ = check dbClient->execute(`
                INSERT INTO audit_logs (
                    runtime_id, action, details, timestamp
                ) VALUES (
                    ${deltaHeartbeat.runtime}, 'DELTA_HEARTBEAT',
                    ${string `Delta heartbeat processed with hash ${deltaHeartbeat.runtimeHash}`},
                    ${currentTimeStr}
                )
            `);
        } else {
            // Runtime was deleted or not yet created; log without FK reference to avoid integrity violation
            _ = check dbClient->execute(`
                INSERT INTO audit_logs (
                    action, details, timestamp
                ) VALUES (
                    'DELTA_HEARTBEAT',
                    ${string `Delta heartbeat received for missing runtime ${deltaHeartbeat.runtime} with hash ${deltaHeartbeat.runtimeHash}`},
                    ${currentTimeStr}
                )
            `);
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
    check deleteExistingArtifacts(heartbeat.runtime);

    // Insert services
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

    // Insert listeners
    foreach types:Listener listenerDetail in heartbeat.artifacts.listeners {
        string? host = listenerDetail?.host;
        int? port = listenerDetail?.port;
        _ = check dbClient->execute(`
            INSERT INTO runtime_listeners (
                runtime_id, listener_name, listener_package, protocol, listener_host, listener_port, state
            ) VALUES (
                ${heartbeat.runtime}, ${listenerDetail.name},
                ${listenerDetail.package}, ${listenerDetail.protocol},
                ${host}, ${port},
                ${listenerDetail.state}
            )
        `);
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
        _ = check dbClient->execute(`
            INSERT INTO runtime_apis (
                runtime_id, api_name, url, context, version, state
            ) VALUES (
                ${heartbeat.runtime}, ${api.name}, ${api.url},
                ${api.context}, ${api.version}, ${api.state}
            )
        `);

        // Insert API resources for this API
        foreach types:ApiResource apiResource in api.resources {
            // MI sends methods as a single string (e.g., "POST"), store as-is
            _ = check dbClient->execute(`
                INSERT INTO runtime_api_resources (
                    runtime_id, api_name, resource_path, methods
                ) VALUES (
                    ${heartbeat.runtime}, ${api.name},
                    ${apiResource.path}, ${apiResource.methods}
                )
            `);
        }
    }

    foreach types:ProxyService proxy in <types:ProxyService[]>heartbeat.artifacts.proxyServices {
        _ = check dbClient->execute(`
            INSERT INTO runtime_proxy_services (
                runtime_id, proxy_name, state
            ) VALUES (
                ${heartbeat.runtime}, ${proxy.name}, ${proxy.state}
            )
        `);

        // Persist endpoints if present
        if proxy.endpoints is string[] {
            foreach string ep in <string[]>proxy.endpoints {
                _ = check dbClient->execute(`
                    INSERT INTO runtime_proxy_service_endpoints (
                        runtime_id, proxy_name, endpoint_url
                    ) VALUES (
                        ${heartbeat.runtime}, ${proxy.name}, ${ep}
                    )
                `);
            }
        }
    }

    foreach types:Endpoint endpoint in <types:Endpoint[]>heartbeat.artifacts.endpoints {
        _ = check dbClient->execute(`
            INSERT INTO runtime_endpoints (
                runtime_id, endpoint_name, endpoint_type, address, state
            ) VALUES (
                ${heartbeat.runtime}, ${endpoint.name}, ${endpoint.'type},
                ${endpoint.address}, ${endpoint.state}
            )
        `);
    }
}

// Insert additional MI artifacts
isolated function insertAdditionalMIArtifacts(types:Heartbeat heartbeat) returns error? {
    foreach types:InboundEndpoint inbound in <types:InboundEndpoint[]>heartbeat.artifacts.inboundEndpoints {
        _ = check dbClient->execute(`
            INSERT INTO runtime_inbound_endpoints (
                runtime_id, inbound_name, protocol, sequence, state, statistics, on_error
            ) VALUES (
                ${heartbeat.runtime}, ${inbound.name}, ${inbound.protocol},
                ${inbound.sequence}, ${inbound.state}, ${inbound.statistics}, ${inbound.onError}
            )
        `);
    }

    foreach types:Sequence sequence in <types:Sequence[]>heartbeat.artifacts.sequences {
        _ = check dbClient->execute(`
            INSERT INTO runtime_sequences (
                runtime_id, sequence_name, sequence_type, container, state
            ) VALUES (
                ${heartbeat.runtime}, ${sequence.name}, ${sequence.'type},
                ${sequence.container}, ${sequence.state}
            )
        `);
    }

    foreach types:Task task in <types:Task[]>heartbeat.artifacts.tasks {
        _ = check dbClient->execute(`
            INSERT INTO runtime_tasks (
                runtime_id, task_name, task_class, task_group, state
            ) VALUES (
                ${heartbeat.runtime}, ${task.name}, ${task.'class},
                ${task.group}, ${task.state}
            )
        `);
    }

    foreach types:Template template in <types:Template[]>heartbeat.artifacts.templates {
        _ = check dbClient->execute(`
            INSERT INTO runtime_templates (
                runtime_id, template_name, template_type
            ) VALUES (
                ${heartbeat.runtime}, ${template.name}, ${template.'type}
            )
        `);
    }

    foreach types:MessageStore store in <types:MessageStore[]>heartbeat.artifacts.messageStores {
        _ = check dbClient->execute(`
            INSERT INTO runtime_message_stores (
                runtime_id, store_name, store_type, size
            ) VALUES (
                ${heartbeat.runtime}, ${store.name}, ${store.'type}, ${store.size}
            )
        `);
    }

    foreach types:MessageProcessor processor in <types:MessageProcessor[]>heartbeat.artifacts.messageProcessors {
        _ = check dbClient->execute(`
            INSERT INTO runtime_message_processors (
                runtime_id, processor_name, processor_type, processor_class, state
            ) VALUES (
                ${heartbeat.runtime}, ${processor.name}, ${processor.'type},
                ${processor.'class}, ${processor.state}
            )
        `);
    }

    foreach types:LocalEntry entry in <types:LocalEntry[]>heartbeat.artifacts.localEntries {
        _ = check dbClient->execute(`
            INSERT INTO runtime_local_entries (
                runtime_id, entry_name, entry_type, entry_value, state
            ) VALUES (
                ${heartbeat.runtime}, ${entry.name}, ${entry.'type},
                ${entry.value}, ${entry.state}
            )
        `);
    }

    foreach types:DataService dataService in <types:DataService[]>heartbeat.artifacts.dataServices {
        _ = check dbClient->execute(`
            INSERT INTO runtime_data_services (
                runtime_id, service_name, description, wsdl, state
            ) VALUES (
                ${heartbeat.runtime}, ${dataService.name}, ${dataService.description},
                ${dataService.wsdl}, ${dataService.state}
            )
        `);
    }

    foreach types:CarbonApp app in <types:CarbonApp[]>heartbeat.artifacts.carbonApps {
        string? artifactsJson = app.artifacts is types:CarbonAppArtifact[]
            ? (<types:CarbonAppArtifact[]>app.artifacts).toJsonString()
            : ();
        _ = check dbClient->execute(`
            INSERT INTO runtime_carbon_apps (
                runtime_id, app_name, version, state, artifacts
            ) VALUES (
                ${heartbeat.runtime}, ${app.name}, ${app.version}, ${app.state}, ${artifactsJson}
            )
        `);
    }

    foreach types:DataSource dataSource in <types:DataSource[]>heartbeat.artifacts.dataSources {
        _ = check dbClient->execute(`
            INSERT INTO runtime_data_sources (
                runtime_id, datasource_name, datasource_type, driver, url, username, state
            ) VALUES (
                ${heartbeat.runtime}, ${dataSource.name}, ${dataSource.'type}, ${dataSource.driver},
                ${dataSource.url}, ${dataSource.username}, ${dataSource.state}
            )
        `);
    }

    foreach types:Connector connector in <types:Connector[]>heartbeat.artifacts.connectors {
        _ = check dbClient->execute(`
            INSERT INTO runtime_connectors (
                runtime_id, connector_name, package, version, state
            ) VALUES (
                ${heartbeat.runtime}, ${connector.name}, ${connector.package},
                ${connector.version}, ${connector.state}
            )
        `);
    }

    foreach types:RegistryResource registryResource in <types:RegistryResource[]>heartbeat.artifacts.registryResources {
        _ = check dbClient->execute(`
            INSERT INTO runtime_registry_resources (
                runtime_id, resource_name, resource_type
            ) VALUES (
                ${heartbeat.runtime}, ${registryResource.name}, ${registryResource.'type}
            )
        `);
    }
}
