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

import ballerina/sql;
import ballerina/time;

// === Enums ===

public enum RuntimeType {
    MI,
    BI
}

public enum DeploymentType {
    VM,
    K8S
}

public enum RuntimeStatus {
    RUNNING,
    FAILED,
    DISABLED,
    OFFLINE,
    STOPPED
}

public enum ArtifactState {
    ENABLED,
    DISABLED,
    STARTING,
    STOPPING,
    FAILED
}

public enum ArtifactType {
    SERVICE = "services",
    LISTENER = "listeners"
}

// === Core Domain Types ===

public type Artifact record {
    string name;
};

public type Resource record {

    string[] methods;
    @sql:Column {
        name: "resource_url"
    }
    string url;
};

public type Artifacts record {
    Listener[] listeners;
    Service[] services;
};

public type Node record {
    string platformName = "ballerina";
    string platformVersion?;
    string platformHome?;
    string ballerinaHome?;
    string osName?;
    string osVersion?;
};

// Heartbeat that includes all runtime information for registration/updates
public type Heartbeat record {|
    string runtime;
    RuntimeType runtimeType;
    RuntimeStatus status;
    string environment;
    string project;
    string component;
    string version?;
    Node nodeInfo;
    Artifacts artifacts;
    string runtimeHash;
    time:Utc timestamp;
|};

// Delta heartbeat with hash value
public type DeltaHeartbeat record {|
    string runtime;
    string runtimeHash;
    time:Utc timestamp;
|};

// === ICP Control Types ===

public type ControlCommand record {
    string commandId;
    string runtimeId;
    string targetArtifact;
    string action;
    time:Utc issuedAt;
    string status; // pending, sent, acknowledged, failed
};

public type HeartbeatResponse record {
    boolean acknowledged;
    boolean fullHeartbeatRequired?;
    ControlCommand[] commands?;
    string[] errors?;
};

public type RuntimeRegistrationResponse record {
    boolean success;
    string message?;
    string[] errors?;
};

// === Configuration ===

public type IcpServer record {|
    string serverUrl;
    string authToken;
    decimal heartbeatInterval;
|};

public type Observability record {|
    string opensearchUrl;
    string logIndex;
    boolean metricsEnabled;
|};

public type IcpConfig record {|
    IcpServer icp;
    Observability observability;
|};

public type RequestLimit record {
    int maxUriLength;
    int maxHeaderSize;
    int maxEntityBodySize;
};

public type ChangeNotification record {
    anydata[] deployedArtifacts;
    anydata[] undeployedArtifacts;
    anydata[] stateChangedArtifacts;
};

// === API Wrappers / Auth ===

public type UserClaims record {
    string sub;
    string[] roles;
    int exp;
};

public type ApiResponse record {
    boolean success;
    string message?;
    json data?;
    string[] errors?;
};

public type AccessTokenResponse record {|
    string AccessToken;
|};

// Database record types for mapping query results
public type RuntimeDBRecord record {
    string runtime_id;
    string runtime_type;
    string status;
    string environment_id;
    string project_id;
    string component_id;
    string version?;
    string platform_name?;
    string platform_version?;
    string platform_home?;
    string os_name?;
    string os_version?;
    time:Utc registration_time?;
    time:Utc last_heartbeat?;
};

// GraphQL response types
public type Runtime record {
    @sql:Column {
        name: "runtime_id"
    }
    string runtimeId;

    @sql:Column {
        name: "runtime_type"
    }
    string runtimeType;

    string status;
    string version?;
    Component component;
    Environment environment;

    @sql:Column {
        name: "platform_name"
    }
    string platformName?;

    @sql:Column {
        name: "platform_version"
    }
    string platformVersion?;

    @sql:Column {
        name: "platform_home"
    }
    string platformHome?;

    @sql:Column {
        name: "os_name"
    }
    string osName?;

    @sql:Column {
        name: "os_version"
    }
    string osVersion?;

    @sql:Column {
        name: "registration_time"
    }
    string registrationTime?;

    @sql:Column {
        name: "last_heartbeat"
    }
    string lastHeartbeat?;
    Artifacts artifacts?;
};

public type ServiceRecordInDB record {
    string service_name;
    string service_package;
    string base_path;
    ArtifactState state;
};

public type ListenerRecordInDB record {
    string listener_name;
    string listener_package;
    string protocol;
    ArtifactState state;
};

public type ResourceRecord record {
    string resource_url;
    string methods; // JSON string of array
};

public type Service record {
    @sql:Column {
        name: "service_name"
    }
    string name;
    @sql:Column {
        name: "service_package"
    }
    string package;
    @sql:Column {
        name: "base_path"
    }
    string basePath;
    ArtifactState state = ENABLED;
    Resource[] resources;
};

public type Listener record {
    @sql:Column {
        name: "listener_name"
    }
    string name;
    @sql:Column {
        name: "listener_package"
    }
    string package;
    string protocol;
    ArtifactState state = ENABLED;
};

// === Project & Component Types ===

public type Project record {
    @sql:Column {
        name: "project_id"
    }
    string projectId;
    string name;
    string description?;
    @sql:Column {
        name: "created_by"
    }
    string createdBy?;
    @sql:Column {
        name: "created_at"
    }
    string createdAt?;

    @sql:Column {
        name: "updated_at"
    }
    string updatedAt?;
    @sql:Column {
        name: "updated_by"
    }
    string updatedBy?;
};

public type ProjectInput record {
    string name;
    string description?;
};

public type Component record {
    @sql:Column {
        name: "component_id"
    }
    string componentId;
    Project project;
    string name;
    string description?;
    @sql:Column {
        name: "created_by"
    }
    string createdBy?;
    @sql:Column {
        name: "created_at"
    }
    string createdAt?;

    @sql:Column {
        name: "updated_at"
    }
    string updatedAt?;
    @sql:Column {
        name: "updated_by"
    }
    string updatedBy?;
};

public type ComponentInput record {
    string projectId;
    string name;
    string description?;
};

public type Environment record {
    @sql:Column {
        name: "environment_id"
    }
    string environmentId;
    string name;
    string description?;

    @sql:Column {
        name: "is_production"
    }
    boolean isProduction;

    @sql:Column {
        name: "created_at"
    }
    string createdAt?;

    @sql:Column {
        name: "updated_at"
    }
    string updatedAt?;

    @sql:Column {
        name: "updated_by"
    }
    string updatedBy?;

    @sql:Column {
        name: "created_by"
    }
    string createdBy?;
};

public type EnvironmentInput record {
    string name;
    string description?;
    boolean isProduction?;
};

public type ComponentInDB record {
    string component_id;
    string project_id;
    string component_name;
    string component_description?;
    string component_created_by?;
    string component_created_at?;
    string component_updated_at?;
    string component_updated_by?;
    string project_name;
    string project_description?;
    string project_created_by?;
    string project_created_at?;
    string project_updated_at?;
    string project_updated_by?;
};

// === Auth Related Types ===

public type Credentials record {
    string username;
    string password;
};

public type LoginResponse record {|
    boolean isNewUser = false;
    string token?;
    int expiresIn?;
    string username?;
    Role[] roles?;
|};

// Types for the /authenticate endpoint
public type AuthenticateResponse record {
    boolean authenticated;
    string? userId;
    string? displayName;
    string? timestamp;
};

// === OIDC/SSO Related Types ===

// SSO Configuration
public type SSOConfig record {|
    boolean enabled;
    string issuer;
    string authorizationEndpoint;
    string tokenEndpoint;
    string logoutEndpoint;
    string clientId;
    string clientSecret;
    string redirectUri;
    string usernameClaim; // "email" or "preferred_username"
    string[] scopes;
|};

// OIDC Authorization URL response
public type OIDCAuthorizationUrlResponse record {|
    string authorizationUrl;
|};

// OIDC callback request
public type OIDCCallbackRequest record {|
    string code;
|};

// OIDC token response from provider
public type OIDCTokenResponse record {|
    string access_token;
    string refresh_token?;
    string id_token;
    string token_type;
    int expires_in;
    string scope?;
|};

// OIDC ID Token claims (standard claims)
public type OIDCIdTokenClaims record {|
    string sub; // Subject (user ID)
    string iss; // Issuer
    string|string[] aud; // Audience
    int exp; // Expiration time
    int iat; // Issued at
    string? email?; // Email address
    string? name?; // Full name
    string? preferred_username?; // Preferred username
|};

// Type to hold extracted user information
public type ExtractedUserInfo record {|
    string userId;
    string username;
    string displayName;
|};

// Database user record type
public type User record {
    @sql:Column {
        name: "user_id"
    }
    string userId;
    string username;
    @sql:Column {
        name: "display_name"
    }
    string displayName;
    @sql:Column {
        name: "created_at"
    }
    string? createdAt?;
    @sql:Column {
        name: "updated_at"
    }
    string? updatedAt?;
};

// Database user_credentials record type
public type UserCredentials record {
    string userId;
    string username;
    string displayName;
    string passwordHash;
    string? createdAt?;
    string? updatedAt?;
};

// Privilege level enum
public enum PrivilegeLevel {
    ADMIN = "admin",
    DEVELOPER = "developer"
};

// Database role record type
public type Role record {
    @sql:Column {
        name: "role_id"
    }
    string roleId;
    @sql:Column {
        name: "project_id"
    }
    string projectId;
    @sql:Column {
        name: "environment_id"
    }
    string environmentId;
    @sql:Column {
        name: "privilege_level"
    }
    PrivilegeLevel privilegeLevel;
    @sql:Column {
        name: "role_name"
    }
    string roleName; // Format: <project_name>:<env_name>:<privilege_level>
    @sql:Column {
        name: "created_at"
    }
    string? createdAt?;
    @sql:Column {
        name: "updated_at"
    }
    string? updatedAt?;
};

// User with roles for API responses
public type UserWithRoles record {
    *User; // Type inclusion - includes all fields from User
    Role[] roles;
};

// Input type for creating a new user
public type CreateUserInput record {
    string username;
    string displayName;
    string password;
};

// Input type for updating user roles
public type UpdateUserRolesInput record {
    string userId;
    RoleAssignment[] roles;
};

// Role assignment for a specific project-environment combination
public type RoleAssignment record {
    string projectId;
    string environmentId;
    PrivilegeLevel privilegeLevel;
};
