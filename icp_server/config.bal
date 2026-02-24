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

import icp_server.types;

import ballerina/file;

// Server configuration
configurable int serverPort = 9445;
configurable int graphqlPort = 9446;
configurable int observabilityServerPort = 9448;
configurable int webServerPort = 9445;
configurable int defaultOpensearchAdaptorPort = 9449;

configurable string serverHost = "0.0.0.0";
configurable string organization = "WSO2 Inc.";

configurable string keystorePath = check file:joinPath("..", "conf", "security", "ballerinaKeystore.p12");
configurable string keystorePassword = "ballerina";
configurable string truststorePath = check file:joinPath("..", "conf", "security", "ballerinaTruststore.p12");
configurable string truststorePassword = "ballerina";

configurable int schedulerIntervalSeconds = 600;
configurable int refreshTokenCleanupIntervalSeconds = 86400; // 24 hours (in seconds)

// Runtime auth configuration (runtime and server communication)
configurable string jwtIssuer = "icp-runtime-jwt-issuer";
configurable string|string[] jwtAudience = "icp-server";
configurable string publicCertFile = "./resources/keys/public.cert";
configurable decimal jwtClockSkewSeconds = 10;

// Frontend auth configuration (frontend and server communication)
configurable string defaultJwtHMACSecret = "default-secret-key-at-least-32-characters-long-for-hs256";
configurable string frontendJwtIssuer = "icp-frontend-jwt-issuer";
configurable string frontendJwtAudience = "icp-server";

// Backend auth configuration (server and user service communication)
configurable string userServiceJwtHMACSecret = "default-secret-key-at-least-32-characters-long-for-hs256";
configurable string userServiceJwtIssuer = "icp-user-service-jwt-issuer";
configurable string userServiceJwtAudience = "icp-user-service-jwt-audience";
configurable decimal userServiceJwtClockSkewSeconds = 0;

configurable int defaultTokenExpiryTime = 3600; // 1 hour (in seconds)

configurable string defaultRuntimeJwtHMACSecret = "default-secret-key-at-least-32-characters-long-for-hs256";

//Backend URLs for the frontend to call
configurable string backendGraphqlEndpoint = "https://localhost:9446/graphql";
configurable string backendAuthBaseUrl = "https://localhost:9445/auth";
configurable string backendObservabilityEndpoint = "https://localhost:9448/icp/observability";

// Refresh token configuration
configurable int refreshTokenExpiryTime = 86400; // 1 day (in seconds)
configurable boolean enableRefreshTokenRotation = true; // Rotate refresh token on each use
configurable int maxRefreshTokensPerUser = 10; // Maximum number of active refresh tokens per user (0 = unlimited)

// Authentication backend configuration 
configurable string authBackendUrl = "https://localhost:9447";

// SSO (OIDC) configuration
configurable boolean ssoEnabled = false;
configurable string ssoIssuer = "";
configurable string ssoAuthorizationEndpoint = "";
configurable string ssoTokenEndpoint = "";
configurable string ssoLogoutEndpoint = "";
configurable string ssoClientId = "";
configurable string ssoClientSecret = "";
configurable string ssoRedirectUri = "";
configurable string ssoUsernameClaim = "email"; // Claim to use for username: "email" or "preferred_username"
configurable string[] ssoScopes = ["openid", "email", "profile"];

// Logging configuration
configurable string logLevel = "INFO"; // DEBUG, INFO, WARN, ERROR
configurable boolean enableAuditLogging = true;
configurable boolean enableMetrics = true;

configurable string observabilityBackendURL = "https://localhost:" + defaultOpensearchAdaptorPort.toString();
configurable string defaultobservabilityJwtHMACSecret = "default-secret-key-at-least-32-characters-long-for-hs256";

// OpenSearch configuration
configurable string opensearchUrl = "https://localhost:9200";
configurable string opensearchUsername = "admin";
configurable string opensearchPassword = "Ballerina@123";

// If true, HTTPS certificate validation will be disabled for calls to the icp artifacts API.
// Keep this true for local/self-signed certs; set to false in production with a proper truststore.
configurable boolean artifactsApiAllowInsecureTLS = true;

// Secrets map containing values encrypted by the WSO2 cipher tool.
// All values present in this table are expected to be encrypted; plaintext values will cause an error.
configurable map<string> secrets = {};

// Any configurable that can be encrypted should first be resolved here.
// Initialized by decrypting (if value is "$secret{alias}") or returned as-is.
// All code outside config.bal must use these resolved variables.
final string resolvedTruststorePassword = check resolveSecret(truststorePassword);
final string resolvedDefaultJwtHMACSecret = check resolveSecret(defaultJwtHMACSecret);
final string resolvedUserServiceJwtHMACSecret = check resolveSecret(userServiceJwtHMACSecret);
final string resolvedDefaultRuntimeJwtHMACSecret = check resolveSecret(defaultRuntimeJwtHMACSecret);
final string resolvedSsoClientId = check resolveSecret(ssoClientId);
final string resolvedSsoClientSecret = check resolveSecret(ssoClientSecret);
final string resolvedDefaultobservabilityJwtHMACSecret = check resolveSecret(defaultobservabilityJwtHMACSecret);
final string resolvedOpensearchUsername = check resolveSecret(opensearchUsername);
final string resolvedOpensearchPassword = check resolveSecret(opensearchPassword);
final string resolvedCredDbUser = check resolveSecret(credentialsDbUser);
final string resolvedCredDbPassword = check resolveSecret(credentialsDbPassword);

// Build SSO configuration from configurable values
public isolated function getSSOConfig() returns types:SSOConfig => {
    enabled: ssoEnabled,
    issuer: ssoIssuer,
    authorizationEndpoint: ssoAuthorizationEndpoint,
    tokenEndpoint: ssoTokenEndpoint,
    logoutEndpoint: ssoLogoutEndpoint,
    clientId: resolvedSsoClientId,
    clientSecret: resolvedSsoClientSecret,
    redirectUri: ssoRedirectUri,
    usernameClaim: ssoUsernameClaim,
    scopes: ssoScopes
};

// Validate SSO configuration
public isolated function validateSSOConfig(types:SSOConfig config) returns error? {
    if !config.enabled {
        // SSO is disabled, no validation needed
        return;
    }

    // Validate required fields
    if config.issuer.trim() == "" {
        return error("SSO is enabled but 'ssoIssuer' is not configured");
    }
    if config.authorizationEndpoint.trim() == "" {
        return error("SSO is enabled but 'ssoAuthorizationEndpoint' is not configured");
    }
    if config.tokenEndpoint.trim() == "" {
        return error("SSO is enabled but 'ssoTokenEndpoint' is not configured");
    }
    if config.logoutEndpoint.trim() == "" {
        return error("SSO is enabled but 'ssoLogoutEndpoint' is not configured");
    }
    if config.clientId.trim() == "" {
        return error("SSO is enabled but 'ssoClientId' is not configured");
    }
    if config.clientSecret.trim() == "" {
        return error("SSO is enabled but 'ssoClientSecret' is not configured");
    }
    if config.redirectUri.trim() == "" {
        return error("SSO is enabled but 'ssoRedirectUri' is not configured");
    }

    // Validate usernameClaim is either "email" or "preferred_username"
    if config.usernameClaim != "email" && config.usernameClaim != "preferred_username" {
        return error("'ssoUsernameClaim' must be either 'email' or 'preferred_username'");
    }

    // Validate scopes contain at least "openid"
    if config.scopes.length() == 0 {
        return error("'ssoScopes' must contain at least 'openid' scope");
    }

    boolean hasOpenIdScope = false;
    foreach string scope in config.scopes {
        if scope == "openid" {
            hasOpenIdScope = true;
            break;
        }
    }

    if !hasOpenIdScope {
        return error("'ssoScopes' must include 'openid' scope");
    }
}
