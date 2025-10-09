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

import ballerina/http;
import ballerina/jwt;
import ballerina/test;

// Test configuration
const string AUTH_SERVICE_URL = "https://localhost:9445";
const string TEST_EMAIL = "admin@example.com";
const string TEST_PASSWORD = "admin123";
const string INVALID_EMAIL = "nonexistent@example.com";
const string INVALID_PASSWORD = "wrongpassword";
const string NEW_USER_EMAIL = "newuser@example.com";
const string NEW_USER_PASSWORD = "newuser123";

// HTTP client for testing
final http:Client authClient = check new (AUTH_SERVICE_URL,
    secureSocket = {
        cert: {
            path: truststorePath,
            password: truststorePassword
        }
    }
);

@test:Config {
    groups: ["auth", "login"]
}
function testSuccessfulLogin() returns error? {
    // Prepare login request
    json loginRequest = {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Assert response status
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for successful login");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert response structure
    test:assertTrue(responseBody.token is string, "Token should be present in response");
    test:assertTrue(responseBody.expiresIn is int, "ExpiresIn should be present in response");

    // Validate JWT token
    string token = check responseBody.token;
    test:assertTrue(token.length() > 0, "Token should not be empty");

    // Verify JWT token can be decoded
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(token);

    // Verify JWT claims
    test:assertTrue(payload.sub is string, "Subject should be present in JWT");
    test:assertTrue(payload.iss is string, "Issuer should be present in JWT");
    test:assertTrue(payload.exp is int, "Expiration should be present in JWT");
    test:assertTrue(payload.aud is string, "Audience should be present in JWT");

    // Verify custom claims
    test:assertTrue(payload["email"] is string, "Email should be present in JWT custom claims");
    test:assertEquals(payload["email"], TEST_EMAIL, "Email should match the logged-in user");
    test:assertTrue(payload["roles"] is json[], "Roles should be present in JWT custom claims");

    json[] roles = check payload["roles"].ensureType();
    test:assertTrue(roles.length() > 0, "User should have at least one role");
}

// Test: Login failure with invalid email
@test:Config {
    groups: ["auth", "login", "negative"]
}
function testLoginWithInvalidEmail() returns error? {
    // Prepare login request with invalid email
    json loginRequest = {
        email: INVALID_EMAIL,
        password: TEST_PASSWORD
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Assert response status (should be 401 Unauthorized)
    test:assertEquals(response.statusCode, 401, "Expected status code 401 for invalid credentials");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert error message
    test:assertTrue(responseBody.message is string, "Error message should be present");
}

// Test: Login failure with invalid password
@test:Config {
    groups: ["auth", "login", "negative"]
}
function testLoginWithInvalidPassword() returns error? {
    // Prepare login request with invalid password
    json loginRequest = {
        email: TEST_EMAIL,
        password: INVALID_PASSWORD
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Assert response status (should be 401 Unauthorized)
    test:assertEquals(response.statusCode, 401, "Expected status code 401 for invalid password");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert error message
    test:assertTrue(responseBody.message is string, "Error message should be present");
}

// Test: Login failure with missing credentials
@test:Config {
    groups: ["auth", "login", "negative"]
}
function testLoginWithMissingCredentials() returns error? {
    // Prepare login request with missing password
    json loginRequest = {
        email: TEST_EMAIL
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Assert response status (should be 400 Bad Request or 500 Internal Server Error)
    test:assertTrue(
            response.statusCode == 400 || response.statusCode == 500,
            "Expected status code 400 or 500 for missing credentials"
    );
}

// Test: JWT token expiration time
@test:Config {
    groups: ["auth", "login", "jwt"]
}
function testJWTTokenExpiration() returns error? {
    // Prepare login request
    json loginRequest = {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Parse response
    json responseBody = check response.getJsonPayload();
    string token = check responseBody.token;
    decimal expiresIn = check responseBody.expiresIn;

    // Decode JWT to verify expiration
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(token);

    int? exp = payload.exp;
    int? iat = payload.iat;

    test:assertTrue(exp is int, "JWT should have expiration time");
    test:assertTrue(iat is int, "JWT should have issued at time");

    // Verify the expiration time matches the configured value (approximately)
    if exp is int && iat is int {
        int tokenLifetime = exp - iat;
        test:assertTrue(
                tokenLifetime >= <int>expiresIn - 5 && tokenLifetime <= <int>expiresIn + 5,
                "Token lifetime should match the expiresIn value (with 5 second tolerance)"
        );
    }
}

// Test: JWT token contains user roles
@test:Config {
    groups: ["auth", "login", "jwt", "roles"]
}
function testJWTContainsUserRoles() returns error? {
    // Prepare login request
    json loginRequest = {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Parse response
    json responseBody = check response.getJsonPayload();
    string token = check responseBody.token;

    // Decode JWT to verify roles
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(token);

    // Verify roles claim exists and is an array
    test:assertTrue(payload["roles"] is json[], "Roles should be an array");

    json[] roles = check payload["roles"].ensureType();

    // Verify each role has the expected structure
    foreach json role in roles {
        test:assertTrue(role.roleId is string, "Role should have roleId");
        test:assertTrue(role.projectId is string, "Role should have projectId");
        test:assertTrue(role.environmentId is string, "Role should have environmentId");
        test:assertTrue(role.privilegeLevel is string, "Role should have privilegeLevel");
        test:assertTrue(role.roleName is string, "Role should have roleName");
    }
}

// Test: JWT token signature verification
@test:Config {
    groups: ["auth", "login", "jwt", "security"]
}
function testJWTSignatureVerification() returns error? {
    // Prepare login request
    json loginRequest = {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Parse response
    json responseBody = check response.getJsonPayload();
    string token = check responseBody.token;

    // Verify JWT signature with the expected config
    jwt:ValidatorSignatureConfig validatorConfig = {
        secret: defaultJwtHMACSecret
    };

    jwt:Payload validatedPayload = check jwt:validate(token, {
                                                                 issuer: "icp-frontend-jwt-issuer",
                                                                 audience: "icp-server",
                                                                 signatureConfig: validatorConfig
                                                             });

    // Verify payload contains expected claims
    test:assertTrue(validatedPayload.sub is string, "Validated payload should contain subject");
    test:assertTrue(validatedPayload["email"] is string, "Validated payload should contain email");
    test:assertTrue(validatedPayload["roles"] is json[], "Validated payload should contain roles");
}

// Test: New user scenario - authenticated but not in database
@test:Config {
    groups: ["auth", "login", "newuser"]
}
function testNewUserLogin() returns error? {
    // Prepare login request for a new user (authenticated by backend but not in DB)
    json loginRequest = {
        email: NEW_USER_EMAIL,
        password: NEW_USER_PASSWORD
    };

    // Send login request
    http:Response response = check authClient->post("/auth/login", loginRequest);

    // Assert response status (should be 200 for successful authentication)
    test:assertEquals(response.statusCode, 200, "Expected status code 200 for authenticated new user");

    // Parse response body
    json responseBody = check response.getJsonPayload();

    // Assert that isNewUser flag is set to true
    test:assertTrue(responseBody.isNewUser is boolean, "isNewUser field should be present in response");
    test:assertEquals(responseBody.isNewUser, true, "isNewUser should be true for new users");
}

