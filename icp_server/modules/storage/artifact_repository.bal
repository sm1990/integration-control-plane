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

import icp_server.types;

import ballerina/crypto;
import ballerina/sql;

// Helper function to get runtime IDs for a specific environment and component
isolated function getRuntimeIdsByEnvironmentAndComponent(string environmentId, string componentId) returns string[]|error {
    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(`
        SELECT runtime_id 
        FROM runtimes 
        WHERE environment_id = ${environmentId} AND component_id = ${componentId}
    `);

    string[] runtimeIds = [];
    check from types:RuntimeDBRecord runtime in runtimeStream
        do {
            runtimeIds.push(runtime.runtime_id);
        };

    return runtimeIds;
}

// Helper function to calculate a hash for a service based on its key properties
isolated function calculateServiceHash(types:Service 'service) returns string {
    // Create a unique string representation of the service including resources
    string serviceKey = string `${('service.name)}-${('service.package)}-${('service.basePath)}-${('service.'type)}`;

    // Add resources to the hash calculation
    foreach types:Resource 'resource in 'service.resources {
        serviceKey = serviceKey + string `-${('resource.path)}-${('resource.method)}`;
    }

    // Calculate SHA-256 hash
    byte[] hashBytes = crypto:hashSha256(serviceKey.toBytes());
    return hashBytes.toBase16();
}

// Helper function to calculate a hash for a listener based on its key properties
isolated function calculateListenerHash(types:Listener listenerRecord) returns string {
    // Create a unique string representation of the listener
    string listenerKey = string `${listenerRecord.name}-${listenerRecord.package}-${listenerRecord.protocol}`;

    // Add optional fields if present
    string? host = listenerRecord?.host;
    if host is string {
        listenerKey = listenerKey + string `-${host}`;
    }
    int? port = listenerRecord?.port;
    if port is int {
        listenerKey = listenerKey + string `-${port}`;
    }
    string? destination = listenerRecord?.destination;
    if destination is string {
        listenerKey = listenerKey + string `-${destination}`;
    }
    string? queue = listenerRecord?.queue;
    if queue is string {
        listenerKey = listenerKey + string `-${queue}`;
    }
    string? path = listenerRecord?.path;
    if path is string {
        listenerKey = listenerKey + string `-${path}`;
    }

    // Calculate SHA-256 hash
    byte[] hashBytes = crypto:hashSha256(listenerKey.toBytes());
    return hashBytes.toBase16();
}

// Get services for a specific environment and component
public isolated function getServicesByEnvironmentAndComponent(string environmentId, string componentId) returns types:Service[]|error {
    types:Service[] serviceList = [];
    map<boolean> seenHashes = {}; // Track unique service hashes

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return serviceList;
    }

    // Get all services for these runtimes, ensuring uniqueness
    foreach string runtimeId in runtimeIds {
        types:Service[] runtimeServices = check getServicesForRuntime(runtimeId);
        foreach types:Service 'service in runtimeServices {
            string hash = calculateServiceHash('service);
            // Only add if we haven't seen this hash before
            if !seenHashes.hasKey(hash) {
                serviceList.push('service);
                seenHashes[hash] = true;
            }
        }
    }

    return serviceList;
}

// Get listeners for a specific environment and component
public isolated function getListenersByEnvironmentAndComponent(string environmentId, string componentId) returns types:Listener[]|error {
    types:Listener[] listenerList = [];
    map<boolean> seenHashes = {}; // Track unique listener hashes

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return listenerList;
    }

    // Get all listeners for these runtimes, ensuring uniqueness
    foreach string runtimeId in runtimeIds {
        types:Listener[] runtimeListeners = check getListenersForRuntime(runtimeId);
        foreach types:Listener listenerRecord in runtimeListeners {
            string hash = calculateListenerHash(listenerRecord);
            // Only add if we haven't seen this hash before
            if !seenHashes.hasKey(hash) {
                listenerList.push(listenerRecord);
                seenHashes[hash] = true;
            }
        }
    }

    return listenerList;
}

// Get REST APIs for a specific environment and component
public isolated function getRestApisByEnvironmentAndComponent(string environmentId, string componentId) returns types:RestApi[]|error {
    types:RestApi[] apiList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return apiList;
    }

    // Get all REST APIs for these runtimes
    foreach string runtimeId in runtimeIds {
        types:RestApi[] runtimeApis = check getApisForRuntime(runtimeId);
        apiList.push(...runtimeApis);
    }

    return apiList;
}

// Get Carbon Apps for a specific environment and component
public isolated function getCarbonAppsByEnvironmentAndComponent(string environmentId, string componentId) returns types:CarbonApp[]|error {
    types:CarbonApp[] appList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return appList;
    }

    // Get all Carbon Apps for these runtimes
    foreach string runtimeId in runtimeIds {
        types:CarbonApp[] runtimeApps = check getCarbonAppsForRuntime(runtimeId);
        appList.push(...runtimeApps);
    }

    return appList;
}

// Get Inbound Endpoints for a specific environment and component
public isolated function getInboundEndpointsByEnvironmentAndComponent(string environmentId, string componentId) returns types:InboundEndpoint[]|error {
    types:InboundEndpoint[] inboundList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return inboundList;
    }

    // Get all Inbound Endpoints for these runtimes
    foreach string runtimeId in runtimeIds {
        types:InboundEndpoint[] runtimeInbounds = check getInboundEndpointsForRuntime(runtimeId);
        inboundList.push(...runtimeInbounds);
    }

    return inboundList;
}

// Get Endpoints for a specific environment and component
public isolated function getEndpointsByEnvironmentAndComponent(string environmentId, string componentId) returns types:Endpoint[]|error {
    types:Endpoint[] endpointList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return endpointList;
    }

    // Get all Endpoints for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Endpoint[] runtimeEndpoints = check getEndpointsForRuntime(runtimeId);
        endpointList.push(...runtimeEndpoints);
    }

    return endpointList;
}

// Get Sequences for a specific environment and component
public isolated function getSequencesByEnvironmentAndComponent(string environmentId, string componentId) returns types:Sequence[]|error {
    types:Sequence[] sequenceList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return sequenceList;
    }

    // Get all Sequences for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Sequence[] runtimeSequences = check getSequencesForRuntime(runtimeId);
        sequenceList.push(...runtimeSequences);
    }

    return sequenceList;
}

// Get Proxy Services for a specific environment and component
public isolated function getProxyServicesByEnvironmentAndComponent(string environmentId, string componentId) returns types:ProxyService[]|error {
    types:ProxyService[] proxyList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return proxyList;
    }

    // Get all Proxy Services for these runtimes
    foreach string runtimeId in runtimeIds {
        types:ProxyService[] runtimeProxies = check getProxyServicesForRuntime(runtimeId);
        proxyList.push(...runtimeProxies);
    }

    return proxyList;
}

// Get Tasks for a specific environment and component
public isolated function getTasksByEnvironmentAndComponent(string environmentId, string componentId) returns types:Task[]|error {
    types:Task[] taskList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return taskList;
    }

    // Get all Tasks for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Task[] runtimeTasks = check getTasksForRuntime(runtimeId);
        taskList.push(...runtimeTasks);
    }

    return taskList;
}

// Get Templates for a specific environment and component
public isolated function getTemplatesByEnvironmentAndComponent(string environmentId, string componentId) returns types:Template[]|error {
    types:Template[] templateList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return templateList;
    }

    // Get all Templates for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Template[] runtimeTemplates = check getTemplatesForRuntime(runtimeId);
        templateList.push(...runtimeTemplates);
    }

    return templateList;
}

// Get Message Stores for a specific environment and component
public isolated function getMessageStoresByEnvironmentAndComponent(string environmentId, string componentId) returns types:MessageStore[]|error {
    types:MessageStore[] storeList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return storeList;
    }

    // Get all Message Stores for these runtimes
    foreach string runtimeId in runtimeIds {
        types:MessageStore[] runtimeStores = check getMessageStoresForRuntime(runtimeId);
        storeList.push(...runtimeStores);
    }

    return storeList;
}

// Get Message Processors for a specific environment and component
public isolated function getMessageProcessorsByEnvironmentAndComponent(string environmentId, string componentId) returns types:MessageProcessor[]|error {
    types:MessageProcessor[] processorList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return processorList;
    }

    // Get all Message Processors for these runtimes
    foreach string runtimeId in runtimeIds {
        types:MessageProcessor[] runtimeProcessors = check getMessageProcessorsForRuntime(runtimeId);
        processorList.push(...runtimeProcessors);
    }

    return processorList;
}

// Get Local Entries for a specific environment and component
public isolated function getLocalEntriesByEnvironmentAndComponent(string environmentId, string componentId) returns types:LocalEntry[]|error {
    types:LocalEntry[] entryList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return entryList;
    }

    // Get all Local Entries for these runtimes
    foreach string runtimeId in runtimeIds {
        types:LocalEntry[] runtimeEntries = check getLocalEntriesForRuntime(runtimeId);
        entryList.push(...runtimeEntries);
    }

    return entryList;
}

// Get Data Services for a specific environment and component
public isolated function getDataServicesByEnvironmentAndComponent(string environmentId, string componentId) returns types:DataService[]|error {
    types:DataService[] dataServiceList = [];

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return dataServiceList;
    }

    // Get all Data Services for these runtimes
    foreach string runtimeId in runtimeIds {
        types:DataService[] runtimeDataServices = check getDataServicesForRuntime(runtimeId);
        dataServiceList.push(...runtimeDataServices);
    }

    return dataServiceList;
}
