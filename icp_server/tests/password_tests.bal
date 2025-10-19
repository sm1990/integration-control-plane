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
import ballerina/log;
import ballerina/test;

// Test constants
const string TEST_CURRENT_PASSWORD = "admin";
const string TEST_NEW_PASSWORD = "newpassword123";
const string WRONG_PASSWORD = "wrongpassword";

// Test: Successful password change
// Note: This test requires the admin user to exist in DB with credentials
// Disabled for now as it modifies database state
@test:Config {
    groups: ["password"],
    enable: false
}
function testChangePasswordSuccess() returns error? {
    log:printInfo("Test: Successful password change");
    
    // Use the pre-generated admin token
    string authHeader = createAuthHeader(adminToken);
    
    // Prepare password change request
    json passwordRequest = {
        currentPassword: TEST_CURRENT_PASSWORD,
        newPassword: TEST_NEW_PASSWORD
    };
    
    // Send password change request
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status
    assertStatusCode(response.statusCode, 200, "Expected status code 200 for successful password change");
    
    // Parse response body
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Success message should be present");
    
    string message = check responseBody.message;
    test:assertTrue(
        message.toLowerAscii().includes("success"),
        "Message should indicate success"
    );
    
    log:printInfo("Test passed: Password changed successfully");
}

// Test: Login with new password after change
@test:Config {
    groups: ["password"],
    dependsOn: [testChangePasswordSuccess],
    enable: false
}
function testLoginWithNewPasswordAfterChange() returns error? {
    log:printInfo("Test: Login with new password after change");
    
    // Try to login with the new password
    json loginRequest = {
        username: "admin",
        password: TEST_NEW_PASSWORD
    };
    
    http:Response response = check authClient->post("/auth/login", loginRequest);
    
    // Assert successful login
    assertStatusCode(response.statusCode, 200, "Expected successful login with new password");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.token is string, "Token should be present after login");
    
    log:printInfo("Test passed: Login successful with new password");
}

// Test: Old password fails after change
@test:Config {
    groups: ["password", "negative"],
    dependsOn: [testLoginWithNewPasswordAfterChange],
    enable: false
}
function testOldPasswordFailsAfterChange() returns error? {
    log:printInfo("Test: Old password fails after change");
    
    // Try to login with the old password
    json loginRequest = {
        username: "admin",
        password: TEST_CURRENT_PASSWORD
    };
    
    http:Response response = check authClient->post("/auth/login", loginRequest);
    
    // Assert login failure
    assertStatusCode(response.statusCode, 401, "Expected login failure with old password");
    
    log:printInfo("Test passed: Old password no longer works");
}

// Test: Change password back to original for other tests
@test:Config {
    groups: ["password"],
    dependsOn: [testOldPasswordFailsAfterChange],
    enable: false
}
function testChangePasswordBackToOriginal() returns error? {
    log:printInfo("Test: Change password back to original");
    
    // First login with the new password to get a valid token
    json loginRequest = {
        username: "admin",
        password: TEST_NEW_PASSWORD
    };
    
    http:Response loginResponse = check authClient->post("/auth/login", loginRequest);
    if loginResponse.statusCode != 200 {
        log:printError("Failed to login with new password for password reset");
        return;
    }
    
    json loginBody = check loginResponse.getJsonPayload();
    string validToken = check loginBody.token;
    string authHeader = createAuthHeader(validToken);
    
    // Change password back to original
    json passwordRequest = {
        currentPassword: TEST_NEW_PASSWORD,
        newPassword: TEST_CURRENT_PASSWORD
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    assertStatusCode(response.statusCode, 200, "Expected successful password change");
    
    log:printInfo("Test passed: Password changed back to original");
}

// Test: Password change fails with incorrect current password
@test:Config {
    groups: ["password", "negative"]
}
function testChangePasswordWithIncorrectCurrent() returns error? {
    log:printInfo("Test: Password change with incorrect current password");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Prepare request with wrong current password
    json passwordRequest = {
        currentPassword: WRONG_PASSWORD,
        newPassword: "newsecurepassword123"
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request)
    assertStatusCode(response.statusCode, 400, "Expected status code 400 with incorrect current password");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    string message = check responseBody.message;
    test:assertTrue(
        message.toLowerAscii().includes("incorrect") || message.toLowerAscii().includes("current"),
        "Error message should indicate incorrect current password"
    );
    
    log:printInfo("Test passed: Password change rejected with incorrect current password");
}

// Test: Password change fails with missing current password
@test:Config {
    groups: ["password", "negative"]
}
function testChangePasswordWithMissingCurrent() returns error? {
    log:printInfo("Test: Password change with missing current password");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Prepare request without current password
    json passwordRequest = {
        newPassword: "newsecurepassword123"
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 or 500)
    test:assertTrue(
        response.statusCode == 400 || response.statusCode == 500,
        "Expected status code 400 or 500 with missing current password"
    );
    
    log:printInfo("Test passed: Password change rejected with missing current password");
}

// Test: Password change fails with missing new password
@test:Config {
    groups: ["password", "negative"]
}
function testChangePasswordWithMissingNew() returns error? {
    log:printInfo("Test: Password change with missing new password");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Prepare request without new password
    json passwordRequest = {
        currentPassword: TEST_CURRENT_PASSWORD
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 or 500)
    test:assertTrue(
        response.statusCode == 400 || response.statusCode == 500,
        "Expected status code 400 or 500 with missing new password"
    );
    
    log:printInfo("Test passed: Password change rejected with missing new password");
}

// Test: Password change fails when new password is too short
@test:Config {
    groups: ["password", "negative"]
}
function testChangePasswordTooShort() returns error? {
    log:printInfo("Test: Password change with password too short");
    
    string authHeader = createAuthHeader(adminToken);
    
    // Prepare request with short password (less than 6 characters)
    json passwordRequest = {
        currentPassword: TEST_CURRENT_PASSWORD,
        newPassword: "12345" // Only 5 characters
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request)
    assertStatusCode(response.statusCode, 400, "Expected status code 400 with short password");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    string message = check responseBody.message;
    test:assertTrue(
        message.toLowerAscii().includes("6") || message.toLowerAscii().includes("characters"),
        "Error message should indicate password length requirement"
    );
    
    log:printInfo("Test passed: Password change rejected for short password");
}

// Test: Password change fails for OIDC user (no local credentials)
// Note: This test requires a user without local credentials in the DB
@test:Config {
    groups: ["password", "negative"],
    enable: false
}
function testChangePasswordForOIDCUser() returns error? {
    log:printInfo("Test: Password change for OIDC user");
    
    // Use the regular user token (this user might not have local credentials)
    string authHeader = createAuthHeader(regularUserToken);
    
    // Try to change password for OIDC user
    json passwordRequest = {
        currentPassword: "anypassword",
        newPassword: "newpassword123"
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request)
    assertStatusCode(response.statusCode, 400, "Expected status code 400 for OIDC user");
    
    json responseBody = check response.getJsonPayload();
    test:assertTrue(responseBody.message is string, "Error message should be present");
    
    string message = check responseBody.message;
    test:assertTrue(
        message.toLowerAscii().includes("sso") || message.toLowerAscii().includes("not available"),
        "Error message should indicate password change not available for SSO users"
    );
    
    log:printInfo("Test passed: Password change rejected for OIDC user");
}

// Test: Password change fails without authorization header
@test:Config {
    groups: ["password", "negative"]
}
function testChangePasswordWithoutAuthHeader() returns error? {
    log:printInfo("Test: Password change without auth header");
    
    json passwordRequest = {
        currentPassword: TEST_CURRENT_PASSWORD,
        newPassword: TEST_NEW_PASSWORD
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest);
    
    // Assert response status (should be 401 Unauthorized)
    assertStatusCode(response.statusCode, 401, "Expected status code 401 without auth header");
    
    log:printInfo("Test passed: Password change rejected without auth header");
}

// Test: Password change fails with empty current password
@test:Config {
    groups: ["password", "negative"]
}
function testChangePasswordWithEmptyCurrentPassword() returns error? {
    log:printInfo("Test: Password change with empty current password");
    
    string authHeader = createAuthHeader(adminToken);
    
    json passwordRequest = {
        currentPassword: "",
        newPassword: "newpassword123"
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request)
    assertStatusCode(response.statusCode, 400, "Expected status code 400 with empty current password");
    
    log:printInfo("Test passed: Password change rejected with empty current password");
}

// Test: Password change fails with empty new password
@test:Config {
    groups: ["password", "negative"]
}
function testChangePasswordWithEmptyNewPassword() returns error? {
    log:printInfo("Test: Password change with empty new password");
    
    string authHeader = createAuthHeader(adminToken);
    
    json passwordRequest = {
        currentPassword: TEST_CURRENT_PASSWORD,
        newPassword: ""
    };
    
    http:Response response = check authClient->put("/auth/password", passwordRequest, {
        "Authorization": authHeader
    });
    
    // Assert response status (should be 400 Bad Request)
    assertStatusCode(response.statusCode, 400, "Expected status code 400 with empty new password");
    
    log:printInfo("Test passed: Password change rejected with empty new password");
}
