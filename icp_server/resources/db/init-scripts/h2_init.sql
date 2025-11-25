-- ============================================================================
-- ICP Server H2 Database Schema
-- ============================================================================

-- Drop all database objects (tables, views, sequences, etc.)
DROP ALL OBJECTS;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

CREATE TABLE organizations (
    org_id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    org_name VARCHAR(255) NOT NULL UNIQUE,
    org_handle VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_org_handle ON organizations (org_handle);

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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_username ON users (username);

CREATE INDEX idx_super_admin ON users (is_super_admin);

CREATE INDEX idx_project_author ON users (is_project_author);

-- ============================================================================
-- REFRESH TOKENS (for authentication session management)
-- ============================================================================

CREATE TABLE refresh_tokens (
    token_id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP,
    user_agent VARCHAR(500),
    ip_address VARCHAR(50),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);

CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens (revoked);

-- ============================================================================
-- PROJECTS / COMPONENTS / ENVIRONMENTS
-- ============================================================================

CREATE TABLE projects (
    project_id CHAR(36) PRIMARY KEY,
    org_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50) DEFAULT '1.0.0',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    handler VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    description TEXT,
    default_deployment_pipeline_id CHAR(36),
    deployment_pipeline_ids CLOB,
    type VARCHAR(50),
    git_provider VARCHAR(50),
    git_organization VARCHAR(200),
    repository VARCHAR(200),
    branch VARCHAR(100),
    secret_ref VARCHAR(200),
    owner_id CHAR(36),
    created_by VARCHAR(200),
    updated_by VARCHAR(200),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_projects_org FOREIGN KEY (org_id) REFERENCES organizations (org_id) ON DELETE RESTRICT,
    CONSTRAINT uk_project_name_org UNIQUE (org_id, name)
);

CREATE INDEX idx_projects_owner_id ON projects (owner_id);

CREATE INDEX idx_projects_org_id ON projects (org_id);

CREATE INDEX idx_projects_handler ON projects ( handler );

CREATE TABLE components (
    component_id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    component_type VARCHAR(10) NOT NULL DEFAULT 'BI' CHECK (
        component_type IN ('MI', 'BI')
    ),
    created_by CHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(36),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_components_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    CONSTRAINT fk_components_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_components_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT uk_component_project_name UNIQUE (project_id, name)
);

CREATE INDEX idx_components_project_id ON components (project_id);

CREATE TABLE environments (
    environment_id CHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    region VARCHAR(100),
    cluster_id VARCHAR(200),
    choreo_env VARCHAR(50),
    external_apim_env_name VARCHAR(200),
    internal_apim_env_name VARCHAR(200),
    sandbox_apim_env_name VARCHAR(200),
    critical BOOLEAN NOT NULL DEFAULT FALSE,
    dns_prefix VARCHAR(100),
    created_by CHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(36),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_environments_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_environments_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL
);

-- ============================================================================
-- ROLES & USER ROLES
-- ============================================================================

CREATE TABLE roles (
    role_id CHAR(36) NOT NULL PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    environment_type VARCHAR(20) NOT NULL,
    privilege_level VARCHAR(20) NOT NULL,
    role_name VARCHAR(200) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_roles_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    CONSTRAINT uk_role_project_env_type_priv UNIQUE (
        project_id,
        environment_type,
        privilege_level
    )
);

CREATE INDEX idx_roles_role_name ON roles (role_name);

CREATE INDEX idx_roles_project_id ON roles (project_id);

CREATE INDEX idx_roles_environment_type ON roles (environment_type);

CREATE TABLE user_roles (
    user_id CHAR(36) NOT NULL,
    role_id CHAR(36) NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by CHAR(36),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);

CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);

-- ============================================================================
-- RBAC V2 - GROUP-BASED AUTHORIZATION
-- ============================================================================

-- User Groups table
CREATE TABLE user_groups (
    group_id VARCHAR(36) PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,
    org_uuid INT NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_groups_org FOREIGN KEY (org_uuid) REFERENCES organizations(org_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_groups_org_uuid ON user_groups (org_uuid);
CREATE INDEX idx_user_groups_group_name ON user_groups (group_name);

-- Roles v2 table (new structure for permission-based RBAC)
CREATE TABLE roles_v2 (
    role_id VARCHAR(36) PRIMARY KEY,
    role_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_name UNIQUE (role_name)
);

CREATE INDEX idx_roles_v2_role_name ON roles_v2 (role_name);

-- Permissions table with domain grouping
CREATE TABLE permissions (
    permission_id VARCHAR(36) PRIMARY KEY,
    permission_name VARCHAR(255) NOT NULL UNIQUE,
    permission_domain VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_permission_domain CHECK (permission_domain IN (
        'Integration-Management',
        'Environment-Management',
        'Observability-Management',
        'Project-Management',
        'User-Management'
    ))
);

CREATE INDEX idx_permissions_domain ON permissions (permission_domain);
CREATE INDEX idx_permissions_resource_type ON permissions (resource_type);
CREATE INDEX idx_permissions_name ON permissions (permission_name);

-- Group-User mapping (Many-to-Many)
CREATE TABLE group_user_mapping (
    id IDENTITY PRIMARY KEY,
    group_id VARCHAR(36) NOT NULL,
    user_uuid VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_group_user_group FOREIGN KEY (group_id) REFERENCES user_groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_user_user FOREIGN KEY (user_uuid) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT unique_group_user UNIQUE (group_id, user_uuid)
);

CREATE INDEX idx_group_user_user_uuid ON group_user_mapping (user_uuid);
CREATE INDEX idx_group_user_group_id ON group_user_mapping (group_id);

-- Group-Role mapping with context (Many-to-Many with hierarchical scoping)
CREATE TABLE group_role_mapping (
    id IDENTITY PRIMARY KEY,
    group_id VARCHAR(36) NOT NULL,
    role_id VARCHAR(36) NOT NULL,
    org_uuid INT,
    project_uuid CHAR(36),
    env_uuid CHAR(36),
    integration_uuid CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_grp_role_group FOREIGN KEY (group_id) REFERENCES user_groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_grp_role_role FOREIGN KEY (role_id) REFERENCES roles_v2(role_id) ON DELETE CASCADE,
    CONSTRAINT fk_grp_role_org FOREIGN KEY (org_uuid) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_grp_role_project FOREIGN KEY (project_uuid) REFERENCES projects(project_id) ON DELETE CASCADE,
    CONSTRAINT fk_grp_role_env FOREIGN KEY (env_uuid) REFERENCES environments(environment_id) ON DELETE CASCADE,
    CONSTRAINT fk_grp_role_integration FOREIGN KEY (integration_uuid) REFERENCES components(component_id) ON DELETE CASCADE,
    CONSTRAINT chk_integration_requires_project CHECK (integration_uuid IS NULL OR project_uuid IS NOT NULL),
    CONSTRAINT unique_group_role_context UNIQUE (group_id, role_id, org_uuid, project_uuid, env_uuid, integration_uuid)
);

CREATE INDEX idx_grp_role_group_id ON group_role_mapping (group_id);
CREATE INDEX idx_grp_role_role_id ON group_role_mapping (role_id);
CREATE INDEX idx_grp_role_org_uuid ON group_role_mapping (org_uuid);
CREATE INDEX idx_grp_role_project_uuid ON group_role_mapping (project_uuid);
CREATE INDEX idx_grp_role_env_uuid ON group_role_mapping (env_uuid);
CREATE INDEX idx_grp_role_integration_uuid ON group_role_mapping (integration_uuid);
CREATE INDEX idx_grp_role_group_project ON group_role_mapping (group_id, project_uuid);
CREATE INDEX idx_grp_role_group_env ON group_role_mapping (group_id, env_uuid);

-- Role-Permission mapping (Many-to-Many)
CREATE TABLE role_permission_mapping (
    id IDENTITY PRIMARY KEY,
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_role_perm_role FOREIGN KEY (role_id) REFERENCES roles_v2(role_id) ON DELETE CASCADE,
    CONSTRAINT fk_role_perm_permission FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_perm_role_id ON role_permission_mapping (role_id);
CREATE INDEX idx_role_perm_permission_id ON role_permission_mapping (permission_id);

-- ============================================================================
-- RBAC V2 VIEWS
-- ============================================================================

-- View: User's accessible projects
CREATE VIEW v_user_project_access AS
-- Direct project-level access
SELECT DISTINCT
    gum.user_uuid,
    grm.project_uuid,
    p.name AS project_name,
    p.org_id AS org_uuid,
    grm.role_id,
    'project' AS access_level
FROM group_user_mapping gum
INNER JOIN group_role_mapping grm ON gum.group_id = grm.group_id
INNER JOIN projects p ON grm.project_uuid = p.project_id
WHERE grm.project_uuid IS NOT NULL AND grm.integration_uuid IS NULL

UNION

-- Org-level access (inherits all projects)
SELECT DISTINCT
    gum.user_uuid,
    p.project_id AS project_uuid,
    p.name AS project_name,
    p.org_id AS org_uuid,
    grm.role_id,
    'org' AS access_level
FROM group_user_mapping gum
INNER JOIN group_role_mapping grm ON gum.group_id = grm.group_id
INNER JOIN projects p ON grm.org_uuid = p.org_id
WHERE grm.org_uuid IS NOT NULL 
  AND grm.project_uuid IS NULL 
  AND grm.integration_uuid IS NULL

UNION

-- Integration-level access (project must be visible for navigation)
SELECT DISTINCT
    gum.user_uuid,
    grm.project_uuid,
    p.name AS project_name,
    p.org_id AS org_uuid,
    grm.role_id,
    'integration' AS access_level
FROM group_user_mapping gum
INNER JOIN group_role_mapping grm ON gum.group_id = grm.group_id
INNER JOIN projects p ON grm.project_uuid = p.project_id
WHERE grm.integration_uuid IS NOT NULL;

-- View: User's accessible integrations
CREATE VIEW v_user_integration_access AS
-- Direct integration-level access
SELECT DISTINCT
    gum.user_uuid,
    grm.integration_uuid,
    c.name AS integration_name,
    c.project_id AS project_uuid,
    grm.env_uuid,
    grm.role_id,
    'integration' AS access_level
FROM group_user_mapping gum
INNER JOIN group_role_mapping grm ON gum.group_id = grm.group_id
INNER JOIN components c ON grm.integration_uuid = c.component_id
WHERE grm.integration_uuid IS NOT NULL

UNION

-- Project-level access (inherits all integrations in project)
SELECT DISTINCT
    gum.user_uuid,
    c.component_id AS integration_uuid,
    c.name AS integration_name,
    c.project_id AS project_uuid,
    grm.env_uuid,
    grm.role_id,
    'project' AS access_level
FROM group_user_mapping gum
INNER JOIN group_role_mapping grm ON gum.group_id = grm.group_id
INNER JOIN components c ON grm.project_uuid = c.project_id
WHERE grm.project_uuid IS NOT NULL 
  AND grm.integration_uuid IS NULL

UNION

-- Org-level access (inherits all integrations in all projects)
SELECT DISTINCT
    gum.user_uuid,
    c.component_id AS integration_uuid,
    c.name AS integration_name,
    c.project_id AS project_uuid,
    grm.env_uuid,
    grm.role_id,
    'org' AS access_level
FROM group_user_mapping gum
INNER JOIN group_role_mapping grm ON gum.group_id = grm.group_id
INNER JOIN projects p ON grm.org_uuid = p.org_id
INNER JOIN components c ON p.project_id = c.project_id
WHERE grm.org_uuid IS NOT NULL 
  AND grm.project_uuid IS NULL 
  AND grm.integration_uuid IS NULL;

-- View: User's environment access/restrictions
CREATE VIEW v_user_environment_access AS
SELECT DISTINCT
    gum.user_uuid,
    grm.env_uuid,
    grm.project_uuid,
    grm.integration_uuid,
    grm.role_id,
    CASE 
        WHEN grm.integration_uuid IS NOT NULL THEN 'integration'
        WHEN grm.project_uuid IS NOT NULL THEN 'project'
        ELSE 'org'
    END AS scope_level
FROM group_user_mapping gum
INNER JOIN group_role_mapping grm ON gum.group_id = grm.group_id
WHERE grm.env_uuid IS NOT NULL OR grm.org_uuid IS NOT NULL;

-- ============================================================================
-- RBAC V2 SEED DATA
-- ============================================================================

-- Insert pre-defined roles
INSERT INTO roles_v2 (role_id, role_name, description) VALUES
(RANDOM_UUID(), 'Super Admin', 'Full access to all resources and permissions'),
(RANDOM_UUID(), 'Admin', 'Administrative access to projects and integrations'),
(RANDOM_UUID(), 'Developer', 'Development access with limited permissions');

-- Insert permissions for all domains
INSERT INTO permissions (permission_id, permission_name, permission_domain, resource_type, action, description) VALUES
-- Integration Management
(RANDOM_UUID(), 'integration_mgt:view', 'Integration-Management', 'integration', 'view', 'View integrations'),
(RANDOM_UUID(), 'integration_mgt:edit', 'Integration-Management', 'integration', 'edit', 'Edit integrations'),
(RANDOM_UUID(), 'integration_mgt:manage', 'Integration-Management', 'integration', 'manage', 'Create, edit, and delete integrations'),

-- Environment Management
(RANDOM_UUID(), 'environment_mgt:manage', 'Environment-Management', 'environment', 'manage', 'Create and delete environments'),
(RANDOM_UUID(), 'environment_mgt:manage_nonprod', 'Environment-Management', 'environment', 'manage', 'Create and delete non-production environments'),

-- Project Management
(RANDOM_UUID(), 'project_mgt:view', 'Project-Management', 'project', 'view', 'View projects'),
(RANDOM_UUID(), 'project_mgt:edit', 'Project-Management', 'project', 'edit', 'Edit projects'),
(RANDOM_UUID(), 'project_mgt:manage', 'Project-Management', 'project', 'manage', 'Create, edit, and delete projects'),

-- Observability Management
(RANDOM_UUID(), 'observability_mgt:view_logs', 'Observability-Management', 'logs', 'view', 'View logs'),
(RANDOM_UUID(), 'observability_mgt:view_insights', 'Observability-Management', 'insights', 'view', 'View insights'),

-- User Management
(RANDOM_UUID(), 'user_mgt:manage_users', 'User-Management', 'user', 'manage', 'Create, update, and delete users'),
(RANDOM_UUID(), 'user_mgt:update_users', 'User-Management', 'user', 'update', 'Assign user groups'),
(RANDOM_UUID(), 'user_mgt:manage_groups', 'User-Management', 'group', 'manage', 'Create, update, and delete groups'),
(RANDOM_UUID(), 'user_mgt:manage_roles', 'User-Management', 'role', 'manage', 'Create, update, and delete roles'),
(RANDOM_UUID(), 'user_mgt:update_group_roles', 'User-Management', 'group-role', 'update', 'Map roles to groups');

-- Map Super Admin to ALL permissions
INSERT INTO role_permission_mapping (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Super Admin'),
    permission_id
FROM permissions;

-- Map Admin to all permissions except User Management
INSERT INTO role_permission_mapping (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Admin'),
    permission_id
FROM permissions
WHERE permission_domain != 'User-Management';

-- Map Developer to specific permissions
INSERT INTO role_permission_mapping (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Developer'),
    permission_id
FROM permissions
WHERE permission_name IN (
    'integration_mgt:view',
    'integration_mgt:edit',
    'environment_mgt:manage_nonprod',
    'project_mgt:view',
    'project_mgt:edit',
    'observability_mgt:view_logs',
    'observability_mgt:view_insights'
);

-- ============================================================================
-- RUNTIMES & ARTIFACTS
-- ============================================================================

CREATE TABLE runtimes (
    runtime_id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    project_id CHAR(36) NOT NULL,
    component_id CHAR(36) NOT NULL,
    environment_id CHAR(36) NOT NULL,
    runtime_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE',
    version VARCHAR(50),
    platform_name VARCHAR(50) NOT NULL DEFAULT 'ballerina',
    platform_version VARCHAR(50),
    platform_home VARCHAR(255),
    os_name VARCHAR(50),
    os_version VARCHAR(50),
    carbon_home VARCHAR(500),
    java_vendor VARCHAR(100),
    java_version VARCHAR(50),
    total_memory BIGINT,
    free_memory BIGINT,
    max_memory BIGINT,
    used_memory BIGINT,
    os_arch VARCHAR(50),
    server_name VARCHAR(200),
    registration_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    CONSTRAINT fk_runtime_component FOREIGN KEY (component_id) REFERENCES components (component_id) ON DELETE CASCADE,
    CONSTRAINT fk_runtime_env FOREIGN KEY (environment_id) REFERENCES environments (environment_id) ON DELETE CASCADE
);

CREATE INDEX idx_runtimes_runtime_type ON runtimes (runtime_type);

CREATE INDEX idx_runtimes_status ON runtimes (status);

CREATE INDEX idx_runtimes_env ON runtimes (environment_id);

CREATE INDEX idx_runtimes_component ON runtimes (component_id);

CREATE INDEX idx_runtimes_project ON runtimes (project_id);

CREATE INDEX idx_runtimes_last_heartbeat ON runtimes (last_heartbeat);

CREATE INDEX idx_runtimes_registration_time ON runtimes (registration_time);

-- Services deployed on a runtime
CREATE TABLE runtime_services (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_package VARCHAR(200) NOT NULL,
    base_path VARCHAR(500),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_services_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_service UNIQUE (
        runtime_id,
        service_name,
        service_package
    )
);

CREATE INDEX idx_runtime_services_runtime_id ON runtime_services (runtime_id);

CREATE INDEX idx_runtime_services_service_name ON runtime_services (service_name);

CREATE INDEX idx_runtime_services_service_package ON runtime_services (service_package);

CREATE INDEX idx_runtime_services_state ON runtime_services (state);

-- Resources inside a service (HTTP resources etc.)
CREATE TABLE service_resources (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    resource_url VARCHAR(1000) NOT NULL,
    methods CLOB NOT NULL,
    method_first VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_service_resources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE
);

CREATE INDEX idx_service_resources_runtime_service ON service_resources (runtime_id, service_name);

CREATE INDEX idx_service_resources_resource_url ON service_resources (resource_url);

CREATE INDEX idx_service_resources_method_first ON service_resources (method_first);

-- Listeners bound to a runtime (e.g., HTTP/HTTPS)
CREATE TABLE runtime_listeners (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    listener_name VARCHAR(100) NOT NULL,
    listener_package VARCHAR(200) NOT NULL,
    protocol VARCHAR(20) DEFAULT 'HTTP',
    listener_host VARCHAR(100),
    listener_port INT,
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_listeners_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_listener UNIQUE (
        runtime_id,
        listener_name,
        listener_package,
        listener_host,
        listener_port
    )
);

CREATE INDEX idx_runtime_listeners_runtime_id ON runtime_listeners (runtime_id);

CREATE INDEX idx_runtime_listeners_listener_name ON runtime_listeners (listener_name);

CREATE INDEX idx_runtime_listeners_protocol ON runtime_listeners (protocol);

CREATE INDEX idx_runtime_listeners_state ON runtime_listeners (state);

-- ============================================================================
-- MI-SPECIFIC ARTIFACT TABLES
-- ============================================================================

CREATE TABLE runtime_apis (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    api_name VARCHAR(200) NOT NULL,
    url VARCHAR(500) NOT NULL,
    context VARCHAR(500) NOT NULL,
    version VARCHAR(50),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_apis_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_api UNIQUE (runtime_id, api_name)
);

CREATE INDEX idx_runtime_apis_runtime_id ON runtime_apis (runtime_id);

CREATE INDEX idx_runtime_apis_api_name ON runtime_apis (api_name);

CREATE INDEX idx_runtime_apis_state ON runtime_apis (state);

-- API Resources (MI) - Resources inside an API
CREATE TABLE runtime_api_resources (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    api_name VARCHAR(200) NOT NULL,
    resource_path VARCHAR(1000) NOT NULL,
    methods VARCHAR(20) NOT NULL, -- Single HTTP method as string (e.g., "POST", "GET")
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_api_resources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE
);

CREATE INDEX idx_runtime_api_resources_runtime_api ON runtime_api_resources (runtime_id, api_name);

CREATE INDEX idx_runtime_api_resources_resource_path ON runtime_api_resources (resource_path);

CREATE INDEX idx_runtime_api_resources_methods ON runtime_api_resources (methods);

-- Proxy Services (MI)
CREATE TABLE runtime_proxy_services (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    proxy_name VARCHAR(200) NOT NULL,
    wsdl TEXT,
    transports CLOB,
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_proxy_services_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_proxy_service UNIQUE (runtime_id, proxy_name)
);

CREATE INDEX idx_runtime_proxy_services_runtime_id ON runtime_proxy_services (runtime_id);

CREATE INDEX idx_runtime_proxy_services_proxy_name ON runtime_proxy_services (proxy_name);

CREATE INDEX idx_runtime_proxy_services_state ON runtime_proxy_services (state);

-- Endpoints (MI)
CREATE TABLE runtime_endpoints (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    endpoint_name VARCHAR(200) NOT NULL,
    endpoint_type VARCHAR(100) NOT NULL,
    address VARCHAR(500),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_endpoints_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_endpoint UNIQUE (runtime_id, endpoint_name)
);

CREATE INDEX idx_runtime_endpoints_runtime_id ON runtime_endpoints (runtime_id);

CREATE INDEX idx_runtime_endpoints_endpoint_name ON runtime_endpoints (endpoint_name);

CREATE INDEX idx_runtime_endpoints_endpoint_type ON runtime_endpoints (endpoint_type);

CREATE INDEX idx_runtime_endpoints_state ON runtime_endpoints (state);

-- Inbound Endpoints (MI)
CREATE TABLE runtime_inbound_endpoints (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    inbound_name VARCHAR(200) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    sequence VARCHAR(200),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_inbound_endpoints_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_inbound_endpoint UNIQUE (runtime_id, inbound_name)
);

CREATE INDEX idx_runtime_inbound_endpoints_runtime_id ON runtime_inbound_endpoints (runtime_id);

CREATE INDEX idx_runtime_inbound_endpoints_inbound_name ON runtime_inbound_endpoints (inbound_name);

CREATE INDEX idx_runtime_inbound_endpoints_protocol ON runtime_inbound_endpoints (protocol);

CREATE INDEX idx_runtime_inbound_endpoints_state ON runtime_inbound_endpoints (state);

-- Sequences (MI)
CREATE TABLE runtime_sequences (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    sequence_name VARCHAR(200) NOT NULL,
    sequence_type VARCHAR(100),
    container VARCHAR(200),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_sequences_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_sequence UNIQUE (runtime_id, sequence_name)
);

CREATE INDEX idx_runtime_sequences_runtime_id ON runtime_sequences (runtime_id);

CREATE INDEX idx_runtime_sequences_sequence_name ON runtime_sequences (sequence_name);

CREATE INDEX idx_runtime_sequences_sequence_type ON runtime_sequences (sequence_type);

CREATE INDEX idx_runtime_sequences_state ON runtime_sequences (state);

-- Tasks (MI)
CREATE TABLE runtime_tasks (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_class VARCHAR(500),
    task_group VARCHAR(200),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_tasks_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_task UNIQUE (runtime_id, task_name)
);

CREATE INDEX idx_runtime_tasks_runtime_id ON runtime_tasks (runtime_id);

CREATE INDEX idx_runtime_tasks_task_name ON runtime_tasks (task_name);

CREATE INDEX idx_runtime_tasks_state ON runtime_tasks (state);

-- Templates (MI)
CREATE TABLE runtime_templates (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_templates_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_template UNIQUE (runtime_id, template_name)
);

CREATE INDEX idx_runtime_templates_runtime_id ON runtime_templates (runtime_id);

CREATE INDEX idx_runtime_templates_template_name ON runtime_templates (template_name);

CREATE INDEX idx_runtime_templates_template_type ON runtime_templates (template_type);

CREATE INDEX idx_runtime_templates_state ON runtime_templates (state);

-- Message Stores (MI)
CREATE TABLE runtime_message_stores (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    store_name VARCHAR(200) NOT NULL,
    store_type VARCHAR(100) NOT NULL,
    store_class VARCHAR(500),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_message_stores_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_message_store UNIQUE (runtime_id, store_name)
);

CREATE INDEX idx_runtime_message_stores_runtime_id ON runtime_message_stores (runtime_id);

CREATE INDEX idx_runtime_message_stores_store_name ON runtime_message_stores (store_name);

CREATE INDEX idx_runtime_message_stores_store_type ON runtime_message_stores (store_type);

CREATE INDEX idx_runtime_message_stores_state ON runtime_message_stores (state);

-- Message Processors (MI)
CREATE TABLE runtime_message_processors (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    processor_name VARCHAR(200) NOT NULL,
    processor_type VARCHAR(100) NOT NULL,
    processor_class VARCHAR(500),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_message_processors_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_message_processor UNIQUE (runtime_id, processor_name)
);

CREATE INDEX idx_runtime_message_processors_runtime_id ON runtime_message_processors (runtime_id);

CREATE INDEX idx_runtime_message_processors_processor_name ON runtime_message_processors (processor_name);

CREATE INDEX idx_runtime_message_processors_processor_type ON runtime_message_processors (processor_type);

CREATE INDEX idx_runtime_message_processors_state ON runtime_message_processors (state);

-- Local Entries (MI)
CREATE TABLE runtime_local_entries (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    entry_name VARCHAR(200) NOT NULL,
    entry_type VARCHAR(100) NOT NULL,
    entry_value TEXT,
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_local_entries_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_local_entry UNIQUE (runtime_id, entry_name)
);

CREATE INDEX idx_runtime_local_entries_runtime_id ON runtime_local_entries (runtime_id);

CREATE INDEX idx_runtime_local_entries_entry_name ON runtime_local_entries (entry_name);

CREATE INDEX idx_runtime_local_entries_entry_type ON runtime_local_entries (entry_type);

CREATE INDEX idx_runtime_local_entries_state ON runtime_local_entries (state);

-- Data Services (MI)
CREATE TABLE runtime_data_services (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    service_name VARCHAR(200) NOT NULL,
    description TEXT,
    wsdl TEXT,
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_data_services_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_data_service UNIQUE (runtime_id, service_name)
);

CREATE INDEX idx_runtime_data_services_runtime_id ON runtime_data_services (runtime_id);

CREATE INDEX idx_runtime_data_services_service_name ON runtime_data_services (service_name);

CREATE INDEX idx_runtime_data_services_state ON runtime_data_services (state);

-- Carbon Apps (MI)
CREATE TABLE runtime_carbon_apps (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    app_name VARCHAR(200) NOT NULL,
    version VARCHAR(50),
    state VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (state IN ('Active', 'Faulty')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_carbon_apps_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_carbon_app UNIQUE (runtime_id, app_name)
);

CREATE INDEX idx_runtime_carbon_apps_runtime_id ON runtime_carbon_apps (runtime_id);

CREATE INDEX idx_runtime_carbon_apps_app_name ON runtime_carbon_apps (app_name);

CREATE INDEX idx_runtime_carbon_apps_state ON runtime_carbon_apps (state);

-- Data Sources (MI)
CREATE TABLE runtime_data_sources (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    datasource_name VARCHAR(200) NOT NULL,
    driver VARCHAR(500),
    url VARCHAR(1000),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_data_sources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_data_source UNIQUE (runtime_id, datasource_name)
);

CREATE INDEX idx_runtime_data_sources_runtime_id ON runtime_data_sources (runtime_id);

CREATE INDEX idx_runtime_data_sources_datasource_name ON runtime_data_sources (datasource_name);

CREATE INDEX idx_runtime_data_sources_state ON runtime_data_sources (state);

-- Connectors (MI)
CREATE TABLE runtime_connectors (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    connector_name VARCHAR(200) NOT NULL,
    package VARCHAR(200) NOT NULL,
    version VARCHAR(50),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_connectors_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_connector UNIQUE (
        runtime_id,
        connector_name,
        package
    )
);

CREATE INDEX idx_runtime_connectors_runtime_id ON runtime_connectors (runtime_id);

CREATE INDEX idx_runtime_connectors_connector_name ON runtime_connectors (connector_name);

CREATE INDEX idx_runtime_connectors_state ON runtime_connectors (state);

-- Registry Resources (MI)
CREATE TABLE runtime_registry_resources (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    resource_name VARCHAR(200) NOT NULL,
    path VARCHAR(1000) NOT NULL,
    resource_type VARCHAR(100),
    state VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_runtime_registry_resources_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT uk_runtime_registry_resource UNIQUE (
        runtime_id,
        resource_name,
        path
    )
);

CREATE INDEX idx_runtime_registry_resources_runtime_id ON runtime_registry_resources (runtime_id);

CREATE INDEX idx_runtime_registry_resources_resource_name ON runtime_registry_resources (resource_name);

CREATE INDEX idx_runtime_registry_resources_resource_type ON runtime_registry_resources (resource_type);

CREATE INDEX idx_runtime_registry_resources_state ON runtime_registry_resources (state);

-- ============================================================================
-- CONTROL COMMANDS
-- ============================================================================

CREATE TABLE control_commands (
    command_id CHAR(36) NOT NULL PRIMARY KEY,
    runtime_id CHAR(36) NOT NULL,
    target_artifact VARCHAR(200) NOT NULL,
    action VARCHAR(50) NOT NULL,
    parameters CLOB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    issued_by CHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_control_cmd_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT fk_control_cmd_issued_by FOREIGN KEY (issued_by) REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_control_commands_runtime_id ON control_commands (runtime_id);

CREATE INDEX idx_control_commands_status ON control_commands (status);

CREATE INDEX idx_control_commands_issued_at ON control_commands (issued_at);

CREATE INDEX idx_control_commands_target_artifact ON control_commands (target_artifact);

CREATE INDEX idx_control_commands_action ON control_commands (action);

CREATE INDEX idx_control_commands_issued_by ON control_commands (issued_by);

-- ============================================================================
-- AUDIT & EVENTS
-- ============================================================================

CREATE TABLE audit_logs (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36),
    user_id CHAR(36),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(200),
    details TEXT,
    client_ip VARCHAR(45),
    user_agent VARCHAR(500),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_runtime_id ON audit_logs (runtime_id);

CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);

CREATE INDEX idx_audit_logs_action ON audit_logs (action);

CREATE INDEX idx_audit_logs_resource_type ON audit_logs (resource_type);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp);

CREATE INDEX idx_audit_logs_client_ip ON audit_logs (client_ip);

CREATE TABLE system_events (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    source VARCHAR(100),
    message TEXT NOT NULL,
    metadata CLOB,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by CHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sys_events_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_system_events_event_type ON system_events (event_type);

CREATE INDEX idx_system_events_severity ON system_events (severity);

CREATE INDEX idx_system_events_source ON system_events (source);

CREATE INDEX idx_system_events_resolved ON system_events (resolved);

CREATE INDEX idx_system_events_created_at ON system_events (created_at);

-- ============================================================================
-- MONITORING & HEALTH
-- ============================================================================

CREATE TABLE runtime_metrics (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 4) NOT NULL,
    metric_unit VARCHAR(20),
    tags CLOB,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_metrics_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE
);

CREATE INDEX idx_runtime_metrics_runtime_metric ON runtime_metrics (runtime_id, metric_name);

CREATE INDEX idx_runtime_metrics_timestamp ON runtime_metrics (timestamp);

CREATE INDEX idx_runtime_metrics_metric_name ON runtime_metrics (metric_name);

CREATE TABLE health_checks (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    runtime_id CHAR(36) NOT NULL,
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INT,
    error_message TEXT,
    details CLOB,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_health_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE CASCADE
);

CREATE INDEX idx_health_checks_runtime_check ON health_checks (runtime_id, check_type);

CREATE INDEX idx_health_checks_status ON health_checks (status);

CREATE INDEX idx_health_checks_timestamp ON health_checks (timestamp);

-- ============================================================================
-- SYSTEM CONFIG
-- ============================================================================

CREATE TABLE system_config (
    config_key VARCHAR(100) NOT NULL PRIMARY KEY,
    config_value TEXT NOT NULL,
    config_type VARCHAR(20) NOT NULL DEFAULT 'STRING',
    description TEXT,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by CHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_syscfg_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_system_config_config_type ON system_config (config_type);

CREATE INDEX idx_system_config_updated_at ON system_config (updated_at);

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
        'Sample Project',
        '1.0.0',
        'sample-project',
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
        'Sample Project 2',
        '1.1.0',
        'sample-project-2',
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
        'sample-integration',
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
        DATEADD ('DAY', 7, NOW()),
        'Mozilla/5.0 (Test Browser)',
        '127.0.0.1'
    );