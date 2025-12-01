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

import icp_server.auth;
import icp_server.storage;
import icp_server.types;

import ballerina/data.jsondata;
import ballerina/graphql;
import ballerina/http;
import ballerina/jwt;
import ballerina/lang.value;
import ballerina/log;

// GraphQL listener configuration
// TODO: Enable SSL
listener graphql:Listener graphqlListener = new (graphqlPort);

const string ICP_ARTIFACTS_PATH = "/icp/artifacts";

isolated function contextInit(http:RequestContext reqCtx, http:Request request) returns graphql:Context {
    string|error authorization = request.getHeader("Authorization");
    graphql:Context context = new;
    if authorization is string {
        context.set("Authorization", authorization);
    }

    return context;
}

// Helper: generate HMAC JWT used to call ICP internal APIs
isolated function issueRuntimeHmacToken() returns string|error {
    jwt:IssuerConfig issConfig = {
        username: "icp-artifact-fetcher",
        issuer: jwtIssuer,
        expTime: <decimal>defaultTokenExpiryTime,
        audience: jwtAudience,
        signatureConfig: {algorithm: jwt:HS256, config: defaultRuntimeJwtHMACSecret}
    };
    issConfig.customClaims["scope"] = "runtime_agent";

    string|jwt:Error hmacToken = jwt:issue(issConfig);
    if hmacToken is jwt:Error {
        log:printError("Failed to generate HMAC JWT for internal ICP API", hmacToken);
        return error("Failed to generate authentication token");
    }
    return hmacToken;
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // If specific componentId (integration) is provided, check access and return filtered
        if componentId is string {
            boolean hasAccess = check storage:hasAccessToIntegration(userContext.userId, componentId);
            if !hasAccess {
                return []; // No access to this specific integration
            }
            return check storage:getRuntimes(status, runtimeType, environmentId, projectId, componentId);
        }

        // If projectId is provided, filter by accessible integrations in that project
        if projectId is string {
            boolean hasProjectAccess = check storage:hasAccessToProject(userContext.userId, projectId);
            if !hasProjectAccess {
                return []; // No access to this project
            }

            // Get all accessible integrations for this project
            types:UserIntegrationAccess[] accessibleIntegrations = 
                check storage:getUserAccessibleIntegrations(userContext.userId, projectId, environmentId);

            // If no accessible integrations in this project, return empty
            if accessibleIntegrations.length() == 0 {
                return [];
            }

            // Fetch runtimes for each accessible integration
            types:Runtime[] allRuntimes = [];
            foreach types:UserIntegrationAccess integration in accessibleIntegrations {
                types:Runtime[] integrationRuntimes = check storage:getRuntimes(
                    status, 
                    runtimeType, 
                    environmentId, 
                    projectId, 
                    integration.integrationUuid
                );
                allRuntimes.push(...integrationRuntimes);
            }
            return allRuntimes;
        }

        // No specific filters - return runtimes for all accessible integrations
        types:UserIntegrationAccess[] accessibleIntegrations = 
            check storage:getUserAccessibleIntegrations(userContext.userId, (), environmentId);

        if accessibleIntegrations.length() == 0 {
            return [];
        }

        // Fetch runtimes for each accessible integration
        types:Runtime[] allRuntimes = [];
        foreach types:UserIntegrationAccess integration in accessibleIntegrations {
            types:Runtime[] integrationRuntimes = check storage:getRuntimes(
                status, 
                runtimeType, 
                environmentId, 
                (), // no project filter since we're querying across projects
                integration.integrationUuid
            );
            allRuntimes.push(...integrationRuntimes);
        }
        return allRuntimes;
    }

    // Get a specific runtime by ID
    isolated resource function get runtime(graphql:Context context, string runtimeId) returns types:Runtime?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Fetch the runtime to get its context
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return (); // Runtime not found
        }

        // Build scope from runtime's context
        types:AccessScope scope = auth:buildScopeFromContext(
            runtime.component.projectId,
            runtime.component.id,
            runtime.environment.id
        );

        // Check permission to view this integration
        if !check auth:hasPermission(userContext.userId, "integration_mgt:view", scope) {
            return (); // No access - return 404 (same as not found)
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return (); // Integration not found
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = auth:buildScopeFromContext(
            component.projectId,
            componentId,
            environmentId
        );

        // Check permission to view this integration deployment
        if !check auth:hasPermission(userContext.userId, "integration_mgt:view", scope) {
            return (); // No access - return 404 (same as not found)
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // First, fetch the runtime to verify access to its environment
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return error("Runtime not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: runtime.component.projectId,
            integrationUuid: runtime.component.id,
            envUuid: runtime.environment.id
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to runtime services");
        }

        return check storage:getServicesForRuntime(runtimeId);
    }

    // Get services for a specific environment and component
    isolated resource function get servicesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Service[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component services");
        }

        return check storage:getServicesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get listeners for a specific runtime
    isolated resource function get listeners(graphql:Context context, string runtimeId) returns types:Listener[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // First, fetch the runtime to verify access to its environment
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return error("Runtime not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: runtime.component.projectId,
            integrationUuid: runtime.component.id,
            envUuid: runtime.environment.id
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to runtime listeners");
        }

        return check storage:getListenersForRuntime(runtimeId);
    }

    // Get listeners for a specific environment and component
    isolated resource function get listenersByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Listener[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component listeners");
        }

        return check storage:getListenersByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get REST APIs for a specific environment and component
    isolated resource function get restApisByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:RestApi[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component REST APIs");
        }

        return check storage:getRestApisByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Carbon Apps for a specific environment and component
    isolated resource function get carbonAppsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:CarbonApp[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component Carbon Apps");
        }

        return check storage:getCarbonAppsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Inbound Endpoints for a specific environment and component
    isolated resource function get inboundEndpointsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:InboundEndpoint[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component inbound endpoints");
        }

        return check storage:getInboundEndpointsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Endpoints for a specific environment and component
    isolated resource function get endpointsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Endpoint[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component endpoints");
        }

        return check storage:getEndpointsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Sequences for a specific environment and component
    isolated resource function get sequencesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Sequence[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component sequences");
        }

        return check storage:getSequencesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Proxy Services for a specific environment and component
    isolated resource function get proxyServicesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:ProxyService[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component proxy services");
        }

        return check storage:getProxyServicesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Tasks for a specific environment and component
    isolated resource function get tasksByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Task[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component tasks");
        }

        return check storage:getTasksByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Templates for a specific environment and component
    isolated resource function get templatesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:Template[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component templates");
        }

        return check storage:getTemplatesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Message Stores for a specific environment and component
    isolated resource function get messageStoresByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:MessageStore[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component message stores");
        }

        return check storage:getMessageStoresByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Message Processors for a specific environment and component
    isolated resource function get messageProcessorsByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:MessageProcessor[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component message processors");
        }

        return check storage:getMessageProcessorsByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Local Entries for a specific environment and component
    isolated resource function get localEntriesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:LocalEntry[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component local entries");
        }

        return check storage:getLocalEntriesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Get Data Services for a specific environment and component
    isolated resource function get dataServicesByEnvironmentAndComponent(graphql:Context context, string environmentId, string componentId) returns types:DataService[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project, integration, and environment
        types:AccessScope scope = {
            orgUuid: 1,
            projectUuid: component.projectId,
            integrationUuid: componentId,
            envUuid: environmentId
        };

        // Verify user has view, edit, or manage permission
        if !check auth:hasAnyPermission(userContext.userId, ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Access denied to component data services");
        }

        return check storage:getDataServicesByEnvironmentAndComponent(environmentId, componentId);
    }

    // Delete a runtime by ID
    isolated remote function deleteRuntime(graphql:Context context, string runtimeId) returns boolean|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Fetch the runtime to get its context
        types:Runtime? runtime = check storage:getRuntimeById(runtimeId);

        if runtime is () {
            return error("Runtime not found");
        }

        // Build scope from runtime's context
        types:AccessScope scope = auth:buildScopeFromContext(
            runtime.component.projectId,
            runtime.component.id,
            runtime.environment.id
        );

        // Check permission to delete this integration's runtime (mutation = explicit error)
        if !check auth:hasPermission(userContext.userId, "integration_mgt:delete", scope) {
            return error("Access denied: insufficient permissions to delete runtime");
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Build org-level scope for permission check
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};

        // Check if user can manage environments based on production status
        if environment.critical {
            // Production environment requires full management permission
            if !check auth:hasPermission(userContext.userId, "environment_mgt:manage", scope) {
                return error("Access denied: insufficient permissions to create production environments");
            }
        } else {
            // Non-production environment requires manage_nonprod or manage permission
            boolean canManageNonProd = check auth:hasPermission(userContext.userId, "environment_mgt:manage_nonprod", scope);
            boolean canManageFull = check auth:hasPermission(userContext.userId, "environment_mgt:manage", scope);
            if !canManageNonProd && !canManageFull {
                return error("Access denied: insufficient permissions to create environments");
            }
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get user's accessible environments (filtered by role mappings)
        // If user has any role mapping, they can see environments within their scope
        types:UserEnvironmentAccess[] accessibleEnvs = 
            check storage:getUserEnvironmentRestrictions(userContext.userId);

        // Check if user has any access at all
        if accessibleEnvs.length() == 0 {
            return error("Access denied: no role mappings found for user");
        }

        // Build environment ID list from access mappings:
        // If ANY mapping has env_uuid = NULL, user gets all environments
        // Otherwise, collect specific env_uuid values
        
        boolean hasUnrestrictedAccess = false;
        string[] envIds = [];
        
        foreach types:UserEnvironmentAccess envAccess in accessibleEnvs {
            if envAccess.envUuid is () {
                // env_uuid is NULL = unrestricted access to all environments
                hasUnrestrictedAccess = true;
                break;
            } else if envAccess.envUuid is string {
                // Specific environment access
                string envId = <string>envAccess.envUuid;
                if envIds.indexOf(envId) is () {
                    envIds.push(envId);
                }
            }
        }

        // Fetch environments based on access type
        types:Environment[] environments = [];
        if hasUnrestrictedAccess {
            // User has unrestricted access - fetch all environments
            environments = check storage:getAllEnvironments();
        } else {
            // User has access to specific environments only (envIds must have at least one item)
            environments = check storage:getEnvironmentsByIds(envIds);
        }

        // Filter by type if provided (prod = critical, non-prod = non-critical)
        if 'type is string {
            if 'type == "prod" {
                environments = environments.filter(env => env.critical);
            } else if 'type == "non-prod" {
                environments = environments.filter(env => !env.critical);
            }
        }

        return environments;
    }

    // Delete an environment (requires management permission based on environment type)
    isolated remote function deleteEnvironment(graphql:Context context, string environmentId) returns boolean|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Fetch environment to check its production status
        types:Environment? env = check storage:getEnvironmentById(environmentId);
        if env is () {
            return error("Environment not found");
        }

        // Build org-level scope for permission check
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};

        // Check permission based on production status
        if env.critical {
            // Production environment requires full management permission
            if !check auth:hasPermission(userContext.userId, "environment_mgt:manage", scope) {
                return error("Access denied: insufficient permissions to delete production environments");
            }
        } else {
            // Non-production environment requires manage_nonprod or manage permission
            boolean canManageNonProd = check auth:hasPermission(userContext.userId, "environment_mgt:manage_nonprod", scope);
            boolean canManageFull = check auth:hasPermission(userContext.userId, "environment_mgt:manage", scope);
            if !canManageNonProd && !canManageFull {
                return error("Access denied: insufficient permissions to delete environments");
            }
        }

        check storage:deleteEnvironment(environmentId);
        return true;
    }

    // Update environment name, description, and/or critical status (requires management permission)
    isolated remote function updateEnvironment(graphql:Context context, string environmentId, string? name, string? description, boolean? critical) returns types:Environment?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Fetch current environment to check its production status
        types:Environment? currentEnv = check storage:getEnvironmentById(environmentId);
        if currentEnv is () {
            return error("Environment not found");
        }

        // Build org-level scope for permission check
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};

        // If changing critical flag, check permission for the target state
        // Otherwise, check permission for the current state
        boolean targetIsCritical = critical ?: currentEnv.critical;

        if targetIsCritical {
            // Production environment requires full management permission
            if !check auth:hasPermission(userContext.userId, "environment_mgt:manage", scope) {
                return error("Access denied: insufficient permissions to update production environments");
            }
        } else {
            // Non-production environment requires manage_nonprod or manage permission
            boolean canManageNonProd = check auth:hasPermission(userContext.userId, "environment_mgt:manage_nonprod", scope);
            boolean canManageFull = check auth:hasPermission(userContext.userId, "environment_mgt:manage", scope);
            if !canManageNonProd && !canManageFull {
                return error("Access denied: insufficient permissions to update environments");
            }
        }

        check storage:updateEnvironment(environmentId, name, description, critical);
        return check storage:getEnvironmentById(environmentId);
    }

    // Update environment production status (requires full management permission)
    // This is a critical operation that always requires the highest permission level
    isolated remote function updateEnvironmentProductionStatus(graphql:Context context, string environmentId, boolean isProduction) returns types:Environment?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Verify environment exists
        types:Environment? env = check storage:getEnvironmentById(environmentId);
        if env is () {
            return error("Environment not found");
        }

        // Build org-level scope for permission check
        types:AccessScope scope = {orgUuid: storage:DEFAULT_ORG_ID};

        // Changing production status is a critical operation - always requires full management permission
        if !check auth:hasPermission(userContext.userId, "environment_mgt:manage", scope) {
            return error("Access denied: full environment management permission required to change production status");
        }

        check storage:updateEnvironmentProductionStatus(environmentId, isProduction);
        return check storage:getEnvironmentById(environmentId);
    }

    //------------- Project Resources
    // Create a new project
    isolated remote function createProject(graphql:Context context, types:ProjectInput project) returns types:Project|error? {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Check permission at org level - requires project_mgt:manage
        boolean canManage = check auth:canManageProject(userContext.userId);
        if !canManage {
            return error("Insufficient permissions to create projects");
        }

        // Create project and auto-assign creator to project admin group
        return check storage:createProject(project, userContext);
    }

    // Get all projects (filtered by user's accessible projects via RBAC v2)
    isolated resource function get projects(graphql:Context context, int? orgId) returns types:Project[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get accessible projects via access resolver
        // This returns all projects where user has ANY role assignment (any permission domain)
        // Includes users who only have observability_mgt:view_logs or other non-project permissions
        types:UserProjectAccess[] accessibleProjects = 
            check auth:getAccessibleProjects(userContext.userId);
        
        if accessibleProjects.length() == 0 {
            return []; // User has no project access
        }

        string[] accessibleProjectIds = accessibleProjects.map(p => p.projectUuid);

        // Fetch only accessible projects with SQL IN clause (efficient DB filtering)
        types:Project[] filteredProjects = 
            check storage:getProjectsByIds(accessibleProjectIds, orgId);

        return filteredProjects;
    }

    // Get a specific project by ID with optional orgId filter
    isolated resource function get project(graphql:Context context, int? orgId, string projectId) returns types:Project?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Use access resolver to check project access (handles ANY role assignment)
        auth:ProjectAccessInfo accessInfo = check auth:resolveProjectAccess(userContext.userId, projectId);
        
        if !accessInfo.hasAccess {
            return (); // No access - return null (404 pattern for queries)
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Check permission at project level - requires project_mgt:manage (higher bar than edit)
        boolean canManage = check auth:canManageProject(userContext.userId, projectId);
        if !canManage {
            return error("Insufficient permissions to delete project");
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Check permission at project level - requires project_mgt:edit or project_mgt:manage
        boolean canEdit = check auth:canEditProject(userContext.userId, project.id);
        if !canEdit {
            return error("Insufficient permissions to update project");
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Build scope at project level (creating integration in a project)
        types:AccessScope scope = auth:buildScopeFromContext(component.projectId);

        // Check if user has permission to manage integrations in this project
        if !check auth:hasPermission(userContext.userId, "integration_mgt:manage", scope) {
            return error("Insufficient permissions to create component in this project");
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get accessible integrations (with optional project filter)
        // This returns integrations where user has ANY role assignment (permission-agnostic)
        types:UserIntegrationAccess[] accessibleIntegrations = 
            check storage:getUserAccessibleIntegrations(userContext.userId, projectId);

        // Extract integration IDs
        string[] integrationIds = accessibleIntegrations.map(i => i.integrationUuid);

        // Return empty if no access
        if integrationIds.length() == 0 {
            return [];
        }

        return check storage:getComponentsByIds(integrationIds);
    }

    // Get a specific component by ID or by projectId + componentHandler
    isolated resource function get component(graphql:Context context, string? componentId, string? projectId, string? componentHandler) returns types:Component?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

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
            return (); // Integration not found
        }

        // Build scope with project and integration context
        types:AccessScope scope = auth:buildScopeFromContext(component.projectId, integrationId = component.id);

        // Check if user has permission to view this integration
        // Users with edit or manage permissions should also be able to view
        if !check auth:hasAnyPermission(userContext.userId, 
            ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return (); // Return null for no access (404 pattern for queries)
        }

        return component;
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // 1. Check if component exists and belongs to the specified project
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return {
                status: "FAILED",
                canDelete: false,
                message: "Integration not found",
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

        // 2. Build scope and check if user has permission to manage this integration
        types:AccessScope scope = auth:buildScopeFromContext(component.projectId, integrationId = componentId);
        
        if !check auth:hasPermission(userContext.userId, "integration_mgt:manage", scope) {
            return {
                status: "FAILED",
                canDelete: false,
                message: "Insufficient permissions to delete this component",
                encodedData: ""
            };
        }

        // 3. Check for active runtimes/deployments
        string[] environmentsWithRuntimes = check storage:getEnvironmentIdsWithRuntimes(componentId);

        if environmentsWithRuntimes.length() > 0 {
            // Check if user has manage permission in ALL environments where the component has runtimes
            foreach string envId in environmentsWithRuntimes {
                types:AccessScope envScope = auth:buildScopeFromContext(component.projectId, integrationId = componentId, envId = envId);
                if !check auth:hasPermission(userContext.userId, "integration_mgt:manage", envScope) {
                    return {
                        status: "FAILED",
                        canDelete: false,
                        message: string `Cannot delete component: it has runtimes in environment ${envId} where you don't have manage permission`,
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Extract values from ComponentUpdateInput
        string targetComponentId = component.id;
        string? targetName = component.name;
        string? targetDisplayName = component.displayName;
        string? targetDescription = component.description;

        // Get component to check project access
        types:Component? existingComponent = check storage:getComponentById(targetComponentId);
        if existingComponent is () {
            return error("Integration not found");
        }

        // Build scope with project and integration context
        types:AccessScope scope = auth:buildScopeFromContext(existingComponent.projectId, integrationId = targetComponentId);

        // Check if user has permission to edit this integration (edit or manage)
        if !check auth:hasAnyPermission(userContext.userId, 
            ["integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Insufficient permissions to update this component");
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

        // Extract user context V2 for RBAC
        types:UserContextV2 userContext = check auth:extractUserContextV2(authHeader);

        // Get component to check access and type
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Build scope with project and integration context (and optional environment)
        types:AccessScope scope = auth:buildScopeFromContext(component.projectId, integrationId = componentId, envId = environmentId);

        // Check if user has permission to view this integration
        // Users with edit or manage permissions should also be able to view artifacts
        if !check auth:hasAnyPermission(userContext.userId, 
            ["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"], scope) {
            return error("Insufficient permissions to view component artifacts");
        }

        // Return available artifact types based on component (only those with actual data)
        return check storage:getArtifactTypesForComponent(componentId, component.componentType, environmentId);
    }

    isolated resource function get artifactSourceByComponent(
            graphql:Context context,
            string componentId,
            string artifactType,
            string artifactName,
            string? environmentId = (),
            string? runtimeId = ()
    ) returns string|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }

        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);

        // Get component to verify access
        types:Component? component = check storage:getComponentById(componentId);
        if component is () {
            return error("Integration not found");
        }

        // Verify user has access to the component's project
        if !utils:hasAccessToProject(userContext, component.projectId) {
            return error("Access denied to component");
        }

        // Get runtimes for this component (optionally filtered by environment)
        types:Runtime[] runtimes;
        if environmentId is string {
            // Verify environment access
            if !utils:hasAccessToEnvironment(userContext, component.projectId, environmentId) {
                return error("Access denied to environment");
            }
            runtimes = check storage:getRuntimes((), (), environmentId, component.projectId, componentId);
        } else {
            // Get runtimes from any environment the user has access to
            runtimes = check storage:getRuntimes((), (), (), component.projectId, componentId);
        }

        if runtimes.length() == 0 {
            return error("No runtimes found for this component");
        }

        // Select runtime: if runtimeId provided, use matching runtime; otherwise first available
        types:Runtime runtime = runtimes[0];
        if runtimeId is string {
            boolean found = false;
            foreach types:Runtime r in runtimes {
                if r.runtimeId == runtimeId {
                    runtime = r;
                    found = true;
                    break;
                }
            }
            if !found {
                return error(string `Runtime ${runtimeId} not found for component ${componentId}${environmentId is string ? string ` in environment ${environmentId}` : ""}`);
            }
        }

        // Check if management endpoint is configured
        string? managementHost = runtime.managementHostname;
        string? managementPort = runtime.managementPort;

        if managementHost is () {
            return error("Management hostname not configured for this runtime");
        }

        // Build management API base URL
        string baseUrl = string `https://${managementHost}`;
        if managementPort is string {
            baseUrl = string `${baseUrl}:${managementPort}`;
        }

        log:printInfo("Fetching artifact from runtime management API",
                runtimeId = runtime.runtimeId,
                managementUrl = baseUrl,
                artifactType = artifactType,
                artifactName = artifactName);

        // Create management API client (toggle insecure TLS via configuration)
        http:Client|error mgmtClient = artifactsApiAllowInsecureTLS
            ? new (baseUrl, {secureSocket: {enable: false}})
            : new (baseUrl);
        if mgmtClient is error {
            log:printError("Failed to create management API client", mgmtClient);
            return error("Failed to create management API client");
        }
        // Generate an HMAC JWT (same mechanism as heartbeat) to call the ICP internal API
        string hmacToken = check issueRuntimeHmacToken();

        // Fetch artifact source via ICP Internal API (/icp/artifacts)
        string artifactPath = string `${ICP_ARTIFACTS_PATH}?type=${artifactType}&name=${artifactName}`;
        // Log outbound request details (truncate token for safety)
        log:printDebug("Sending ICP internal API artifact request",
                runtimeId = runtime.runtimeId,
                managementUrl = baseUrl,
                artifactPath = artifactPath,
                accept = "application/json"
        );
        http:Response|error artifactResponse = mgmtClient->get(artifactPath, {
                "Authorization": string `Bearer ${hmacToken}`,
                "Accept": "application/json"
                });

        if artifactResponse is error {
            log:printError("Failed to fetch artifact from management API", artifactResponse);
            return error("Failed to fetch artifact from management API");
        }

        if artifactResponse.statusCode != http:STATUS_OK {
            string|error errPayload = artifactResponse.getTextPayload();
            if errPayload is error {
                log:printError("ICP internal API artifact fetch returned non-OK status",
                        status = artifactResponse.statusCode.toString(),
                        runtimeId = runtime.runtimeId,
                        artifactType = artifactType,
                        artifactName = artifactName);
                return error(string `ICP internal API artifact fetch failed with status ${artifactResponse.statusCode}`);
            }
            log:printError("ICP internal API artifact fetch returned non-OK status",
                    status = artifactResponse.statusCode.toString(),
                    runtimeId = runtime.runtimeId,
                    artifactType = artifactType,
                    artifactName = artifactName,
                    response = errPayload);
            return error(string `ICP internal API artifact fetch failed with status ${artifactResponse.statusCode}: ${errPayload}`);
        }

        // Parse JSON body and extract only the `configuration` field
        json artifactConfigJson = check artifactResponse.getJsonPayload();
        types:ArtifactResponse artifactConfig = check jsondata:parseAsType(artifactConfigJson);

        log:printInfo("Successfully fetched artifact source",
                runtimeId = runtime.runtimeId,
                artifactType = artifactConfig.'type,
                artifactName = artifactConfig.name,
                sourceLength = artifactConfig.configuration.length());
        return artifactConfig.configuration;
    }
}
