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

// Create a new component
public isolated function createComponent(types:ComponentInput component) returns types:Component|error? {
    string componentId = uuid:createType1AsString();
    string componentTypeValue = component.componentType.toString();

    // Use displayName if provided, otherwise fall back to name
    string displayName = component?.displayName ?: component.name;

    sql:ParameterizedQuery insertQuery = `INSERT INTO components (component_id, project_id, name, display_name, description, component_type, created_by) 
                                          VALUES (${componentId}, ${component.projectId}, ${component.name}, ${displayName}, ${component.description}, ${componentTypeValue}, ${component.createdBy})`;
    var result = dbClient->execute(insertQuery);
    if result is sql:Error {
        log:printError(string `Failed to create component: ${component.name}`, 'error = result);
        match classifySqlError(result) {
            DUPLICATE_KEY => { return error("A component with this name already exists in this project", result); }
            VALUE_TOO_LONG => { return error("The provided value exceeds the maximum allowed length", result); }
            FOREIGN_KEY_VIOLATION => { return error("The specified project does not exist", result); }
            _ => { return error("An unexpected error occurred. Please contact your administrator.", result); }
        }
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

    stream<types:ComponentInDB, sql:Error?> componentStream = dbClient->query(query);

    check from types:ComponentInDB component in componentStream
        do {
            components.push(mapToComponent(component));
        };
    return components;
}

// Get all components for multiple projects (RBAC-aware batch query)
public isolated function getComponentsByProjectIds(string[] projectIds, types:ComponentOptionsInput? options = ()) returns types:Component[]|error {
    if projectIds.length() == 0 {
        return [];
    }

    types:Component[] components = [];

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

    sql:ParameterizedQuery inClause = ``;
    foreach int i in 0 ..< projectIds.length() {
        if i > 0 {
            inClause = sql:queryConcat(inClause, `, `);
        }
        inClause = sql:queryConcat(inClause, `${projectIds[i]}`);
    }

    sql:ParameterizedQuery orderByClause = `) ORDER BY c.name ASC`;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, inClause, orderByClause);

    stream<types:ComponentInDB, sql:Error?> componentStream = dbClient->query(query);

    check from types:ComponentInDB component in componentStream
        do {
            components.push(mapToComponent(component));
        };

    return components;
}

// Get components by component IDs (integration IDs) using SQL IN clause
public isolated function getComponentsByIds(string[] componentIds) returns types:Component[]|error {
    if componentIds.length() == 0 {
        return [];
    }

    // Log warning for large lists (similar to getProjectsByIds)
    if componentIds.length() > 5000 {
        log:printWarn(string `Large component ID list: ${componentIds.length()} components`);
    }

    types:Component[] components = [];

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
                                           WHERE c.component_id IN (`;

    sql:ParameterizedQuery inClause = ``;
    foreach int i in 0 ..< componentIds.length() {
        if i > 0 {
            inClause = sql:queryConcat(inClause, `, `);
        }
        inClause = sql:queryConcat(inClause, `${componentIds[i]}`);
    }

    sql:ParameterizedQuery orderByClause = `) ORDER BY c.name ASC`;
    sql:ParameterizedQuery query = sql:queryConcat(selectClause, inClause, orderByClause);

    stream<types:ComponentInDB, sql:Error?> componentStream = dbClient->query(query);

    check from types:ComponentInDB component in componentStream
        do {
            components.push(mapToComponent(component));
        };

    return components;
}

// Get project ID for a given component ID (lightweight query for access control)
public isolated function getProjectIdByComponentId(string componentId) returns string|error {
    stream<record {|string project_id;|}, sql:Error?> resultStream =
        dbClient->query(`SELECT project_id FROM components WHERE component_id = ${componentId}`);

    record {|string project_id;|}[] results =
        check from record {|string project_id;|} result in resultStream
        select result;

    if results.length() == 0 {
        return error(string `Component with id ${componentId} not found`);
    }

    return results[0].project_id;
}

// Get a specific component by ID
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

    return mapToComponent(componentRecords[0]);
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

// Get a component by project ID and handler (component name)
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
        return ();
    }

    return mapToComponent(componentRecords[0]);
}

// Delete a component by ID
public isolated function deleteComponent(string componentId) returns error? {
    sql:ParameterizedQuery deleteQuery = `DELETE FROM components WHERE component_id = ${componentId}`;
    var result = dbClient->execute(deleteQuery);
    if result is sql:Error {
        log:printError(string `Failed to delete component ${componentId}`, 'error = result);
        match classifySqlError(result) {
            FOREIGN_KEY_VIOLATION => { return error("Cannot delete component because it has dependent resources", result); }
            _ => { return error("An unexpected error occurred. Please contact your administrator.", result); }
        }
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
        log:printError(string `Failed to update component ${componentId}`, 'error = result);
        match classifySqlError(result) {
            DUPLICATE_KEY => { return error("A component with this name already exists in this project", result); }
            VALUE_TOO_LONG => { return error("The provided value exceeds the maximum allowed length", result); }
            _ => { return error("An unexpected error occurred. Please contact your administrator.", result); }
        }
    }
    log:printInfo(string `Successfully updated component ${componentId}`);
    return ();
}

// Get component deployment information from runtimes table
public isolated function getComponentDeployment(string componentId, string environmentId, string versionId) returns types:ComponentDeployment?|error {
    log:printDebug(string `Fetching deployment info for component: ${componentId}, environment: ${environmentId}`);

    sql:ParameterizedQuery query = `
        SELECT runtime_id, runtime_type, status, environment_id, project_id, component_id, version,
               platform_name, platform_version, platform_home, os_name, os_version,
               registration_time, last_heartbeat
        FROM runtimes
        WHERE component_id = ${componentId} AND environment_id = ${environmentId}
        ORDER BY last_heartbeat DESC
    `;

    query = appendLimitClause(query, 1);

    stream<types:RuntimeDBRecord, sql:Error?> runtimeStream = dbClient->query(query);

    types:RuntimeDBRecord[] runtimeRecords = check from types:RuntimeDBRecord runtimeRecord in runtimeStream
        select runtimeRecord;

    if runtimeRecords.length() == 0 {
        log:printDebug(string `No runtime found for component ${componentId} in environment ${environmentId}`);
        return ();
    }

    types:RuntimeDBRecord runtime = runtimeRecords[0];
    types:Component component = check getComponentById(componentId);

    int configCount = 0;
    types:Service[] services = check getServicesForRuntime(runtime.runtime_id);
    types:Listener[] listeners = check getListenersForRuntime(runtime.runtime_id);
    configCount = services.length() + listeners.length();

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

// Get artifact types for a component
public isolated function getArtifactTypesForComponent(string componentId, types:RuntimeType componentType, string? environmentId = ()) returns types:ArtifactTypeCount[]|error {
    types:ArtifactTypeCount[] artifactTypes = [];

    sql:ParameterizedQuery runtimeQuery = `SELECT DISTINCT runtime_id FROM runtimes WHERE component_id = ${componentId}`;
    if environmentId is string {
        runtimeQuery = sql:queryConcat(runtimeQuery, ` AND environment_id = ${environmentId}`);
    }
    stream<record {|string runtime_id;|}, sql:Error?> runtimeStream = dbClient->query(runtimeQuery);

    string[] runtimeIds = [];
    check from record {|string runtime_id;|} runtime in runtimeStream
        do {
            runtimeIds.push(runtime.runtime_id);
        };

    if runtimeIds.length() == 0 {
        return [];
    }

    sql:ParameterizedQuery runtimeInClause = ` WHERE runtime_id IN (`;
    foreach int i in 0 ..< runtimeIds.length() {
        if i > 0 {
            runtimeInClause = sql:queryConcat(runtimeInClause, `, `);
        }
        runtimeInClause = sql:queryConcat(runtimeInClause, `${runtimeIds[i]}`);
    }
    runtimeInClause = sql:queryConcat(runtimeInClause, `) `);

    sql:ParameterizedQuery countQuery = `SELECT COUNT(*) as count FROM `;

    int serviceCount = check getCount(sql:queryConcat(countQuery, `bi_service_artifacts `, runtimeInClause));
    if serviceCount > 0 {
        artifactTypes.push({artifactType: types:SERVICE, artifactCount: serviceCount});
    }

    int listenerCount = check getCount(sql:queryConcat(countQuery, `bi_runtime_listener_artifacts `, runtimeInClause));
    if listenerCount > 0 {
        artifactTypes.push({artifactType: types:LISTENER, artifactCount: listenerCount});
    }

    if componentType == types:MI {
        int apiCount = check getCount(sql:queryConcat(countQuery, `mi_api_artifacts `, runtimeInClause));
        if apiCount > 0 {
            artifactTypes.push({artifactType: types:RESTAPI, artifactCount: apiCount});
        }

        int proxyCount = check getCount(sql:queryConcat(countQuery, `mi_proxy_service_artifacts `, runtimeInClause));
        if proxyCount > 0 {
            artifactTypes.push({artifactType: types:PROXYSERVICE, artifactCount: proxyCount});
        }

        int endpointCount = check getCount(sql:queryConcat(countQuery, `mi_endpoint_artifacts `, runtimeInClause));
        if endpointCount > 0 {
            artifactTypes.push({artifactType: types:ENDPOINT, artifactCount: endpointCount});
        }

        int inboundCount = check getCount(sql:queryConcat(countQuery, `mi_inbound_endpoint_artifacts `, runtimeInClause));
        if inboundCount > 0 {
            artifactTypes.push({artifactType: types:INBOUNDENDPOINT, artifactCount: inboundCount});
        }

        int sequenceCount = check getCount(sql:queryConcat(countQuery, `mi_sequence_artifacts `, runtimeInClause));
        if sequenceCount > 0 {
            artifactTypes.push({artifactType: types:SEQUENCE, artifactCount: sequenceCount});
        }

        int taskCount = check getCount(sql:queryConcat(countQuery, `mi_task_artifacts `, runtimeInClause));
        if taskCount > 0 {
            artifactTypes.push({artifactType: types:TASK, artifactCount: taskCount});
        }

        int templateCount = check getCount(sql:queryConcat(countQuery, `mi_template_artifacts `, runtimeInClause));
        if templateCount > 0 {
            artifactTypes.push({artifactType: types:TEMPLATE, artifactCount: templateCount});
        }

        int storeCount = check getCount(sql:queryConcat(countQuery, `mi_message_store_artifacts `, runtimeInClause));
        if storeCount > 0 {
            artifactTypes.push({artifactType: types:MESSAGESTORE, artifactCount: storeCount});
        }

        int processorCount = check getCount(sql:queryConcat(countQuery, `mi_message_processor_artifacts `, runtimeInClause));
        if processorCount > 0 {
            artifactTypes.push({artifactType: types:MESSAGEPROCESSOR, artifactCount: processorCount});
        }

        int entryCount = check getCount(sql:queryConcat(countQuery, `mi_local_entry_artifacts `, runtimeInClause));
        if entryCount > 0 {
            artifactTypes.push({artifactType: types:LOCALENTRY, artifactCount: entryCount});
        }

        int dataServiceCount = check getCount(sql:queryConcat(countQuery, `mi_data_service_artifacts `, runtimeInClause));
        if dataServiceCount > 0 {
            artifactTypes.push({artifactType: types:DATASERVICE, artifactCount: dataServiceCount});
        }

        int appCount = check getCount(sql:queryConcat(countQuery, `mi_carbon_app_artifacts `, runtimeInClause));
        if appCount > 0 {
            artifactTypes.push({artifactType: types:CARBONAPP, artifactCount: appCount});
        }

        int sourceCount = check getCount(sql:queryConcat(countQuery, `mi_data_source_artifacts `, runtimeInClause));
        if sourceCount > 0 {
            artifactTypes.push({artifactType: types:DATASOURCE, artifactCount: sourceCount});
        }

        int connectorCount = check getCount(sql:queryConcat(countQuery, `mi_connector_artifacts `, runtimeInClause));
        if connectorCount > 0 {
            artifactTypes.push({artifactType: types:CONNECTOR, artifactCount: connectorCount});
        }

        int resourceCount = check getCount(sql:queryConcat(countQuery, `mi_registry_resource_artifacts `, runtimeInClause));
        if resourceCount > 0 {
            artifactTypes.push({artifactType: types:REGISTRYRESOURCE, artifactCount: resourceCount});
        }
    }

    return artifactTypes;
}

// Helper function to map database record to Component type
isolated function mapToComponent(types:ComponentInDB component) returns types:Component {
    return {
        id: component.component_id,
        projectId: component.project_id,
        orgHandler: component.project_handler,
        orgId: component.project_org_id,
        name: component.component_name,
        handler: component.component_name,
        displayName: component.component_display_name ?: component.component_name,
        displayType: "service",
        description: component.component_description,
        status: "active",
        initStatus: "completed",
        version: "v1.0.0",
        createdAt: component.component_created_at ?: "",
        lastBuildDate: component.component_updated_at,
        updatedAt: component.component_updated_at,
        componentSubType: (),
        componentType: component.component_type == "MI" ? types:MI : types:BI,
        labels: (),
        isSystemComponent: false,
        apiVersions: [],
        deploymentTracks: [],
        gitProvider: component.project_git_provider,
        gitOrganization: component.project_git_organization,
        gitRepository: component.project_repository,
        branch: component.project_branch,
        endpoints: [],
        environmentVariables: [],
        secrets: [],
        componentId: component.component_id,
        project: {
            id: component.project_id,
            orgId: component.project_org_id,
            name: component.project_name,
            version: component.project_version,
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
