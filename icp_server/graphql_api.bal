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

import icp_server.storage;
import icp_server.types;
import icp_server.utils;

import ballerina/graphql;
import ballerina/http;
import ballerina/lang.value;
import ballerina/log;

// GraphQL listener configuration
// TODO: Enable SSL
listener graphql:Listener graphqlListener = new (graphqlPort);

isolated function contextInit(http:RequestContext reqCtx, http:Request request) returns graphql:Context {
    string|error authorization = request.getHeader("Authorization");
    graphql:Context context = new;
    if authorization is string {
        context.set("Authorization", authorization);
    }

    return context;
}

// GraphQL service for runtime details
@graphql:ServiceConfig {
    contextInit,
    cors: {
        allowOrigins: ["*"]
    },
    auth: [
        {
            jwtValidatorConfig: {
                issuer: frontendJwtIssuer,
                audience: frontendJwtAudience,
                signatureConfig: {
                    secret: defaultJwtHMACSecret
                }
            }
        }
    ]
}

service /graphql on graphqlListener {

    function init() {
        log:printInfo("GraphQL service started at " + serverHost + ":" + graphqlPort.toString());
    }

    // ----------- Runtime Resources
    // Get all runtimes with optional filtering
    isolated resource function get runtimes(graphql:Context context, string? status, string? runtimeType, string? environmentId, string? projectId, string? componentId) returns types:Runtime[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // If specific projectId and environmentId are provided, verify access
        if projectId is string && environmentId is string {
            if !utils:hasAccessToEnvironment(userContext, projectId, environmentId) {
                return error("Access denied to environment");
            }
            return check storage:getRuntimes(status, runtimeType, environmentId, projectId, componentId);
        }

        // If only projectId is provided, filter by accessible environments in that project
        if projectId is string {
            if !utils:hasAccessToProject(userContext, projectId) {
                return error("Access denied to project");
            }
            // Get accessible environment IDs for this project
            string[] accessibleEnvIds = utils:getAccessibleEnvironmentIds(userContext, projectId);

            // Get runtimes for each accessible environment and aggregate
            types:Runtime[] allRuntimes = [];
            foreach string envId in accessibleEnvIds {
                types:Runtime[] envRuntimes = check storage:getRuntimes(status, runtimeType, envId, projectId, componentId);
                allRuntimes.push(...envRuntimes);
            }
            return allRuntimes;
        }

        // No specific filters - return runtimes for all accessible environments
        // Use optimized batch query
        return check storage:getRuntimesByAccessibleEnvironments(userContext);
    }

    // Get a specific runtime by ID
    isolated resource function get runtime(graphql:Context context, string runtimeId) returns types:Runtime?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // First, fetch the runtime to get its project and environment
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return (); // Runtime not found
        }

        // Verify user has access to the runtime's project and environment
        if !utils:hasAccessToEnvironment(userContext, runtime.component.projectId, runtime.environment.id) {
            return error("Access denied to runtime");
        }

        return runtime;
    }

    // Get component deployment information for a specific environment
    isolated resource function get componentDeployment(
            graphql:Context context,
            string orgHandler,
            string orgUuid,
            string componentId,
            string versionId,
            string environmentId
    ) returns types:ComponentDeployment?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return (); // Component not found
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to component deployment");
        }

        // Get deployment information from runtimes table
        types:ComponentDeployment? deployment = check storage:getComponentDeployment(componentId, environmentId, versionId);

        return deployment;
    }

    // Get services for a specific runtime
    isolated resource function get services(graphql:Context context, string runtimeId) returns types:Service[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // First, fetch the runtime to verify access to its environment
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return error("Runtime not found");
        }

        // Verify user has access to the runtime's project and environment
        if !utils:hasAccessToEnvironment(userContext, runtime.component.projectId, runtime.environment.id) {
            return error("Access denied to runtime");
        }

        return check storage:getServicesForRuntime(runtimeId);
    }

    // Get services for a specific environment and component
    isolated resource function get servicesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Service[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getServicesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get listeners for a specific runtime
    isolated resource function get listeners(graphql:Context context, string runtimeId) returns types:Listener[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // First, fetch the runtime to verify access to its environment
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return error("Runtime not found");
        }

        // Verify user has access to the runtime's project and environment
        if !utils:hasAccessToEnvironment(userContext, runtime.component.projectId, runtime.environment.id) {
            return error("Access denied to runtime");
        }

        return check storage:getListenersForRuntime(runtimeId);
    }

    // Get listeners for a specific environment and component
    isolated resource function get listenersByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Listener[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getListenersByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get REST APIs for a specific environment and component
    isolated resource function get restApisByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:RestApi[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getRestApisByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Carbon Apps for a specific environment and component
    isolated resource function get carbonAppsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:CarbonApp[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getCarbonAppsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Inbound Endpoints for a specific environment and component
    isolated resource function get inboundEndpointsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:InboundEndpoint[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getInboundEndpointsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Endpoints for a specific environment and component
    isolated resource function get endpointsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Endpoint[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getEndpointsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Sequences for a specific environment and component
    isolated resource function get sequencesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Sequence[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getSequencesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Proxy Services for a specific environment and component
    isolated resource function get proxyServicesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:ProxyService[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getProxyServicesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Tasks for a specific environment and component
    isolated resource function get tasksByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Task[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getTasksByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Templates for a specific environment and component
    isolated resource function get templatesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Template[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getTemplatesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Message Stores for a specific environment and component
    isolated resource function get messageStoresByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:MessageStore[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getMessageStoresByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Message Processors for a specific environment and component
    isolated resource function get messageProcessorsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:MessageProcessor[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getMessageProcessorsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Local Entries for a specific environment and component
    isolated resource function get localEntriesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:LocalEntry[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getLocalEntriesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Data Services for a specific environment and component
    isolated resource function get dataServicesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:DataService[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project and environment
        if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
            return error("Access denied to environment");
        }

        return check storage:getDataServicesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Delete a runtime by ID
    isolated remote function deleteRuntime(graphql:Context context, string runtimeId) returns boolean|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // First, fetch the runtime to get its project and environment
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return error("Runtime not found");
        }

        // Verify user has admin access to the runtime's project and environment
        if !utils:hasAdminAccess(userContext, runtime.component.projectId, runtime.environment.id) {
            return error("Admin access required to delete runtime");
        }

        check storage:deleteRuntime(runtimeId);
        return true;
    }

    // ----------- Environment Resources
    // Create a new environment (super admin only)
    isolated remote function createEnvironment(graphql:Context context, types:EnvironmentInput environment) returns types:Environment|error? {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Only super admins can create environments
        if !userContext.isSuperAdmin {
            return error("Super admin access required to create environments");
        }

        // Set created_by to the current user's ID
        environment.createdBy = userContext.userId;

        // Call storage layer to insert environments
        return storage:createEnvironment(environment);
    }

    // Get all environments (filtered by user's accessible environments via RBAC)
    // Note: orgUuid, type, and projectId parameters are accepted for frontend compatibility
    // but ignored since environments are global (not org-specific)
    isolated resource function get environments(graphql:Context context, string? orgUuid, string? 'type, string? projectId) returns types:Environment[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get all environment IDs where user has any role (across all projects)
        // Note: Parameters orgUuid, type, projectId are ignored - environments are global
        string[]|error accessibleEnvironmentIds = utils:getAccessibleEnvironmentIdsByType(userContext);
        if accessibleEnvironmentIds is error {
            log:printError("Failed to get accessible environment IDs", accessibleEnvironmentIds);
            return error("Failed to get accessible environment IDs");
        }

        // Return empty array if user has no access to any environment
        if accessibleEnvironmentIds.length() == 0 {
            return [];
        }

        // Fetch environments by accessible environment IDs
        types:Environment[] environments = check storage:getEnvironmentsByIds(accessibleEnvironmentIds);

        // The id alias is already set in the storage layer
        return environments;
    }

    // Get all environments where user has admin access (for permission management)
    isolated resource function get adminEnvironments(graphql:Context context) returns types:Environment[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get all environment IDs where user is admin (across all projects)
        string[] adminEnvironmentIds = utils:getAdminEnvironmentIdsByType(userContext);

        // Return empty array if user is not admin in any environment
        if adminEnvironmentIds.length() == 0 {
            return [];
        }

        // Fetch environments by admin environment IDs
        return check storage:getEnvironmentsByIds(adminEnvironmentIds);
    }

    // Delete an environment (super admin only)
    isolated remote function deleteEnvironment(graphql:Context context, string environmentId) returns boolean|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Only super admins can delete environments
        if !userContext.isSuperAdmin {
            return error("Super admin access required to delete environments");
        }

        check storage:deleteEnvironment(environmentId);
        return true;
    }

    // Update environment name, description, and/or critical status (super admin only)
    isolated remote function updateEnvironment(graphql:Context context, string environmentId, string? name, string? description, boolean? critical) returns types:Environment?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Only super admins can update environments
        if !userContext.isSuperAdmin {
            return error("Super admin access required to update environments");
        }

        check storage:updateEnvironment(environmentId, name, description, critical);
        return check storage:getEnvironmentById(environmentId);
    }

    // Update environment production status (super admin only)
    isolated remote function updateEnvironmentProductionStatus(graphql:Context context, string environmentId, boolean isProduction) returns types:Environment?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Only super admins can update environment production status
        if !userContext.isSuperAdmin {
            return error("Super admin access required to update environment production status");
        }

        check storage:updateEnvironmentProductionStatus(environmentId, isProduction);
        return check storage:getEnvironmentById(environmentId);
    }

    //------------- Project Resources
    // Create a new project
    isolated remote function createProject(graphql:Context context, types:ProjectInput project) returns types:Project|error? {
        // Extract user context to get the creating user's information
        // value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Check if user is super admin or project author
        if !userContext.isSuperAdmin && !userContext.isProjectAuthor {
            return error("Project author access required to create projects");
        }

        // Create project and auto-assign admin roles to creating user
        return check storage:createProject(project, userContext);
    }

    // Get all projects (filtered by user's accessible projects via RBAC)
    isolated resource function get projects(graphql:Context context, int? orgId) returns types:Project[]|error {
        // value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        // if authHeader !is string {
        //     return error("Authorization header missing in request");
        // }

        // Extract user context for RBAC
        // types:UserContext userContext = check utils:extractUserContext(authHeader);
        // string[] accessibleProjectIds = utils:getAccessibleProjectIds(userContext);

        // Get projects filtered by user's access
        types:Project[] allProjects = check storage:getProjects();

        // Filter by orgId if provided
        if orgId is int {
            types:Project[] filteredProjects = [];
            foreach types:Project project in allProjects {
                if project.orgId == orgId {
                    filteredProjects.push(project);
                }
            }
            return filteredProjects;
        }

        return allProjects;
    }

    // Get projects where user has admin access (for permission management)
    isolated resource function get adminProjects(graphql:Context context) returns types:Project[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get project IDs where user is admin
        string[] adminProjectIds = utils:getAdminProjectIds(userContext);

        // Return empty array if user is not admin in any project
        if adminProjectIds.length() == 0 {
            return [];
        }

        // Fetch projects by admin project IDs
        return check storage:getProjectsByIds(adminProjectIds);
    }

    // Get a specific project by ID with optional orgId filter
    isolated resource function get project(graphql:Context context, int? orgId, string projectId) returns types:Project?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Verify user has access to this project
        if !utils:hasAccessToProject(userContext, projectId) {
            return error("Access denied to project");
        }

        types:Project? project = check storage:getProjectById(projectId);

        if project is () {
            return (); // Project not found
        }

        // If orgId is specified, verify it matches the project's orgId
        if orgId is int && project.orgId != orgId {
            return (); // Project doesn't belong to the specified organization
        }

        return project;
    }

    // Check project creation eligibility for an organization
    isolated resource function get projectCreationEligibility(graphql:Context context, int orgId, string orgHandler) returns types:ProjectCreationEligibility|error {
        // Note: This endpoint might not require authentication depending on business requirements
        // For now, we'll allow it without authentication to match the example
        // value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        // if authHeader !is string {
        //     return error("Authorization header missing in request");
        // }

        // Call storage layer to check eligibility
        return check storage:checkProjectCreationEligibility(orgId, orgHandler);
    }

    // Check project handler availability for an organization
    isolated resource function get projectHandlerAvailability(graphql:Context context, int orgId, string projectHandlerCandidate) returns types:ProjectHandlerAvailability|error {
        // Note: This endpoint might not require authentication depending on business requirements
        // For now, we'll allow it without authentication to match the example
        // value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        // if authHeader !is string {
        //     return error("Authorization header missing in request");
        // }

        // Call storage layer to check handler availability
        return check storage:checkProjectHandlerAvailability(orgId, projectHandlerCandidate);
    }

    // Delete a project
    isolated remote function deleteProject(graphql:Context context, int orgId, string projectId) returns types:DeleteResponse|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Check if user is super admin or project author
        if !userContext.isSuperAdmin && !userContext.isProjectAuthor {
            return error("Project author access required to delete projects");
        }

        // Check if the project has any components
        boolean hasComponents = check storage:hasProjectComponents(projectId);
        if hasComponents {
            return {
                status: "failed",
                details: "Cannot delete project. Project contains components that must be deleted first."
            };
        }

        // Proceed with deletion if no components exist
        check storage:deleteProject(projectId);
        return {
            status: "success",
            details: string `Deleted project with ID: ${projectId}`
        };
    }

    // Update project name and/or description
    isolated remote function updateProject(graphql:Context context, types:ProjectUpdateInput project) returns types:Project|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Check if user is super admin or project author
        if !userContext.isSuperAdmin && !userContext.isProjectAuthor {
            return error("Project author access required to update projects");
        }

        check storage:updateProjectWithInput(project);
        types:Project? updatedProject = check storage:getProjectById(project.id);
        if updatedProject is () {
            return error("Project not found after update");
        }
        return updatedProject;
    }

    // ----------- Component Resources
    // Create a new component
    isolated remote function createComponent(graphql:Context context, types:ComponentInput component) returns types:Component|error? {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Check if user is admin in the project (in any environment)
        if !utils:isAdminInAnyEnvironment(userContext, component.projectId) {
            return error("Admin access required in project to create components");
        }

        // Validate component name format (3-64 characters, alphanumeric, hyphens, underscores)
        if component.name.length() < 3 || component.name.length() > 64 {
            return error("Component name must be between 3 and 64 characters");
        }

        // Set displayName (use provided or fallback to name)
        if component.displayName is () || component.displayName == "" {
            component.displayName = component.name;
        }

        // Set default description if not provided
        if component.description is () {
            component.description = "";
        }

        // Set the createdBy field to the current user's ID
        component.createdBy = userContext.userId;

        return storage:createComponent(component);
    }

    // Get all components with optional project filter
    isolated resource function get components(graphql:Context context, string orgHandler, string? projectId, types:ComponentOptionsInput? options) returns types:Component[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // If projectId is provided, verify access to that specific project
        if projectId is string {
            if !utils:hasAccessToProject(userContext, projectId) {
                return error("Access denied to project");
            }
            return check storage:getComponents(projectId, options);
        }

        // If no projectId filter, return components for all accessible projects
        // Get all accessible project IDs
        string[] accessibleProjectIds = utils:getAccessibleProjectIds(userContext);

        // Use optimized batch query with WHERE IN clause
        return check storage:getComponentsByProjectIds(accessibleProjectIds, options);
    }

    // Get a specific component by ID or by projectId + componentHandler
    isolated resource function get component(graphql:Context context, string? componentId, string? projectId, string? componentHandler) returns types:Component?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        types:Component? component = ();

        // Fetch component by ID or by projectId + componentHandler
        if componentId is string {
            component = check storage:getComponentById(componentId);
        } else if projectId is string && componentHandler is string {
            component = check storage:getComponentByProjectAndHandler(projectId, componentHandler);
        } else {
            return error("Either componentId or (projectId and componentHandler) must be provided");
        }

        if component is () {
            return (); // Component not found
        }

        // Verify user has access to the component's parent project
        if !utils:hasAccessToProject(userContext, component.projectId) {
            return error("Access denied to component");
        }

        return component;
    }

    // Delete a component
    isolated remote function deleteComponent(graphql:Context context, string componentId) returns boolean|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to check project access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Check if user is admin in the project (in any environment)
        if !utils:isAdminInAnyEnvironment(userContext, component.projectId) {
            return error("Admin access required in project to delete components");
        }

        // Get all environments where this component has runtimes
        string[] environmentsWithRuntimes = check storage:getEnvironmentIdsWithRuntimes(componentId);

        // Check if user is admin in ALL environments where the component has runtimes
        foreach string envId in environmentsWithRuntimes {
            if !utils:hasAdminAccess(userContext, component.projectId, envId) {
                return error(string `Cannot delete component: it has runtimes in environment ${envId} where you don't have admin access`);
            }
        }

        check storage:deleteComponent(componentId);
        return true;
    }

    // Delete a component V2 - with detailed response
    isolated remote function deleteComponentV2(graphql:Context context, string orgHandler, string componentId, string projectId) returns types:DeleteComponentV2Response|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return {
                status: "FAILED",
                canDelete: false,
                message: "Authorization header missing in request",
                encodedData: ""
            };
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // 1. Check if component exists and belongs to the specified project
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return {
                status: "FAILED",
                canDelete: false,
                message: "Component not found",
                encodedData: ""
            };
        }

        // Verify the component belongs to the specified project
        if component.projectId != projectId {
            return {
                status: "FAILED",
                canDelete: false,
                message: "Component does not belong to the specified project",
                encodedData: ""
            };
        }

        // 2. Check if user has admin access to the project
        if !utils:isAdminInAnyEnvironment(userContext, component.projectId) {
            return {
                status: "FAILED",
                canDelete: false,
                message: "Admin access required in project to delete components",
                encodedData: ""
            };
        }

        // 3. Check for active runtimes/deployments
        string[] environmentsWithRuntimes = check storage:getEnvironmentIdsWithRuntimes(componentId);

        if environmentsWithRuntimes.length() > 0 {
            // Check if user is admin in ALL environments where the component has runtimes
            foreach string envId in environmentsWithRuntimes {
                if !utils:hasAdminAccess(userContext, component.projectId, envId) {
                    return {
                        status: "FAILED",
                        canDelete: false,
                        message: string `Cannot delete component: it has runtimes in environment ${envId} where you don't have admin access`,
                        encodedData: ""
                    };
                }
            }

            return {
                status: "FAILED",
                canDelete: false,
                message: string `Cannot delete component: ${environmentsWithRuntimes.length()} active runtime(s) found. Please stop all runtimes before deleting.`,
                encodedData: ""
            };
        }

        // 4. Perform deletion
        error? deleteResult = storage:deleteComponent(componentId);
        if deleteResult is error {
            return {
                status: "FAILED",
                canDelete: false,
                message: string `Deletion failed: ${deleteResult.message()}`,
                encodedData: ""
            };
        }

        return {
            status: "SUCCESS",
            canDelete: true,
            message: "Component deleted successfully",
            encodedData: ""
        };
    }

    // Update component using ComponentUpdateInput object
    isolated remote function updateComponent(graphql:Context context, types:ComponentUpdateInput component) returns types:Component|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Extract values from ComponentUpdateInput
        string targetComponentId = component.id;
        string? targetName = component.name;
        string? targetDisplayName = component.displayName;
        string? targetDescription = component.description;

        // Get component to check project access
        types:Component? existingComponent = check storage:getComponentById(targetComponentId);
        if existingComponent is () {
            return error("Component not found");
        }

        // Check if user is admin in the project (in any environment)
        if !utils:isAdminInAnyEnvironment(userContext, existingComponent.projectId) {
            return error("Admin access required in project to update components");
        }

        // Call the existing backend method to maintain consistency
        check storage:updateComponent(targetComponentId, targetName, targetDisplayName, targetDescription, userContext.userId);
        return check storage:getComponentById(targetComponentId);
    }

    // Get available artifact types for a component
    isolated resource function get componentArtifactTypes(graphql:Context context, string componentId, string? environmentId = ()) returns types:ArtifactTypeCount[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to check access and type
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Component not found");
        }

        // Verify user has access to the component's project
        if !utils:hasAccessToProject(userContext, component.projectId) {
            return error("Access denied to component");
        }

        // Return available artifact types based on component (only those with actual data)
        return check storage:getArtifactTypesForComponent(componentId, component.componentType, environmentId);
    }
}
