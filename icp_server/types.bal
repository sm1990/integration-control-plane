import ballerina/graphql;
import icp_server.types as types;

type schema_graphql service object {
    *graphql:Service;
    # Runtime Queries
    # + return - List of runtimes
    isolated resource function get runtimes(string? status, string? runtimeType, string? environmentId, string? projectId, string? componentId) returns Runtime[];
    # + runtimeId - Runtime identifier
    # + return - Runtime details or nil
    isolated resource function get runtime(string runtimeId) returns Runtime?;
    # + runtimeId - Runtime identifier
    # + return - List of services
    isolated resource function get services(string runtimeId) returns Service[];
    # + runtimeId - Runtime identifier
    # + return - List of listeners
    isolated resource function get listeners(string runtimeId) returns Listener[];
    # Environment Queries
    # + return - List of environments
    isolated resource function get environments(string? orgUuid, string? 'type, string? projectId) returns Environment[];
    # + return - List of admin environments
    isolated resource function get adminEnvironments() returns Environment[];
    # Project Queries
    # + return - List of projects
    isolated resource function get projects(int? orgId) returns Project[];
    # + return - List of admin projects
    isolated resource function get adminProjects() returns Project[];
    # + return - Project details or nil
    isolated resource function get project(int? orgId, string projectId) returns Project?;
    isolated resource function get projectCreationEligibility(int orgId, string orgHandler) returns ProjectCreationEligibility;
    isolated resource function get projectHandlerAvailability(int orgId, string projectHandlerCandidate) returns ProjectHandlerAvailability;
    # Component Queries
    # + return - List of components
    isolated resource function get components(string orgHandler, string? projectId, ComponentOptionsInput? options) returns Component[];
    isolated resource function get component(string? componentId, string? projectId, string? componentHandler) returns Component?;
    isolated resource function get componentDeployment(string orgHandler, string orgUuid, string componentId, string versionId, string environmentId) returns ComponentDeployment?;
    # Runtime Mutations
    # + runtimeId - Runtime identifier
    # + return - Success status
    remote function deleteRuntime(string runtimeId) returns boolean;
    # Environment Mutations
    # + environment - Environment input
    # + return - Created environment or nil
    remote function createEnvironment(EnvironmentInput environment) returns Environment?;
    remote function deleteEnvironment(string environmentId) returns boolean;
    remote function updateEnvironment(string environmentId, string? name, string? description) returns Environment?;
    remote function updateEnvironmentProductionStatus(string environmentId, boolean isProduction) returns Environment?;
    # Project Mutations
    # + project - Project input
    # + return - Created project or nil
    remote function createProject(ProjectInput project) returns Project?;
    remote function deleteProject(int orgId, string projectId) returns DeleteResponse;
    # + project - Project update input
    # + return - Updated project or nil
    remote function updateProject(ProjectUpdateInput project) returns Project?;
    # Component Mutations
    # + component - Component input
    # + return - Created component or nil
    remote function createComponent(ComponentInput component) returns Component?;
    remote function deleteComponent(string componentId) returns boolean;
    remote function deleteComponentV2(string orgHandler, string componentId, string projectId) returns DeleteComponentV2Response;
    # + componentId - Component identifier
    # + name - Component name
    # + description - Component description
    # + component - Component update input
    # + return - Updated component
    remote function updateComponent(string? componentId, string? name, string? description, ComponentUpdateInput? component) returns Component;
};

# ============================================
# Input Types for Queries
# ============================================
# Component Filter Input
public type ComponentFilterInput record {|
    # Include system components in results
    boolean? withSystemComponents;
    # Filter by display type
    string? displayType;
    # Filter by status
    string? status;
    # Filter by component sub type
    string? componentSubType;
|};

# Component Input
public type ComponentInput record {|
    # Required Fields
    # Project identifier
    string projectId;
    # Component name
    string name;
    # Recommended Fields
    # Display name
    string? displayName;
    # Component description
    string? description;
    # Organization Context (optional - can derive from projectId)
    # Organization ID
    int? orgId;
    # Organization handler
    string? orgHandler;
    # Component Classification (optional - can have defaults)
    # Component type (runtime type)
    types:RuntimeType? componentType;
    # Technology stack
    string? technology;
    # Repository Integration (optional - for future use)
    # Repository name
    string? repository;
    # Branch name
    string? branch;
    # Directory path
    string? directoryPath;
    # Secret reference
    string? secretRef;
    # Is public repository
    boolean? isPublicRepo;
|};

# Component Options Input
public type ComponentOptionsInput record {|
    # Filter options
    ComponentFilterInput? filter;
    # Sort options
    ComponentSortInput? sort;
    # Pagination options
    PaginationInput? pagination;
|};

# Component Sort Input
public type ComponentSortInput record {|
    # Field to sort by
    string sortField;
    # Sort order (asc/desc)
    string sortOrder;
|};

# Component Update Input
public type ComponentUpdateInput record {|
    # Required field - component ID to update
    string id;
    # Basic fields that can be updated
    # Component name
    string? name;
    # Display name
    string? displayName;
    # Component description
    string? description;
    # Component type (runtime type)
    types:RuntimeType? componentType;
    # Version
    string? version;
    # Labels
    string? labels;
    # Service access mode
    string? serviceAccessMode;
    # Extended fields (accepted for compatibility but may not be persisted)
    # API identifier
    string? apiId;
    # HTTP based flag
    boolean? httpBased;
    # Migration completed flag
    boolean? isMigrationCompleted;
    # Skip deploy flag
    boolean? skipDeploy;
    # Endpoint short URL enabled
    boolean? endpointShortUrlEnabled;
    # Unified config mapping flag
    boolean? isUnifiedConfigMapping;
    # Component sub type
    string? componentSubType;
|};

# ============================================
# Input Types for Mutations
# ============================================
# Environment Input
public type EnvironmentInput record {|
    # Environment name
    string name;
    # Environment description
    string? description;
    # Is production environment
    boolean? isProduction;
|};

# Pagination Input
public type PaginationInput record {|
    # Limit number of results
    int? 'limit;
    # Offset for pagination
    int? offset;
    # Cursor for pagination
    string? cursor;
|};

# Project Input
public type ProjectInput record {|
    # Organization ID
    int orgId;
    # Organization handler
    string orgHandler;
    # Project name
    string name;
    # Project version
    string? version;
    # Project handler
    string projectHandler;
    # Handler
    string? handler;
    # Region
    string? region;
    # Project description
    string? description;
    # Default deployment pipeline ID
    string? defaultDeploymentPipelineId;
    # Deployment pipeline IDs
    string[]? deploymentPipelineIds;
    # Project type
    string? 'type;
    # Git provider
    string? gitProvider;
    # Git organization
    string? gitOrganization;
    # Repository name
    string? repository;
    # Branch name
    string? branch;
    # Secret reference
    string? secretRef;
|};

# Project Update Input
public type ProjectUpdateInput record {|
    # Project identifier
    string id;
    # Organization ID
    int? orgId;
    # Project name
    string? name;
    # Project version
    string? version;
    # Project description
    string? description;
|};

# ============================================
# ArtifactState Enum - Artifact Status
# ============================================
public enum ArtifactState {
    FAILED,
    STOPPING,
    STARTING,
    DISABLED,
    ENABLED
}

# ============================================
# API Revision Type
# ============================================
public isolated distinct service class ApiRevision {
    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get displayName() returns string {
    
        return "";
    }
}

# ============================================
# API Version Type - API Management
# ============================================
public isolated distinct service class ApiVersion {
    # Identity
    # + return - API version identifier
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - API version number
    isolated resource function get apiVersion() returns string {
    
        return "";
    }

    # + return - Version identifier or nil
    isolated resource function get versionId() returns string? {
    
        return ();
    }

    # Proxy Configuration
    # + return - Proxy name or nil
    isolated resource function get proxyName() returns string? {
    
        return ();
    }

    # + return - Proxy URL or nil
    isolated resource function get proxyUrl() returns string? {
    
        return ();
    }

    # + return - Proxy identifier or nil
    isolated resource function get proxyId() returns string? {
    
        return ();
    }

    # State Management
    # + return - State
    isolated resource function get state() returns string {
    
        return "";
    }

    # + return - Boolean value
    isolated resource function get latest() returns boolean {
    
        return false;
    }

    # Git Integration
    # + return - Branch name or nil
    isolated resource function get branch() returns string? {
    
        return ();
    }

    # Access Control
    # + return - Accessibility setting or nil
    isolated resource function get accessibility() returns string? {
    
        return ();
    }

    # Deployment Settings
    # + return - Value or nil
    isolated resource function get autoDeployEnabled() returns boolean? {
    
        return ();
    }

    # Environment Versions
    # + return - Value or nil
    isolated resource function get appEnvVersions() returns AppEnvVersion[]? {
    
        return ();
    }

    # Observability
    # + return - Value or nil
    isolated resource function get cellDiagram() returns CellDiagram? {
    
        return ();
    }

    # API Specification
    # + return - Value or nil
    isolated resource function get openApiSpec() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get graphqlSchema() returns string? {
    
        return ();
    }

    # Metadata
    # + return - Value or nil
    isolated resource function get createdAt() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedAt() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }
}

# ============================================
# App Environment Version Type
# ============================================
public isolated distinct service class AppEnvVersion {
    # + return - Value
    isolated resource function get environmentId() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get releaseId() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get release() returns Release? {
    
        return ();
    }
}

# ============================================
# Artifacts Type - Runtime Artifacts Container
# ============================================
public isolated distinct service class Artifacts {
    # + return - Array of values
    isolated resource function get listeners() returns Listener[] {
    
        return [];
    }

    # + return - Array of values
    isolated resource function get services() returns Service[] {
    
        return [];
    }
}

# ============================================
# Author Info Type - Commit Author Information
# ============================================
public isolated distinct service class AuthorInfo {
    # + return - Value
    isolated resource function get name() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get date() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get email() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get avatarUrl() returns string {
    
        return "";
    }
}

# ============================================
# Build Info Type - Build Information
# ============================================
public isolated distinct service class BuildInfo {
    # + return - Value
    isolated resource function get buildId() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get deployedAt() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get 'commit() returns CommitInfo? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get sourceConfigMigrationStatus() returns SourceConfigMigrationStatus? {
    
        return ();
    }

    # + return - Value
    isolated resource function get runId() returns string {
    
        return "";
    }
}

public isolated distinct service class Buildpack {
    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get name() returns string? {
    
        return ();
    }

    # + return - Value
    isolated resource function get language() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get version() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }
}

# ============================================
# Buildpack Configuration
# ============================================
public isolated distinct service class BuildpackConfig {
    # + return - Value or nil
    isolated resource function get versionId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get buildContext() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get languageVersion() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get buildCommand() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get runCommand() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get isUnitTestEnabled() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get pullLatestSubmodules() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get enableTrivyScan() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get buildpack() returns Buildpack? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get keyValues() returns KeyValue[]? {
    
        return ();
    }
}

# ============================================
# BYOC Build Configuration
# ============================================
public isolated distinct service class ByocBuildConfig {
    # + return - Value or nil
    isolated resource function get id() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get isMainContainer() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get containerId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get componentId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get repositoryId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dockerContext() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dockerfilePath() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get oasFilePath() returns string? {
    
        return ();
    }
}

# ============================================
# BYOC Web App Build Configuration
# ============================================
public isolated distinct service class ByocWebAppBuildConfig {
    # + return - Value or nil
    isolated resource function get id() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get containerId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get componentId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get repositoryId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dockerContext() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get webAppType() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get port() returns int? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get imageUrl() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get registryId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dockerfile() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get buildCommand() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get packageManagerVersion() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get outputDirectory() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get enableTrivyScan() returns boolean? {
    
        return ();
    }
}

# ============================================
# Cell Diagram - Observability & Architecture View
# ============================================
public isolated distinct service class CellDiagram {
    # + return - Value or nil
    isolated resource function get data() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get message() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get errorName() returns string? {
    
        return ();
    }

    # + return - Boolean value
    isolated resource function get success() returns boolean {
    
        return false;
    }
}

# ============================================
# Commit Info Type - Git Commit Information
# ============================================
public isolated distinct service class CommitInfo {
    # + return - Value
    isolated resource function get author() returns AuthorInfo {
        // Return a dummy AuthorInfo object
        return new AuthorInfo();
    }

    # + return - Value
    isolated resource function get sha() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get message() returns string {
    
        return "";
    }

    # + return - Boolean value
    isolated resource function get isLatest() returns boolean {
    
        return false;
    }
}

# ============================================
# Component Type - Application Component
# ============================================
public isolated distinct service class Component {
    # Basic Identity Fields
    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get projectId() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get orgHandler() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get orgId() returns int? {
    
        return ();
    }

    # Component Metadata
    # + return - Value
    isolated resource function get name() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get handler() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get displayName() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get displayType() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get ownerName() returns string? {
    
        return ();
    }

    # Status Fields
    # + return - Value
    isolated resource function get status() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get initStatus() returns string? {
    
        return ();
    }

    # Version & Timestamps
    # + return - Value
    isolated resource function get version() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get createdAt() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get lastBuildDate() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedAt() returns string? {
    
        return ();
    }

    # Classification
    # + return - Value or nil
    isolated resource function get componentSubType() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get componentType() returns types:RuntimeType? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get labels() returns string? {
        return "";
    }

    # System Component Flag
    # + return - Value or nil
    isolated resource function get isSystemComponent() returns boolean? {
        return ();
    }

    # Component Configuration Flags
    # + return - Value or nil
    isolated resource function get apiId() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get httpBased() returns boolean? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get isMigrationCompleted() returns boolean? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get skipDeploy() returns boolean? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get endpointShortUrlEnabled() returns boolean? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get isUnifiedConfigMapping() returns boolean? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get serviceAccessMode() returns string? {
        return ();
    }

    # Nested Objects
    # + return - Value or nil
    isolated resource function get repository() returns Repository? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get apiVersions() returns ApiVersion[]? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get deploymentTracks() returns DeploymentTrack[]? {
        return ();
    }

    # Git Integration (for components with source control)
    # + return - Value or nil
    isolated resource function get gitProvider() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get gitOrganization() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get gitRepository() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get branch() returns string? {
        return ();
    }

    # Advanced Fields (used in specific views)
    # + return - Value or nil
    isolated resource function get endpoints() returns Endpoint[]? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get environmentVariables() returns EnvironmentVariable[]? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get secrets() returns Secret[]? {
        return ();
    }

    # Legacy fields for backward compatibility
    # + return - Value or nil
    isolated resource function get createdBy() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedBy() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get componentId() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get project() returns Project? {
        return ();
    }
}

# ============================================
# Component Deployment Type - Deployment Information
# ============================================
public isolated distinct service class ComponentDeployment {
    # + return - Value
    isolated resource function get environmentId() returns string {
    
        return "";
    }

    # + return - Integer value
    isolated resource function get configCount() returns int {
    
        return 0;
    }

    # + return - Value or nil
    isolated resource function get apiId() returns string? {
    
        return ();
    }

    # + return - Value
    isolated resource function get releaseId() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get apiRevision() returns ApiRevision? {
    
        return ();
    }

    # + return - Value
    isolated resource function get build() returns BuildInfo {
        // Return a dummy BuildInfo object  
        return new BuildInfo();
    }

    # + return - Value
    isolated resource function get imageUrl() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get invokeUrl() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get versionId() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get deploymentStatus() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get deploymentStatusV2() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get version() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get cron() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get cronTimezone() returns string? {
    
        return ();
    }
}

# ============================================
# Delete Component V2 Response Type
# ============================================
public isolated distinct service class DeleteComponentV2Response {
    # + return - Value
    isolated resource function get status() returns string {
    
        return "";
    }

    # + return - Boolean value
    isolated resource function get canDelete() returns boolean {
    
        return false;
    }

    # + return - Value
    isolated resource function get message() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get encodedData() returns string {
    
        return "";
    }
}

# ============================================
# Delete Response Type
# ============================================
public isolated distinct service class DeleteResponse {
    # + return - Value
    isolated resource function get status() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get details() returns string {
    
        return "";
    }
}

# ============================================
# Deployment Track Type - CI/CD Configuration
# ============================================
public isolated distinct service class DeploymentTrack {
    # Identity
    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get componentId() returns string {
    
        return "";
    }

    # Timestamps
    # + return - Value
    isolated resource function get createdAt() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get updatedAt() returns string {
    
        return "";
    }

    # Version Configuration
    # + return - Value
    isolated resource function get apiVersion() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get branch() returns string? {
    
        return ();
    }

    # + return - Boolean value
    isolated resource function get latest() returns boolean {
    
        return false;
    }

    # + return - Value or nil
    isolated resource function get versionStrategy() returns string? {
    
        return ();
    }

    # Deployment Settings
    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get autoDeployEnabled() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get autoBuildEnabled() returns boolean? {
    
        return ();
    }

    # Environment Settings
    # + return - Value or nil
    isolated resource function get environmentName() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get environmentId() returns string? {
    
        return ();
    }

    # Deployment Status
    # + return - Value or nil
    isolated resource function get deploymentStatus() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get lastDeployedAt() returns string? {
    
        return ();
    }
}

# ============================================
# Docker Build Configuration
# ============================================
public isolated distinct service class DockerBuildConfig {
    # + return - Value or nil
    isolated resource function get id() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dockerContext() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dockerfile() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get port() returns int? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get imageUrl() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get registryId() returns string? {
    
        return ();
    }
}

# ============================================
# Endpoint Type - Service Endpoints
# ============================================
public isolated distinct service class Endpoint {
    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get componentId() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get name() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get url() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get 'type() returns string {
        return "";
    }

    # + return - Value or nil
    isolated resource function get protocol() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get port() returns int? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get visibility() returns string? {
    
        return ();
    }
}

# ============================================
# Environment Type - Deployment Environment
# ============================================
public isolated distinct service class Environment {
    # Core Identity
    # + return - Value
    isolated resource function get environmentId() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get name() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }

    # + return - Boolean value
    isolated resource function get isProduction() returns boolean {
    
        return false;
    }

    # Choreo Environment Configuration
    # + return - Value or nil
    isolated resource function get choreoEnv() returns string? {
    
        return ();
    }

    # Virtual Host Configuration
    # + return - Value or nil
    isolated resource function get vhost() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get sandboxVhost() returns string? {
    
        return ();
    }

    # API Management
    # + return - Value or nil
    isolated resource function get apiEnvName() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get apimEnvId() returns string? {
    
        return ();
    }

    # Migration & Deployment
    # + return - Value or nil
    isolated resource function get isMigrating() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get promoteFrom() returns string? {
    
        return ();
    }

    # Infrastructure
    # + return - Value or nil
    isolated resource function get namespace() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dpId() returns string? {
    
        return ();
    }

    # + return - Value
    isolated resource function get templateId() returns string {
    
        return "";
    }

    # Features & Flags
    # + return - Value or nil
    isolated resource function get critical() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get isPdp() returns boolean? {
    
        return ();
    }

    # + return - Boolean value
    isolated resource function get scaleToZeroEnabled() returns boolean {
    
        return false;
    }

    # Audit Fields
    # + return - Value or nil
    isolated resource function get createdAt() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedAt() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedBy() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get createdBy() returns string? {
    
        return ();
    }
}

# ============================================
# Environment Variable Type
# ============================================
public isolated distinct service class EnvironmentVariable {
    # + return - Value
    isolated resource function get key() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get value() returns string? {
    
        return ();
    }

    # + return - Boolean value
    isolated resource function get isSecret() returns boolean {
    
        return false;
    }

    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }
}

# ============================================
# Key Value Pair
# ============================================
public isolated distinct service class KeyValue {
    # + return - Value or nil
    isolated resource function get id() returns string? {
    
        return ();
    }

    # + return - Value
    isolated resource function get key() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get value() returns string? {
    
        return ();
    }
}

# ============================================
# Listener Type - Listener Artifacts
# ============================================
public isolated distinct service class Listener {
    # + return - Value
    isolated resource function get name() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get package() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get protocol() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get state() returns ArtifactState {
        return ENABLED;
    }
}

# ============================================
# Project Type - Project Details
# ============================================
public isolated distinct service class Project {
    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get projectId() returns string {
    
        return "";
    }

    # + return - Integer value
    isolated resource function get orgId() returns int {
    
        return 0;
    }

    # + return - Value
    isolated resource function get name() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get version() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get createdDate() returns string? {
    
        return ();
    }

    # + return - Value
    isolated resource function get handler() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get extendedHandler() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get region() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get owner() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get labels() returns string[]? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get defaultDeploymentPipelineId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get deploymentPipelineIds() returns string[]? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get 'type() returns string? {
        return ();
    }

    # + return - Value or nil
    isolated resource function get gitProvider() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get gitOrganization() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get repository() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get branch() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get secretRef() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get createdBy() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedAt() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedBy() returns string? {
    
        return ();
    }
}

# ============================================
# Project Creation Eligibility Type
# ============================================
public isolated distinct service class ProjectCreationEligibility {
    # + return - Boolean value
    isolated resource function get isProjectCreationAllowed() returns boolean {
    
        return false;
    }
}

# ============================================
# Project Handler Availability Type
# ============================================
public isolated distinct service class ProjectHandlerAvailability {
    # + return - Boolean value
    isolated resource function get handlerUnique() returns boolean {
    
        return false;
    }

    # + return - Value or nil
    isolated resource function get alternateHandlerCandidate() returns string? {
    
        return ();
    }
}

public isolated distinct service class Release {
    # + return - Value
    isolated resource function get id() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get metadata() returns ReleaseMetadata? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get environmentId() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get environment() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get gitHash() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get gitOpsHash() returns string? {
    
        return ();
    }
}

public isolated distinct service class ReleaseMetadata {
    # + return - Value or nil
    isolated resource function get choreoEnv() returns string? {
    
        return ();
    }
}

# ============================================
# Repository Type - Build & Deploy Configuration
# ============================================
public isolated distinct service class Repository {
    # Build Configurations
    # + return - Value or nil
    isolated resource function get buildpackConfig() returns BuildpackConfig? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get byocWebAppBuildConfig() returns ByocWebAppBuildConfig? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get byocBuildConfig() returns ByocBuildConfig? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get dockerBuildConfig() returns DockerBuildConfig? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get testRunnerConfig() returns TestRunnerConfig? {
    
        return ();
    }

    # Repository Source Information
    # + return - Value or nil
    isolated resource function get repositoryType() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get repositoryBranch() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get repositorySubPath() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get repositoryUrl() returns string? {
    
        return ();
    }

    # Git Provider Information
    # + return - Value or nil
    isolated resource function get bitbucketServerUrl() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get serverUrl() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get gitProvider() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get nameApp() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get nameConfig() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get branch() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get branchApp() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get organizationApp() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get organizationConfig() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get appSubPath() returns string? {
    
        return ();
    }

    # Repository Flags
    # + return - Value or nil
    isolated resource function get isUserManage() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get isAuthorizedRepo() returns boolean? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get isBuildConfigurationMigrated() returns boolean? {
    
        return ();
    }
}

# ============================================
# Resource Type - Service Resources
# ============================================
public isolated distinct service class Resource {
    # + return - Array of values
    isolated resource function get methods() returns string[] {
        return [];
    }

    # + return - Value
    isolated resource function get url() returns string {
    
        return "";
    }
}

# ============================================
# Runtime Type - Runtime Instance Details
# ============================================
public isolated distinct service class Runtime {
    # + return - Value
    isolated resource function get runtimeId() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get runtimeType() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get status() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get version() returns string? {
    
        return ();
    }

    # + return - Value
    isolated resource function get component() returns Component {
        return new Component();
    }

    # + return - Value
    isolated resource function get environment() returns Environment {
        return new Environment();
    }

    # + return - Value or nil
    isolated resource function get platformName() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get platformVersion() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get platformHome() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get osName() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get osVersion() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get registrationTime() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get lastHeartbeat() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get artifacts() returns Artifacts? {
    
        return ();
    }
}

# ============================================
# Secret Type
# ============================================
public isolated distinct service class Secret {
    # + return - Value
    isolated resource function get key() returns string {
    
        return "";
    }

    # + return - Value or nil
    isolated resource function get description() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get createdAt() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get updatedAt() returns string? {
    
        return ();
    }
}

# ============================================
# Service Type - Service Artifacts
# ============================================
public isolated distinct service class Service {
    # + return - Value
    isolated resource function get name() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get package() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get basePath() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get state() returns ArtifactState {
        return ENABLED;
    }

    # + return - Array of values
    isolated resource function get resources() returns Resource[] {
    
        return [];
    }
}

# ============================================
# Source Config Migration Status Type
# ============================================
public isolated distinct service class SourceConfigMigrationStatus {
    # + return - Boolean value
    isolated resource function get canMigrate() returns boolean {
    
        return false;
    }

    # + return - Value
    isolated resource function get existingFileName() returns string {
    
        return "";
    }

    # + return - Value
    isolated resource function get existingFileSchemaVersion() returns string {
    
        return "";
    }
}

# ============================================
# Test Runner Configuration
# ============================================
public isolated distinct service class TestRunnerConfig {
    # + return - Value or nil
    isolated resource function get dockerContext() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get postmanDirectory() returns string? {
    
        return ();
    }

    # + return - Value or nil
    isolated resource function get testRunnerType() returns string? {
    
        return ();
    }
}
