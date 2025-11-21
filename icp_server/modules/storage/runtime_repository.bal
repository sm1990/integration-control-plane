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

// Get filtered runtimes based on criteria
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

// Mark runtimes as offline if they haven't sent heartbeat within timeout
public isolated function markOfflineRuntimes() returns error? {

    // Use database native timestamp functions for reliable comparison
    // TIMESTAMPDIFF and DATE_SUB work in both H2 (in MySQL mode) and MySQL
    sql:ParameterizedQuery updateQuery = `
        UPDATE runtimes
        SET status = 'OFFLINE'
        WHERE status != 'OFFLINE'
        AND last_heartbeat IS NOT NULL
        AND TIMESTAMPDIFF(SECOND, last_heartbeat, CURRENT_TIMESTAMP) > ${heartbeatTimeoutSeconds}
    `;
    sql:ExecutionResult result = check dbClient->execute(updateQuery);

    int? affectedCount = result.affectedRowCount;
    if affectedCount is int && affectedCount > 0 {
        log:printInfo(string `Successfully marked ${affectedCount} runtime(s) as OFFLINE`);
    }
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
        SELECT listener_name, listener_package, protocol, state, listener_host, listener_port 
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
            // Get resources for this API
            types:ApiResource[] resources = check getApiResourcesForRuntime(runtimeId, apiRecord.name);
            apiRecord.resources = resources;
            apiList.push(apiRecord);
        };

    return apiList;
}

// Get API resources for a specific runtime and API
isolated function getApiResourcesForRuntime(string runtimeId, string apiName) returns types:ApiResource[]|error {
    types:ApiResource[] resourceList = [];

    stream<record {| string resource_path; string methods; |}, sql:Error?> resourceStream = dbClient->query(`
        SELECT resource_path, methods
        FROM runtime_api_resources
        WHERE runtime_id = ${runtimeId} AND api_name = ${apiName}
    `);

    check from record {| string resource_path; string methods; |} resourceRecord in resourceStream
        do {
            types:ApiResource apiResource = {
                path: resourceRecord.resource_path,
                methods: resourceRecord.methods
            };
            resourceList.push(apiResource);
        };

    return resourceList;
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
        SELECT app_name, version, state
        FROM runtime_carbon_apps 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:CarbonAppRecordInDB appRecord in appStream
        do {
            types:CarbonApp app = {
                name: appRecord.app_name,
                version: appRecord.version,
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
