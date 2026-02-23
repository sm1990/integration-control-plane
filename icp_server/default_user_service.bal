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

import ballerina/crypto;
import ballerina/http;
import ballerina/log;
import ballerina/sql;
import ballerina/time;
import ballerina/uuid;

type PasswordHash record {|
    string hash;
    string? salt;
|};

configurable int authServicePort = 9447;
configurable string authServiceHost = "0.0.0.0";
configurable string passwordHashingAlgorithm = "bcrypt";

// Credentials DB
configurable string credentialsDbType = "h2";
configurable string credentialsDbHost = "localhost";
configurable int credentialsDbPort = 5432;
configurable string credentialsDbName = "credentials_db";
configurable string credentialsDbUser = "icp_user";
configurable string credentialsDbPassword = "icp_password";

final storage:DatabaseConnectionManager credentialsDbManager = check new storage:DatabaseConnectionManager(
    credentialsDbType, credentialsDbHost, credentialsDbPort,
    credentialsDbName, credentialsDbUser, credentialsDbPassword
);
final sql:Client credentialsDbClient = credentialsDbManager.getClient();

listener http:Listener defaultAuthServiceListener = new (authServicePort,
    config = {
        host: authServiceHost,
        secureSocket: {
            key: {
                path: keystorePath,
                password: keystorePassword
            }
        }
    }
);

@http:ServiceConfig {
    auth: [
        {
            jwtValidatorConfig: {
                issuer: userServiceJwtIssuer,
                audience: userServiceJwtAudience,
                clockSkew: userServiceJwtClockSkewSeconds,
                signatureConfig: {
                    secret: userServiceJwtHMACSecret
                }
            }
        }
    ]
}
service / on defaultAuthServiceListener {

    function init() {
        log:printInfo("Authentication service started at " + authServiceHost + ":" + authServicePort.toString());
    }
    resource function post authenticate(types:Credentials request) returns http:Ok|http:BadRequest|http:Unauthorized|error {
        // Perform authentication against database
        types:User|error authResult = authenticateUser(request.username, request.password);
        if authResult is error {
            log:printError("Error authenticating user", authResult);
            return utils:createUnauthorizedError("Invalid credentials");
        }

        // Create response timestamp
        string responseTimestamp = time:utcToString(time:utcNow());
        log:printInfo("User authenticated successfully: " + authResult.username);
        return <http:Ok>{
            body: {
                authenticated: true,
                userId: authResult.userId,
                displayName: authResult.displayName,
                timestamp: responseTimestamp
            }
        };
    }

    resource function post change\-password(types:ChangePasswordRequest request) returns http:Ok|http:BadRequest|http:Unauthorized|http:InternalServerError|error {

        // Validate request
        if request.currentPassword.trim().length() == 0 {
            return utils:createBadRequestError("Current password is required");
        }
        if request.newPassword.trim().length() == 0 {
            return utils:createBadRequestError("New password is required");
        }
        if request.newPassword.length() < 6 {
            return utils:createBadRequestError("New password must be at least 6 characters long");
        }

        // Get user credentials to verify current password
        string|() userId = request.userId;
        if userId is () {
            log:printError("User ID is required");
            return utils:createBadRequestError("User ID is required");
        }
        types:UserCredentials|error credentials = getUserCredentialsById(userId);
        if credentials is error {
            if credentials is sql:NoRowsError {
                log:printWarn("User attempted password change but has no local credentials (likely OIDC user)",
                        userId = request.userId);
                return utils:createBadRequestError("Password change is not available for SSO users");
            }
            log:printError("Error fetching user credentials", credentials);
            return utils:createInternalServerError("Failed to verify credentials");
        }

        // Verify current password
        boolean|error matches = verifyPassword(request.currentPassword, credentials.passwordHash, credentials.passwordSalt);
        if matches is error {
            log:printError("Error verifying current password", matches);
            return utils:createInternalServerError("Failed to verify current password");
        } else if !matches {
            log:printWarn("User provided incorrect current password", userId = request.userId);
            return utils:createBadRequestError("Current password is incorrect");
        }

        // Hash new password
        PasswordHash|error newPasswordHash = hashPassword(request.newPassword);
        if newPasswordHash is error {
            log:printError("Error hashing new password", newPasswordHash);
            return utils:createInternalServerError("Failed to process new password");
        }

        // Update password
        error? updateResult = updateUserPasswordInDb(userId, newPasswordHash.hash, newPasswordHash.salt);
        if updateResult is error {
            log:printError("Error updating password", updateResult, userId = userId);
            return utils:createInternalServerError("Failed to update password");
        }

        log:printInfo("Password changed successfully", userId = userId);
        return <http:Ok>{
            body: {
                message: "Password changed successfully"
            }
        };
    }

    resource function post 'reset\-password(types:ResetPasswordRequest request) returns http:Ok|http:BadRequest|http:Unauthorized|http:InternalServerError|error {
        // Verify user exists
        types:UserCredentials|error credentials = getUserCredentialsById(request.userId);
        if credentials is error {
            if credentials is sql:NoRowsError {
                return utils:createBadRequestError("User not found or is an SSO user");
            }
            log:printError("Error fetching user credentials for reset", credentials);
            return utils:createInternalServerError("Failed to fetch user credentials");
        }

        // Generate random one-time password
        string otp = generateRandomPassword();

        // Hash and store
        PasswordHash|error otpHash = hashPassword(otp);
        if otpHash is error {
            log:printError("Error hashing generated password", otpHash);
            return utils:createInternalServerError("Failed to process password");
        }

        error? updateResult = resetUserPasswordInDb(request.userId, otpHash.hash, otpHash.salt);
        if updateResult is error {
            log:printError("Error resetting password", updateResult, userId = request.userId);
            return utils:createInternalServerError("Failed to reset password");
        }

        log:printInfo("Password reset successfully by admin", userId = request.userId);
        return <http:Ok>{
            body: {
                password: otp,
                message: "Password has been reset. The user must change it on next login."
            }
        };
    }

    resource function post 'force\-change\-password(types:ForceChangePasswordRequest request, string userId) returns http:Ok|http:BadRequest|http:InternalServerError|error {
        if request.newPassword.trim().length() == 0 {
            return utils:createBadRequestError("New password is required");
        }

        // Hash new password
        PasswordHash|error newPasswordHash = hashPassword(request.newPassword);
        if newPasswordHash is error {
            log:printError("Error hashing new password", newPasswordHash);
            return utils:createInternalServerError("Failed to process new password");
        }

        // Update password and clear require_password_change flag
        error? updateResult = forceUpdateUserPasswordInDb(userId, newPasswordHash.hash, newPasswordHash.salt);
        if updateResult is error {
            log:printError("Error force-changing password", updateResult, userId = userId);
            return utils:createInternalServerError("Failed to change password");
        }

        log:printInfo("Password force-changed successfully", userId = userId);
        return <http:Ok>{
            body: {
                message: "Password changed successfully"
            }
        };
    }

    resource function post users(types:CreateUserInput request) returns http:Created|http:BadRequest|http:Unauthorized|http:InternalServerError|error {

        // Validate input
        if request.username.trim().length() == 0 {
            return utils:createBadRequestError("Username is required");
        }
        if request.displayName.trim().length() == 0 {
            return utils:createBadRequestError("Display name is required");
        }
        if request.password.trim().length() == 0 {
            return utils:createBadRequestError("Password is required");
        }

        // Hash password
        PasswordHash|error passwordHash = hashPassword(request.password);
        if passwordHash is error {
            log:printError("Error hashing password during user creation", passwordHash);
            return utils:createInternalServerError("Failed to process password");
        }

        // Check if user already exists in credentials database
        types:UserCredentials|sql:Error existingUser = credentialsDbClient->queryRow(
            `SELECT user_id, username, display_name FROM user_credentials WHERE username = ${request.username}`
        );

        if existingUser is types:UserCredentials {
            log:printWarn("Attempt to create user with existing username", username = request.username);
            return utils:createBadRequestError("Username already exists");
        }

        // Create user credentials only (auth backend manages user_credentials table)
        string userId = uuid:createRandomUuid();
        error? createResult = createUserCredentials(userId, request.username, request.displayName, passwordHash.hash, passwordHash.salt);

        if createResult is error {
            log:printError("Error creating user credentials in auth backend", createResult, username = request.username);
            string errorMsg = createResult.toString().toLowerAscii();
            if errorMsg.includes("duplicate") || errorMsg.includes("unique") || errorMsg.includes("constraint") {
                return utils:createBadRequestError("Username already exists");
            }
            return utils:createInternalServerError("Failed to create user credentials");
        }

        log:printInfo("User credentials created successfully by auth backend", username = request.username, userId = userId);
        return <http:Created>{
            body: {
                userId: userId,
                username: request.username,
                displayName: request.displayName
            }
        };
    }
}

isolated function authenticateUser(string username, string password) returns types:User|error {
    log:printDebug("Attempting to authenticate user: " + username);
    // Query user credentials table from separate credentials database
    types:UserCredentials|sql:Error credentials = credentialsDbClient->queryRow(
        `SELECT user_id as userId, username, display_name as displayName,
                password_hash as passwordHash, password_salt as passwordSalt,
                created_at as createdAt, updated_at as updatedAt
         FROM user_credentials
         WHERE username = ${username}`
    );

    if credentials is sql:Error {
        log:printError("Error getting credentials from database", credentials);
        return error("Invalid credentials");
    }

    // Validate password
    boolean|error matches = verifyPassword(password, credentials.passwordHash, credentials.passwordSalt);
    if matches is error {
        log:printError("Unable to verify password", matches);
        return error("Invalid credentials");
    } else if !matches {
        log:printError("Invalid password", username = username);
        return error("Invalid credentials");
    }

    // Return user details from credentials (converting UserCredentials to User type)
    types:User user = {
        userId: credentials.userId,
        username: credentials.username,
        displayName: credentials.displayName,
        createdAt: credentials?.createdAt,
        updatedAt: credentials?.updatedAt
    };

    return user;
}

isolated function getUserCredentialsById(string userId) returns types:UserCredentials|error {
    log:printDebug(string `Fetching credentials for userId: ${userId}`);
    types:UserCredentials|sql:Error credentials = credentialsDbClient->queryRow(
        `SELECT user_id as userId, username, display_name as displayName,
                password_hash as passwordHash, password_salt as passwordSalt,
                created_at as createdAt, updated_at as updatedAt
         FROM user_credentials
         WHERE user_id = ${userId}`
    );

    if credentials is sql:Error {
        log:printError("Error getting credentials from database", credentials);
        return error("Invalid credentials");
    }

    return credentials;
}

isolated function updateUserPasswordInDb(string userId, string newPasswordHash, string? newPasswordSalt) returns error? {
    log:printDebug(string `Updating password for user: ${userId}`);

    sql:ExecutionResult result = check credentialsDbClient->execute(
        `UPDATE user_credentials
         SET password_hash = ${newPasswordHash}, password_salt = ${newPasswordSalt}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ${userId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `User not found in credentials table or user does not have local authentication: ${userId}`);
    }

    log:printInfo(string `Successfully updated password for user ${userId}`);
    return ();
}

isolated function resetUserPasswordInDb(string userId, string newPasswordHash, string? newPasswordSalt) returns error? {
    log:printDebug(string `Admin resetting password for user: ${userId}`);

    sql:ExecutionResult result = check credentialsDbClient->execute(
        `UPDATE user_credentials
         SET password_hash = ${newPasswordHash}, password_salt = ${newPasswordSalt}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ${userId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `User not found: ${userId}`);
    }

    log:printInfo(string `Successfully reset password for user ${userId}`);
    return ();
}

isolated function forceUpdateUserPasswordInDb(string userId, string newPasswordHash, string? newPasswordSalt) returns error? {
    log:printDebug(string `Force-changing password for user: ${userId}`);

    sql:ExecutionResult result = check credentialsDbClient->execute(
        `UPDATE user_credentials
         SET password_hash = ${newPasswordHash}, password_salt = ${newPasswordSalt}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ${userId}`
    );

    if result.affectedRowCount == 0 {
        return error(string `User not found: ${userId}`);
    }

    log:printInfo(string `Successfully force-changed password for user ${userId}`);
    return ();
}

isolated function generateRandomPassword() returns string {
    // Generate a random 12-character password using two UUIDs
    string id1 = uuid:createRandomUuid();
    string id2 = uuid:createRandomUuid();
    // Take first 6 chars from each UUID (skipping hyphens) for a 12-char password
    string chars = id1.substring(0, 8) + id2.substring(0, 4);
    return chars;
}

// hashWithDigest computes Base64(digest(password+salt)) matching the v1 JDBCUserStoreManager
// algorithm. `salt` is appended to the password string before hashing, mirroring the v1
// behaviour of Secret.addChars(salt). Returns a standard Base64-encoded string.
isolated function hashWithDigest(string password, string? salt) returns string {
    string input = salt is () ? password : password + salt;
    byte[] inputBytes = input.toBytes();
    byte[] hashBytes;
    match passwordHashingAlgorithm.toLowerAscii() {
        "sha-1"|"sha1"|"sha" => {
            hashBytes = crypto:hashSha1(inputBytes);
        }
        "md5" => {
            hashBytes = crypto:hashMd5(inputBytes);
        }
        "sha-384"|"sha384" => {
            hashBytes = crypto:hashSha384(inputBytes);
        }
        "sha-512"|"sha512" => {
            hashBytes = crypto:hashSha512(inputBytes);
        }
        _ => {
            // Covers "sha-256", "sha256" and any unrecognised digest value
            hashBytes = crypto:hashSha256(inputBytes);
        }
    }
    return hashBytes.toBase64();
}

isolated function hashPassword(string password) returns PasswordHash|error {
    match passwordHashingAlgorithm.toLowerAscii() {
        "argon2" => {
            string|crypto:Error h = crypto:hashArgon2(password);
            if h is crypto:Error {
                return h;
            }
            return {hash: h, salt: ()};
        }
        "pbkdf2" => {
            string|crypto:Error h = crypto:hashPbkdf2(password);
            if h is crypto:Error {
                return h;
            }
            return {hash: h, salt: ()};
        }
        "sha-256"|"sha256"|"sha-1"|"sha1"|"sha"|"md5"|"sha-384"|"sha384"|"sha-512"|"sha512" => {
            // Generate a random salt and produce a v1-compatible Base64(digest(password+salt)) hash
            string salt = uuid:createRandomUuid();
            return {hash: hashWithDigest(password, salt), salt: salt};
        }
        "plain_text"|"plaintext" => {
            // No hashing; password stored as-is (no salt generated in v2)
            return {hash: password, salt: ()};
        }
        _ => {
            // Default: bcrypt
            string|crypto:Error h = crypto:hashBcrypt(password);
            if h is crypto:Error {
                return h;
            }
            return {hash: h, salt: ()};
        }
    }
}

isolated function verifyPassword(string password, string storedHash, string? storedSalt) returns boolean|error {
    match passwordHashingAlgorithm.toLowerAscii() {
        "argon2" => {
            return crypto:verifyArgon2(password, storedHash);
        }
        "pbkdf2" => {
            return crypto:verifyPbkdf2(password, storedHash);
        }
        "sha-256"|"sha256"|"sha-1"|"sha1"|"sha"|"md5"|"sha-384"|"sha384"|"sha-512"|"sha512" => {
            // Re-derive Base64(digest(password+salt)) and compare
            return hashWithDigest(password, storedSalt) == storedHash;
        }
        "plain_text"|"plaintext" => {
            // v1 stored password+salt (or just password) as plain text
            string expected = storedSalt is () ? password : password + storedSalt;
            return expected == storedHash;
        }
        _ => {
            // Default: bcrypt
            return crypto:verifyBcrypt(password, storedHash);
        }
    }
}

// Local helper: create user credentials only (auth backend manages user_credentials table in separate DB)
isolated function createUserCredentials(string userId, string username, string displayName, string passwordHash, string? passwordSalt) returns error? {
    log:printDebug(string `Auth backend creating user credentials: ${username} (${userId})`);

    sql:ExecutionResult|error insertError = credentialsDbClient->execute(
        `INSERT INTO user_credentials (user_id, username, display_name, password_hash, password_salt)
         VALUES (${userId}, ${username}, ${displayName}, ${passwordHash}, ${passwordSalt})`
    );

    if insertError is error {
        log:printError("Error creating user credentials in database", insertError, username = username);
        return insertError;
    }

    log:printInfo(string `Auth backend: created user credentials for ${username} (${userId})`);
    return ();
}

