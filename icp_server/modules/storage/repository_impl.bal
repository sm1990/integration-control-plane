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

import ballerina/log;
import ballerina/sql;
import ballerina/time;
import ballerina/uuid;

final DatabaseConnectionManager dbManager = check new (dbType);
public final sql:Client dbClient = dbManager.getClient();

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

public isolated function getEnvironments() returns types:Environment[]|error {
    types:Environment[] environments = [];
    stream<types:Environment, sql:Error?> envStream = dbClient->query(`SELECT environment_id, name, description, 
        region, cluster_id, choreo_env, external_apim_env_name, internal_apim_env_name, sandbox_apim_env_name, 
        critical, dns_prefix, created_at, updated_at, created_by, updated_by 
        FROM environments ORDER BY name ASC`);
    check from types:Environment env in envStream
        do {
            environments.push({
                id: env.id,
                description: env.description,
                name: env.name,
                region: env.region,
                clusterId: env.clusterId,
                choreoEnv: env.choreoEnv,
                externalApimEnvName: env.externalApimEnvName,
                internalApimEnvName: env.internalApimEnvName,
                sandboxApimEnvName: env.sandboxApimEnvName,
                critical: env.critical,
                dnsPrefix: env.dnsPrefix,
                createdAt: env.createdAt,
                createdBy: getDisplayNameById(env.createdBy),
                updatedAt: env.updatedAt,
                updatedBy: getDisplayNameById(env.updatedBy)
            });
        };
    return environments;
}

public isolated function getEnvironmentsByIds(string[] environmentIds) returns types:Environment[]|error {
    // Return empty array if no environment IDs provided
    if environmentIds.length() == 0 {
        return [];
    }

    types:Environment[] environments = [];

    // Build WHERE clause to filter by environment IDs
    sql:ParameterizedQuery query = `SELECT environment_id, name, description, 
                                     region, cluster_id, choreo_env, external_apim_env_name, internal_apim_env_name, 
                                     sandbox_apim_env_name, critical, dns_prefix, created_at, updated_at, created_by, updated_by
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
                id: env.id,
                description: env.description,
                name: env.name,
                region: env.region,
                clusterId: env.clusterId,
                choreoEnv: env.choreoEnv,
                externalApimEnvName: env.externalApimEnvName,
                internalApimEnvName: env.internalApimEnvName,
                sandboxApimEnvName: env.sandboxApimEnvName,
                critical: env.critical,
                dnsPrefix: env.dnsPrefix,
                createdAt: env.createdAt,
                updatedAt: env.updatedAt,
                createdBy: getDisplayNameById(env.createdBy),
                updatedBy: getDisplayNameById(env.updatedBy)
            });
        };

    log:printInfo("Retrieved environments by IDs", environmentCount = environments.length());

    return environments;
}

// Get environment IDs by environment types (for RBAC filtering)
public isolated function getEnvironmentIdsByTypes(boolean hasProdAccess, boolean hasNonProdAccess) returns string[]|error {
    if !hasProdAccess && !hasNonProdAccess {
        return [];
    }

    string[] environmentIds = [];

    // Build WHERE clause to filter by environment types
    sql:ParameterizedQuery query = `SELECT environment_id FROM environments WHERE `;

    if hasProdAccess && hasNonProdAccess {
        query = sql:queryConcat(query, `1=1`);
    } else if hasProdAccess {
        query = sql:queryConcat(query, `critical = true`);
    } else if hasNonProdAccess {
        query = sql:queryConcat(query, `critical = false`);
    }

    query = sql:queryConcat(query, ` ORDER BY name ASC`);

    stream<record {|string environment_id;|}, sql:Error?> envStream = dbClient->query(query);

    check from record {|string environment_id;|} env in envStream
        do {
            environmentIds.push(env.environment_id);
        };

    log:printInfo("Retrieved environment IDs by types", environmentCount = environmentIds.length());

    return environmentIds;
}

// Get environment by ID
public isolated function getEnvironmentById(string environmentId) returns types:Environment|error {
    stream<types:Environment, sql:Error?> envStream =
        dbClient->query(`SELECT environment_id, name, description, region, cluster_id, choreo_env, 
                        external_apim_env_name, internal_apim_env_name, sandbox_apim_env_name, critical, dns_prefix, 
                        created_at, updated_at FROM environments WHERE environment_id = ${environmentId}`);

    types:Environment[] envRecords = check from types:Environment env in envStream
        select env;

    if envRecords.length() == 0 {
        return error(string `Environment ${environmentId} not found.`);
    }

    types:Environment env = envRecords[0];
    return {
        id: env.id,
        name: env.name,
        description: env.description,
        region: env?.region,
        clusterId: env?.clusterId,
        choreoEnv: env?.choreoEnv,
        externalApimEnvName: env?.externalApimEnvName,
        internalApimEnvName: env?.internalApimEnvName,
        sandboxApimEnvName: env?.sandboxApimEnvName,
        critical: env?.critical,
        dnsPrefix: env?.dnsPrefix,
        createdAt: env.createdAt,
        updatedAt: env.updatedAt
    };
}

// Insert a list of environments into the environments table
public isolated function createEnvironment(types:EnvironmentInput environment) returns types:Environment|error? {
    log:printInfo(string `Register environment : ${environment.toString()}`);
    string envId = uuid:createRandomUuid();

    sql:ParameterizedQuery insertQuery = `INSERT INTO environments (environment_id, name, description, critical, created_by) 
    VALUES (${envId}, ${environment.name}, ${environment.description}, ${environment.critical}, ${environment.createdBy})`;
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
public isolated function updateEnvironment(string environmentId, string? name, string? description, boolean? critical) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE environment_id = ${environmentId} `;
    sql:ParameterizedQuery updateFields = ` SET updated_at = CURRENT_TIMESTAMP `;

    if name is string {
        updateFields = sql:queryConcat(updateFields, `, name = ${name} `);
    }
    if description is string {
        updateFields = sql:queryConcat(updateFields, `, description = ${description} `);
    }
    if critical is boolean {
        updateFields = sql:queryConcat(updateFields, `, critical = ${critical} `);
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
public isolated function updateEnvironmentProductionStatus(string environmentId, boolean critical) returns error? {
    sql:ParameterizedQuery updateQuery = `UPDATE environments SET critical = ${critical}, updated_at = CURRENT_TIMESTAMP WHERE environment_id = ${environmentId}`;
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
// Updated to work with environment-type-based role model
public isolated function getRuntimesByAccessibleEnvironments(types:UserContext userContext) returns types:Runtime[]|error {
    types:RoleInfo[] roles = userContext.roles;
    // Super admin: return all runtimes without filtering
    if userContext.isSuperAdmin {
        types:Runtime[] runtimeList = [];
        stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(`
            SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version, 
                   platform_name, platform_version, platform_home, os_name, os_version, 
                   registration_time, last_heartbeat FROM runtimes 
            ORDER BY registration_time DESC
        `);

        check from types:RuntimeDBRecord runtime in runtimeStream
            do {
                runtimeList.push(check mapToRuntime(runtime));
            };

        return runtimeList;
    }

    // Return empty array if no roles provided
    if roles.length() == 0 {
        return [];
    }

    // Get all environments to determine which ones the user has access to
    types:Environment[]|error allEnvironments = getEnvironments();
    if allEnvironments is error {
        log:printError("Failed to fetch environments for runtime access check", allEnvironments);
        return [];
    }

    // Build list of accessible environment IDs based on user's environment type permissions
    string[] accessibleEnvironmentIds = [];
    foreach types:Environment env in allEnvironments {
        final types:EnvironmentType envType = env.critical ? types:PROD : types:NON_PROD;

        // Check if user has any role for this environment type
        boolean hasAccess = roles.some(isolated function(types:RoleInfo role) returns boolean {
            return role.environmentType == envType;
        });

        if hasAccess {
            accessibleEnvironmentIds.push(env.id);
        }
    }

    // Return empty array if no accessible environments
    if accessibleEnvironmentIds.length() == 0 {
        return [];
    }

    // Build WHERE clause for accessible environments
    sql:ParameterizedQuery whereClause = ` WHERE environment_id IN (`;
    foreach int i in 0 ..< accessibleEnvironmentIds.length() {
        if i > 0 {
            whereClause = sql:queryConcat(whereClause, `, `);
        }
        whereClause = sql:queryConcat(whereClause, `${accessibleEnvironmentIds[i]}`);
    }
    whereClause = sql:queryConcat(whereClause, `) `);

    // Build the complete query
    sql:ParameterizedQuery selectClause = ` SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version, 
                 platform_name, platform_version, platform_home, os_name, os_version, 
                 registration_time, last_heartbeat FROM runtimes `;
    sql:ParameterizedQuery orderByClause = ` ORDER BY registration_time DESC`;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, whereClause, orderByClause);

    types:Runtime[] runtimeList = [];
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(query);

    check from types:RuntimeDBRecord runtime in runtimeStream
        do {
            runtimeList.push(check mapToRuntime(runtime));
        };

    log:printDebug(string `Found ${runtimeList.length()} runtimes for ${accessibleEnvironmentIds.length()} accessible environments`);
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

// Get component deployment information from runtimes table
public isolated function getComponentDeployment(string componentId, string environmentId, string versionId) returns types:ComponentDeployment?|error {
    log:printDebug(string `Fetching deployment info for component: ${componentId}, environment: ${environmentId}`);

    // Query runtimes table for deployment information
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(`
        SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version,
               platform_name, platform_version, platform_home, os_name, os_version,
               registration_time, last_heartbeat
        FROM runtimes
        WHERE component_id = ${componentId} AND environment_id = ${environmentId}
        ORDER BY last_heartbeat DESC
        LIMIT 1
    `);

    types:RuntimeDBRecord[] runtimeRecords = check from types:RuntimeDBRecord runtimeRecord in runtimeStream
        select runtimeRecord;

    if runtimeRecords.length() == 0 {
        log:printDebug(string `No runtime found for component ${componentId} in environment ${environmentId}`);
        return (); // No deployment found
    }

    types:RuntimeDBRecord runtime = runtimeRecords[0];

    // Get component details for apiId
    types:Component component = check getComponentById(componentId);

    // Count configurations (services + listeners)
    int configCount = 0;
    types:Service[] services = check getServicesForRuntime(runtime.runtime_id);
    types:Listener[] listeners = check getListenersForRuntime(runtime.runtime_id);
    configCount = services.length() + listeners.length();

    // Build deployment information from runtime data
    types:BuildInfo buildInfo = {
        buildId: runtime.runtime_id,
        deployedAt: runtime?.last_heartbeat is time:Utc ? time:utcToString(<time:Utc>runtime?.last_heartbeat) : (),
        'commit: (),
        sourceConfigMigrationStatus: (),
        runId: runtime.runtime_id
    };

    types:ComponentDeployment deployment = {
        environmentId: environmentId,
        configCount: configCount,
        apiId: component?.apiId,
        releaseId: runtime.runtime_id,
        apiRevision: (),
        build: buildInfo,
        imageUrl: "",
        invokeUrl: "",
        versionId: versionId,
        deploymentStatus: runtime.status,
        deploymentStatusV2: runtime.status,
        version: runtime?.version,
        cron: (),
        cronTimezone: ()
    };

    log:printInfo(string `Retrieved deployment info for component ${componentId}`,
            status = runtime.status,
            configCount = configCount);

    return deployment;
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

// Get REST APIs for a specific runtime
public isolated function getApisForRuntime(string runtimeId) returns types:RestApi[]|error {
    types:RestApi[] apiList = [];
    stream<types:RestApi, sql:Error?> apiStream = dbClient->query(`
        SELECT api_name, url, context, version, state 
        FROM runtime_apis 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:RestApi apiRecord in apiStream
        do {
            apiList.push(apiRecord);
        };

    return apiList;
}

// Get proxy services for a specific runtime
public isolated function getProxyServicesForRuntime(string runtimeId) returns types:ProxyService[]|error {
    types:ProxyService[] proxyList = [];
    stream<types:ProxyServiceRecordInDB, sql:Error?> proxyStream = dbClient->query(`
        SELECT proxy_name, wsdl, transports, state 
        FROM runtime_proxy_services 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:ProxyServiceRecordInDB proxyRecord in proxyStream
        do {
            // Parse transports JSON string to array
            string[]? transports = ();
            json transportsJson = check proxyRecord.transports.fromJsonString();
            transports = check transportsJson.cloneWithType();

            types:ProxyService proxy = {
                name: proxyRecord.proxy_name,
                wsdl: proxyRecord.wsdl,
                transports: transports,
                state: proxyRecord.state
            };
            proxyList.push(proxy);
        };

    return proxyList;
}

// Get endpoints for a specific runtime
public isolated function getEndpointsForRuntime(string runtimeId) returns types:Endpoint[]|error {
    types:Endpoint[] endpointList = [];
    stream<types:EndpointRecordInDB, sql:Error?> endpointStream = dbClient->query(`
        SELECT endpoint_name, endpoint_type, address, state 
        FROM runtime_endpoints 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:EndpointRecordInDB endpointRecord in endpointStream
        do {
            types:Endpoint endpoint = {
                name: endpointRecord.endpoint_name,
                'type: endpointRecord.endpoint_type,
                address: endpointRecord.address,
                state: endpointRecord.state
            };
            endpointList.push(endpoint);
        };

    return endpointList;
}

// Get inbound endpoints for a specific runtime
public isolated function getInboundEndpointsForRuntime(string runtimeId) returns types:InboundEndpoint[]|error {
    types:InboundEndpoint[] inboundList = [];
    stream<types:InboundEndpoint, sql:Error?> inboundStream = dbClient->query(`
        SELECT inbound_name, protocol, sequence, state 
        FROM runtime_inbound_endpoints 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:InboundEndpoint inboundRecord in inboundStream
        do {
            inboundList.push(inboundRecord);
        };

    return inboundList;
}

// Get sequences for a specific runtime
public isolated function getSequencesForRuntime(string runtimeId) returns types:Sequence[]|error {
    types:Sequence[] sequenceList = [];
    stream<types:SequenceRecordInDB, sql:Error?> sequenceStream = dbClient->query(`
        SELECT sequence_name, sequence_type, container, state 
        FROM runtime_sequences 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:SequenceRecordInDB sequenceRecord in sequenceStream
        do {
            types:Sequence sequence = {
                name: sequenceRecord.sequence_name,
                'type: sequenceRecord.sequence_type,
                container: sequenceRecord.container,
                state: sequenceRecord.state
            };
            sequenceList.push(sequence);
        };

    return sequenceList;
}

// Get tasks for a specific runtime
public isolated function getTasksForRuntime(string runtimeId) returns types:Task[]|error {
    types:Task[] taskList = [];
    stream<types:TaskRecordInDB, sql:Error?> taskStream = dbClient->query(`
        SELECT task_name, task_class, task_group, state 
        FROM runtime_tasks 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:TaskRecordInDB taskRecord in taskStream
        do {
            types:Task task = {
                name: taskRecord.task_name,
                'class: taskRecord.task_class,
                group: taskRecord.task_group,
                state: taskRecord.state
            };
            taskList.push(task);
        };

    return taskList;
}

// Get templates for a specific runtime
public isolated function getTemplatesForRuntime(string runtimeId) returns types:Template[]|error {
    types:Template[] templateList = [];
    stream<types:Template, sql:Error?> templateStream = dbClient->query(`
        SELECT template_name, template_type, state 
        FROM runtime_templates 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:Template templateRecord in templateStream
        do {
            templateList.push(templateRecord);
        };

    return templateList;
}

// Get message stores for a specific runtime
public isolated function getMessageStoresForRuntime(string runtimeId) returns types:MessageStore[]|error {
    types:MessageStore[] storeList = [];
    stream<types:MessageStoreRecordInDB, sql:Error?> storeStream = dbClient->query(`
        SELECT store_name, store_type, store_class, state 
        FROM runtime_message_stores 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:MessageStoreRecordInDB storeRecord in storeStream
        do {
            types:MessageStore store = {
                name: storeRecord.store_name,
                'type: storeRecord.store_type,
                'class: storeRecord.store_class,
                state: storeRecord.state
            };
            storeList.push(store);
        };

    return storeList;
}

// Get message processors for a specific runtime
public isolated function getMessageProcessorsForRuntime(string runtimeId) returns types:MessageProcessor[]|error {
    types:MessageProcessor[] processorList = [];
    stream<types:MessageProcessorRecordInDB, sql:Error?> processorStream = dbClient->query(`
        SELECT processor_name, processor_type, processor_class, state 
        FROM runtime_message_processors 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:MessageProcessorRecordInDB processorRecord in processorStream
        do {
            types:MessageProcessor processor = {
                name: processorRecord.processor_name,
                'type: processorRecord.processor_type,
                'class: processorRecord.processor_class,
                state: processorRecord.state
            };
            processorList.push(processor);
        };

    return processorList;
}

// Get local entries for a specific runtime
public isolated function getLocalEntriesForRuntime(string runtimeId) returns types:LocalEntry[]|error {
    types:LocalEntry[] entryList = [];
    stream<types:LocalEntryRecordInDB, sql:Error?> entryStream = dbClient->query(`
        SELECT entry_name, entry_type, entry_value, state 
        FROM runtime_local_entries 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:LocalEntryRecordInDB entryRecord in entryStream
        do {
            types:LocalEntry entry = {
                name: entryRecord.entry_name,
                'type: entryRecord.entry_type,
                value: entryRecord.entry_value,
                state: entryRecord.state
            };
            entryList.push(entry);
        };

    return entryList;
}

// Get data services for a specific runtime
public isolated function getDataServicesForRuntime(string runtimeId) returns types:DataService[]|error {
    types:DataService[] serviceList = [];
    stream<types:DataService, sql:Error?> serviceStream = dbClient->query(`
        SELECT service_name, description, wsdl, state 
        FROM runtime_data_services 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:DataService serviceRecord in serviceStream
        do {
            serviceList.push(serviceRecord);
        };

    return serviceList;
}

// Get carbon apps for a specific runtime
public isolated function getCarbonAppsForRuntime(string runtimeId) returns types:CarbonApp[]|error {
    types:CarbonApp[] appList = [];
    stream<types:CarbonAppRecordInDB, sql:Error?> appStream = dbClient->query(`
        SELECT app_name, version, deployment_status, state 
        FROM runtime_carbon_apps 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:CarbonAppRecordInDB appRecord in appStream
        do {
            types:CarbonApp app = {
                name: appRecord.app_name,
                version: appRecord.version,
                deploymentStatus: appRecord.deployment_status,
                state: appRecord.state
            };
            appList.push(app);
        };

    return appList;
}

// Get data sources for a specific runtime
public isolated function getDataSourcesForRuntime(string runtimeId) returns types:DataSource[]|error {
    types:DataSource[] sourceList = [];
    stream<types:DataSource, sql:Error?> sourceStream = dbClient->query(`
        SELECT datasource_name, driver, url, state 
        FROM runtime_data_sources 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:DataSource sourceRecord in sourceStream
        do {
            sourceList.push(sourceRecord);
        };

    return sourceList;
}

// Get connectors for a specific runtime
public isolated function getConnectorsForRuntime(string runtimeId) returns types:Connector[]|error {
    types:Connector[] connectorList = [];
    stream<types:Connector, sql:Error?> connectorStream = dbClient->query(`
        SELECT connector_name, package as connector_package, version, state
        FROM runtime_connectors 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:Connector connectorRecord in connectorStream
        do {
            connectorList.push(connectorRecord);
        };

    return connectorList;
}

// Get registry resources for a specific runtime
public isolated function getRegistryResourcesForRuntime(string runtimeId) returns types:RegistryResource[]|error {
    types:RegistryResource[] resourceList = [];
    stream<types:RegistryResourceRecordInDB, sql:Error?> resourceStream = dbClient->query(`
        SELECT resource_name, path, resource_type, state 
        FROM runtime_registry_resources 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:RegistryResourceRecordInDB resourceRecord in resourceStream
        do {
            types:RegistryResource registryResource = {
                name: resourceRecord.resource_name,
                path: resourceRecord.path,
                'type: resourceRecord.resource_type,
                state: resourceRecord.state
            };
            resourceList.push(registryResource);
        };

    return resourceList;
}

// Get system info for a specific runtime
public isolated function getSystemInfoForRuntime(string runtimeId) returns types:SystemInfo[]|error {
    types:SystemInfo[] infoList = [];
    stream<types:SystemInfo, sql:Error?> infoStream = dbClient->query(`
        SELECT info_key, info_value
        FROM runtime_system_info 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:SystemInfo infoRecord in infoStream
        do {
            infoList.push(infoRecord);
        };

    return infoList;
}

// Helper function to map database record to Runtime type
public isolated function mapToRuntime(types:RuntimeDBRecord runtimeRecord) returns types:Runtime|error {
    // Get services for this runtime
    types:Service[] serviceList = check getServicesForRuntime(runtimeRecord.runtime_id);

    // Get listeners for this runtime
    types:Listener[] listenerList = check getListenersForRuntime(runtimeRecord.runtime_id);

    // Initialize all MI artifacts as empty arrays for non-MI runtimes
    types:RestApi[] apiList = [];
    types:ProxyService[] proxyList = [];
    types:Endpoint[] endpointList = [];
    types:InboundEndpoint[] inboundList = [];
    types:Sequence[] sequenceList = [];
    types:Task[] taskList = [];
    types:Template[] templateList = [];
    types:MessageStore[] storeList = [];
    types:MessageProcessor[] processorList = [];
    types:LocalEntry[] entryList = [];
    types:DataService[] dataServiceList = [];
    types:CarbonApp[] appList = [];
    types:DataSource[] sourceList = [];
    types:Connector[] connectorList = [];
    types:RegistryResource[] resourceList = [];
    types:SystemInfo[] infoList = [];

    // Get MI artifacts only for MI runtime types
    if runtimeRecord.runtime_type == "MI" {
        apiList = check getApisForRuntime(runtimeRecord.runtime_id);
        proxyList = check getProxyServicesForRuntime(runtimeRecord.runtime_id);
        endpointList = check getEndpointsForRuntime(runtimeRecord.runtime_id);
        inboundList = check getInboundEndpointsForRuntime(runtimeRecord.runtime_id);
        sequenceList = check getSequencesForRuntime(runtimeRecord.runtime_id);
        taskList = check getTasksForRuntime(runtimeRecord.runtime_id);
        templateList = check getTemplatesForRuntime(runtimeRecord.runtime_id);
        storeList = check getMessageStoresForRuntime(runtimeRecord.runtime_id);
        processorList = check getMessageProcessorsForRuntime(runtimeRecord.runtime_id);
        entryList = check getLocalEntriesForRuntime(runtimeRecord.runtime_id);
        dataServiceList = check getDataServicesForRuntime(runtimeRecord.runtime_id);
        appList = check getCarbonAppsForRuntime(runtimeRecord.runtime_id);
        sourceList = check getDataSourcesForRuntime(runtimeRecord.runtime_id);
        connectorList = check getConnectorsForRuntime(runtimeRecord.runtime_id);
        resourceList = check getRegistryResourcesForRuntime(runtimeRecord.runtime_id);
        infoList = check getSystemInfoForRuntime(runtimeRecord.runtime_id);
    }

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
            services: serviceList,
            apis: apiList,
            proxyServices: proxyList,
            endpoints: endpointList,
            inboundEndpoints: inboundList,
            sequences: sequenceList,
            tasks: taskList,
            templates: templateList,
            messageStores: storeList,
            messageProcessors: processorList,
            localEntries: entryList,
            dataServices: dataServiceList,
            carbonApps: appList,
            dataSources: sourceList,
            connectors: connectorList,
            registryResources: resourceList,
            systemInfo: infoList
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
                path: resourceRecord.resource_path,
                method: resourceRecord.method,
                url: resourceRecord.resource_url,
                methods: methods
            };
            resourceList.push(resourceItem);
        };

    return {
        name: serviceRecord.name,
        package: serviceRecord.package,
        basePath: serviceRecord.basePath,
        state: "ENABLED", // Default state
        'type: "API", // Default type
        resources: resourceList,
        listeners: [] // Empty listeners array
    };
}

// Periodically mark runtimes as OFFLINE if heartbeat is too old
public isolated function markOfflineRuntimes() returns error? {
    log:printDebug("Marking offline runtimes");
    time:Utc now = time:utcNow();
    // Calculate the threshold timestamp
    time:Utc threshold = time:utcAddSeconds(now, -<decimal>heartbeatTimeoutSeconds);

    // Convert threshold to H2 datetime format
    string thresholdStr = check convertUtcToDbDateTime(threshold);

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

    if timestampResult is error {
        log:printError(string `Failed to update timestamp for runtime ${deltaHeartbeat.runtime}`, timestampResult);
        // Continue processing - timestamp update failure shouldn't block command retrieval
    }

    // Handle control commands and audit logging in a transaction
    // This ensures commands are marked as 'sent' atomically with audit log creation
    transaction {
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
    types:Component|error componentById = getComponentById(componentId);
    if componentById is error {
        return error(string `Invalid component configuration detected: ${heartbeat.component}`, componentById);
    }
    if componentById.componentType != heartbeat.runtimeType {
        return error(string `Component type mismatch for component ${heartbeat.component}. Expected: ${componentById.componentType}, Got: ${heartbeat.runtimeType}`);
    }

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

// Helper function to delete all existing artifacts for a runtime
isolated function deleteExistingArtifacts(string runtimeId) returns error? {
    // Delete core artifacts
    _ = check dbClient->execute(`DELETE FROM runtime_services WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_listeners WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM service_resources WHERE runtime_id = ${runtimeId}`);

    // Delete MI artifacts for all runtimes (will be empty for non-MI runtimes)
    _ = check dbClient->execute(`DELETE FROM runtime_apis WHERE runtime_id = ${runtimeId}`);
    _ = check dbClient->execute(`DELETE FROM runtime_proxy_services WHERE runtime_id = ${runtimeId}`);
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
    _ = check dbClient->execute(`DELETE FROM runtime_system_info WHERE runtime_id = ${runtimeId}`);
}

// Helper function to convert systemInfo (json) to SystemInfo array
public isolated function convertSystemInfoToArray(json systemInfo) returns types:SystemInfo[] {
    types:SystemInfo[] result = [];

    // If systemInfo is already an array, cast and return it
    if systemInfo is json[] {
        foreach json item in systemInfo {
            if item is map<json> {
                string key = item["key"] is string ? <string>item["key"] : "";
                string value = item["value"] is string ? <string>item["value"] : "";
                result.push({key, value});
            }
        }
        return result;
    }

    // If systemInfo is an object, convert each key-value pair
    if systemInfo is map<json> {
        foreach [string, json] [key, value] in systemInfo.entries() {
            string valueStr = value.toString();
            result.push({key, value: valueStr});
        }
    }

    return result;
}

// Helper function to insert MI artifacts
isolated function insertMIArtifacts(types:Heartbeat heartbeat) returns error? {
    // Insert MI-specific artifacts (APIs, Proxy Services, Endpoints)
    foreach types:RestApi api in <types:RestApi[]>heartbeat.artifacts.apis {
        _ = check dbClient->execute(`
                INSERT INTO runtime_apis (
                    runtime_id, api_name, url, context, version, state
                ) VALUES (
                    ${heartbeat.runtime}, ${api.name}, ${api.url},
                    ${api.context}, ${api.version}, ${api.state}
                )
            `);
    }

    foreach types:ProxyService proxy in <types:ProxyService[]>heartbeat.artifacts.proxyServices {
        string? transportsJson = proxy.transports is string[] ? (<string[]>proxy.transports).toJsonString() : ();
        _ = check dbClient->execute(`
                INSERT INTO runtime_proxy_services (
                    runtime_id, proxy_name, wsdl, transports, state
                ) VALUES (
                    ${heartbeat.runtime}, ${proxy.name}, ${proxy.wsdl},
                    ${transportsJson}, ${proxy.state}
                )
            `);
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

    // LocalEntries, DataServices, CarbonApps, DataSources, Connectors, RegistryResources, and SystemInfo
    // are handled in insertAdditionalMIArtifacts() to avoid duplication

}

// Upsert runtime record (insert new or update existing)
// Returns true if it was a new registration, false if it was an update
isolated function upsertRuntime(types:Heartbeat heartbeat) returns boolean|error {
    sql:ExecutionResult result = check dbClient->execute(`
        INSERT INTO runtimes (
            runtime_id, name, runtime_type, status, version,
            environment_id, project_id, component_id,
            platform_name, platform_version, platform_home,
            os_name, os_version
        ) VALUES (
            ${heartbeat.runtime}, ${heartbeat.runtime}, ${heartbeat.runtimeType}, ${heartbeat.status}, ${heartbeat.version},
            ${heartbeat.environment}, ${heartbeat.project}, ${heartbeat.component},
            ${heartbeat.nodeInfo.platformName}, ${heartbeat.nodeInfo.platformVersion}, ${heartbeat.nodeInfo.ballerinaHome},
            ${heartbeat.nodeInfo.osName}, ${heartbeat.nodeInfo.osVersion}
        )
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            runtime_type = VALUES(runtime_type),
            status = VALUES(status),
            version = VALUES(version),
            environment_id = VALUES(environment_id),
            project_id = VALUES(project_id),
            component_id = VALUES(component_id),
            platform_name = VALUES(platform_name),
            platform_version = VALUES(platform_version),
            platform_home = VALUES(platform_home),
            os_name = VALUES(os_name),
            os_version = VALUES(os_version),
            last_heartbeat = CURRENT_TIMESTAMP
    `);

    int? affectedRows = result.affectedRowCount;
    return affectedRows == 1;
}

// Insert all artifacts for a runtime (within transaction)
isolated function insertRuntimeArtifacts(types:Heartbeat heartbeat) returns error? {
    // First, delete existing artifacts for this runtime
    check deleteExistingArtifacts(heartbeat.runtime);

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

    // Insert MI artifacts if present
    check insertMIArtifacts(heartbeat);

    // Insert additional MI artifacts not covered by insertMIArtifacts
    check insertAdditionalMIArtifacts(heartbeat);
}

// Insert additional MI artifacts (inboundEndpoints, sequences, tasks, etc.)
isolated function insertAdditionalMIArtifacts(types:Heartbeat heartbeat) returns error? {
    foreach types:InboundEndpoint inbound in <types:InboundEndpoint[]>heartbeat.artifacts.inboundEndpoints {
        _ = check dbClient->execute(`
                INSERT INTO runtime_inbound_endpoints (
                    runtime_id, inbound_name, protocol, sequence, state
                ) VALUES (
                    ${heartbeat.runtime}, ${inbound.name}, ${inbound.protocol},
                    ${inbound.sequence}, ${inbound.state}
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
                    runtime_id, template_name, template_type, state
                ) VALUES (
                    ${heartbeat.runtime}, ${template.name}, ${template.'type}, ${template.state}
                )
            `);
    }

    foreach types:MessageStore store in <types:MessageStore[]>heartbeat.artifacts.messageStores {
        _ = check dbClient->execute(`
                INSERT INTO runtime_message_stores (
                    runtime_id, store_name, store_type, store_class, state
                ) VALUES (
                    ${heartbeat.runtime}, ${store.name}, ${store.'type},
                    ${store.'class}, ${store.state}
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
        _ = check dbClient->execute(`
                INSERT INTO runtime_carbon_apps (
                    runtime_id, app_name, version, deployment_status, state
                ) VALUES (
                    ${heartbeat.runtime}, ${app.name}, ${app.version},
                    ${app.deploymentStatus}, ${app.state}
                )
            `);
    }

    foreach types:DataSource dataSource in <types:DataSource[]>heartbeat.artifacts.dataSources {
        _ = check dbClient->execute(`
                INSERT INTO runtime_data_sources (
                    runtime_id, datasource_name, driver, url, state
                ) VALUES (
                    ${heartbeat.runtime}, ${dataSource.name}, ${dataSource.driver},
                    ${dataSource.url}, ${dataSource.state}
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
                    runtime_id, resource_name, path, resource_type, state
                ) VALUES (
                    ${heartbeat.runtime}, ${registryResource.name}, ${registryResource.path},
                    ${registryResource.'type}, ${registryResource.state}
                )
            `);
    }

    foreach types:SystemInfo info in heartbeat.artifacts.systemInfo {
        _ = check dbClient->execute(`
                INSERT INTO runtime_system_info (
                    runtime_id, info_key, info_value
                ) VALUES (
                    ${heartbeat.runtime}, ${info.key}, ${info.value}
                )
            `);
    }

}

// Retrieve and mark control commands as sent (within transaction)
isolated function retrieveAndMarkCommandsAsSent(string runtimeId) returns types:ControlCommand[]|error {
    types:ControlCommand[] pendingCommands = [];

    // Retrieve pending control commands for this runtime
    stream<types:ControlCommand, sql:Error?> commandStream = dbClient->query(`
        SELECT command_id, runtime_id, target_artifact, action, issued_at, status
        FROM control_commands
        WHERE runtime_id = ${runtimeId}
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

    return pendingCommands;
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

    totalArtifacts += (<types:SystemInfo[]>artifacts.systemInfo).length();

    return totalArtifacts;
}

// Heartbeat processing that handles both registration and updates
public isolated function processHeartbeat(types:Heartbeat heartbeat) returns types:HeartbeatResponse|error {
    check validateHeartbeatData(heartbeat);

    boolean isNewRegistration = false;
    types:ControlCommand[] pendingCommands = [];

    // Upsert runtime record (atomic, no transaction needed)
    isNewRegistration = check upsertRuntime(heartbeat);

    if isNewRegistration {
        log:printInfo(string `Registered new runtime via heartbeat: ${heartbeat.runtime}`);
    } else {
        log:printInfo(string `Updated runtime via heartbeat: ${heartbeat.runtime}`);
    }

    // Start transaction for artifact updates and command retrieval
    transaction {
        // Insert all runtime artifacts (services, listeners, MI artifacts, etc.)
        check insertRuntimeArtifacts(heartbeat);

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

        // Count all artifacts
        int totalArtifacts = heartbeat.artifacts.services.length() + heartbeat.artifacts.listeners.length();
        totalArtifacts += heartbeat.artifacts.apis.length();

        totalArtifacts += heartbeat.artifacts.proxyServices.length();

        totalArtifacts += heartbeat.artifacts.endpoints.length();

        totalArtifacts += heartbeat.artifacts.inboundEndpoints.length();

        totalArtifacts += heartbeat.artifacts.sequences.length();

        totalArtifacts += heartbeat.artifacts.tasks.length();

        totalArtifacts += heartbeat.artifacts.templates.length();

        totalArtifacts += heartbeat.artifacts.messageStores.length();

        totalArtifacts += heartbeat.artifacts.messageProcessors.length();

        totalArtifacts += heartbeat.artifacts.localEntries.length();

        totalArtifacts += heartbeat.artifacts.dataServices.length();

        totalArtifacts += heartbeat.artifacts.carbonApps.length();

        totalArtifacts += heartbeat.artifacts.dataSources.length();

        totalArtifacts += heartbeat.artifacts.connectors.length();

        totalArtifacts += heartbeat.artifacts.registryResources.length();

        totalArtifacts += heartbeat.artifacts.systemInfo.length();

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

    // Use projectHandler as the handler field, fallback to handler if projectHandler is not provided
    string handler = project.projectHandler;
    if handler.trim() == "" {
        return error("Project handler is required");
    }

    // Convert deployment pipeline IDs array to JSON string if provided
    string? deploymentPipelineIdsJson = ();
    string[]? pipelineIds = project?.deploymentPipelineIds;
    if pipelineIds is string[] {
        deploymentPipelineIdsJson = pipelineIds.toJsonString();
    }

    transaction {
        // Insert project with all new fields
        sql:ParameterizedQuery insertQuery = `INSERT INTO projects (
            project_id, org_id, name, version, handler, region, description, 
            default_deployment_pipeline_id, deployment_pipeline_ids, type, 
            git_provider, git_organization, repository, branch, secret_ref,
            owner_id, created_by
        ) VALUES (
            ${projectId}, ${project.orgId}, ${project.name}, ${project?.version}, 
            ${handler}, ${project?.region}, ${project?.description},
            ${project?.defaultDeploymentPipelineId}, ${deploymentPipelineIdsJson}, ${project?.'type},
            ${project?.gitProvider}, ${project?.gitOrganization}, ${project?.repository}, 
            ${project?.branch}, ${project?.secretRef}, ${userId}, ${displayName}
        )`;
        sql:ExecutionResult _ = check dbClient->execute(insertQuery);

        log:printInfo(string `Created project: ${project.name}`,
                projectId = projectId,
                orgId = project.orgId,
                handler = handler,
                ownerId = userId,
                createdBy = displayName);

        // Auto-assign admin roles to the creating user for both environment types
        // Skip role assignment if user is super admin
        if !userContext.isSuperAdmin {
            // Assign admin role for production environment type
            string prodRoleId = check getOrCreateRole(projectId, types:PROD, types:ADMIN);
            sql:ExecutionResult _ = check dbClient->execute(
                `INSERT INTO user_roles (user_id, role_id, assigned_by)
                 VALUES (${userId}, ${prodRoleId}, ${userId})`
                );
            log:printInfo(string `Assigned production admin role to project creator`,
                    userId = userId,
                    projectId = projectId);

            // Assign admin role for non-production environment type
            string nonProdRoleId = check getOrCreateRole(projectId, types:NON_PROD, types:ADMIN);
            sql:ExecutionResult _ = check dbClient->execute(
                `INSERT INTO user_roles (user_id, role_id, assigned_by)
                 VALUES (${userId}, ${nonProdRoleId}, ${userId})`
                );
            log:printInfo(string `Assigned non-production admin role to project creator`,
                    userId = userId,
                    projectId = projectId);
        } else {
            log:printInfo(string `Skipping role assignment for super admin user`,
                    userId = userId,
                    projectId = projectId);
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

    sql:ParameterizedQuery query = `SELECT project_id, org_id, name, version, created_date, handler, region, 
                                          description, 
                                          type, git_provider, git_organization, repository, branch, secret_ref,
                                          owner_id, created_by, updated_at, updated_by 
                                   FROM projects 
                                   ORDER BY name ASC`;

    stream<types:Project, sql:Error?> projectStream = dbClient->query(query);

    check from types:Project projectRecord in projectStream
        do {
            projects.push({
                ...projectRecord
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
    sql:ParameterizedQuery query = `SELECT project_id, org_id, name, version, created_date, handler, region, 
                                          description,   
                                          type, git_provider, git_organization, repository, branch, secret_ref,
                                          owner_id, created_by, updated_at, updated_by 
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

    check from types:Project projectRecord in projectStream
        do {

            projects.push({
                ...projectRecord
            });
        };

    log:printInfo("Retrieved projects by IDs", projectCount = projects.length());

    return projects;
}

// Get a specific project by ID
public isolated function getProjectById(string projectId) returns types:Project|error {
    stream<types:Project, sql:Error?> projectStream =
        dbClient->query(`SELECT project_id, org_id, name, version, created_date, handler, region, 
                                description, 
                                type, git_provider, git_organization, repository, branch, secret_ref,
                                owner_id, created_by, updated_at, updated_by 
                         FROM projects WHERE project_id = ${projectId}`);

    types:Project[] projectRecords =
        check from types:Project projectRecord in projectStream
        select projectRecord;

    if projectRecords.length() == 0 {
        return error(string `Project with ID ${projectId} not found`);
    }

    types:Project projectRecord = projectRecords[0];
    return projectRecord;
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

    transaction {
        // Update the project
        sql:ParameterizedQuery updateQuery = sql:queryConcat(`UPDATE projects `, updateFields, whereClause);
        sql:ExecutionResult _ = check dbClient->execute(updateQuery);

        // If project name is being updated, update all associated role names
        if name is string {
            // Replace spaces with underscores in project name for role naming
            string projectName = re `\s+`.replaceAll(name, "_");

            // Update role names for all roles associated with this project
            // Role name format: <project_name>:<env_type>:<privilege_level>
            sql:ExecutionResult _ = check dbClient->execute(`
                UPDATE roles 
                SET role_name = CONCAT(${projectName}, ':', environment_type, ':', privilege_level),
                    updated_at = CURRENT_TIMESTAMP
                WHERE project_id = ${projectId}
            `);

            log:printInfo(string `Updated role names for project ${projectId} with new name: ${name}`);
        }

        check commit;
        log:printInfo(string `Successfully updated project ${projectId}`);
    } on fail error e {
        log:printError(string `Failed to update project ${projectId}`, e);
        return error(string `Failed to update project ${projectId}`, e);
    }

    return ();
}

// Update project with ProjectUpdateInput
public isolated function updateProjectWithInput(types:ProjectUpdateInput project) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE project_id = ${project.id} `;
    sql:ParameterizedQuery updateFields = ` SET updated_at = CURRENT_TIMESTAMP `;
    boolean hasUpdates = false;

    if project?.name is string {
        updateFields = sql:queryConcat(updateFields, `, name = ${project?.name} `);
        hasUpdates = true;
    }
    if project?.description is string {
        updateFields = sql:queryConcat(updateFields, `, description = ${project?.description} `);
        hasUpdates = true;
    }
    if project?.version is string {
        updateFields = sql:queryConcat(updateFields, `, version = ${project?.version} `);
        hasUpdates = true;
    }
    if project?.orgId is int {
        updateFields = sql:queryConcat(updateFields, `, org_id = ${project?.orgId} `);
        hasUpdates = true;
    }

    if !hasUpdates {
        return error("No fields to update");
    }

    transaction {
        // Update the project
        sql:ParameterizedQuery updateQuery = sql:queryConcat(`UPDATE projects `, updateFields, whereClause);
        sql:ExecutionResult _ = check dbClient->execute(updateQuery);

        // If project name is being updated, update all associated role names
        if project?.name is string {
            // Replace spaces with underscores in project name for role naming
            string projectName = re `\s+`.replaceAll(project?.name ?: "", "_");

            // Update role names for all roles associated with this project
            // Role name format: <project_name>:<env_type>:<privilege_level>
            sql:ExecutionResult _ = check dbClient->execute(`
                UPDATE roles 
                SET role_name = CONCAT(${projectName}, ':', environment_type, ':', privilege_level),
                    updated_at = CURRENT_TIMESTAMP
                WHERE project_id = ${project.id}
            `);

            log:printInfo(string `Updated role names for project ${project.id} with new name: ${project?.name ?: "unknown"}`);
        }

        check commit;
        log:printInfo(string `Successfully updated project ${project.id}`);
    } on fail error e {
        log:printError(string `Failed to update project ${project.id}`, e);
        return error(string `Failed to update project ${project.id}`, e);
    }

    return ();
}

// Delete a project by ID (this will cascade delete all components, runtimes, roles, and user role assignments)
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
    string componentTypeValue = component.componentType.toString();
    
    // Use displayName if provided, otherwise fall back to name
    string displayName = component?.displayName ?: component.name;
    
    sql:ParameterizedQuery insertQuery = `INSERT INTO components (component_id, project_id, name, display_name, description, component_type, created_by) 
                                          VALUES (${componentId}, ${component.projectId}, ${component.name}, ${displayName}, ${component.description}, ${componentTypeValue}, ${component.createdBy})`;
    var result = dbClient->execute(insertQuery);
    if result is sql:Error {
        return result;
    }
    return getComponentById(componentId);

}

// Check if a project has any components
public isolated function hasProjectComponents(string projectId) returns boolean|error {
    sql:ParameterizedQuery query = `SELECT COUNT(*) as component_count FROM components WHERE project_id = ${projectId}`;
    stream<record {int component_count;}, sql:Error?> resultStream = dbClient->query(query);

    record {|record {int component_count;} value;|}? streamResult = check resultStream.next();
    check resultStream.close();

    if streamResult is record {|record {int component_count;} value;|} {
        return streamResult.value.component_count > 0;
    }
    return false;
}

// Get all components with optional project filter
public isolated function getComponents(string? projectId, types:ComponentOptionsInput? options = ()) returns types:Component[]|error {
    types:Component[] components = [];
    sql:ParameterizedQuery whereClause = ` WHERE 1=1 `;
    sql:ParameterizedQuery whereConditions = ` `;

    if projectId is string {
        whereConditions = sql:queryConcat(whereConditions, ` AND c.project_id = ${projectId} `);
    }

    sql:ParameterizedQuery selectClause = `SELECT c.component_id, c.project_id, c.name as component_name, c.display_name as component_display_name, c.description as component_description, 
                                                  c.component_type, c.created_by as component_created_by, c.created_at as component_created_at, c.updated_at as component_updated_at,
                                                  c.updated_by as component_updated_by,
                                                  p.org_id as project_org_id, p.name as project_name, p.version as project_version, 
                                                  p.created_date as project_created_date, p.handler as project_handler, p.region as project_region,
                                                  p.description as project_description, p.default_deployment_pipeline_id as project_default_deployment_pipeline_id,
                                                  p.deployment_pipeline_ids as project_deployment_pipeline_ids, p.type as project_type,
                                                  p.git_provider as project_git_provider, p.git_organization as project_git_organization,
                                                  p.repository as project_repository, p.branch as project_branch, p.secret_ref as project_secret_ref,
                                                  p.created_by as project_created_by, p.updated_at as project_updated_at, p.updated_by as project_updated_by
                                           FROM components c 
                                           JOIN projects p ON c.project_id = p.project_id `;
    sql:ParameterizedQuery orderByClause = ` ORDER BY c.name ASC `;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, whereClause, whereConditions, orderByClause);

    stream<types:ComponentInDB, sql:Error?> componentStream =
        dbClient->query(query);

    check from types:ComponentInDB component in componentStream
        do {
            // Parse deployment pipeline IDs from JSON if present

            components.push({
                // Basic Identity Fields
                id: component.component_id,
                projectId: component.project_id,
                orgHandler: component.project_handler, // Using project handler as org handler
                orgId: component.project_org_id,

                // Component Metadata
                name: component.component_name,
                handler: component.component_name, // Using component name as handler
                displayName: component.component_display_name ?: component.component_name, // Use display_name or fallback to name
                displayType: "service", // Default to "service"
                description: component.component_description,

                // Status Fields
                status: "active", // Default to "active"
                initStatus: "completed", // Default to "completed"

                // Version & Timestamps
                version: "v1.0.0", // Default version
                createdAt: component.component_created_at ?: "",
                lastBuildDate: component.component_updated_at,
                updatedAt: component.component_updated_at,

                // Classification
                componentSubType: (),
                componentType: component.component_type == "MI" ? types:MI : types:BI, // Use actual DB value or default to BI
                labels: (),

                // System Component Flag
                isSystemComponent: false,

                // Nested Objects (empty arrays for now)
                apiVersions: [],
                deploymentTracks: [],

                // Git Integration
                gitProvider: component.project_git_provider,
                gitOrganization: component.project_git_organization,
                gitRepository: component.project_repository,
                branch: component.project_branch,

                // Advanced Fields
                endpoints: [],
                environmentVariables: [],
                secrets: [],

                // Legacy fields for backward compatibility
                componentId: component.component_id,
                project: {
                    id: component.project_id,
                    orgId: component.project_org_id,
                    name: component.project_name,
                    version: <string>component.project_version,
                    createdDate: component.project_created_date,
                    handler: component.project_handler,
                    region: component.project_region,
                    description: component.project_description,

                    'type: component.project_type,
                    gitProvider: component.project_git_provider,
                    gitOrganization: component.project_git_organization,
                    repository: component.project_repository,
                    branch: component.project_branch,
                    secretRef: component.project_secret_ref,
                    createdBy: component.project_created_by,
                    updatedAt: component.project_updated_at,
                    updatedBy: component.project_updated_by
                },
                createdBy: getDisplayNameById(component.component_created_by),
                updatedBy: getDisplayNameById(component.component_updated_by)
            });
        };
    return components;
}

// Get all components for multiple projects (RBAC-aware batch query)
public isolated function getComponentsByProjectIds(string[] projectIds, types:ComponentOptionsInput? options = ()) returns types:Component[]|error {
    // Return empty array if no project IDs provided
    if projectIds.length() == 0 {
        return [];
    }

    types:Component[] components = [];

    // Build WHERE IN clause for multiple project IDs
    sql:ParameterizedQuery selectClause = `SELECT c.component_id, c.project_id, c.name as component_name, c.display_name as component_display_name, c.description as component_description, 
                                                  c.component_type, c.created_by as component_created_by, c.created_at as component_created_at, c.updated_at as component_updated_at,
                                                  c.updated_by as component_updated_by,
                                                  p.org_id as project_org_id, p.name as project_name, p.version as project_version, 
                                                  p.created_date as project_created_date, p.handler as project_handler, p.region as project_region,
                                                  p.description as project_description, p.default_deployment_pipeline_id as project_default_deployment_pipeline_id,
                                                  p.deployment_pipeline_ids as project_deployment_pipeline_ids, p.type as project_type,
                                                  p.git_provider as project_git_provider, p.git_organization as project_git_organization,
                                                  p.repository as project_repository, p.branch as project_branch, p.secret_ref as project_secret_ref,
                                                  p.created_by as project_created_by, p.updated_at as project_updated_at, p.updated_by as project_updated_by
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
                // Basic Identity Fields
                id: component.component_id,
                projectId: component.project_id,
                orgHandler: component.project_handler, // Using project handler as org handler
                orgId: component.project_org_id,

                // Component Metadata
                name: component.component_name,
                componentType: component.component_type == "MI" ? types:MI : types:BI,
                handler: component.component_name, // Using component name as handler
                displayName: component.component_display_name ?: component.component_name, // Use display_name or fallback to name
                displayType: "service", // Default to "service"
                description: component.component_description,

                // Status Fields
                status: "active", // Default to "active"
                initStatus: "completed", // Default to "completed"

                // Version & Timestamps
                version: "v1.0.0", // Default version
                createdAt: component.component_created_at ?: "",
                lastBuildDate: component.component_updated_at,
                updatedAt: component.component_updated_at,

                // Classification
                componentSubType: (),
                labels: (),

                // System Component Flag
                isSystemComponent: false,

                // Nested Objects (empty arrays for now)
                apiVersions: [],
                deploymentTracks: [],

                // Git Integration
                gitProvider: component.project_git_provider,
                gitOrganization: component.project_git_organization,
                gitRepository: component.project_repository,
                branch: component.project_branch,

                // Advanced Fields
                endpoints: [],
                environmentVariables: [],
                secrets: [],

                // Legacy fields for backward compatibility
                componentId: component.component_id,
                project: {
                    id: component.project_id,
                    orgId: component.project_org_id,
                    name: component.project_name,
                    version: <string>component.project_version,
                    createdDate: component.project_created_date,
                    handler: component.project_handler,
                    region: component.project_region,
                    description: component.project_description,
                    'type: component.project_type,
                    gitProvider: component.project_git_provider,
                    gitOrganization: component.project_git_organization,
                    repository: component.project_repository,
                    branch: component.project_branch,
                    secretRef: component.project_secret_ref,
                    createdBy: component.project_created_by,
                    updatedAt: component.project_updated_at,
                    updatedBy: component.project_updated_by
                },
                createdBy: getDisplayNameById(component.component_created_by),
                updatedBy: getDisplayNameById(component.component_updated_by)
            });
        };

    return components;
}

// Get a specific component by ID
// GetComponentById function - FIRST
public isolated function getComponentById(string componentId) returns types:Component|error {
    stream<types:ComponentInDB, sql:Error?> componentStream =
        dbClient->query(`SELECT c.component_id, c.project_id, c.name as component_name, c.display_name as component_display_name, c.description as component_description, 
                                c.component_type, c.created_by as component_created_by, c.created_at as component_created_at, c.updated_at as component_updated_at,
                                c.updated_by as component_updated_by,
                                p.org_id as project_org_id, p.name as project_name, p.version as project_version, 
                                p.created_date as project_created_date, p.handler as project_handler, p.region as project_region,
                                p.description as project_description, p.default_deployment_pipeline_id as project_default_deployment_pipeline_id,
                                p.deployment_pipeline_ids as project_deployment_pipeline_ids, p.type as project_type,
                                p.git_provider as project_git_provider, p.git_organization as project_git_organization,
                                p.repository as project_repository, p.branch as project_branch, p.secret_ref as project_secret_ref,
                                p.created_by as project_created_by, p.updated_at as project_updated_at, p.updated_by as project_updated_by
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
        // Basic Identity Fields
        id: component.component_id,
        projectId: component.project_id,
        orgHandler: component.project_handler, // Using project handler as org handler
        orgId: component.project_org_id,

        // Component Metadata
        name: component.component_name,
        handler: component.component_name, // Using component name as handler
        displayName: component.component_display_name ?: component.component_name, // Use display_name or fallback to name
        displayType: "service", // Default to "service"
        description: component.component_description,

        // Status Fields
        status: "active", // Default to "active"
        initStatus: "completed", // Default to "completed"

        // Version & Timestamps
        version: "v1.0.0", // Default version
        createdAt: component.component_created_at ?: "",
        lastBuildDate: component.component_updated_at,
        updatedAt: component.component_updated_at,

        // Classification
        componentSubType: (),
        componentType: component.component_type == "MI" ? types:MI : types:BI, // Use actual DB value or default to BI
        labels: (),

        // System Component Flag
        isSystemComponent: false,

        // Nested Objects (empty for now)
        repository: (),
        apiVersions: [],
        deploymentTracks: [],

        // Git Integration
        gitProvider: component.project_git_provider,
        gitOrganization: component.project_git_organization,
        gitRepository: component.project_repository,
        branch: component.project_branch,

        // Advanced Fields
        endpoints: [],
        environmentVariables: [],
        secrets: [],

        // Legacy fields for backward compatibility
        componentId: component.component_id,
        project: {
            id: component.project_id,
            orgId: component.project_org_id,
            name: component.project_name,
            version: <string>component.project_version,
            createdDate: component.project_created_date,
            handler: component.project_handler,
            region: component.project_region,
            description: component.project_description,
            'type: component.project_type,
            gitProvider: component.project_git_provider,
            gitOrganization: component.project_git_organization,
            repository: component.project_repository,
            branch: component.project_branch,
            secretRef: component.project_secret_ref,
            createdBy: component.project_created_by,
            updatedAt: component.project_updated_at,
            updatedBy: component.project_updated_by
        },
        createdBy: getDisplayNameById(component.component_created_by),
        updatedBy: getDisplayNameById(component.component_updated_by)
    };
}

// Get a component by project ID and handler (component name) - SECOND
public isolated function getComponentByProjectAndHandler(string projectId, string handler) returns types:Component?|error {
    stream<types:ComponentInDB, sql:Error?> componentStream =
        dbClient->query(`SELECT c.component_id, c.project_id, c.name as component_name, c.display_name as component_display_name, c.description as component_description,
                                c.component_type, c.created_by as component_created_by, c.created_at as component_created_at, c.updated_at as component_updated_at,
                                c.updated_by as component_updated_by,
                                p.org_id as project_org_id, p.name as project_name, p.version as project_version,
                                p.created_date as project_created_date, p.handler as project_handler, p.region as project_region,
                                p.description as project_description, p.default_deployment_pipeline_id as project_default_deployment_pipeline_id,
                                p.deployment_pipeline_ids as project_deployment_pipeline_ids, p.type as project_type,
                                p.git_provider as project_git_provider, p.git_organization as project_git_organization,
                                p.repository as project_repository, p.branch as project_branch, p.secret_ref as project_secret_ref,
                                p.created_by as project_created_by, p.updated_at as project_updated_at, p.updated_by as project_updated_by
                         FROM components c
                         JOIN projects p ON c.project_id = p.project_id
                         WHERE c.project_id = ${projectId} AND c.name = ${handler}`);

    types:ComponentInDB[] componentRecords =
        check from types:ComponentInDB component in componentStream
        select component;

    if componentRecords.length() == 0 {
        return (); // Component not found
    }

    types:ComponentInDB component = componentRecords[0];

    return {
        // Basic Identity Fields
        id: component.component_id,
        projectId: component.project_id,
        orgHandler: component.project_handler, // Using project handler as org handler
        orgId: component.project_org_id,

        // Component Metadata
        name: component.component_name,
        handler: component.component_name, // Using component name as handler
        displayName: component.component_display_name ?: component.component_name, // Use display_name or fallback to name
        displayType: "service", // Default to "service"
        description: component.component_description,

        // Status Fields
        status: "active", // Default to "active"
        initStatus: "completed", // Default to "completed"

        // Version & Timestamps
        version: "v1.0.0", // Default version
        createdAt: component.component_created_at ?: "",
        lastBuildDate: component.component_updated_at,
        updatedAt: component.component_updated_at,

        // Classification
        componentSubType: (),
        componentType: component.component_type == "MI" ? types:MI : types:BI, // Use actual DB value or default to BI (SECOND)
        labels: (),

        // System Component Flag
        isSystemComponent: false,

        // Nested Objects (empty for now)
        repository: (),
        apiVersions: [],
        deploymentTracks: [],

        // Git Integration
        gitProvider: component.project_git_provider,
        gitOrganization: component.project_git_organization,
        gitRepository: component.project_repository,
        branch: component.project_branch,

        // Advanced Fields
        endpoints: [],
        environmentVariables: [],
        secrets: [],

        // Legacy fields for backward compatibility
        componentId: component.component_id,
        project: {
            id: component.project_id,
            orgId: component.project_org_id,
            name: component.project_name,
            version: <string>component.project_version,
            createdDate: component.project_created_date,
            handler: component.project_handler,
            region: component.project_region,
            description: component.project_description,
            'type: component.project_type,
            gitProvider: component.project_git_provider,
            gitOrganization: component.project_git_organization,
            repository: component.project_repository,
            branch: component.project_branch,
            secretRef: component.project_secret_ref,
            createdBy: component.project_created_by,
            updatedAt: component.project_updated_at,
            updatedBy: component.project_updated_by
        },
        createdBy: getDisplayNameById(component.component_created_by),
        updatedBy: getDisplayNameById(component.component_updated_by)
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
public isolated function updateComponent(string componentId, string? name, string? displayName, string? description, string updatedBy) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE component_id = ${componentId} `;
    sql:ParameterizedQuery updateFields = ` SET updated_at = CURRENT_TIMESTAMP, updated_by = ${updatedBy} `;

    if name is string {
        updateFields = sql:queryConcat(updateFields, `, name = ${name} `);
    }
    if displayName is string {
        updateFields = sql:queryConcat(updateFields, `, display_name = ${displayName} `);
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
        `SELECT r.role_id, r.project_id, r.environment_type, r.privilege_level, r.role_name, r.created_at, r.updated_at
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

// Get or create a role for a specific project-environment-type-privilege combination
isolated function getOrCreateRole(string projectId, types:EnvironmentType environmentType, types:PrivilegeLevel privilegeLevel) returns string|error {
    // First try to get existing role
    stream<record {|string role_id;|}, sql:Error?> roleStream = dbClient->query(
        `SELECT role_id FROM roles 
         WHERE project_id = ${projectId} 
         AND environment_type = ${environmentType} 
         AND privilege_level = ${privilegeLevel}`
        );

    record {|string role_id;|}[] existingRoles = check from record {|string role_id;|} role in roleStream
        select role;

    if existingRoles.length() > 0 {
        return existingRoles[0].role_id;
    }

    // Role doesn't exist, create it
    string roleId = uuid:createRandomUuid();

    // Get project name for role_name
    types:Project project = check getProjectById(projectId);

    // Replace spaces with underscores in project name
    string projectName = re `\s+`.replaceAll(project.name, "_");

    string roleName = string `${projectName}:${environmentType}:${privilegeLevel}`;

    sql:ExecutionResult _ = check dbClient->execute(
        `INSERT INTO roles (role_id, project_id, environment_type, privilege_level, role_name)
         VALUES (${roleId}, ${projectId}, ${environmentType}, ${privilegeLevel}, ${roleName})`
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
                    assignment.environmentType,
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

// Get all environment IDs where a component has runtimes
public isolated function getEnvironmentIdsWithRuntimes(string componentId) returns string[]|error {
    log:printDebug(string `Fetching environment IDs where component ${componentId} has runtimes`);

    stream<record {|string environment_Id;|}, sql:Error?> envStream = dbClient->query(
        `SELECT DISTINCT environment_id 
         FROM runtimes 
         WHERE component_id = ${componentId}`
        );

    string[] environmentIds = [];
    check from record {|string environment_Id;|} envRecord in envStream
        do {
            environmentIds.push(envRecord.environment_Id);
        };

    log:printInfo(string `Component ${componentId} has runtimes in ${environmentIds.length()} environments`);
    return environmentIds;
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

// Update user profile (display name)
public isolated function updateUserProfile(string userId, string displayName) returns error? {
    log:printDebug(string `Updating profile for user: ${userId}`);

    // First check if user exists
    types:User|error existingUser = getUserDetailsById(userId);
    if existingUser is error {
        log:printError(string `User not found: ${userId}`, existingUser);
        return error(string `User not found: ${userId}`);
    }

    transaction {
        // Update users table
        sql:ExecutionResult _ = check dbClient->execute(
            `UPDATE users 
             SET display_name = ${displayName}, updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = ${userId}`
            );

        // Update user_credentials table if exists (for users with local auth)
        sql:ExecutionResult _ = check dbClient->execute(
            `UPDATE user_credentials 
             SET display_name = ${displayName}, updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = ${userId}`
            );

        check commit;
        log:printInfo(string `Successfully updated profile for user ${userId}`);
    } on fail error e {
        log:printError(string `Transaction failed while updating profile for user ${userId}`, e);
        return error(string `Failed to update profile for user ${userId}`, e);
    }

    return ();
}

// ============================================================================
// REFRESH TOKEN FUNCTIONS
// ============================================================================

// Store a new refresh token in the database
public isolated function storeRefreshToken(string tokenId, string userId, string tokenHash, int expirySeconds, string? userAgent,
        string? ipAddress) returns error? {
    log:printDebug(string `Storing refresh token for user: ${userId}`);

    // Calculate expiry time in Ballerina by adding seconds to current time
    time:Utc currentTime = time:utcNow();
    decimal expiryEpoch = <decimal>currentTime[0] + <decimal>expirySeconds;
    time:Utc expiryUtc = [<int>expiryEpoch, currentTime[1]];
    string expiryUtcStr = check convertUtcToDbDateTime(expiryUtc);

    sql:ExecutionResult|sql:Error result = dbClient->execute(
        `INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at, user_agent, ip_address) 
         VALUES (${tokenId}, ${userId}, ${tokenHash}, ${expiryUtcStr}, ${userAgent}, ${ipAddress})`
        );

    if result is sql:Error {
        log:printError(string `Failed to store refresh token for user ${userId}`, result);
        return result;
    }

    log:printInfo(string `Successfully stored refresh token for user ${userId}`);
    return ();
}

// Validate a refresh token and return user details if valid
// Returns error if token is invalid, expired, or revoked
public isolated function validateRefreshToken(string tokenHash) returns types:User|error {
    log:printDebug("Validating refresh token");

    // Query for the refresh token with epoch timestamp for expiry
    record {|
        string token_id;
        string user_id;
        boolean revoked;
        int expires_at_epoch;
    |}|sql:Error refreshToken = dbClient->queryRow(
        `SELECT token_id, user_id, revoked, UNIX_TIMESTAMP(expires_at) as expires_at_epoch
         FROM refresh_tokens 
         WHERE token_hash = ${tokenHash}`
        );

    if refreshToken is sql:Error {
        log:printWarn("Refresh token not found in database");
        return error("Invalid refresh token");
    }

    // Check if token is revoked
    if refreshToken.revoked {
        log:printWarn("Refresh token has been revoked", tokenId = refreshToken.token_id);
        return error("Refresh token has been revoked");
    }

    // Check if token has expired (compare epoch timestamps)
    time:Utc currentTime = time:utcNow();
    decimal currentEpoch = <decimal>currentTime[0];
    decimal expiryEpoch = <decimal>refreshToken.expires_at_epoch;

    if expiryEpoch <= currentEpoch {
        log:printWarn("Refresh token has expired", tokenId = refreshToken.token_id);
        return error("Refresh token has expired");
    }

    // Update last_used_at timestamp
    sql:ExecutionResult|sql:Error updateResult = dbClient->execute(
        `UPDATE refresh_tokens 
         SET last_used_at = CURRENT_TIMESTAMP 
         WHERE token_hash = ${tokenHash}`
        );

    if updateResult is sql:Error {
        log:printWarn("Failed to update last_used_at for refresh token", updateResult);
        // Don't fail the validation, just log the warning
    }

    // Fetch and return user details
    types:User|error user = getUserDetailsById(refreshToken.user_id);
    if user is error {
        log:printError(string `Failed to get user details for token validation`, user);
        return error("User not found for refresh token");
    }

    log:printInfo("Refresh token validated successfully", userId = user.userId);
    return user;
}

// Revoke a refresh token (logout)
public isolated function revokeRefreshToken(string tokenHash) returns error? {
    log:printDebug("Revoking refresh token");

    sql:ExecutionResult|sql:Error result = dbClient->execute(
        `UPDATE refresh_tokens 
         SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP 
         WHERE token_hash = ${tokenHash}`
        );

    if result is sql:Error {
        log:printError("Failed to revoke refresh token", result);
        return result;
    }

    // Check if any rows were affected
    int? affectedRows = result.affectedRowCount;
    if affectedRows is () || affectedRows == 0 {
        log:printWarn("No refresh token found to revoke");
        return error("Refresh token not found");
    }

    log:printInfo("Successfully revoked refresh token");
    return ();
}

// Revoke all refresh tokens for a specific user
public isolated function revokeAllUserRefreshTokens(string userId) returns error? {
    log:printDebug(string `Revoking all refresh tokens for user: ${userId}`);

    sql:ExecutionResult|sql:Error result = dbClient->execute(
        `UPDATE refresh_tokens 
         SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP 
         WHERE user_id = ${userId} AND revoked = FALSE`
        );

    if result is sql:Error {
        log:printError(string `Failed to revoke refresh tokens for user ${userId}`, result);
        return result;
    }

    int? affectedRows = result.affectedRowCount;
    log:printInfo(string `Successfully revoked ${affectedRows ?: 0} refresh tokens for user ${userId}`);
    return ();
}

// Clean up expired refresh tokens (called by scheduled job)
public isolated function cleanupExpiredRefreshTokens() returns error? {
    log:printDebug("Cleaning up expired refresh tokens");

    sql:ExecutionResult|sql:Error result = dbClient->execute(
        `DELETE FROM refresh_tokens 
         WHERE expires_at < CURRENT_TIMESTAMP OR revoked = TRUE`
        );

    if result is sql:Error {
        log:printError("Failed to cleanup expired refresh tokens", result);
        return result;
    }

    int? deletedCount = result.affectedRowCount;
    log:printInfo(string `Successfully cleaned up ${deletedCount ?: 0} expired/revoked refresh tokens`);
    return ();
}

// Check project creation eligibility for an organization
public isolated function checkProjectCreationEligibility(int orgId, string orgHandler) returns types:ProjectCreationEligibility|error {
    log:printDebug(string `Checking project creation eligibility for orgId: ${orgId}, orgHandler: ${orgHandler}`);
    // TODO:
    // Simple implementation: allow project creation if organization exists and is active
    // This can be extended with more complex business logic

    sql:ParameterizedQuery query = `SELECT COUNT(*) as PROJECTCOUNT 
                                   FROM projects 
                                   WHERE org_id = ${orgId}`;

    int currentProjectCount = 0;

    stream<record {}, sql:Error?> projectCountStream = dbClient->query(query);

    check from record {} countRecord in projectCountStream
        do {
            currentProjectCount = <int>countRecord["PROJECTCOUNT"];
        };

    boolean isAllowed = true;

    log:printInfo(string `Project creation eligibility check completed`,
            orgId = orgId,
            orgHandler = orgHandler,
            currentProjectCount = currentProjectCount,
            isAllowed = isAllowed);

    return {
        isProjectCreationAllowed: isAllowed
    };
}

// Check project handler availability for an organization
public isolated function checkProjectHandlerAvailability(int orgId, string projectHandlerCandidate) returns types:ProjectHandlerAvailability|error {
    log:printDebug(string `Checking project handler availability for orgId: ${orgId}, handler: ${projectHandlerCandidate}`);

    // Check if the handler already exists for this organization
    sql:ParameterizedQuery query = `SELECT COUNT(*) as HANDLECOUNT 
                                   FROM projects 
                                   WHERE org_id = ${orgId} AND handler = ${projectHandlerCandidate}`;

    int existingHandlerCount = 0;

    stream<record {}, sql:Error?> handlerCountStream = dbClient->query(query);

    check from record {} countRecord in handlerCountStream
        do {
            existingHandlerCount = <int>countRecord["HANDLECOUNT"];
        };

    boolean isHandlerUnique = existingHandlerCount == 0;
    string? alternateCandidate = ();

    // If handler is not unique, generate an alternate candidate
    if !isHandlerUnique {
        // Generate alternate handler suggestions by appending numbers
        int counter = 1;
        string baseHandler = projectHandlerCandidate;

        while counter <= 10 { // Limit to 10 attempts to avoid infinite loop
            string candidate = string `${baseHandler}${counter}`;

            sql:ParameterizedQuery alternateQuery = `SELECT COUNT(*) as HANDLECOUNT 
                                                   FROM projects 
                                                   WHERE org_id = ${orgId} AND handler = ${candidate}`;

            int candidateCount = 0;
            stream<record {}, sql:Error?> candidateStream = dbClient->query(alternateQuery);

            check from record {} candidateRecord in candidateStream
                do {
                    candidateCount = <int>candidateRecord["HANDLECOUNT"];
                };

            if candidateCount == 0 {
                alternateCandidate = candidate;
                break;
            }

            counter += 1;
        }
    }

    log:printInfo(string `Project handler availability check completed`,
            orgId = orgId,
            projectHandlerCandidate = projectHandlerCandidate,
            isHandlerUnique = isHandlerUnique,
            alternateCandidate = alternateCandidate);

    return {
        handlerUnique: isHandlerUnique,
        alternateHandlerCandidate: alternateCandidate
    };
}
