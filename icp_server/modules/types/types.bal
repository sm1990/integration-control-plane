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

public enum DeploymentState {
    Active,
    Faulty
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
    LISTENER = "listeners",
    RESTAPI = "RestApi",
    PROXYSERVICE = "ProxyService",
    ENDPOINT = "Endpoint",
    INBOUNDENDPOINT = "InboundEndpoint",
    SEQUENCE = "Sequence",
    TASK = "Task",
    TEMPLATE = "Template",
    MESSAGESTORE = "MessageStore",
    MESSAGEPROCESSOR = "MessageProcessor",
    LOCALENTRY = "LocalEntry",
    DATASERVICE = "DataService",
    CARBONAPP = "CarbonApp",
    DATASOURCE = "DataSource",
    CONNECTOR = "Connector",
    REGISTRYRESOURCE = "RegistryResource"
}

// === Core Domain Types ===

public type Artifact record {
    string name;
};

public type Resource record {
    @sql:Column {
        name: "resource_path"
    }
    string path = ""; // "/unittest", "/", "/send", etc.
    @sql:Column {
        name: "resource_method"
    }
    string method = ""; // "GET", "POST", "PUT", "DELETE"
    // Legacy fields for backward compatibility
    @sql:Column {
        name: "resource_url"
    }
    string url = "";
    string[] methods = [];
};

public type Artifacts record {
    Listener[] listeners = [];
    Service[] services = [];
    // MI-specific artifact types that may be present in heartbeat payloads
    RestApi[] apis = [];
    ProxyService[] proxyServices = [];
    Endpoint[] endpoints = [];
    InboundEndpoint[] inboundEndpoints = [];
    Sequence[] sequences = [];
    Task[] tasks = [];
    Template[] templates = [];
    MessageStore[] messageStores = [];
    MessageProcessor[] messageProcessors = [];
    LocalEntry[] localEntries = [];
    DataService[] dataServices = [];
    CarbonApp[] carbonApps = [];
    DataSource[] dataSources = [];
    Connector[] connectors = [];
    RegistryResource[] registryResources = [];
    SystemInfo[] systemInfo = [];
};

public type Node record {
    string platformName = "wso2-mi";
    string platformVersion?;
    string platformHome?;
    string ballerinaHome?;
    string osName?;
    string osVersion?;
    string javaVersion?;
};

// Heartbeat that includes all runtime information for registration/updates
public type Heartbeat record {|
    string runtime;
    string runtimeType; // "wso2-mi" from payloads
    string status; // "RUNNING", "STOPPED", etc.
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
    string service_type;
};

public type ListenerRecordInDB record {
    string listener_name;
    string listener_package;
    string protocol;
    ArtifactState state;
    string port?;
    string destination?;
    string queue?;
    string path?;
};

// Database record types for MI artifacts
public type ProxyServiceRecordInDB record {
    string proxy_name;
    string proxy_package;
    string base_path;
    ArtifactState state;
    string wsdl = "";
    string transports = "";
};

public type EndpointRecordInDB record {
    string endpoint_name;
    string endpoint_type;
    string address?;
    ArtifactState state;
};

public type SequenceRecordInDB record {
    string sequence_name;
    string sequence_type?;
    string container?;
    ArtifactState state;
};

public type TaskRecordInDB record {
    string task_name;
    string task_class?;
    string task_group?;
    ArtifactState state;
};

public type MessageStoreRecordInDB record {
    string store_name;
    string store_type;
    string store_class?;
    ArtifactState state;
};

public type MessageProcessorRecordInDB record {
    string processor_name;
    string processor_type;
    string processor_class?;
    ArtifactState state;
};

public type LocalEntryRecordInDB record {
    string entry_name;
    string entry_type;
    string entry_value?;
    ArtifactState state;
};

public type CarbonAppRecordInDB record {
    string app_name;
    string version = "";
    DeploymentState state;
};

public type RegistryResourceRecordInDB record {
    string resource_name;
    string resource_path;
    string resource_type = "";
    ArtifactState state;
    string path = "";
};

public type ResourceRecord record {
    string resource_path = "";
    string method = ""; // Single method like "GET", "POST", etc.
    string resource_url = "";
    string methods = ""; // JSON string of array
};

public type Service record {
    @sql:Column {
        name: "service_name"
    }
    string name;
    @sql:Column {
        name: "service_package"
    }
    string package = "";
    @sql:Column {
        name: "base_path"
    }
    string basePath = "";
    @sql:Column {
        name: "service_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
    @sql:Column {
        name: "service_type"
    }
    string 'type = ""; // "API", "ProxyService", "DataService", "InboundEndpoint", "ScheduledTask"
    Resource[] resources;
    Listener[] listeners;
};

public type Listener record {
    @sql:Column {
        name: "listener_name"
    }
    string name = "";
    @sql:Column {
        name: "listener_package"
    }
    string package = "";

    @sql:Column {
        name: "protocol"
    }
    string protocol = ""; // "http", "https", "jms", "rabbitmq", "file"

    @sql:Column {
        name: "listener_host"
    }
    string host?; // "0.0.0.0", "localhost" for network protocols
    @sql:Column {
        name: "listener_port"
    }
    int port?; // "8290", "8253" for network protocols

    @sql:Column {
        name: "listener_destination"
    }
    string destination?; // JMS destination name

    @sql:Column {
        name: "listener_queue"
    }
    string queue?; // RabbitMQ queue name

    @sql:Column {
        name: "listener_path"
    }
    string path?; // File system path

    @sql:Column {
        name: "listener_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

// MI Runtime specific artifact types
public type RestApi record {
    @sql:Column {
        name: "api_name"
    }
    string name;
    string url = "";
    string context;
    string version?;
    @sql:Column {
        name: "api_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
    ApiResource[] resources = []; // API resources (path + methods)
};

// API Resource type for MI API resources
public type ApiResource record {
    @sql:Column {
        name: "resource_path"
    }
    string path = ""; // "/unittest", "/*", etc.
    string methods = ""; // Single method as string from MI heartbeat (e.g., "POST", "GET")
};

public type ProxyService record {
    @sql:Column {
        name: "proxy_name"
    }
    string name;
    string wsdl?;
    string[] transports?;
    @sql:Column {
        name: "proxy_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type Endpoint record {
    @sql:Column {
        name: "endpoint_name"
    }
    string name;
    string 'type;
    string address?;
    @sql:Column {
        name: "endpoint_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type InboundEndpoint record {
    @sql:Column {
        name: "inbound_name"
    }
    string name;
    string protocol;
    string sequence?;
    @sql:Column {
        name: "inbound_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type Sequence record {
    @sql:Column {
        name: "sequence_name"
    }
    string name;
    string 'type?;
    string container?;
    @sql:Column {
        name: "sequence_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type Task record {
    @sql:Column {
        name: "task_name"
    }
    string name;
    string 'class?;
    string group?;
    @sql:Column {
        name: "task_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type Template record {
    @sql:Column {
        name: "template_name"
    }
    string name;
    string 'type;
    @sql:Column {
        name: "template_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type MessageStore record {
    @sql:Column {
        name: "store_name"
    }
    string name;
    string 'type;
    string 'class?;
    @sql:Column {
        name: "store_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type MessageProcessor record {
    @sql:Column {
        name: "processor_name"
    }
    string name;
    string 'type;
    string 'class?;
    @sql:Column {
        name: "processor_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type LocalEntry record {
    @sql:Column {
        name: "entry_name"
    }
    string name;
    string 'type;
    string value?;
    @sql:Column {
        name: "entry_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type DataService record {
    @sql:Column {
        name: "service_name"
    }
    string name;
    string description?;
    string wsdl?;
    @sql:Column {
        name: "dataservice_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type CarbonApp record {
    @sql:Column {
        name: "app_name"
    }
    string name;
    string componentId?;
    string version?;
    @sql:Column {
        name: "app_state"
    }
    string state = "Active"; // "Active", "Faulty"
};

public type DataSource record {
    @sql:Column {
        name: "datasource_name"
    }
    string name;
    string driver?;
    string url?;
    @sql:Column {
        name: "datasource_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type Connector record {
    @sql:Column {
        name: "connector_name"
    }
    string name;
    string 'package;
    string version?;
    @sql:Column {
        name: "connector_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type RegistryResource record {
    @sql:Column {
        name: "resource_name"
    }
    string name;
    string path = "";
    @sql:Column {
        name: "resource_type"
    }
    string 'type = "";
    @sql:Column {
        name: "registryresource_state"
    }
    string state = "ENABLED"; // "ENABLED", "DISABLED"
};

public type SystemInfo record {
    @sql:Column {
        name: "info_key"
    }
    string key;
    @sql:Column {
        name: "info_value"
    }
    string value;
};

// === Project & Component Types ===

public type Project record {
    @sql:Column {
        name: "project_id"
    }
    string id; // Alias for projectId to support queries requesting 'id'

    @sql:Column {
        name: "org_id"
    }
    int orgId;

    string name;
    string version;

    @sql:Column {
        name: "created_date"
    }
    string createdDate?;

    string handler;

    @sql:Column {
        name: "extended_handler"
    }
    string? extendedHandler?;

    string region?;
    string description?;

    @sql:Column {
        name: "owner_id"
    }
    string owner?;

    string[] labels?;

    @sql:Column {
        name: "default_deployment_pipeline_id"
    }
    string defaultDeploymentPipelineId = "";

    string[] deploymentPipelineIds = [];

    string 'type?;

    @sql:Column {
        name: "git_provider"
    }
    string? gitProvider?;

    @sql:Column {
        name: "git_organization"
    }
    string gitOrganization?;

    string repository?;
    string branch?;

    @sql:Column {
        name: "secret_ref"
    }
    string secretRef?;

    @sql:Column {
        name: "owner_id"
    }
    string ownerId?;

    @sql:Column {
        name: "created_by"
    }
    string createdBy?;

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
    int orgId;
    string orgHandler;
    string name;
    string? version?;
    string projectHandler;
    string? handler?;
    string? region?;
    string? description?;
    string? defaultDeploymentPipelineId?;
    string[]? deploymentPipelineIds?;
    string? 'type?;
    string? gitProvider?;
    string? gitOrganization?;
    string? repository?;
    string? branch?;
    string? secretRef?;
};

public type ProjectUpdateInput record {
    string id;
    int orgId?;
    string name?;
    string version?;
    string description?;
};

public type Component record {
    // Basic Identity Fields
    string id; // Alias for componentId
    @sql:Column {
        name: "project_id"
    }
    string projectId;
    @sql:Column {
        name: "org_handler"
    }
    string orgHandler;
    @sql:Column {
        name: "org_id"
    }
    int orgId?;

    // Component Metadata
    string name;
    string handler;
    @sql:Column {
        name: "display_name"
    }
    string displayName;
    @sql:Column {
        name: "display_type"
    }
    string displayType;
    string description?;
    @sql:Column {
        name: "owner_name"
    }
    string ownerName?;

    // Status Fields
    string status;
    @sql:Column {
        name: "init_status"
    }
    string initStatus?;

    // Version & Timestamps
    string version;
    @sql:Column {
        name: "created_at"
    }
    string createdAt;
    @sql:Column {
        name: "last_build_date"
    }
    string lastBuildDate?;
    @sql:Column {
        name: "updated_at"
    }
    string updatedAt?;

    // Classification
    @sql:Column {
        name: "component_sub_type"
    }
    string componentSubType?;
    @sql:Column {
        name: "component_type"
    }
    RuntimeType componentType; // NOT NULL in DB with DEFAULT 'BI'
    string labels?;

    // System Component Flag
    @sql:Column {
        name: "is_system_component"
    }
    boolean isSystemComponent?;

    // Component Configuration Flags
    @sql:Column {
        name: "api_id"
    }
    string apiId?;
    @sql:Column {
        name: "http_based"
    }
    boolean httpBased?;
    @sql:Column {
        name: "is_migration_completed"
    }
    boolean isMigrationCompleted?;
    @sql:Column {
        name: "skip_deploy"
    }
    boolean skipDeploy?;
    @sql:Column {
        name: "endpoint_short_url_enabled"
    }
    boolean endpointShortUrlEnabled?;
    @sql:Column {
        name: "is_unified_config_mapping"
    }
    boolean isUnifiedConfigMapping?;
    @sql:Column {
        name: "service_access_mode"
    }
    string serviceAccessMode?;

    // Nested Objects
    Repository repository?;
    ApiVersion[] apiVersions?;
    DeploymentTrack[] deploymentTracks?;

    // Git Integration
    @sql:Column {
        name: "git_provider"
    }
    string gitProvider?;
    @sql:Column {
        name: "git_organization"
    }
    string gitOrganization?;
    @sql:Column {
        name: "git_repository"
    }
    string gitRepository?;
    string branch?;

    // Advanced Fields
    ComponentEndpoint[] endpoints?;
    ComponentEnvironmentVariable[] environmentVariables?;
    ComponentSecret[] secrets?;

    // Legacy fields for backward compatibility
    @sql:Column {
        name: "component_id"
    }
    string componentId?;
    Project project?;
    @sql:Column {
        name: "created_by"
    }
    string createdBy?;
    @sql:Column {
        name: "updated_by"
    }
    string updatedBy?;
};

public type ComponentInput record {
    // Required Fields
    string projectId;
    string name;

    // Recommended Fields
    string displayName?; // User-friendly display name
    string description?; // Component description

    // Organization Context (optional - can derive from projectId)
    int orgId?; // Organization ID
    string orgHandler?; // Organization handle

    // Component Classification (optional - can have defaults)
    RuntimeType componentType?; // Runtime type: "BI" or "MI"
    string technology?; // Technology: "WSO2MI", "Ballerina", etc.

    // Repository Integration (optional - for future use)
    string repository?; // Git repository URL
    string branch?; // Git branch
    string directoryPath?; // Path within repository
    string secretRef?; // Reference to credentials
    boolean isPublicRepo?; // Public/private repository flag

    // Internal field (set by backend)
    string createdBy?;
};

public type ComponentUpdateInput record {
    // Required field - component ID to update
    string id;

    // Basic fields that can be updated
    string name?;
    string displayName?;
    string description?;
    RuntimeType componentType?;
    string version?;
    string labels?;
    string serviceAccessMode?;

    // Extended fields (accepted for compatibility but may not be persisted)
    string apiId?;
    boolean httpBased?;
    boolean isMigrationCompleted?;
    boolean skipDeploy?;
    boolean endpointShortUrlEnabled?;
    boolean isUnifiedConfigMapping?;
    string componentSubType?;
};

// === Component Related Nested Types ===

public type Repository record {
    // Build Configurations
    BuildpackConfig buildpackConfig?;
    ByocWebAppBuildConfig byocWebAppBuildConfig?;
    ByocBuildConfig byocBuildConfig?;
    DockerBuildConfig dockerBuildConfig?;
    TestRunnerConfig testRunnerConfig?;

    // Repository Source Information
    string repositoryType?;
    string repositoryBranch?;
    string repositorySubPath?;
    string repositoryUrl?;

    // Git Provider Information (not in DB, will be null)
    string bitbucketServerUrl?;
    string serverUrl?;
    string gitProvider?;
    string nameApp?;
    string nameConfig?;
    string branch?;
    string branchApp?;
    string organizationApp?;
    string organizationConfig?;
    string appSubPath?;

    // Repository Flags (not in DB, will be null)
    boolean isUserManage?;
    boolean isAuthorizedRepo?;
    boolean isBuildConfigurationMigrated?;
};

public type BuildpackConfig record {
    string versionId?;
    string buildContext?;
    string languageVersion?;
    string buildCommand?;
    string runCommand?;
    boolean isUnitTestEnabled?;
    boolean pullLatestSubmodules?;
    boolean enableTrivyScan?;
    Buildpack buildpack?;
    KeyValue[] keyValues?;
};

public type Buildpack record {
    string id;
    string name?;
    string language;
    string version?;
    string description?;
};

public type ByocWebAppBuildConfig record {
    string id?;
    string containerId?;
    string componentId?;
    string repositoryId?;
    string dockerContext?;
    string webAppType?;
    int port?;
    string imageUrl?;
    string registryId?;
    string dockerfile?;
    string buildCommand?;
    string packageManagerVersion?;
    string outputDirectory?;
    boolean enableTrivyScan?;
};

public type DockerBuildConfig record {
    string id?;
    string dockerContext?;
    string dockerfile?;
    int port?;
    string imageUrl?;
    string registryId?;
};

public type ByocBuildConfig record {
    string id?;
    boolean isMainContainer?;
    string containerId?;
    string componentId?;
    string repositoryId?;
    string dockerContext?;
    string dockerfilePath?;
    string oasFilePath?;
};

public type TestRunnerConfig record {
    string dockerContext?;
    string postmanDirectory?;
    string testRunnerType?;
};

public type KeyValue record {
    string id?;
    string key;
    string value?;
};

public type ApiVersion record {
    string id;
    string apiVersion;
    string versionId?;
    string proxyName?;
    string proxyUrl?;
    string proxyId?;
    string state;
    boolean latest;
    string branch?;
    string accessibility?;
    boolean autoDeployEnabled?;
    AppEnvVersion[] appEnvVersions?;
    CellDiagram cellDiagram?;
    string openApiSpec?;
    string graphqlSchema?;
    string createdAt?;
    string updatedAt?;
    string description?;
};

public type AppEnvVersion record {
    string environmentId;
    string releaseId;
    Release? release;
};

public type Release record {
    string id;
    ReleaseMetadata? metadata;
    string environmentId?;
    string environment?;
    string gitHash?;
    string gitOpsHash?;
};

public type ReleaseMetadata record {
    string choreoEnv?;
};

public type CellDiagram record {
    string data?;
    string message?;
    string errorName?;
    boolean success;
};

public type DeploymentTrack record {
    string id;
    string componentId;
    string createdAt;
    string updatedAt;
    string apiVersion;
    string branch?;
    boolean latest;
    string versionStrategy?;
    string description?;
    boolean autoDeployEnabled?;
    boolean autoBuildEnabled?;
    string environmentName?;
    string environmentId?;
    string deploymentStatus?;
    string lastDeployedAt?;
};

public type ComponentEndpoint record {
    string id;
    string componentId;
    string name;
    string url;
    string 'type;
    string protocol?;
    int port?;
    string visibility?;
};

public type ComponentEnvironmentVariable record {
    string key;
    string value?;
    boolean isSecret;
    string description?;
};

public type ComponentSecret record {
    string key;
    string description?;
    string createdAt?;
    string updatedAt?;
};

public type ComponentFilterInput record {
    boolean withSystemComponents?;
    string displayType?;
    string status?;
    string componentSubType?;
};

public type ComponentSortInput record {
    string 'field;
    string 'order;
};

public type PaginationInput record {
    int 'limit?;
    int offset?;
    string cursor?;
};

public type ComponentOptionsInput record {
    ComponentFilterInput filter?;
    ComponentSortInput sort?;
    PaginationInput pagination?;
};

public type Environment record {
    // Core Identity (from DB)
    @sql:Column {
        name: "environment_id"
    }
    string id; // Alias for environmentId (set in resolver)
    string name;
    string description?;

    // New required fields (from DB)
    string region?;

    @sql:Column {
        name: "cluster_id"
    }
    string clusterId?;

    @sql:Column {
        name: "choreo_env"
    }
    string choreoEnv?;

    @sql:Column {
        name: "external_apim_env_name"
    }
    string externalApimEnvName?;

    @sql:Column {
        name: "internal_apim_env_name"
    }
    string internalApimEnvName?;

    @sql:Column {
        name: "sandbox_apim_env_name"
    }
    string sandboxApimEnvName?;

    boolean critical;

    @sql:Column {
        name: "dns_prefix"
    }
    string dnsPrefix?;

    // Extended fields (legacy, not in DB)
    string vhost?;
    string sandboxVhost?;
    string apiEnvName?;
    string apimEnvId?;
    boolean isMigrating?;
    string promoteFrom?;
    string namespace?;
    string dpId?;
    string templateId?;
    boolean isPdp?;
    boolean scaleToZeroEnabled?;

    // Audit Fields (from DB)
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
    boolean critical;
    string createdBy?;
};

public type ComponentInDB record {
    string component_id;
    string project_id;
    string component_name;
    string component_display_name?;
    string component_description?;
    string component_type; // NOT NULL in DB, should always have a value
    string component_created_by?;
    string component_created_at?;
    string component_updated_at?;
    string component_updated_by?;
    int project_org_id;
    string project_name;
    string project_version?;
    string project_created_date?;
    string project_handler;
    string project_region?;
    string project_description?;
    string project_default_deployment_pipeline_id?;
    string project_deployment_pipeline_ids?;
    string project_type?;
    string project_git_provider?;
    string project_git_organization?;
    string project_repository?;
    string project_branch?;
    string project_secret_ref?;
    string project_created_by?;
    string project_updated_at?;
    string project_updated_by?;
};

// === Observability Related Types ===

public type LogEntryRequest record {
    string startTime;
    string endTime;
    int logStartIndex;
    int logCount;
    string? runtime = ();
    string? component = ();
    string? environment = ();
    string? project = ();
    string? logLevel = ();
};

public type LogEntry record {
    string time;
    string level;
    string runtime;
    string component;
    string project;
    string environment;
    string message;
    map<anydata> additionalTags;
};

public type LogCount record {
    int total;
    int debug;
    int info;
    int warn;
    int 'error;
};

public type LogEntriesResponse record {
    LogEntry[] logs;
    LogCount logCounts;
};

public type OpenSearchHit record {
    string _index;
    string _id;
    json? _score;
    map<string> _source;
    json[]? sort;
};

public type OpenSearchHits record {
    record {
        int value;
        string relation;
    } total;
    json? max_score;
    OpenSearchHit[] hits;
};

public type OpenSearchResponse record {
    int took;
    boolean timed_out;
    record {
        int total;
        int successful;
        int skipped;
        int failed;
    } _shards;
    OpenSearchHits hits;
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

// Request type for refresh token endpoint
public type RefreshTokenRequest record {
    string refreshToken;
};

// Request type for revoke token endpoint
public type RevokeTokenRequest record {
    string? refreshToken?; // If provided, revokes specific token. If omitted, revokes all user's tokens
};

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
    string state?; // CSRF protection token
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
        name: "is_super_admin"
    }
    boolean isSuperAdmin = false;
    @sql:Column {
        name: "is_project_author"
    }
    boolean isProjectAuthor = false;
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

// Environment type enum
public enum EnvironmentType {
    PROD = "prod",
    NON_PROD = "non-prod"
};

// === User Context for RBAC ===

// Simplified role info extracted from JWT for authorization checks
// Contains only the minimal information needed for authorization decisions
public type RoleInfo record {
    string projectId;
    EnvironmentType environmentType;
    PrivilegeLevel privilegeLevel;
};

// User context extracted from JWT token for RBAC
public type UserContext record {
    string userId;
    string username;
    string displayName;
    RoleInfo[] roles;
    boolean isSuperAdmin = false; // Global admin with access to all resources
    boolean isProjectAuthor = false; // Can create/update/delete projects
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
        name: "environment_type"
    }
    EnvironmentType environmentType;
    @sql:Column {
        name: "privilege_level"
    }
    PrivilegeLevel privilegeLevel;
    @sql:Column {
        name: "role_name"
    }
    string roleName; // Format: <project_name>:<env_type>:<privilege_level>
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

// Role assignment for a specific project-environment type combination
public type RoleAssignment record {
    string projectId;
    EnvironmentType environmentType;
    PrivilegeLevel privilegeLevel;
};

// Request body for updating user roles and permissions
public type UpdateUserRolesRequest record {
    RoleAssignment[] roles;
    boolean? isProjectAuthor?; // Optional: only super admins can update this
};

// Input type for updating user profile (display name)
public type UpdateProfileRequest record {
    string displayName;
};

// Input type for changing password
public type ChangePasswordRequest record {
    string userId?;
    string currentPassword;
    string newPassword;
};

// === Project Creation Eligibility ===

public type ProjectCreationEligibility record {
    boolean isProjectCreationAllowed;
};

// === Project Handler Availability ===

public type ProjectHandlerAvailability record {
    boolean handlerUnique;
    string? alternateHandlerCandidate;
};

// === Missing Types for API Functionality ===

public type ComponentDeployment record {
    string environmentId;
    int configCount;
    string? apiId?;
    string releaseId;
    ApiRevision? apiRevision?;
    BuildInfo build;
    string imageUrl;
    string invokeUrl;
    string versionId;
    string deploymentStatus;
    string deploymentStatusV2;
    string? version?;
    string? cron?;
    string? cronTimezone?;
};

public type ApiRevision record {
    string id;
    string displayName;
};

public type BuildInfo record {
    string buildId;
    string? deployedAt?;
    CommitInfo? 'commit?;
    SourceConfigMigrationStatus? sourceConfigMigrationStatus?;
    string runId;
};

public type CommitInfo record {
    AuthorInfo author;
    string sha;
    string message;
    boolean isLatest;
};

public type AuthorInfo record {
    string name;
    string date;
    string email;
    string avatarUrl;
};

public type SourceConfigMigrationStatus record {
    boolean canMigrate;
    string existingFileName;
    string existingFileSchemaVersion;
};

public type DeleteResponse record {
    string status;
    string details;
};

public type DeleteComponentV2Response record {
    string status;
    boolean canDelete;
    string message;
    string encodedData;
};

// Available artifact types for a component
public type ArtifactTypeCount record {|
    ArtifactType artifactType;
    int artifactCount;
|};
