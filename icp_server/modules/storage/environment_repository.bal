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

// Get all environments
public isolated function getEnvironments() returns types:Environment[]|error {
    types:Environment[] environments = [];
    stream<types:Environment, sql:Error?> envStream = dbClient->query(`SELECT environment_id, name, description, 
        region, cluster_id, choreo_env, external_apim_env_name, internal_apim_env_name, sandbox_apim_env_name, 
        critical, dns_prefix, created_at, updated_at, created_by, updated_by 
        FROM environments ORDER BY name ASC`);
    check from types:Environment env in envStream
        do {
            environments.push({
                id: env.id,
                description: env.description,
                name: env.name,
                region: env.region,
                clusterId: env.clusterId,
                choreoEnv: env.choreoEnv,
                externalApimEnvName: env.externalApimEnvName,
                internalApimEnvName: env.internalApimEnvName,
                sandboxApimEnvName: env.sandboxApimEnvName,
                critical: env.critical,
                dnsPrefix: env.dnsPrefix,
                createdAt: env.createdAt,
                createdBy: getDisplayNameById(env.createdBy),
                updatedAt: env.updatedAt,
                updatedBy: getDisplayNameById(env.updatedBy)
            });
        };
    return environments;
}

// Get environments by specific environment IDs
public isolated function getEnvironmentsByIds(string[] environmentIds) returns types:Environment[]|error {
    // Return empty array if no environment IDs provided
    if environmentIds.length() == 0 {
        return [];
    }

    types:Environment[] environments = [];

    // Build WHERE clause to filter by environment IDs
    sql:ParameterizedQuery query = `SELECT environment_id, name, description, 
                                     region, cluster_id, choreo_env, external_apim_env_name, internal_apim_env_name, 
                                     sandbox_apim_env_name, critical, dns_prefix, created_at, updated_at, created_by, updated_by
                                     FROM environments 
                                     WHERE environment_id IN (`;

    // Add environment IDs to the IN clause
    foreach int i in 0 ..< environmentIds.length() {
        if i > 0 {
            query = sql:queryConcat(query, `, `);
        }
        query = sql:queryConcat(query, `${environmentIds[i]}`);
    }

    query = sql:queryConcat(query, `) ORDER BY name ASC`);

    stream<types:Environment, sql:Error?> envStream = dbClient->query(query);

    check from types:Environment env in envStream
        do {
            environments.push({
                id: env.id,
                description: env.description,
                name: env.name,
                region: env.region,
                clusterId: env.clusterId,
                choreoEnv: env.choreoEnv,
                externalApimEnvName: env.externalApimEnvName,
                internalApimEnvName: env.internalApimEnvName,
                sandboxApimEnvName: env.sandboxApimEnvName,
                critical: env.critical,
                dnsPrefix: env.dnsPrefix,
                createdAt: env.createdAt,
                updatedAt: env.updatedAt,
                createdBy: getDisplayNameById(env.createdBy),
                updatedBy: getDisplayNameById(env.updatedBy)
            });
        };

    log:printInfo("Retrieved environments by IDs", environmentCount = environments.length());

    return environments;
}

// Get all environments (for admin operations)
public isolated function getAllEnvironments() returns types:Environment[]|error {
    types:Environment[] environments = [];

    sql:ParameterizedQuery query = `SELECT environment_id, name, description, 
                                     region, cluster_id, choreo_env, external_apim_env_name, internal_apim_env_name, 
                                     sandbox_apim_env_name, critical, dns_prefix, created_at, updated_at, created_by, updated_by
                                     FROM environments 
                                     ORDER BY name ASC`;

    stream<types:Environment, sql:Error?> envStream = dbClient->query(query);

    check from types:Environment env in envStream
        do {
            environments.push({
                id: env.id,
                description: env.description,
                name: env.name,
                region: env.region,
                clusterId: env.clusterId,
                choreoEnv: env.choreoEnv,
                externalApimEnvName: env.externalApimEnvName,
                internalApimEnvName: env.internalApimEnvName,
                sandboxApimEnvName: env.sandboxApimEnvName,
                critical: env.critical,
                dnsPrefix: env.dnsPrefix,
                createdAt: env.createdAt,
                updatedAt: env.updatedAt,
                createdBy: getDisplayNameById(env.createdBy),
                updatedBy: getDisplayNameById(env.updatedBy)
            });
        };

    log:printInfo("Retrieved all environments", environmentCount = environments.length());

    return environments;
}

// Get environment IDs by environment types (for RBAC filtering)
public isolated function getEnvironmentIdsByTypes(boolean hasProdAccess, boolean hasNonProdAccess) returns string[]|error {
    if !hasProdAccess && !hasNonProdAccess {
        return [];
    }

    string[] environmentIds = [];

    // Build WHERE clause to filter by environment types
    sql:ParameterizedQuery query = `SELECT environment_id FROM environments WHERE `;

    if hasProdAccess && hasNonProdAccess {
        query = sql:queryConcat(query, `1=1`);
    } else if hasProdAccess {
        query = sql:queryConcat(query, sql:queryConcat(`critical = `, sqlQueryFromString(TRUE_LITERAL)));
    } else if hasNonProdAccess {
        query = sql:queryConcat(query, sql:queryConcat(`critical = `, sqlQueryFromString(FALSE_LITERAL)));
    }

    query = sql:queryConcat(query, ` ORDER BY name ASC`);

    stream<record {|string environment_id;|}, sql:Error?> envStream = dbClient->query(query);

    check from record {|string environment_id;|} env in envStream
        do {
            environmentIds.push(env.environment_id);
        };

    log:printInfo("Retrieved environment IDs by types", environmentCount = environmentIds.length());

    return environmentIds;
}

// Get environment by ID
public isolated function getEnvironmentById(string environmentId) returns types:Environment|error {
    stream<types:Environment, sql:Error?> envStream =
        dbClient->query(`SELECT environment_id, name, description, region, cluster_id, choreo_env, 
                        external_apim_env_name, internal_apim_env_name, sandbox_apim_env_name, critical, dns_prefix, 
                        created_at, updated_at FROM environments WHERE environment_id = ${environmentId}`);

    types:Environment[] envRecords = check from types:Environment env in envStream
        select env;

    if envRecords.length() == 0 {
        return error(string `Environment ${environmentId} not found.`);
    }

    types:Environment env = envRecords[0];
    return {
        id: env.id,
        name: env.name,
        description: env.description,
        region: env?.region,
        clusterId: env?.clusterId,
        choreoEnv: env?.choreoEnv,
        externalApimEnvName: env?.externalApimEnvName,
        internalApimEnvName: env?.internalApimEnvName,
        sandboxApimEnvName: env?.sandboxApimEnvName,
        critical: env?.critical,
        dnsPrefix: env?.dnsPrefix,
        createdAt: env.createdAt,
        updatedAt: env.updatedAt
    };
}

// Create a new environment
public isolated function createEnvironment(types:EnvironmentInput environment) returns types:Environment|error? {
    log:printInfo(string `Register environment : ${environment.toString()}`);
    string envId = uuid:createRandomUuid();

    sql:ParameterizedQuery insertQuery = `INSERT INTO environments (environment_id, name, description, critical, created_by) 
    VALUES (${envId}, ${environment.name}, ${environment.description}, ${environment.critical}, ${environment.createdBy})`;
    var result = dbClient->execute(insertQuery);
    if result is sql:Error {
        // If error is not duplicate entry, log and return
        if !result.toString().toLowerAscii().includes("duplicate") {
            log:printError(string `Failed to insert environment: ${environment.name}`, result);
            return result;
        }
        return ();
    }

    // Return the created environment
    return check getEnvironmentById(envId);
}

// Update environment name and/or description
public isolated function updateEnvironment(string environmentId, string? name, string? description, boolean? critical) returns error? {
    sql:ParameterizedQuery whereClause = ` WHERE environment_id = ${environmentId} `;
    sql:ParameterizedQuery updateFields = ` SET updated_at = CURRENT_TIMESTAMP `;

    if name is string {
        updateFields = sql:queryConcat(updateFields, `, name = ${name} `);
    }
    if description is string {
        updateFields = sql:queryConcat(updateFields, `, description = ${description} `);
    }
    if critical is boolean {
        updateFields = sql:queryConcat(updateFields, `, critical = ${critical} `);
    }

    sql:ParameterizedQuery updateQuery = sql:queryConcat(`UPDATE environments `, updateFields, whereClause);
    var result = dbClient->execute(updateQuery);
    if result is sql:Error {
        log:printError(string `Failed to update environment ${environmentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully updated environment ${environmentId}`);
    return ();
}

// Update environment production status
public isolated function updateEnvironmentProductionStatus(string environmentId, boolean critical) returns error? {
    sql:ParameterizedQuery updateQuery = `UPDATE environments SET critical = ${critical}, updated_at = CURRENT_TIMESTAMP WHERE environment_id = ${environmentId}`;
    var result = dbClient->execute(updateQuery);
    if result is sql:Error {
        log:printError(string `Failed to update environment production status ${environmentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully updated environment production status ${environmentId}`);
    return ();
}

// Get environment ID by name
public isolated function getEnvironmentIdByName(string environmentName) returns string|error {
    stream<record {|string environment_id;|}, sql:Error?> envStream = dbClient->query(`
        SELECT environment_id FROM environments WHERE name = ${environmentName}
    `);

    record {|string environment_id;|}[] envRecords = check from record {|string environment_id;|} env in envStream
        select env;

    if envRecords.length() == 0 {
        return error(string `Environment ${environmentName} not found.`);
    }
    return envRecords[0].environment_id;
}

// Delete an environment by ID
public isolated function deleteEnvironment(string environmentId) returns error? {
    sql:ParameterizedQuery deleteQuery = `DELETE FROM environments WHERE environment_id = ${environmentId}`;
    var result = dbClient->execute(deleteQuery);
    if result is sql:Error {
        log:printError(string `Failed to delete environment ${environmentId}`, result);
        return result;
    }
    log:printInfo(string `Successfully deleted environment ${environmentId}`);
    return ();
}

// Get all environment IDs where a component has runtimes
public isolated function getEnvironmentIdsWithRuntimes(string componentId) returns string[]|error {
    log:printDebug(string `Fetching environment IDs where component ${componentId} has runtimes`);

    stream<record {|string environment_Id;|}, sql:Error?> envStream = dbClient->query(
        `SELECT DISTINCT environment_id 
         FROM runtimes 
         WHERE component_id = ${componentId}`
        );

    string[] environmentIds = [];
    check from record {|string environment_Id;|} envRecord in envStream
        do {
            environmentIds.push(envRecord.environment_Id);
        };

    log:printInfo(string `Component ${componentId} has runtimes in ${environmentIds.length()} environments`);
    return environmentIds;
}
