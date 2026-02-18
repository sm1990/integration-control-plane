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
import ballerina/uuid;

// Helper function to get Project Admin role ID
isolated function getProjectAdminRoleId() returns string|error {
    sql:ParameterizedQuery query = `SELECT role_id FROM roles_v2 WHERE role_name = 'Project Admin'`;
    query = appendLimitClause(query, 1);

    stream<record {|string role_id;|}, sql:Error?> roleStream = dbClient->query(query);

    record {|string role_id;|}[] roles = check from record {|string role_id;|} role in roleStream
        select role;

    if roles.length() == 0 {
        return error("Project Admin role not found in database");
    }

    return roles[0].role_id;
}

// Create a new project in the projects table (RBAC v2)
public isolated function createProject(types:ProjectInput project, types:UserContextV2 userContext) returns types:Project|error? {
    string projectId = uuid:createType1AsString();
    string userId = userContext.userId;
    string displayName = userContext.displayName;

    // Use projectHandler as the handler field, fallback to handler if projectHandler is not provided
    string handler = project.projectHandler;
    if handler.trim() == "" {
        return error("Project handler is required");
    }

    // Convert deployment pipeline IDs array to JSON string if provided
    string? deploymentPipelineIdsJson = ();
    string[]? pipelineIds = project?.deploymentPipelineIds;
    if pipelineIds is string[] {
        deploymentPipelineIdsJson = pipelineIds.toJsonString();
    }

    transaction {
        // Insert project with all new fields
        sql:ParameterizedQuery insertQuery = `INSERT INTO projects (
            project_id, org_id, name, version, handler, region, description, 
            default_deployment_pipeline_id, deployment_pipeline_ids, type, 
            git_provider, git_organization, repository, branch, secret_ref,
            owner_id, created_by
        ) VALUES (
            ${projectId}, ${project.orgId}, ${project.name}, ${project?.version}, 
            ${handler}, ${project?.region}, ${project?.description},
            ${project?.defaultDeploymentPipelineId}, ${deploymentPipelineIdsJson}, ${project?.'type},
            ${project?.gitProvider}, ${project?.gitOrganization}, ${project?.repository}, 
            ${project?.branch}, ${project?.secretRef}, ${userId}, ${displayName}
        )`;
        sql:ExecutionResult _ = check dbClient->execute(insertQuery);

        log:printInfo(string `Created project: ${project.name}`,
                projectId = projectId,
                orgId = project.orgId,
                handler = handler,
                ownerId = userId,
                createdBy = displayName);

        // RBAC v2: Create project-specific admin group and assign Project Admin role
        // 1. Create project admin group
        string adminGroupId = uuid:createType1AsString();
        string groupName = string `${project.name} Admins`;
        string groupDescription = string `Admin group for project: ${project.name}`;

        sql:ExecutionResult _ = check dbClient->execute(`
            INSERT INTO user_groups (group_id, group_name, org_uuid, description)
            VALUES (${adminGroupId}, ${groupName}, 1, ${groupDescription})
        `);
        log:printInfo(string `Created project admin group: ${groupName}`,
                groupId = adminGroupId,
                projectId = projectId);

        // 2. Get Project Admin role ID
        string projectAdminRoleId = check getProjectAdminRoleId();

        // 3. Map group to Project Admin role (project-scoped, all environments)
        sql:ExecutionResult _ = check dbClient->execute(`
            INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid)
            VALUES (${adminGroupId}, ${projectAdminRoleId}, 1, ${projectId})
        `);
        log:printInfo(string `Mapped group to Project Admin role for project`,
                groupId = adminGroupId,
                roleId = projectAdminRoleId,
                projectId = projectId);

        // 4. Add creator to admin group
        sql:ExecutionResult _ = check dbClient->execute(`
            INSERT INTO group_user_mapping (group_id, user_uuid)
            VALUES (${adminGroupId}, ${userId})
        `);
        log:printInfo(string `Added project creator to admin group`,
                userId = userId,
                groupId = adminGroupId,
                projectId = projectId);

        check commit;
        log:printInfo(string `Successfully created project and assigned admin roles`,
                projectId = projectId,
                owner = displayName);
    }

    return getProjectById(projectId);
}

// Get all projects
public isolated function getProjects() returns types:Project[]|error {
    types:Project[] projects = [];

    sql:ParameterizedQuery query = `SELECT project_id, org_id, name, version, created_date, handler, region, 
                                          description, 
                                          type, git_provider, git_organization, repository, branch, secret_ref,
                                          owner_id, created_by, updated_at, updated_by 
                                   FROM projects 
                                   ORDER BY name ASC`;

    stream<types:Project, sql:Error?> projectStream = dbClient->query(query);

    check from types:Project projectRecord in projectStream
        do {
            projects.push({
                ...projectRecord
            });
        };

    log:printInfo("Retrieved all projects", projectCount = projects.length());

    return projects;
}

// Get projects by specific project IDs with optional org filter (for RBAC v2 filtering)
public isolated function getProjectsByIds(string[] projectIds, int? orgId = ()) returns types:Project[]|error {
    // Return empty array if no project IDs provided
    if projectIds.length() == 0 {
        return [];
    }

    // Safety check: log warning if project ID list is unexpectedly large
    if projectIds.length() > 5000 {
        log:printWarn(string `Large project ID list: ${projectIds.length()} projects - consider pagination`);
    }

    types:Project[] projects = [];

    // Build WHERE clause to filter by project IDs
    sql:ParameterizedQuery query = `SELECT project_id, org_id, name, version, created_date, handler, region, 
                                          description,   
                                          type, git_provider, git_organization, repository, branch, secret_ref,
                                          owner_id, created_by, updated_at, updated_by 
                                     FROM projects 
                                     WHERE project_id IN (`;

    // Add project IDs to the IN clause
    foreach int i in 0 ..< projectIds.length() {
        if i > 0 {
            query = sql:queryConcat(query, `, `);
        }
        query = sql:queryConcat(query, `${projectIds[i]}`);
    }

    query = sql:queryConcat(query, `)`);

    // Add orgId filter if provided
    if orgId is int {
        query = sql:queryConcat(query, ` AND org_id = ${orgId}`);
    }

    query = sql:queryConcat(query, ` ORDER BY name ASC`);

    stream<types:Project, sql:Error?> projectStream = dbClient->query(query);

    check from types:Project projectRecord in projectStream
        do {
            projects.push({
                ...projectRecord
            });
        };

    log:printInfo("Retrieved projects by IDs",
            projectCount = projects.length(),
            requestedIds = projectIds.length(),
            orgIdFilter = orgId);

    return projects;
}

// Get a specific project by ID
public isolated function getProjectById(string projectId) returns types:Project|error {
    stream<types:Project, sql:Error?> projectStream =
        dbClient->query(`SELECT project_id, org_id, name, version, created_date, handler, region, 
                                description, 
                                type, git_provider, git_organization, repository, branch, secret_ref,
                                owner_id, created_by, updated_at, updated_by 
                         FROM projects WHERE project_id = ${projectId}`);

    types:Project[] projectRecords =
        check from types:Project projectRecord in projectStream
        select projectRecord;

    if projectRecords.length() == 0 {
        return error(string `Project with ID ${projectId} not found`);
    }

    types:Project projectRecord = projectRecords[0];
    return projectRecord;
}

// Get project ID by handler
public isolated function getProjectIdByHandler(string projectHandler, int orgId) returns string|error {
    stream<record {|string project_id;|}, sql:Error?> projectStream = dbClient->query(`
        SELECT project_id FROM projects WHERE handler = ${projectHandler} AND org_id = ${orgId} 
    `);

    record {|string project_id;|}[] projectRecords = check from record {|string project_id;|} project in projectStream
        select project;

    if projectRecords.length() == 0 {
        return error(string `Project ${projectHandler} not found.`);
    }
    return projectRecords[0].project_id;
}

// Update project with ProjectUpdateInput
public isolated function updateProjectWithInput(types:ProjectUpdateInput project) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE project_id = ${project.id} `;
    sql:ParameterizedQuery updateFields = ` SET updated_at = CURRENT_TIMESTAMP `;
    boolean hasUpdates = false;

    if project?.name is string {
        updateFields = sql:queryConcat(updateFields, `, name = ${project?.name} `);
        hasUpdates = true;
    }
    if project?.description is string {
        updateFields = sql:queryConcat(updateFields, `, description = ${project?.description} `);
        hasUpdates = true;
    }
    if project?.version is string {
        updateFields = sql:queryConcat(updateFields, `, version = ${project?.version} `);
        hasUpdates = true;
    }
    if project?.orgId is int {
        updateFields = sql:queryConcat(updateFields, `, org_id = ${project?.orgId} `);
        hasUpdates = true;
    }

    if !hasUpdates {
        return error("No fields to update");
    }

    transaction {
        // Update the project
        sql:ParameterizedQuery updateQuery = sql:queryConcat(`UPDATE projects `, updateFields, whereClause);
        sql:ExecutionResult _ = check dbClient->execute(updateQuery);

        check commit;
        log:printInfo(string `Successfully updated project ${project.id}`);
    } on fail error e {
        log:printError(string `Failed to update project ${project.id}`, e);
        return error(string `Failed to update project ${project.id}`, e);
    }

    return ();
}

// Delete a project by ID (this will cascade delete all components, runtimes, roles, and user role assignments)
public isolated function deleteProject(string projectId) returns error? {
    sql:ParameterizedQuery deleteQuery = `DELETE FROM projects WHERE project_id = ${projectId}`;
    var result = dbClient->execute(deleteQuery);
    if result is sql:Error {
        log:printError(string `Failed to delete project ${projectId}`, result);
        return result;
    }
    log:printInfo(string `Successfully deleted project ${projectId}`);
    return ();
}

// Check project handler availability for an organization
public isolated function checkProjectHandlerAvailability(int orgId, string projectHandlerCandidate) returns types:ProjectHandlerAvailability|error {
    log:printDebug(string `Checking project handler availability for orgId: ${orgId}, handler: ${projectHandlerCandidate}`);

    // Check if the handler already exists for this organization
    sql:ParameterizedQuery query = `SELECT COUNT(*) as HANDLECOUNT 
                                   FROM projects 
                                   WHERE org_id = ${orgId} AND handler = ${projectHandlerCandidate}`;

    int existingHandlerCount = 0;

    stream<record {}, sql:Error?> handlerCountStream = dbClient->query(query);

    check from record {} countRecord in handlerCountStream
        do {
            existingHandlerCount = <int>countRecord["HANDLECOUNT"];
        };

    boolean isHandlerUnique = existingHandlerCount == 0;
    string? alternateCandidate = ();

    // If handler is not unique, generate an alternate candidate
    if !isHandlerUnique {
        // Generate alternate handler suggestions by appending numbers
        int counter = 1;
        string baseHandler = projectHandlerCandidate;

        while counter <= 10 { // Limit to 10 attempts to avoid infinite loop
            string candidate = string `${baseHandler}${counter}`;

            sql:ParameterizedQuery alternateQuery = `SELECT COUNT(*) as HANDLECOUNT 
                                                   FROM projects 
                                                   WHERE org_id = ${orgId} AND handler = ${candidate}`;

            int candidateCount = 0;
            stream<record {}, sql:Error?> candidateStream = dbClient->query(alternateQuery);

            check from record {} candidateRecord in candidateStream
                do {
                    candidateCount = <int>candidateRecord["HANDLECOUNT"];
                };

            if candidateCount == 0 {
                alternateCandidate = candidate;
                break;
            }

            counter += 1;
        }
    }

    log:printInfo(string `Project handler availability check completed`,
            orgId = orgId,
            projectHandlerCandidate = projectHandlerCandidate,
            isHandlerUnique = isHandlerUnique,
            alternateCandidate = alternateCandidate);

    return {
        handlerUnique: isHandlerUnique,
        alternateHandlerCandidate: alternateCandidate
    };
}
    
