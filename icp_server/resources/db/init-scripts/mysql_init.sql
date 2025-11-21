-- ============================================================================
-- ICP Server MySQL Database Schema (Full Rewrite, MySQL 8.0+)
-- ============================================================================

DROP DATABASE IF EXISTS icp_database;

CREATE DATABASE icp_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE icp_database;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

CREATE TABLE organizations (
    org_id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    org_name VARCHAR(255) NOT NULL UNIQUE,
    org_handle VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_handle (org_handle)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- USER MANAGEMENT & AUTHZ
-- ============================================================================

CREATE TABLE users (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_project_author BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_super_admin (is_super_admin),
    INDEX idx_project_author (is_project_author)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- REFRESH TOKENS (for authentication session management)
-- ============================================================================

CREATE TABLE refresh_tokens (
    token_id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA256 hash of token
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP NULL,
    user_agent VARCHAR(500) NULL,
    ip_address VARCHAR(50) NULL,
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at),
    INDEX idx_revoked (revoked)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- PROJECTS / COMPONENTS / ENVIRONMENTS
-- ============================================================================

CREATE TABLE projects (
    project_id CHAR(36) PRIMARY KEY,
    org_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NULL DEFAULT '1.0.0',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    handler VARCHAR(200) NOT NULL,
    region VARCHAR(100) NULL,
    description TEXT,
    default_deployment_pipeline_id CHAR(36) NULL,
    deployment_pipeline_ids JSON NULL,
    type VARCHAR(50) NULL,
    git_provider VARCHAR(50) NULL,
    git_organization VARCHAR(200) NULL,
    repository VARCHAR(200) NULL,
    branch VARCHAR(100) NULL,
    secret_ref VARCHAR(200) NULL,
    owner_id CHAR(36) NULL, -- User ID of the project owner
    created_by VARCHAR(200) NULL, -- Display name of who created the project
    updated_by VARCHAR(200) NULL, -- Display name of who last updated the project
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_projects_org FOREIGN KEY (org_id) REFERENCES organizations (org_id) ON DELETE RESTRICT,
    UNIQUE KEY uk_project_name_org (org_id, name), -- Allow same name in different orgs
    INDEX idx_owner_id (owner_id),
    INDEX idx_org_id (org_id),
    INDEX idx_handler (
        handler
    )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Components belong to projects; users create components.
CREATE TABLE components (
    component_id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    component_type ENUM('MI', 'BI') NOT NULL DEFAULT 'BI',
    created_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(36) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_components_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    CONSTRAINT fk_components_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_components_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL,
    -- Prevent duplicate component names within the same project
    UNIQUE KEY uk_component_project_name (project_id, name),
    INDEX idx_project_id (project_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE environments (
    environment_id CHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE, -- e.g., dev, stage, prod
    description TEXT NULL,
    region VARCHAR(100) NULL,
    cluster_id VARCHAR(200) NULL,
    choreo_env VARCHAR(50) NULL,
    external_apim_env_name VARCHAR(200) NULL,
    internal_apim_env_name VARCHAR(200) NULL,
    sandbox_apim_env_name VARCHAR(200) NULL,
    critical BOOLEAN NOT NULL DEFAULT FALSE,
    dns_prefix VARCHAR(100) NULL,
    created_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(36) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_environments_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_environments_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- ROLES & USER ROLES (moved after projects/environments)
-- ============================================================================

CREATE TABLE roles (
    role_id CHAR(36) NOT NULL PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    environment_type ENUM('prod', 'non-prod') NOT NULL,
    privilege_level ENUM('admin', 'developer') NOT NULL,
    role_name VARCHAR(200) NOT NULL UNIQUE, -- Format: <project_name>:<env_type>:<privilege_level>
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_roles_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    UNIQUE KEY uk_role_project_env_type_priv (
        project_id,
        environment_type,
        privilege_level
    ),
    INDEX idx_role_name (role_name),
    INDEX idx_project_id (project_id),
    INDEX idx_environment_type (environment_type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE user_roles (
    user_id CHAR(36) NOT NULL,
    role_id CHAR(36) NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by CHAR(36) NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- RUNTIMES & ARTIFACTS
-- ============================================================================

CREATE TABLE runtimes (
    runtime_id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    project_id CHAR(36) NOT NULL,
    component_id CHAR(36) NOT NULL,
    environment_id CHAR(36) NOT NULL,
    runtime_type ENUM('MI', 'BI') NOT NULL,
    status ENUM(
        'RUNNING',
        'FAILED',
        'DISABLED',
        'OFFLINE'
    ) NOT NULL DEFAULT 'OFFLINE',
    version VARCHAR(50) NULL,
    platform_name VARCHAR(50) NOT NULL DEFAULT 'ballerina',
    platform_version VARCHAR(50) NULL,
    platform_home VARCHAR(255) NULL,
    os_name VARCHAR(50) NULL,
    os_version VARCHAR(50) NULL,
    registration_time TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_heartbeat TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    CONSTRAINT fk_runtime_component FOREIGN KEY (component_id) REFERENCES components (component_id) ON DELETE CASCADE,
    CONSTRAINT fk_runtime_env FOREIGN KEY (environment_id) REFERENCES environments (environment_id) ON DELETE CASCADE,
    INDEX idx_runtime_type (runtime_type),
    INDEX idx_status (status),
    INDEX idx_env (environment_id),
    INDEX idx_component (component_id),
    INDEX idx_project (project_id),
    INDEX idx_last_heartbeat (last_heartbeat),
    INDEX idx_registration_time (registration_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Services deployed on a runtime
CREATE TABLE runtime_services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_package VARCHAR(200) NOT NULL,
    base_path VARCHAR(500) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_services_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_service (
        runtime_id,
        service_name,
        service_package
    ),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_service_name (service_name),
    INDEX idx_service_package (service_package),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Resources inside a service (HTTP resources etc.)
CREATE TABLE service_resources (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  runtime_id    CHAR(36) NOT NULL,
  service_name  VARCHAR(100) NOT NULL,
  resource_url  VARCHAR(1000) NOT NULL,
  methods       JSON NOT NULL,  -- Array of HTTP methods

-- Generated column for indexing first method (example pattern)


method_first  VARCHAR(20)
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(methods, '$[0]'))) STORED,

  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_service_resources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE CASCADE,

  INDEX idx_runtime_service (runtime_id, service_name),
  INDEX idx_resource_url (resource_url(255)),
  INDEX idx_method_first (method_first)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Listeners bound to a runtime (e.g., HTTP/HTTPS)
CREATE TABLE runtime_listeners (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    listener_name VARCHAR(100) NOT NULL,
    listener_package VARCHAR(200) NOT NULL,
    protocol VARCHAR(20) NULL DEFAULT 'HTTP',
    listener_host VARCHAR(100),
    listener_port INT,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_listeners_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_listener (
        runtime_id,
        listener_name,
        listener_package,
        listener_host,
        listener_port
    ),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_listener_name (listener_name),
    INDEX idx_protocol (protocol),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- MI-SPECIFIC ARTIFACT TABLES
-- ============================================================================

-- REST APIs (MI)
CREATE TABLE runtime_apis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    api_name VARCHAR(200) NOT NULL,
    url VARCHAR(500) NOT NULL,
    context VARCHAR(500) NOT NULL,
    version VARCHAR(50) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_apis_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_api (runtime_id, api_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_api_name (api_name),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- API Resources (MI) - Resources inside an API
CREATE TABLE runtime_api_resources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    api_name VARCHAR(200) NOT NULL,
    resource_path VARCHAR(1000) NOT NULL,
    methods VARCHAR(20) NOT NULL,  -- Single HTTP method as string (e.g., "POST", "GET")
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_api_resources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    INDEX idx_runtime_api (runtime_id, api_name),
    INDEX idx_resource_path (resource_path(255)),
    INDEX idx_methods (methods)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Proxy Services (MI)
CREATE TABLE runtime_proxy_services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    proxy_name VARCHAR(200) NOT NULL,
    wsdl TEXT NULL,
    transports JSON NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_proxy_services_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_proxy_service (runtime_id, proxy_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_proxy_name (proxy_name),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Endpoints (MI)
CREATE TABLE runtime_endpoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    endpoint_name VARCHAR(200) NOT NULL,
    endpoint_type VARCHAR(100) NOT NULL,
    address VARCHAR(500) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_endpoints_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_endpoint (runtime_id, endpoint_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_endpoint_name (endpoint_name),
    INDEX idx_endpoint_type (endpoint_type),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Inbound Endpoints (MI)
CREATE TABLE runtime_inbound_endpoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    inbound_name VARCHAR(200) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    sequence VARCHAR(200) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_inbound_endpoints_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_inbound_endpoint (runtime_id, inbound_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_inbound_name (inbound_name),
    INDEX idx_protocol (protocol),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Sequences (MI)
CREATE TABLE runtime_sequences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    sequence_name VARCHAR(200) NOT NULL,
    sequence_type VARCHAR(100) NULL,
    container VARCHAR(200) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_sequences_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_sequence (runtime_id, sequence_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_sequence_name (sequence_name),
    INDEX idx_sequence_type (sequence_type),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Tasks (MI)
CREATE TABLE runtime_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_class VARCHAR(500) NULL,
    task_group VARCHAR(200) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_tasks_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_task (runtime_id, task_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_task_name (task_name),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Templates (MI)
CREATE TABLE runtime_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_templates_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_template (runtime_id, template_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_template_name (template_name),
    INDEX idx_template_type (template_type),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Message Stores (MI)
CREATE TABLE runtime_message_stores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    store_name VARCHAR(200) NOT NULL,
    store_type VARCHAR(100) NOT NULL,
    store_class VARCHAR(500) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_message_stores_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_message_store (runtime_id, store_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_store_name (store_name),
    INDEX idx_store_type (store_type),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Message Processors (MI)
CREATE TABLE runtime_message_processors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    processor_name VARCHAR(200) NOT NULL,
    processor_type VARCHAR(100) NOT NULL,
    processor_class VARCHAR(500) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_message_processors_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_message_processor (runtime_id, processor_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_processor_name (processor_name),
    INDEX idx_processor_type (processor_type),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Local Entries (MI)
CREATE TABLE runtime_local_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    entry_name VARCHAR(200) NOT NULL,
    entry_type VARCHAR(100) NOT NULL,
    entry_value TEXT NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_local_entries_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_local_entry (runtime_id, entry_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_entry_name (entry_name),
    INDEX idx_entry_type (entry_type),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Data Services (MI)
CREATE TABLE runtime_data_services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    service_name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    wsdl TEXT NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_data_services_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_data_service (runtime_id, service_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_service_name (service_name),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Carbon Apps (MI)
CREATE TABLE runtime_carbon_apps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    app_name VARCHAR(200) NOT NULL,
    version VARCHAR(50) NULL,
    state ENUM(
        'Active',
        'Faulty'
    ) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_carbon_apps_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_carbon_app (runtime_id, app_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_app_name (app_name),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Data Sources (MI)
CREATE TABLE runtime_data_sources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    datasource_name VARCHAR(200) NOT NULL,
    driver VARCHAR(500) NULL,
    url VARCHAR(1000) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_data_sources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_data_source (runtime_id, datasource_name),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_datasource_name (datasource_name),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Connectors (MI)
CREATE TABLE runtime_connectors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    connector_name VARCHAR(200) NOT NULL,
    package VARCHAR(200) NOT NULL,
    version VARCHAR(50) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_connectors_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_connector (
        runtime_id,
        connector_name,
        package
    ),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_connector_name (connector_name),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Registry Resources (MI)
CREATE TABLE runtime_registry_resources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    resource_name VARCHAR(200) NOT NULL,
    path VARCHAR(1000) NOT NULL,
    resource_type VARCHAR(100) NULL,
    state ENUM(
        'ENABLED',
        'DISABLED',
        'STARTING',
        'STOPPING',
        'FAILED'
    ) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_registry_resources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_registry_resource (
        runtime_id,
        resource_name,
        path (255)
    ),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_resource_name (resource_name),
    INDEX idx_resource_type (resource_type),
    INDEX idx_state (state)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- System Info (MI)
CREATE TABLE runtime_system_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    info_key VARCHAR(200) NOT NULL,
    info_value TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_system_info_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    UNIQUE KEY uk_runtime_system_info (runtime_id, info_key),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_info_key (info_key)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- CONTROL COMMANDS
-- ============================================================================

CREATE TABLE control_commands (
    command_id CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    runtime_id CHAR(36) NOT NULL,
    target_artifact VARCHAR(200) NOT NULL,
    action VARCHAR(50) NOT NULL, -- start, stop, restart, deploy, undeploy
    parameters JSON NULL,
    status ENUM(
        'pending',
        'sent',
        'acknowledged',
        'completed',
        'failed',
        'timeout'
    ) NOT NULL DEFAULT 'pending',
    issued_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    sent_at TIMESTAMP(6) NULL,
    acknowledged_at TIMESTAMP(6) NULL,
    completed_at TIMESTAMP(6) NULL,
    error_message TEXT NULL,
    issued_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_control_cmd_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT fk_control_cmd_issued_by FOREIGN KEY (issued_by) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_status (status),
    INDEX idx_issued_at (issued_at),
    INDEX idx_target_artifact (target_artifact),
    INDEX idx_action (action),
    INDEX idx_issued_by (issued_by)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- AUDIT & EVENTS
-- ============================================================================

CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NULL,
    user_id CHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NULL, -- runtime, service, listener, command
    resource_id VARCHAR(200) NULL,
    details TEXT NULL,
    client_ip VARCHAR(45) NULL, -- IPv6 compatible
    user_agent VARCHAR(500) NULL,
    timestamp TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource_type (resource_type),
    INDEX idx_timestamp (timestamp),
    INDEX idx_client_ip (client_ip)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE system_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- heartbeat_timeout, runtime_offline, system_error
    severity ENUM(
        'INFO',
        'WARN',
        'ERROR',
        'CRITICAL'
    ) NOT NULL DEFAULT 'INFO',
    source VARCHAR(100) NULL, -- runtime_id or system component
    message TEXT NOT NULL,
    metadata JSON NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sys_events_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity),
    INDEX idx_source (source),
    INDEX idx_resolved (resolved),
    INDEX idx_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- MONITORING & HEALTH
-- ============================================================================

CREATE TABLE runtime_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 4) NOT NULL,
    metric_unit VARCHAR(20) NULL,
    tags JSON NULL,
    timestamp TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_metrics_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    INDEX idx_runtime_metric (runtime_id, metric_name),
    INDEX idx_timestamp (timestamp),
    INDEX idx_metric_name (metric_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE health_checks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    check_type VARCHAR(50) NOT NULL, -- heartbeat, connectivity, resource
    status ENUM(
        'HEALTHY',
        'DEGRADED',
        'UNHEALTHY'
    ) NOT NULL,
    response_time_ms INT NULL,
    error_message TEXT NULL,
    details JSON NULL,
    timestamp TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_health_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    INDEX idx_runtime_check (runtime_id, check_type),
    INDEX idx_status (status),
    INDEX idx_timestamp (timestamp)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- SYSTEM CONFIG
-- ============================================================================

CREATE TABLE system_config (
    config_key VARCHAR(100) NOT NULL PRIMARY KEY,
    config_value TEXT NOT NULL,
    config_type ENUM(
        'STRING',
        'INTEGER',
        'BOOLEAN',
        'JSON'
    ) NOT NULL DEFAULT 'STRING',
    description TEXT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_syscfg_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_config_type (config_type),
    INDEX idx_updated_at (updated_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Active commands view
CREATE OR REPLACE VIEW active_commands AS
SELECT
    cc.*,
    r.runtime_type,
    r.status AS runtime_status,
    TIMESTAMPDIFF(SECOND, cc.issued_at, NOW(6)) AS age_seconds
FROM
    control_commands cc
    JOIN runtimes r ON cc.runtime_id = r.runtime_id
WHERE
    cc.status IN ('pending', 'sent')
ORDER BY cc.issued_at ASC;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert default organization
INSERT INTO
    organizations (org_id, org_name, org_handle)
VALUES (
        1,
        'Default Organization',
        'default'
    );

-- Insert a default admin user for testing
INSERT INTO
    users (
        user_id,
        username,
        display_name,
        is_super_admin
    )
VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        'admin',
        'System Administrator',
        TRUE
    ),
    (
        '660e8400-e29b-41d4-a716-446655440002',
        'testuser',
        'Test User for Role Management',
        FALSE
    ),
    (
        '660e8400-e29b-41d4-a716-446655440003',
        'targetuser',
        'Target User for Role Updates',
        FALSE
    );

-- Note: User credentials are stored in a separate H2 database (credentialsdb)
-- accessed only by the default auth backend. See resources/db/init-scripts/credentials_h2_init.sql

-- Insert sample project
INSERT INTO
    projects (
        project_id,
        org_id,
        name,
        version,
        handler,
        region,
        description,
        type,
        git_provider,
        git_organization,
        repository,
        branch,
        owner_id,
        created_by
    )
VALUES (
        '650e8400-e29b-41d4-a716-446655440001',
        1,
        'sample_project',
        '1.0.0',
        'admin',
        'us-west-2',
        'Sample project for testing',
        'web-application',
        'github',
        'sample-org',
        'sample-repo',
        'main',
        '550e8400-e29b-41d4-a716-446655440000',
        'System Administrator'
    ),
    (
        '650e8400-e29b-41d4-a716-446655440002',
        1,
        'sample_project_2',
        '1.1.0',
        'testuser',
        'eu-west-1',
        'Second sample project for testing',
        'api-service',
        'gitlab',
        'test-org',
        'test-repo',
        'develop',
        '550e8400-e29b-41d4-a716-446655440000',
        'System Administrator'
    );

INSERT INTO
    components (
        component_id,
        name,
        display_name,
        component_type,
        description,
        created_by,
        project_id
    )
VALUES (
        '640e8400-e29b-41d4-a716-446655440001',
        'sample_integration',
        'Sample Integration',
        'BI',
        'Sample integration for testing',
        '550e8400-e29b-41d4-a716-446655440000',
        '650e8400-e29b-41d4-a716-446655440001'
    );

-- Insert sample environments
INSERT INTO
    environments (
        environment_id,
        name,
        description,
        region,
        cluster_id,
        choreo_env,
        external_apim_env_name,
        internal_apim_env_name,
        sandbox_apim_env_name,
        critical,
        dns_prefix,
        created_by
    )
VALUES (
        '750e8400-e29b-41d4-a716-446655440001',
        'dev',
        'Development environment',
        'us-east-1',
        'cluster-abc123',
        'dev',
        'dev-external',
        'dev-internal',
        'dev-sandbox',
        FALSE,
        'dev',
        '550e8400-e29b-41d4-a716-446655440000'
    ),
    (
        '750e8400-e29b-41d4-a716-446655440002',
        'prod',
        'Production environment',
        'us-east-1',
        'cluster-abc123',
        'prod',
        'prod-external',
        'prod-internal',
        'prod-sandbox',
        TRUE,
        'prod',
        '550e8400-e29b-41d4-a716-446655440000'
    );

-- Insert sample roles with format: <project_name>:<env_type>:<privilege_level>
INSERT INTO
    roles (
        role_id,
        project_id,
        environment_type,
        privilege_level,
        role_name
    )
VALUES (
        '850e8400-e29b-41d4-a716-446655440001',
        '650e8400-e29b-41d4-a716-446655440001',
        'non-prod',
        'admin',
        'sample_project:non-prod:admin'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440002',
        '650e8400-e29b-41d4-a716-446655440001',
        'non-prod',
        'developer',
        'sample_project:non-prod:developer'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440003',
        '650e8400-e29b-41d4-a716-446655440001',
        'prod',
        'admin',
        'sample_project:prod:admin'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440004',
        '650e8400-e29b-41d4-a716-446655440001',
        'prod',
        'developer',
        'sample_project:prod:developer'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440005',
        '650e8400-e29b-41d4-a716-446655440002',
        'non-prod',
        'admin',
        'sample_project_2:non-prod:admin'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440006',
        '650e8400-e29b-41d4-a716-446655440002',
        'non-prod',
        'developer',
        'sample_project_2:non-prod:developer'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440007',
        '650e8400-e29b-41d4-a716-446655440002',
        'prod',
        'admin',
        'sample_project_2:prod:admin'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440008',
        '650e8400-e29b-41d4-a716-446655440002',
        'prod',
        'developer',
        'sample_project_2:prod:developer'
    );

-- Insert sample refresh token for admin user (for testing)
-- Token: sample_refresh_token_for_testing (hashed with SHA256)
-- Expires in 7 days from now
INSERT INTO
    refresh_tokens (
        token_id,
        user_id,
        token_hash,
        expires_at,
        user_agent,
        ip_address
    )
VALUES (
        '950e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440000',
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        DATE_ADD(NOW(), INTERVAL 7 DAY),
        'Mozilla/5.0 (Test Browser)',
        '127.0.0.1'
    );

-- ============================================================================
-- SCHEDULED EVENTS
-- ============================================================================

-- Enable event scheduler (required for scheduled events to run)
SET GLOBAL event_scheduler = ON;

-- Create scheduled event to clean up expired and revoked refresh tokens
-- Runs daily at 2:00 AM
CREATE EVENT IF NOT EXISTS cleanup_expired_refresh_tokens
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 2 HOUR)
DO
  DELETE FROM refresh_tokens 
  WHERE expires_at < NOW() OR revoked = TRUE;