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
import ballerina/log;
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

// Helper to fetch status for a given set of runtime IDs in one query
isolated function getRuntimeStatusMap(string[] runtimeIds) returns map<string>|error {
    map<string> statusMap = {};
    if runtimeIds.length() == 0 {
        return statusMap;
    }

    // Build IN clause for runtime IDs
    sql:ParameterizedQuery inClause = `(`;
    foreach int i in 0 ..< runtimeIds.length() {
        if i > 0 {
            inClause = sql:queryConcat(inClause, `, `);
        }
        inClause = sql:queryConcat(inClause, `${runtimeIds[i]}`);
    }
    inClause = sql:queryConcat(inClause, `)`);

    sql:ParameterizedQuery query = sql:queryConcat(`SELECT runtime_id, status FROM runtimes WHERE runtime_id IN `, inClause);
    stream<record {|string runtime_id; string status;|}, sql:Error?> rs = dbClient->query(query);
    check from record {|string runtime_id; string status;|} row in rs
        do {
            statusMap[row.runtime_id] = row.status;
        };

    return statusMap;
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
    log:printDebug("Service Key: " + serviceKey + " | Hash: " + hashBytes.toBase16());
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
    log:printDebug("Listener Key: " + listenerKey + " | Hash: " + hashBytes.toBase16());
    return hashBytes.toBase16();
}

// Get services for a specific environment and component
public isolated function getServicesByEnvironmentAndComponent(string environmentId, string componentId) returns types:Service[]|error {
    types:Service[] serviceList = [];
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
            if !serviceRuntimeMap.hasKey(hash) {
                serviceRuntimeMap[hash] = [runtimeId];
                serviceList.push('service);
            } else {
                string[] existing = serviceRuntimeMap[hash] ?: [];
                existing.push(runtimeId);
                serviceRuntimeMap[hash] = existing;
            }
        }
    }

    // Build status map once
    map<string> statusMap = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (serviceList.length()) {
        types:Service s = serviceList[i];
        string hash = calculateServiceHash(s);
        string[] rids = serviceRuntimeMap[hash] ?: [];
        s.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMap[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        s.runtimes = infos;
        serviceList[i] = s;
    }
    log:printDebug("Services processed: " + serviceList.length().toString());
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

    // Build status map once
    map<string> statusMapL = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (listenerList.length()) {
        types:Listener l = listenerList[i];
        string hash = calculateListenerHash(l);
        string[] rids = listenerRuntimeMap[hash] ?: [];
        l.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapL[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        l.runtimes = infos;
        listenerList[i] = l;
    }
    log:printDebug("Listeners processed: " + listenerList.length().toString());
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
    // Build status map once
    map<string> statusMapApi = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (apiList.length()) {
        types:RestApi api = apiList[i];
        string[] rids = apiRuntimeMap[api.name] ?: [];
        api.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapApi[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        api.runtimes = infos;
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

    // Build status map once
    map<string> statusMapApp = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (appList.length()) {
        types:CarbonApp app = appList[i];
        string[] rids = appRuntimeMap[app.name] ?: [];
        app.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapApp[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        app.runtimes = infos;
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

    // Build status map once
    map<string> statusMapInbound = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (inboundList.length()) {
        types:InboundEndpoint inbound = inboundList[i];
        string[] rids = inboundRuntimeMap[inbound.name] ?: [];
        inbound.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapInbound[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        inbound.runtimes = infos;
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

    // Build status map once
    map<string> statusMapEndpoint = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (endpointList.length()) {
        types:Endpoint endpoint = endpointList[i];
        string[] rids = endpointRuntimeMap[endpoint.name] ?: [];
        endpoint.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapEndpoint[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        endpoint.runtimes = infos;
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

    // Build status map once
    map<string> statusMapSeq = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (sequenceList.length()) {
        types:Sequence sequence = sequenceList[i];
        string[] rids = sequenceRuntimeMap[sequence.name] ?: [];
        sequence.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapSeq[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        sequence.runtimes = infos;
        sequenceList[i] = sequence;
    }

    return sequenceList;
}

// Get Proxy Services for a specific environment and component
public isolated function getProxyServicesByEnvironmentAndComponent(string environmentId, string componentId) returns types:ProxyService[]|error {
    types:ProxyService[] proxyList = [];
    map<string[]> proxyRuntimeMap = {};
    map<int> proxyIndexMap = {};

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
                proxyIndexMap[key] = proxyList.length();
                proxyList.push(proxy);
            } else {
                existing.push(runtimeId);
                proxyRuntimeMap[key] = existing;
                // Merge endpoints across runtimes
                int idx = -1;
                int? idxOpt = proxyIndexMap[key];
                if idxOpt is int {
                    idx = idxOpt;
                }
                if idx >= 0 {
                    types:ProxyService existingProxy = proxyList[idx];
                    string[] existingEndpoints = existingProxy.endpoints ?: [];
                    string[] newEndpoints = proxy.endpoints ?: [];
                    // Union
                    map<boolean> seen = {};
                    string[] merged = [];
                    foreach string ep in existingEndpoints {
                        if !seen.hasKey(ep) {
                            seen[ep] = true;
                            merged.push(ep);
                        }
                    }
                    foreach string ep in newEndpoints {
                        if !seen.hasKey(ep) {
                            seen[ep] = true;
                            merged.push(ep);
                        }
                    }
                    existingProxy.endpoints = merged;
                    proxyList[idx] = existingProxy;
                }
            }
        }
    }

    // Build status map once
    map<string> statusMapProxy = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (proxyList.length()) {
        types:ProxyService proxy = proxyList[i];
        string[] rids = proxyRuntimeMap[proxy.name] ?: [];
        proxy.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapProxy[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        proxy.runtimes = infos;
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

    // Build status map once
    map<string> statusMapTask = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (taskList.length()) {
        types:Task task = taskList[i];
        string[] rids = taskRuntimeMap[task.name] ?: [];
        task.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapTask[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        task.runtimes = infos;
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

    // Build status map once
    map<string> statusMapTpl = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (templateList.length()) {
        types:Template template = templateList[i];
        string[] rids = templateRuntimeMap[template.name] ?: [];
        template.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapTpl[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        template.runtimes = infos;
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

    // Build status map once
    map<string> statusMapStore = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (storeList.length()) {
        types:MessageStore store = storeList[i];
        string[] rids = storeRuntimeMap[store.name] ?: [];
        store.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapStore[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        store.runtimes = infos;
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

    // Build status map once
    map<string> statusMapProc = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (processorList.length()) {
        types:MessageProcessor proc = processorList[i];
        string[] rids = processorRuntimeMap[proc.name] ?: [];
        proc.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapProc[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        proc.runtimes = infos;
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

    // Build status map once
    map<string> statusMapEntry = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (entryList.length()) {
        types:LocalEntry entry = entryList[i];
        string[] rids = entryRuntimeMap[entry.name] ?: [];
        entry.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapEntry[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        entry.runtimes = infos;
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

    // Build status map once
    map<string> statusMapDsvc = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (dataServiceList.length()) {
        types:DataService ds = dataServiceList[i];
        string[] rids = dsRuntimeMap[ds.name] ?: [];
        ds.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapDsvc[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        ds.runtimes = infos;
        dataServiceList[i] = ds;
    }

    return dataServiceList;
}

// Get Data Sources for a specific environment and component
public isolated function getDataSourcesByEnvironmentAndComponent(string environmentId, string componentId) returns types:DataSource[]|error {
    types:DataSource[] sourceList = [];
    map<string[]> sourceRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return sourceList;
    }

    // Get all Data Sources for these runtimes
    foreach string runtimeId in runtimeIds {
        types:DataSource[] runtimeSources = check getDataSourcesForRuntime(runtimeId);
        foreach types:DataSource ds in runtimeSources {
            string key = ds.name;
            string[] existing = sourceRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                sourceRuntimeMap[key] = [runtimeId];
                sourceList.push(ds);
            } else {
                existing.push(runtimeId);
                sourceRuntimeMap[key] = existing;
            }
        }
    }

    // Build status map once
    map<string> statusMapDs = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (sourceList.length()) {
        types:DataSource ds = sourceList[i];
        string[] rids = sourceRuntimeMap[ds.name] ?: [];
        ds.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapDs[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        ds.runtimes = infos;
        sourceList[i] = ds;
    }

    return sourceList;
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
    // Build status map once
    map<string> statusMapRes = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (resourceList.length()) {
        types:RegistryResource res = resourceList[i];
        string[] rids = resourceRuntimeMap[res.name] ?: [];
        res.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapRes[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        res.runtimes = infos;
        resourceList[i] = res;
    }

    return resourceList;
}

// Get Connectors for a specific environment and component
public isolated function getConnectorsByEnvironmentAndComponent(string environmentId, string componentId) returns types:Connector[]|error {
    types:Connector[] connectorList = [];
    map<string[]> connectorRuntimeMap = {};

    // Get all runtime IDs for this environment and component
    string[] runtimeIds = check getRuntimeIdsByEnvironmentAndComponent(environmentId, componentId);

    // If no runtimes found, return empty array
    if runtimeIds.length() == 0 {
        return connectorList;
    }

    // Get all Connectors for these runtimes
    foreach string runtimeId in runtimeIds {
        types:Connector[] runtimeConnectors = check getConnectorsForRuntime(runtimeId);
        foreach types:Connector conn in runtimeConnectors {
            // Use name + package + version as uniqueness key across runtimes
            string key = string `${conn.name}|${conn.'package}|${conn.version ?: ""}`;
            string[] existing = connectorRuntimeMap[key] ?: [];
            if existing.length() == 0 {
                connectorRuntimeMap[key] = [runtimeId];
                connectorList.push(conn);
            } else {
                existing.push(runtimeId);
                connectorRuntimeMap[key] = existing;
            }
        }
    }

    // Build status map once
    map<string> statusMapConn = check getRuntimeStatusMap(runtimeIds);

    foreach int i in 0 ..< (connectorList.length()) {
        types:Connector conn = connectorList[i];
        string key = string `${conn.name}|${conn.'package}|${conn.version ?: ""}`;
        string[] rids = connectorRuntimeMap[key] ?: [];
        conn.runtimeIds = rids;
        types:ArtifactRuntimeInfo[] infos = [];
        foreach string rid in rids {
            string st = statusMapConn[rid] ?: "UNKNOWN";
            infos.push({runtimeId: rid, status: st});
        }
        conn.runtimes = infos;
        connectorList[i] = conn;
    }

    return connectorList;
}
