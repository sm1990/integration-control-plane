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

import ballerina/lang.value as value;
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
                 runtime_hostname, runtime_port,
                 platform_name, platform_version, platform_home, os_name, os_version, 
                 carbon_home, java_vendor, java_version, total_memory, free_memory, max_memory, used_memory, os_arch, server_name,
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

// Get runtimes for multiple integrations in a single batch query (optimized for RBAC v2)
// This eliminates N+1 query pattern by using SQL IN clause
public isolated function getRuntimesByIntegrationIds(
        string[] integrationIds,
        string? status = (),
        string? runtimeType = (),
        string? environmentId = (),
        string? projectId = ()
) returns types:Runtime[]|error {
    // Return empty array if no integration IDs provided
    if integrationIds.length() == 0 {
        return [];
    }

    types:Runtime[] runtimeList = [];

    // Build WHERE clause with IN condition for component_id
    sql:ParameterizedQuery whereClause = ` WHERE 1=1 `;
    sql:ParameterizedQuery whereConditions = ` `;

    // Add component_id IN clause
    sql:ParameterizedQuery inClause = ` AND component_id IN (`;
    foreach int i in 0 ..< integrationIds.length() {
        if i > 0 {
            inClause = sql:queryConcat(inClause, `, `);
        }
        inClause = sql:queryConcat(inClause, `${integrationIds[i]}`);
    }
    inClause = sql:queryConcat(inClause, `) `);
    whereConditions = sql:queryConcat(whereConditions, inClause);

    // Add optional filters
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

    sql:ParameterizedQuery selectClause = ` SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version, 
                 runtime_hostname, runtime_port,
                 platform_name, platform_version, platform_home, os_name, os_version, 
                 carbon_home, java_vendor, java_version, total_memory, free_memory, max_memory, used_memory, os_arch, server_name,
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

// Get a specific runtime by ID
public isolated function getRuntimeById(string runtimeId) returns types:Runtime?|error {
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(`
        SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version,
               runtime_hostname, runtime_port,
               platform_name, platform_version, platform_home, os_name, os_version, 
               carbon_home, java_vendor, java_version, total_memory, free_memory, max_memory, used_memory, os_arch, server_name,
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

// Get the type of a runtime by ID
public isolated function getRuntimeTypeById(string runtimeId) returns types:RuntimeTypeRecord?|error {
    log:printDebug("Fetching runtime type for runtime ID: " + runtimeId);
    stream<types:RuntimeTypeRecord, sql:Error?> runtimeTypeStream = dbClient->query(`
        SELECT runtime_id, runtime_type, environment_id, component_id 
        FROM runtimes
        WHERE runtime_id = ${runtimeId}
    `);

    types:RuntimeTypeRecord[] runtimeTypeRecords = check from types:RuntimeTypeRecord runtimeTypeRecord in runtimeTypeStream
        select runtimeTypeRecord;

    if runtimeTypeRecords.length() == 0 {
        log:printDebug("No runtime type found for runtime ID: " + runtimeId);
        return;
    }

    return runtimeTypeRecords[0];
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
// For K8S deployments, delete OFFLINE runtimes instead of marking them
public isolated function markOfflineRuntimes() returns error? {

    // Use database native timestamp functions for reliable comparison

    if deploymentType == "K8S" {
        // For K8S deployments, delete runtimes that should be marked offline
        sql:ParameterizedQuery deleteQuery = sql:queryConcat(
                `DELETE FROM runtimes
            WHERE status != 'OFFLINE'
            AND last_heartbeat IS NOT NULL
            AND `,
                sqlQueryFromString(getTimestampDiffSeconds("last_heartbeat", "CURRENT_TIMESTAMP")),
                ` > ${heartbeatTimeoutSeconds}`
        );
        sql:ExecutionResult result = check dbClient->execute(deleteQuery);

        int? affectedCount = result.affectedRowCount;
        if affectedCount is int && affectedCount > 0 {
            log:printInfo(string `Successfully deleted ${affectedCount} offline runtime(s) in K8S deployment`);
        }
    } else {
        // For VM deployments, mark runtimes as offline
        sql:ParameterizedQuery updateQuery = sql:queryConcat(
                `UPDATE runtimes
            SET status = 'OFFLINE'
            WHERE status != 'OFFLINE'
            AND last_heartbeat IS NOT NULL
            AND `,
                sqlQueryFromString(getTimestampDiffSeconds("last_heartbeat", "CURRENT_TIMESTAMP")),
                ` > ${heartbeatTimeoutSeconds}`
        );
        sql:ExecutionResult result = check dbClient->execute(updateQuery);

        int? affectedCount = result.affectedRowCount;
        if affectedCount is int && affectedCount > 0 {
            log:printInfo(string `Successfully marked ${affectedCount} runtime(s) as OFFLINE`);
        }
    }
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
            types:Service mappedService = check mapToService(serviceRecord, runtimeId);
            serviceList.push(mappedService);
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
        SELECT api_name, url, context, version, state, tracing, statistics, carbon_app
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

    stream<record {|string resource_path; string methods;|}, sql:Error?> resourceStream = dbClient->query(`
        SELECT resource_path, methods
        FROM runtime_api_resources
        WHERE runtime_id = ${runtimeId} AND api_name = ${apiName}
    `);

    check from record {|string resource_path; string methods;|} resourceRecord in resourceStream
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
    // Load endpoints for all proxies in this runtime
    map<string[]> endpointMap = {};
    stream<record {|string proxy_name; string endpoint_url;|}, sql:Error?> epStream = dbClient->query(`
        SELECT proxy_name, endpoint_url
        FROM runtime_proxy_service_endpoints
        WHERE runtime_id = ${runtimeId}
    `);
    check from record {|string proxy_name; string endpoint_url;|} ep in epStream
        do {
            string[] existing = endpointMap[ep.proxy_name] ?: [];
            existing.push(ep.endpoint_url);
            endpointMap[ep.proxy_name] = existing;
        };

    stream<types:ProxyServiceRecordInDB, sql:Error?> proxyStream = dbClient->query(`
        SELECT proxy_name, state, tracing, statistics, carbon_app
        FROM runtime_proxy_services
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:ProxyServiceRecordInDB proxyRecord in proxyStream
        do {
            types:ProxyService proxy = {
                name: proxyRecord.proxy_name,
                state: proxyRecord.state,
                tracing: proxyRecord.tracing,
                statistics: proxyRecord.statistics,
                carbonApp: proxyRecord.carbon_app
            };
            string[] eps = endpointMap[proxyRecord.proxy_name] ?: [];
            proxy.endpoints = eps;
            proxyList.push(proxy);
        };

    return proxyList;
}

// Get endpoints for a specific runtime
public isolated function getEndpointsForRuntime(string runtimeId) returns types:Endpoint[]|error {
    types:Endpoint[] endpointList = [];
    stream<types:EndpointRecordInDB, sql:Error?> endpointStream = dbClient->query(`
        SELECT endpoint_name, endpoint_type, state, tracing, statistics, carbon_app
        FROM runtime_endpoints
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:EndpointRecordInDB endpointRecord in endpointStream
        do {
            types:Endpoint endpoint = {
                name: endpointRecord.endpoint_name,
                'type: endpointRecord.endpoint_type,
                state: endpointRecord.state,
                tracing: endpointRecord.tracing,
                statistics: endpointRecord.statistics,
                carbonApp: endpointRecord.carbon_app
            };
            endpointList.push(endpoint);
        };

    // Attach attributes per endpoint
    foreach int i in 0 ..< (endpointList.length()) {
        types:Endpoint ep = endpointList[i];
        stream<types:EndpointAttribute, sql:Error?> attrStream = dbClient->query(`
            SELECT attribute_name, attribute_value
            FROM runtime_endpoint_attributes
            WHERE runtime_id = ${runtimeId} AND endpoint_name = ${ep.name}
        `);
        types:EndpointAttribute[] attrs = [];
        check from types:EndpointAttribute a in attrStream
            do {
                attrs.push(a);
            };
        if attrs.length() > 0 {
            ep.attributes = attrs;
            endpointList[i] = ep;
        }
    }

    return endpointList;
}

// Get inbound endpoints for a specific runtime
public isolated function getInboundEndpointsForRuntime(string runtimeId) returns types:InboundEndpoint[]|error {
    types:InboundEndpoint[] inboundList = [];
    sql:ParameterizedQuery query;
    if isMSSQL() {
        query = `
            SELECT inbound_name, protocol, sequence, state, [statistics], on_error, tracing, carbon_app
            FROM runtime_inbound_endpoints 
            WHERE runtime_id = ${runtimeId}
        `;
    } else {
        query = `
            SELECT inbound_name, protocol, sequence, state, statistics, on_error, tracing, carbon_app
            FROM runtime_inbound_endpoints 
            WHERE runtime_id = ${runtimeId}
        `;
    }
    stream<types:InboundEndpoint, sql:Error?> inboundStream = dbClient->query(query);

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
        SELECT sequence_name, sequence_type, container, state, tracing, statistics, carbon_app
        FROM runtime_sequences
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:SequenceRecordInDB sequenceRecord in sequenceStream
        do {
            types:Sequence sequence = {
                name: sequenceRecord.sequence_name,
                'type: sequenceRecord.sequence_type,
                container: sequenceRecord.container,
                state: sequenceRecord.state,
                tracing: sequenceRecord.tracing,
                statistics: sequenceRecord.statistics,
                carbonApp: sequenceRecord.carbon_app
            };
            sequenceList.push(sequence);
        };

    return sequenceList;
}

// Get tasks for a specific runtime
public isolated function getTasksForRuntime(string runtimeId) returns types:Task[]|error {
    types:Task[] taskList = [];
    stream<types:TaskRecordInDB, sql:Error?> taskStream = dbClient->query(`
        SELECT task_name, task_class, task_group, state, carbon_app
        FROM runtime_tasks 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:TaskRecordInDB taskRecord in taskStream
        do {
            types:Task task = {
                name: taskRecord.task_name,
                'class: taskRecord.task_class,
                group: taskRecord.task_group,
                state: taskRecord.state,
                carbonApp: taskRecord.carbon_app
            };
            taskList.push(task);
        };

    return taskList;
}

// Get templates for a specific runtime
public isolated function getTemplatesForRuntime(string runtimeId) returns types:Template[]|error {
    types:Template[] templateList = [];
    stream<types:Template, sql:Error?> templateStream = dbClient->query(`
        SELECT template_name, template_type, carbon_app
        FROM runtime_templates 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:Template templateRecord in templateStream
        do {
            // state is no longer persisted; default value in type will be used
            templateList.push(templateRecord);
        };

    return templateList;
}

// Get message stores for a specific runtime
public isolated function getMessageStoresForRuntime(string runtimeId) returns types:MessageStore[]|error {
    types:MessageStore[] storeList = [];
    stream<types:MessageStoreRecordInDB, sql:Error?> storeStream = dbClient->query(`
        SELECT store_name, store_type, size, carbon_app
        FROM runtime_message_stores 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:MessageStoreRecordInDB storeRecord in storeStream
        do {
            types:MessageStore store = {
                name: storeRecord.store_name,
                'type: storeRecord.store_type,
                size: storeRecord.size,
                carbonApp: storeRecord.carbon_app
            };
            storeList.push(store);
        };

    return storeList;
}

// Get message processors for a specific runtime
public isolated function getMessageProcessorsForRuntime(string runtimeId) returns types:MessageProcessor[]|error {
    types:MessageProcessor[] processorList = [];
    stream<types:MessageProcessorRecordInDB, sql:Error?> processorStream = dbClient->query(`
        SELECT processor_name, processor_type, processor_class, state, carbon_app
        FROM runtime_message_processors 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:MessageProcessorRecordInDB processorRecord in processorStream
        do {
            types:MessageProcessor processor = {
                name: processorRecord.processor_name,
                'type: processorRecord.processor_type,
                'class: processorRecord.processor_class,
                state: processorRecord.state,
                carbonApp: processorRecord.carbon_app
            };
            processorList.push(processor);
        };

    return processorList;
}

// Get local entries for a specific runtime
public isolated function getLocalEntriesForRuntime(string runtimeId) returns types:LocalEntry[]|error {
    types:LocalEntry[] entryList = [];
    stream<types:LocalEntryRecordInDB, sql:Error?> entryStream = dbClient->query(`
        SELECT entry_name, entry_type, entry_value, state, carbon_app
        FROM runtime_local_entries 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:LocalEntryRecordInDB entryRecord in entryStream
        do {
            types:LocalEntry entry = {
                name: entryRecord.entry_name,
                'type: entryRecord.entry_type,
                value: entryRecord.entry_value,
                state: entryRecord.state,
                carbonApp: entryRecord.carbon_app
            };
            entryList.push(entry);
        };

    return entryList;
}

// Get data services for a specific runtime
public isolated function getDataServicesForRuntime(string runtimeId) returns types:DataService[]|error {
    types:DataService[] serviceList = [];
    stream<types:DataService, sql:Error?> serviceStream = dbClient->query(`
        SELECT service_name, description, wsdl, state, carbon_app
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
    // Include artifacts column (serialized JSON string) if present
    stream<record {string app_name; string version; types:DeploymentState state; string artifacts?;}, sql:Error?> appStream = dbClient->query(`
        SELECT app_name, version, state, artifacts
        FROM runtime_carbon_apps 
        WHERE runtime_id = ${runtimeId}
    `);

    check from record {string app_name; string version; types:DeploymentState state; string artifacts?;} appRecord in appStream
        do {
            types:CarbonApp app = {
                name: appRecord.app_name,
                version: appRecord.version,
                state: appRecord.state
            };
            if appRecord.artifacts is string {
                // Attempt to parse JSON string to CarbonAppArtifact[]
                string artStr = <string>appRecord.artifacts;
                json|error parsed = value:fromJsonString(artStr);
                if parsed is json {
                    types:CarbonAppArtifact[]|error arts = parseCarbonAppArtifacts(parsed);
                    if arts is types:CarbonAppArtifact[] {
                        app.artifacts = arts;
                    }
                }
            }
            appList.push(app);
        };

    return appList;
}

// Parse a JSON value into CarbonAppArtifact[]; expects an array of objects with name and type
isolated function parseCarbonAppArtifacts(json j) returns types:CarbonAppArtifact[]|error {
    if j is json[] {
        types:CarbonAppArtifact[] result = [];
        foreach json item in j {
            if item is map<json> {
                string? name = <string?>item["name"];
                string? typ = <string?>item["type"];
                if name is string && typ is string {
                    types:CarbonAppArtifact art = {name: name, 'type: typ};
                    result.push(art);
                }
            }
        }
        return result;
    }
    return []; // Non-array or invalid -> empty list
}

// Get data sources for a specific runtime
public isolated function getDataSourcesForRuntime(string runtimeId) returns types:DataSource[]|error {
    types:DataSource[] sourceList = [];
    stream<types:DataSource, sql:Error?> sourceStream = dbClient->query(`
        SELECT datasource_name, datasource_type, driver, url, username, state, carbon_app
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
        SELECT connector_name, package, version, state
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
        SELECT resource_name, resource_type
        FROM runtime_registry_resources 
        WHERE runtime_id = ${runtimeId}
    `);

    check from types:RegistryResourceRecordInDB resourceRecord in resourceStream
        do {
            types:RegistryResource registryResource = {
                name: resourceRecord.resource_name,
                'type: resourceRecord.resource_type
            };
            resourceList.push(registryResource);
        };

    return resourceList;
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

    // Get MI artifacts only for MI runtime types
    if runtimeRecord.runtime_type == types:MI {
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
        managementHostname: runtimeRecord.runtime_hostname,
        managementPort: runtimeRecord.runtime_port,
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
            registryResources: resourceList
        }
    };
}

// Helper function to map service record and get resources
public isolated function mapToService(types:ServiceRecordInDB serviceRecord, string runtimeId) returns types:Service|error {
    types:Resource[] resourceList = [];
    string serviceName = serviceRecord.service_name;

    stream<types:ResourceRecord, sql:Error?> resourceStream = dbClient->query(`
        SELECT resource_url, methods 
        FROM service_resources 
        WHERE runtime_id = ${runtimeId} AND service_name = ${serviceName}
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
        name: serviceRecord.service_name,
        package: serviceRecord.service_package,
        basePath: serviceRecord.base_path,
        state: "enabled", // Default state
        'type: "API", // Default type
        resources: resourceList,
        listeners: [] // Empty listeners array
    };
}
