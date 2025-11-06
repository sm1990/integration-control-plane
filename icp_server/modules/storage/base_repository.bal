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

import ballerina/cache;

configurable int heartbeatTimeoutSeconds = 300;
final cache:Cache hashCache = new (capacity = 1000, evictionFactor = 0.2);

public type BaseRepository distinct object {

    // Environment functions
    public isolated function getEnvironments() returns types:Environment[]|error;

    public isolated function getEnvironmentsByIds(string[] environmentIds) returns types:Environment[]|error;

    public isolated function getEnvironmentIdsByTypes(boolean hasProdAccess, boolean hasNonProdAccess) returns string[]|error;

    public isolated function getEnvironmentById(string environmentId) returns types:Environment|error;

    public isolated function createEnvironment(types:EnvironmentInput environment) returns types:Environment|error?;

    public isolated function updateEnvironment(string environmentId, string? name, string? description) returns error?;

    public isolated function updateEnvironmentProductionStatus(string environmentId, boolean isProduction) returns error?;

    public isolated function getEnvironmentIdByName(string environmentName) returns string|error;

    public isolated function deleteEnvironment(string environmentId) returns error?;

    // Helper ID functions
    public isolated function getComponentIdByName(string componentName) returns string|error;

    public isolated function getProjectIdByName(string projectName) returns string|error;

    // Runtime functions
    public isolated function getRuntimes(string? status, string? runtimeType, string? environmentId, string? projectId, string? componentId) returns types:Runtime[]|error;

    public isolated function getRuntimesByAccessibleEnvironments(types:UserContext userContext) returns types:Runtime[]|error;

    public isolated function getRuntimeById(string runtimeId) returns types:Runtime?|error;

    public isolated function deleteRuntime(string runtimeId) returns error?;

    // Runtime artifact functions
    public isolated function getServicesForRuntime(string runtimeId) returns types:Service[]|error;

    public isolated function getListenersForRuntime(string runtimeId) returns types:Listener[]|error;

    public isolated function getApisForRuntime(string runtimeId) returns types:RestApi[]|error;

    public isolated function getProxyServicesForRuntime(string runtimeId) returns types:ProxyService[]|error;

    public isolated function getEndpointsForRuntime(string runtimeId) returns types:Endpoint[]|error;

    public isolated function getInboundEndpointsForRuntime(string runtimeId) returns types:InboundEndpoint[]|error;

    public isolated function getSequencesForRuntime(string runtimeId) returns types:Sequence[]|error;

    public isolated function getTasksForRuntime(string runtimeId) returns types:Task[]|error;

    public isolated function getTemplatesForRuntime(string runtimeId) returns types:Template[]|error;

    public isolated function getMessageStoresForRuntime(string runtimeId) returns types:MessageStore[]|error;

    public isolated function getMessageProcessorsForRuntime(string runtimeId) returns types:MessageProcessor[]|error;

    public isolated function getLocalEntriesForRuntime(string runtimeId) returns types:LocalEntry[]|error;

    public isolated function getDataServicesForRuntime(string runtimeId) returns types:DataService[]|error;

    public isolated function getCarbonAppsForRuntime(string runtimeId) returns types:CarbonApp[]|error;

    public isolated function getDataSourcesForRuntime(string runtimeId) returns types:DataSource[]|error;

    public isolated function getConnectorsForRuntime(string runtimeId) returns types:Connector[]|error;

    public isolated function getRegistryResourcesForRuntime(string runtimeId) returns types:RegistryResource[]|error;

    public isolated function getSystemInfoForRuntime(string runtimeId) returns types:SystemInfo[]|error;

    // Mapping functions
    public isolated function mapToRuntime(types:RuntimeDBRecord runtimeRecord) returns types:Runtime|error;

    public isolated function mapToService(types:Service serviceRecord, string runtimeId) returns types:Service|error;

    // Runtime management functions
    public isolated function markOfflineRuntimes() returns error?;

    public isolated function processDeltaHeartbeat(types:DeltaHeartbeat deltaHeartbeat) returns types:HeartbeatResponse|error;

    public isolated function processHeartbeat(types:Heartbeat heartbeat) returns types:HeartbeatResponse|error;

    // Project functions
    public isolated function createProject(types:ProjectInput project, types:UserContext userContext) returns types:Project|error?;

    public isolated function getProjects() returns types:Project[]|error;

    public isolated function getProjectsByIds(string[] projectIds) returns types:Project[]|error;

    public isolated function getProjectById(string projectId) returns types:Project|error;

    public isolated function updateProject(string projectId, string? name, string? description) returns error?;

    public isolated function updateProjectWithInput(types:ProjectUpdateInput project) returns error?;

    public isolated function deleteProject(string projectId) returns error?;

    // Component functions
    public isolated function createComponent(types:ComponentInput component) returns types:Component|error?;

    public isolated function hasProjectComponents(string projectId) returns boolean|error;

    public isolated function getComponents(string? projectId, types:ComponentOptionsInput? options = ()) returns types:Component[]|error;

    public isolated function getComponentsByProjectIds(string[] projectIds, types:ComponentOptionsInput? options = ()) returns types:Component[]|error;

    public isolated function getComponentById(string componentId) returns types:Component|error;

    public isolated function deleteComponent(string componentId) returns error?;

    public isolated function updateComponent(string componentId, string? name, string? description, string updatedBy) returns error?;

    public isolated function getEnvironmentIdsWithRuntimes(string componentId) returns string[]|error;

    // User functions
    public isolated function getUserDetailsById(string userId) returns types:User|error;

    public isolated function createUser(string userId, string username, string displayName) returns error?;

    public isolated function getUserRoles(string userId) returns types:Role[]|error;

    public isolated function updateUserRoles(string userId, types:RoleAssignment[] roleAssignments) returns error?;

    public isolated function updateUserProjectAuthor(string userId, boolean isProjectAuthor) returns error?;

    public isolated function getAllUsers() returns types:UserWithRoles[]|error;

    public isolated function getUsersByProjectIds(string[] projectIds) returns types:UserWithRoles[]|error;

    public isolated function deleteUserById(string userId) returns error?;

    public isolated function updateUserProfile(string userId, string displayName) returns error?;

    // Refresh token functions
    public isolated function storeRefreshToken(
            string tokenId,
            string userId,
            string tokenHash,
            int expirySeconds,
            string? userAgent,
            string? ipAddress
    ) returns error?;

    public isolated function validateRefreshToken(string tokenHash) returns types:User|error;

    public isolated function revokeRefreshToken(string tokenHash) returns error?;

    public isolated function revokeAllUserRefreshTokens(string userId) returns error?;

    public isolated function cleanupExpiredRefreshTokens() returns error?;

    // Project eligibility functions
    public isolated function checkProjectCreationEligibility(int orgId, string orgHandler) returns types:ProjectCreationEligibility|error;

    public isolated function checkProjectHandlerAvailability(int orgId, string projectHandlerCandidate) returns types:ProjectHandlerAvailability|error;
};
