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
    map<string[]> serviceRuntimeMap = {};

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
            string[] existing = serviceRuntimeMap[hash] ?: [];
            if existing.length() == 0 {
                serviceRuntimeMap[hash] = [runtimeId];
                if !seenHashes.hasKey(hash) {
                    serviceList.push('service);
                    seenHashes[hash] = true;
                }
            } else {
                existing.push(runtimeId);
                serviceRuntimeMap[hash] = existing;
            }
        }
    }

    foreach int i in 0..<(serviceList.length()) {
        types:Service s = serviceList[i];
        string hash = calculateServiceHash(s);
        s.runtimeIds = serviceRuntimeMap[hash] ?: [];
        serviceList[i] = s;
    }

    return serviceList;
}

// Get listeners for a specific environment and component
public isolated function getListenersByEnvironmentAndComponent(string environmentId, string componentId) returns types:Listener[]|error {
    types:Listener[] listenerList = [];
    map<boolean> seenHashes = {}; // Track unique listener hashes
    map<string[]> listenerRuntimeMap = {};

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
            string[] existing = listenerRuntimeMap[hash] ?: [];
            if existing.length() == 0 {
                listenerRuntimeMap[hash] = [runtimeId];
                if !seenHashes.hasKey(hash) {
                    listenerList.push(listenerRecord);
                    seenHashes[hash] = true;
                }
            } else {
                existing.push(runtimeId);
                listenerRuntimeMap[hash] = existing;
            }
        }
    }

    foreach int i in 0..<(listenerList.length()) {
        types:Listener l = listenerList[i];
        string hash = calculateListenerHash(l);
        l.runtimeIds = listenerRuntimeMap[hash] ?: [];
        listenerList[i] = l;
    }

    return listenerList;
}

// Get REST APIs for a specific environment and component
public isolated function getRestApisByEnvironmentAndComponent(string environmentId, string componentId) returns types:RestApi[]|error {
    types:RestApi[] apiList = [];
    map<string[]> apiRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return apiList;
    }

    // Get all REST APIs for these runtimes
    foreach string runtimeId in runtimeIds {
        types:RestApi[] runtimeApis = check getApisForRuntime(runtimeId);
        foreach types:RestApi api in runtimeApis {
            string key = api.name;
            string[] existing = apiRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                apiRuntimeMap[key] = [runtimeId];
                apiList.push(api);
            } else {
                existing.push(runtimeId);
                apiRuntimeMap[key] = existing;
            }
        }
    }

    // attach runtimeIds
    foreach int i in 0..<(apiList.length()) {
        types:RestApi api = apiList[i];
        api.runtimeIds = apiRuntimeMap[api.name] ?: [];
        apiList[i] = api;
    }

    return apiList;
}

// Get Carbon Apps for a specific environment and component
public isolated function getCarbonAppsByEnvironmentAndComponent(string environmentId, string componentId) returns types:CarbonApp[]|error {
    types:CarbonApp[] appList = [];
    map<string[]> appRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return appList;
    }

    // Get all Carbon Apps for these runtimes
    foreach string runtimeId in runtimeIds {
        types:CarbonApp[] runtimeApps = check getCarbonAppsForRuntime(runtimeId);
        foreach types:CarbonApp app in runtimeApps {
            string key = app.name;
            string[] existing = appRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                appRuntimeMap[key] = [runtimeId];
                appList.push(app);
            } else {
                existing.push(runtimeId);
                appRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(appList.length()) {
        types:CarbonApp app = appList[i];
        app.runtimeIds = appRuntimeMap[app.name] ?: [];
        appList[i] = app;
    }

    return appList;
}

// Get Inbound Endpoints for a specific environment and component
public isolated function getInboundEndpointsByEnvironmentAndComponent(string environmentId, string componentId) returns types:InboundEndpoint[]|error {
    types:InboundEndpoint[] inboundList = [];
    map<string[]> inboundRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return inboundList;
    }

    // Get all Inbound Endpoints for these runtimes
    foreach string runtimeId in runtimeIds {
        types:InboundEndpoint[] runtimeInbounds = check getInboundEndpointsForRuntime(runtimeId);
        foreach types:InboundEndpoint inbound in runtimeInbounds {
            string key = inbound.name;
            string[] existing = inboundRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                inboundRuntimeMap[key] = [runtimeId];
                inboundList.push(inbound);
            } else {
                existing.push(runtimeId);
                inboundRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(inboundList.length()) {
        types:InboundEndpoint inbound = inboundList[i];
        inbound.runtimeIds = inboundRuntimeMap[inbound.name] ?: [];
        inboundList[i] = inbound;
    }

    return inboundList;
}

// Get Endpoints for a specific environment and component
public isolated function getEndpointsByEnvironmentAndComponent(string environmentId, string componentId) returns types:Endpoint[]|error {
    types:Endpoint[] endpointList = [];
    map<string[]> endpointRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return endpointList;
    }

    // Get all Endpoints for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Endpoint[] runtimeEndpoints = check getEndpointsForRuntime(runtimeId);
        foreach types:Endpoint endpoint in runtimeEndpoints {
            string key = endpoint.name;
            string[] existing = endpointRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                endpointRuntimeMap[key] = [runtimeId];
                endpointList.push(endpoint);
            } else {
                existing.push(runtimeId);
                endpointRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(endpointList.length()) {
        types:Endpoint endpoint = endpointList[i];
        endpoint.runtimeIds = endpointRuntimeMap[endpoint.name] ?: [];
        endpointList[i] = endpoint;
    }

    return endpointList;
}

// Get Sequences for a specific environment and component
public isolated function getSequencesByEnvironmentAndComponent(string environmentId, string componentId) returns types:Sequence[]|error {
    types:Sequence[] sequenceList = [];
    map<string[]> sequenceRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return sequenceList;
    }

    // Get all Sequences for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Sequence[] runtimeSequences = check getSequencesForRuntime(runtimeId);
        foreach types:Sequence sequence in runtimeSequences {
            string key = sequence.name;
            string[] existing = sequenceRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                sequenceRuntimeMap[key] = [runtimeId];
                sequenceList.push(sequence);
            } else {
                existing.push(runtimeId);
                sequenceRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(sequenceList.length()) {
        types:Sequence sequence = sequenceList[i];
        sequence.runtimeIds = sequenceRuntimeMap[sequence.name] ?: [];
        sequenceList[i] = sequence;
    }

    return sequenceList;
}

// Get Proxy Services for a specific environment and component
public isolated function getProxyServicesByEnvironmentAndComponent(string environmentId, string componentId) returns types:ProxyService[]|error {
    types:ProxyService[] proxyList = [];
    map<string[]> proxyRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return proxyList;
    }

    // Get all Proxy Services for these runtimes
    foreach string runtimeId in runtimeIds {
        types:ProxyService[] runtimeProxies = check getProxyServicesForRuntime(runtimeId);
        foreach types:ProxyService proxy in runtimeProxies {
            string key = proxy.name;
            string[] existing = proxyRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                proxyRuntimeMap[key] = [runtimeId];
                proxyList.push(proxy);
            } else {
                existing.push(runtimeId);
                proxyRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(proxyList.length()) {
        types:ProxyService proxy = proxyList[i];
        proxy.runtimeIds = proxyRuntimeMap[proxy.name] ?: [];
        proxyList[i] = proxy;
    }

    return proxyList;
}

// Get Tasks for a specific environment and component
public isolated function getTasksByEnvironmentAndComponent(string environmentId, string componentId) returns types:Task[]|error {
    types:Task[] taskList = [];
    map<string[]> taskRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return taskList;
    }

    // Get all Tasks for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Task[] runtimeTasks = check getTasksForRuntime(runtimeId);
        foreach types:Task task in runtimeTasks {
            string key = task.name;
            string[] existing = taskRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                taskRuntimeMap[key] = [runtimeId];
                taskList.push(task);
            } else {
                existing.push(runtimeId);
                taskRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(taskList.length()) {
        types:Task task = taskList[i];
        task.runtimeIds = taskRuntimeMap[task.name] ?: [];
        taskList[i] = task;
    }

    return taskList;
}

// Get Templates for a specific environment and component
public isolated function getTemplatesByEnvironmentAndComponent(string environmentId, string componentId) returns types:Template[]|error {
    types:Template[] templateList = [];
    map<string[]> templateRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return templateList;
    }

    // Get all Templates for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Template[] runtimeTemplates = check getTemplatesForRuntime(runtimeId);
        foreach types:Template template in runtimeTemplates {
            string key = template.name;
            string[] existing = templateRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                templateRuntimeMap[key] = [runtimeId];
                templateList.push(template);
            } else {
                existing.push(runtimeId);
                templateRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(templateList.length()) {
        types:Template template = templateList[i];
        template.runtimeIds = templateRuntimeMap[template.name] ?: [];
        templateList[i] = template;
    }

    return templateList;
}

// Get Message Stores for a specific environment and component
public isolated function getMessageStoresByEnvironmentAndComponent(string environmentId, string componentId) returns types:MessageStore[]|error {
    types:MessageStore[] storeList = [];
    map<string[]> storeRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return storeList;
    }

    // Get all Message Stores for these runtimes
    foreach string runtimeId in runtimeIds {
        types:MessageStore[] runtimeStores = check getMessageStoresForRuntime(runtimeId);
        foreach types:MessageStore store in runtimeStores {
            string key = store.name;
            string[] existing = storeRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                storeRuntimeMap[key] = [runtimeId];
                storeList.push(store);
            } else {
                existing.push(runtimeId);
                storeRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(storeList.length()) {
        types:MessageStore store = storeList[i];
        store.runtimeIds = storeRuntimeMap[store.name] ?: [];
        storeList[i] = store;
    }

    return storeList;
}

// Get Message Processors for a specific environment and component
public isolated function getMessageProcessorsByEnvironmentAndComponent(string environmentId, string componentId) returns types:MessageProcessor[]|error {
    types:MessageProcessor[] processorList = [];
    map<string[]> processorRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return processorList;
    }

    // Get all Message Processors for these runtimes
    foreach string runtimeId in runtimeIds {
        types:MessageProcessor[] runtimeProcessors = check getMessageProcessorsForRuntime(runtimeId);
        foreach types:MessageProcessor proc in runtimeProcessors {
            string key = proc.name;
            string[] existing = processorRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                processorRuntimeMap[key] = [runtimeId];
                processorList.push(proc);
            } else {
                existing.push(runtimeId);
                processorRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(processorList.length()) {
        types:MessageProcessor proc = processorList[i];
        proc.runtimeIds = processorRuntimeMap[proc.name] ?: [];
        processorList[i] = proc;
    }

    return processorList;
}

// Get Local Entries for a specific environment and component
public isolated function getLocalEntriesByEnvironmentAndComponent(string environmentId, string componentId) returns types:LocalEntry[]|error {
    types:LocalEntry[] entryList = [];
    map<string[]> entryRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return entryList;
    }

    // Get all Local Entries for these runtimes
    foreach string runtimeId in runtimeIds {
        types:LocalEntry[] runtimeEntries = check getLocalEntriesForRuntime(runtimeId);
        foreach types:LocalEntry entry in runtimeEntries {
            string key = entry.name;
            string[] existing = entryRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                entryRuntimeMap[key] = [runtimeId];
                entryList.push(entry);
            } else {
                existing.push(runtimeId);
                entryRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(entryList.length()) {
        types:LocalEntry entry = entryList[i];
        entry.runtimeIds = entryRuntimeMap[entry.name] ?: [];
        entryList[i] = entry;
    }

    return entryList;
}

// Get Data Services for a specific environment and component
public isolated function getDataServicesByEnvironmentAndComponent(string environmentId, string componentId) returns types:DataService[]|error {
    types:DataService[] dataServiceList = [];
    map<string[]> dsRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return dataServiceList;
    }

    // Get all Data Services for these runtimes
    foreach string runtimeId in runtimeIds {
        types:DataService[] runtimeDataServices = check getDataServicesForRuntime(runtimeId);
        foreach types:DataService ds in runtimeDataServices {
            string key = ds.name;
            string[] existing = dsRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                dsRuntimeMap[key] = [runtimeId];
                dataServiceList.push(ds);
            } else {
                existing.push(runtimeId);
                dsRuntimeMap[key] = existing;
            }
        }
    }

    foreach int i in 0..<(dataServiceList.length()) {
        types:DataService ds = dataServiceList[i];
        ds.runtimeIds = dsRuntimeMap[ds.name] ?: [];
        dataServiceList[i] = ds;
    }

    return dataServiceList;
}

// Get Registry Resources for a specific environment and component
public isolated function getRegistryResourcesByEnvironmentAndComponent(string environmentId, string componentId) returns types:RegistryResource[]|error {
    types:RegistryResource[] resourceList = [];
    map<string[]> resourceRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return resourceList;
    }

    // Get all Registry Resources for these runtimes
    foreach string runtimeId in runtimeIds {
        types:RegistryResource[] runtimeResources = check getRegistryResourcesForRuntime(runtimeId);
        foreach types:RegistryResource res in runtimeResources {
            string key = res.name;
            string[] existing = resourceRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                resourceRuntimeMap[key] = [runtimeId];
                resourceList.push(res);
            } else {
                existing.push(runtimeId);
                resourceRuntimeMap[key] = existing;
            }
        }
    }
    foreach int i in 0..<(resourceList.length()) {
        types:RegistryResource res = resourceList[i];
        res.runtimeIds = resourceRuntimeMap[res.name] ?: [];
        resourceList[i] = res;
    }

    return resourceList;
}
