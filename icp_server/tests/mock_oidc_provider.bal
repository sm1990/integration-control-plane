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
import ballerina/log;
import ballerina/time;

// Mock OIDC Provider Configuration
const string MOCK_OIDC_PROVIDER_PORT = "9458";
const string MOCK_OIDC_PROVIDER_URL = "http://localhost:" + MOCK_OIDC_PROVIDER_PORT;

// Mock OIDC provider data
const string MOCK_ISSUER = MOCK_OIDC_PROVIDER_URL + "/oauth2/token";
const string MOCK_CLIENT_ID = "test-client-id";
const string MOCK_CLIENT_SECRET = "test-client-secret";

// Mock authorization codes
const string VALID_AUTH_CODE = "valid-auth-code-12345";
const string INVALID_AUTH_CODE = "invalid-auth-code";
const string EXPIRED_AUTH_CODE = "expired-auth-code";
const string NEW_USER_CODE = "new-user-auth-code";

// Test user data
const string TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const string TEST_USER_EMAIL = "[email protected]";
const string TEST_USER_NAME = "Test User";

// Mock OIDC Provider Service
listener http:Listener mockOidcListener = check new (check int:fromString(MOCK_OIDC_PROVIDER_PORT));

service /oauth2 on mockOidcListener {

    // Token endpoint - exchanges authorization code for tokens
    resource function post token(http:Request request) returns http:Response {
        http:Response response = new;

        do {
            // Parse form data
            string payload = check request.getTextPayload();
            log:printInfo("Mock OIDC: Received token request", payload = payload);

            // Extract parameters from form-urlencoded body
            map<string> params = {};
            string[] pairs = re `&`.split(payload);
            foreach string pair in pairs {
                string[] keyValue = re `=`.split(pair);
                if keyValue.length() == 2 {
                    params[keyValue[0]] = keyValue[1];
                }
            }

            // Verify grant type
            if params["grant_type"] != "authorization_code" {
                response.statusCode = 400;
                response.setJsonPayload({
                    "error": "unsupported_grant_type",
                    "error_description": "Only authorization_code grant type is supported"
                });
                return response;
            }

            // Verify authorization code
            string? code = params["code"];
            if code is () {
                response.statusCode = 400;
                response.setJsonPayload({
                    "error": "invalid_request",
                    "error_description": "Missing authorization code"
                });
                return response;
            }

            // Check for invalid code
            if code == INVALID_AUTH_CODE {
                response.statusCode = 401;
                response.setJsonPayload({
                    "error": "invalid_grant",
                    "error_description": "Invalid authorization code"
                });
                return response;
            }

            // Check for expired code
            if code == EXPIRED_AUTH_CODE {
                response.statusCode = 401;
                response.setJsonPayload({
                    "error": "invalid_grant",
                    "error_description": "Authorization code has expired"
                });
                return response;
            }

            // Generate mock ID token
            string idToken = check generateMockIdToken();

            // Return successful token response
            response.statusCode = 200;
            response.setJsonPayload({
                "access_token": "mock-access-token-" + code,
                "refresh_token": "mock-refresh-token-" + code,
                "id_token": idToken,
                "token_type": "Bearer",
                "expires_in": 3600,
                "scope": "openid email profile"
            });

            log:printInfo("Mock OIDC: Returning successful token response");
            return response;

        } on fail error e {
            log:printError("Mock OIDC: Error processing token request", e);
            response.statusCode = 500;
            response.setJsonPayload({
                "error": "server_error",
                "error_description": "Internal server error"
            });
            return response;
        }
    }
}

// Generate a mock ID token (JWT)
function generateMockIdToken() returns string|error {
    // Get current timestamp
    time:Utc currentTime = time:utcNow();
    int currentTimestamp = <int>currentTime[0];
    int expiryTimestamp = currentTimestamp + 3600; // 1 hour from now

    // Create ID token claims
    jwt:IssuerConfig issuerConfig = {
        username: TEST_USER_ID,
        issuer: MOCK_ISSUER,
        audience: MOCK_CLIENT_ID,
        expTime: 3600,
        signatureConfig: {
            algorithm: jwt:HS256,
            config: "mock-secret-key-for-testing-purposes-only"
        },
        customClaims: {
            "sub": TEST_USER_ID,
            "email": TEST_USER_EMAIL,
            "name": TEST_USER_NAME,
            "iat": currentTimestamp,
            "exp": expiryTimestamp
        }
    };

    string idToken = check jwt:issue(issuerConfig);
    return idToken;
}

