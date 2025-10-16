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
listener graphql:Listener graphqlListener = new (graphqlPort
// ,
//     secureSocket = {
//         key: {
//             path: keystorePath,
//             password: keystorePassword
//         }
//     }
);

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
        if !utils:hasAccessToEnvironment(userContext, runtime.component.project.projectId, runtime.environment.environmentId) {
            return error("Access denied to runtime");
        }
        
        return runtime;
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
        if !utils:hasAccessToEnvironment(userContext, runtime.component.project.projectId, runtime.environment.environmentId) {
            return error("Access denied to runtime");
        }
        
        return check storage:getServicesForRuntime(runtimeId);
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
        if !utils:hasAccessToEnvironment(userContext, runtime.component.project.projectId, runtime.environment.environmentId) {
            return error("Access denied to runtime");
        }
        
        return check storage:getListenersForRuntime(runtimeId);
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
        if !utils:hasAdminAccess(userContext, runtime.component.project.projectId, runtime.environment.environmentId) {
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
        
        // Call storage layer to insert environments
        return storage:createEnvironment(environment);
    }

    // Get all environments
    isolated resource function get environments() returns types:Environment[]|error? {
        return check storage:getEnvironments();
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

    // Update environment name and/or description (super admin only)
    isolated remote function updateEnvironment(graphql:Context context, string environmentId, string? name, string? description) returns types:Environment?|error {
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
        
        check storage:updateEnvironment(environmentId, name, description);
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
    isolated resource function get projects(graphql:Context context) returns types:Project[]|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }
        
        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);
        string[] accessibleProjectIds = utils:getAccessibleProjectIds(userContext);
        
        // Get projects filtered by user's access
        return check storage:getProjectsByIds(accessibleProjectIds);
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

    // Get a specific project by ID
    isolated resource function get project(graphql:Context context, string projectId) returns types:Project?|error {
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
        
        return check storage:getProjectById(projectId);
    }

    // Delete a project
    isolated remote function deleteProject(graphql:Context context, string projectId) returns boolean|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }
        
        types:UserContext userContext = check utils:extractUserContext(authHeader);
        
        // Check if user is super admin or project author
        if !userContext.isSuperAdmin && !userContext.isProjectAuthor {
            return error("Project author access required to delete projects");
        }
        
        check storage:deleteProject(projectId);
        return true;
    }

    // Update project name and/or description
    isolated remote function updateProject(graphql:Context context, string projectId, string? name, string? description) returns types:Project?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }
        
        types:UserContext userContext = check utils:extractUserContext(authHeader);
        
        // Check if user is super admin or project author
        if !userContext.isSuperAdmin && !userContext.isProjectAuthor {
            return error("Project author access required to update projects");
        }
        
        check storage:updateProject(projectId, name, description);
        return check storage:getProjectById(projectId);
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
        
        return storage:createComponent(component);
    }

    // Get all components with optional project filter
    isolated resource function get components(graphql:Context context, string? projectId) returns types:Component[]|error {
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
            return check storage:getComponents(projectId);
        }
        
        // If no projectId filter, return components for all accessible projects
        // Get all accessible project IDs
        string[] accessibleProjectIds = utils:getAccessibleProjectIds(userContext);
        
        // Use optimized batch query with WHERE IN clause
        return check storage:getComponentsByProjectIds(accessibleProjectIds);
    }

    // Get a specific component by ID
    isolated resource function get component(graphql:Context context, string componentId) returns types:Component?|error {
        value:Cloneable|error|isolated object {} authHeader = context.get("Authorization");
        if authHeader !is string {
            return error("Authorization header missing in request");
        }
        
        // Extract user context for RBAC
        types:UserContext userContext = check utils:extractUserContext(authHeader);
        
        // First, fetch the component to get its parent project ID
        types:Component? component = check storage:getComponentById(componentId);
        
        if component is () {
            return (); // Component not found
        }
        
        // Verify user has access to the component's parent project
        if !utils:hasAccessToProject(userContext, component.project.projectId) {
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
        if !utils:isAdminInAnyEnvironment(userContext, component.project.projectId) {
            return error("Admin access required in project to delete components");
        }
        
        // Get all environments where this component has runtimes
        string[] environmentsWithRuntimes = check storage:getEnvironmentIdsWithRuntimes(componentId);
        
        // Check if user is admin in ALL environments where the component has runtimes
        foreach string envId in environmentsWithRuntimes {
            if !utils:hasAdminAccess(userContext, component.project.projectId, envId) {
                return error(string `Cannot delete component: it has runtimes in environment ${envId} where you don't have admin access`);
            }
        }
        
        check storage:deleteComponent(componentId);
        return true;
    }

    // Update component name and/or description
    isolated remote function updateComponent(graphql:Context context, string componentId, string? name, string? description) returns types:Component|error {
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
        if !utils:isAdminInAnyEnvironment(userContext, component.project.projectId) {
            return error("Admin access required in project to update components");
        }
        
        check storage:updateComponent(componentId, name, description);
        return check storage:getComponentById(componentId);
    }
}
