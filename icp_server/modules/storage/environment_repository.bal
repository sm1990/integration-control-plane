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
        log:printError(string `Failed to insert environment: ${environment.name}`, 'error = result);
        match classifySqlError(result) {
            DUPLICATE_KEY => {
                return ();
            }
            VALUE_TOO_LONG => {
                return error("The provided value exceeds the maximum allowed length", result);
            }
            _ => {
                return error("An unexpected error occurred. Please contact your administrator.", result);
            }
        }
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
        log:printError(string `Failed to update environment ${environmentId}`, 'error = result);
        match classifySqlError(result) {
            DUPLICATE_KEY => {
                return error("An environment with this name already exists", result);
            }
            VALUE_TOO_LONG => {
                return error("The provided value exceeds the maximum allowed length", result);
            }
            _ => {
                return error("An unexpected error occurred. Please contact your administrator.", result);
            }
        }
    }
    log:printInfo(string `Successfully updated environment ${environmentId}`);
    return ();
}

// Update environment production status
public isolated function updateEnvironmentProductionStatus(string environmentId, boolean critical) returns error? {
    sql:ParameterizedQuery updateQuery = `UPDATE environments SET critical = ${critical}, updated_at = CURRENT_TIMESTAMP WHERE environment_id = ${environmentId}`;
    var result = dbClient->execute(updateQuery);
    if result is sql:Error {
        log:printError(string `Failed to update environment production status ${environmentId}`, 'error = result);
        return error("An unexpected error occurred. Please contact your administrator.", result);
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
        log:printError(string `Failed to delete environment ${environmentId}`, 'error = result);
        match classifySqlError(result) {
            FOREIGN_KEY_VIOLATION => {
                return error("Cannot delete environment because it has dependent resources", result);
            }
            _ => {
                return error("An unexpected error occurred. Please contact your administrator.", result);
            }
        }
    }
    log:printInfo(string `Successfully deleted environment ${environmentId}`);
    return ();
}

// Resolve the JWT HMAC secret for a specific component+environment pair.
// Looks up the secret in the component_environment_secrets table.
public isolated function resolveComponentEnvJwtSecret(string componentId, string environmentId) returns string|error {
    stream<record {|string jwt_hmac_secret;|}, sql:Error?> secretStream =
        dbClient->query(`
            SELECT jwt_hmac_secret
            FROM component_environment_secrets
            WHERE component_id = ${componentId}
              AND environment_id = ${environmentId}
        `);

    record {|string jwt_hmac_secret;|}[] records = check from record {|string jwt_hmac_secret;|} r in secretStream
        select r;

    if records.length() > 0 {
        log:printDebug(string `Using per-component-environment JWT secret for component: ${componentId}, environment: ${environmentId}`);
        return records[0].jwt_hmac_secret;
    }

    return error(string `No JWT secret provisioned for component '${componentId}' in environment '${environmentId}'. Generate component environment secret for this pair first.`);
}

// Resolve the JWT HMAC secret for a given runtime ID.
// Joins runtimes -> component_environment_secrets to retrieve the secret,(delta heartbeats only carry
// the runtime ID so the component+environment pair is resolved via the join).
public isolated function resolveRuntimeJwtSecretByRuntimeId(string runtimeId) returns string|error {
    stream<record {|string? jwt_hmac_secret;|}, sql:Error?> secretStream =
        dbClient->query(`
            SELECT ces.jwt_hmac_secret
            FROM component_environment_secrets ces
            JOIN runtimes r ON ces.component_id = r.component_id
                           AND ces.environment_id = r.environment_id
            WHERE r.runtime_id = ${runtimeId}
        `);

    record {|string? jwt_hmac_secret;|}[] records = check from record {|string? jwt_hmac_secret;|} r in secretStream
        select r;

    if records.length() > 0 {
        string? secret = records[0].jwt_hmac_secret;
        if secret is string && secret.length() > 0 {
            log:printDebug(string `Using per-component-environment JWT secret for runtime: ${runtimeId}`);
            return secret;
        }
    }

    return error(string `No JWT secret provisioned for runtime '${runtimeId}'. Generate component environment secret for the corresponding component+environment pair first.`);
}

// Get the existing JWT HMAC secret for a component+environment pair, generating
// a new one only when none has been provisioned yet.  Safe to call on every
// "Configure Runtime" dialog open — it never overwrites an existing secret.
public isolated function getOrGenerateComponentEnvironmentSecret(string componentId, string environmentId) returns string|error {
    stream<record {|string jwt_hmac_secret;|}, sql:Error?> secretStream =
        dbClient->query(`
            SELECT jwt_hmac_secret
            FROM component_environment_secrets
            WHERE component_id = ${componentId}
              AND environment_id = ${environmentId}
        `);

    record {|string jwt_hmac_secret;|}[] records = check from record {|string jwt_hmac_secret;|} r in secretStream
        select r;

    if records.length() > 0 {
        log:printDebug(string `Returning existing JWT HMAC secret for component: ${componentId}, environment: ${environmentId}`);
        return records[0].jwt_hmac_secret;
    }

    // No secret provisioned yet — generate and persist one.
    log:printInfo(string `No existing secret found; generating for component: ${componentId}, environment: ${environmentId}`);
    return check generateComponentEnvironmentSecret(componentId, environmentId);
}

// Generate (or rotate) the JWT HMAC secret for a component+environment pair.
// Two UUIDs are concatenated to produce a 72-character secret — well above
// the 32-character minimum required for HS256 signing.
// Idempotent: re-running rotates (overwrites) any existing secret for the same pair.
// Uses a database-agnostic INSERT-then-UPDATE pattern compatible with
// PostgreSQL, MySQL, MSSQL, and H2.
public isolated function generateComponentEnvironmentSecret(string componentId, string environmentId) returns string|error {
    string jwtHmacSecret = uuid:createRandomUuid() + uuid:createRandomUuid();

    sql:ExecutionResult|sql:Error insertResult = dbClient->execute(`
        INSERT INTO component_environment_secrets (component_id, environment_id, jwt_hmac_secret)
        VALUES (${componentId}, ${environmentId}, ${jwtHmacSecret})
    `);

    if insertResult is sql:ExecutionResult {
        log:printInfo(string `Generated new JWT HMAC secret for component: ${componentId}, environment: ${environmentId}`);
        return jwtHmacSecret;
    }

    // Row already exists — rotate the secret with an UPDATE
    if classifySqlError(insertResult) == DUPLICATE_KEY {
        sql:ExecutionResult|sql:Error updateResult = dbClient->execute(`
            UPDATE component_environment_secrets
            SET jwt_hmac_secret = ${jwtHmacSecret}, updated_at = CURRENT_TIMESTAMP
            WHERE component_id = ${componentId}
              AND environment_id = ${environmentId}
        `);

        if updateResult is sql:Error {
            log:printError(string `Failed to rotate JWT secret for component ${componentId} + environment ${environmentId}`, 'error = updateResult);
            return error("An unexpected error occurred while rotating the component-environment JWT secret.", updateResult);
        }

        log:printInfo(string `Rotated JWT HMAC secret for component: ${componentId}, environment: ${environmentId}`);
        return jwtHmacSecret;
    }

    log:printError(string `Failed to generate JWT secret for component ${componentId} + environment ${environmentId}`, 'error = insertResult);
    return error("An unexpected error occurred while generating the component-environment JWT secret.", insertResult);
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
