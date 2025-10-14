-- ============================================================================
-- ICP Server MySQL Database Schema (Full Rewrite, MySQL 8.0+)
-- ============================================================================

DROP DATABASE IF EXISTS icp_database;

CREATE DATABASE icp_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE icp_database;

-- ============================================================================
-- USER MANAGEMENT & AUTHZ
-- ============================================================================

CREATE TABLE users (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE user_credentials (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- PROJECTS / COMPONENTS / ENVIRONMENTS
-- ============================================================================

CREATE TABLE projects (
    project_id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_by CHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(36) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_projects_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL,
    UNIQUE KEY uk_project_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Components belong to projects; users create components.
CREATE TABLE components (
    component_id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
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
    description TEXT,
    is_production BOOLEAN NOT NULL DEFAULT FALSE, -- Flag to mark environment as production
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
    environment_id CHAR(36) NOT NULL,
    privilege_level ENUM('admin', 'developer') NOT NULL,
    role_name VARCHAR(200) NOT NULL UNIQUE, -- Format: <project_name>:<env_name>:<privilege_level>
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_roles_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    CONSTRAINT fk_roles_environment FOREIGN KEY (environment_id) REFERENCES environments (environment_id) ON DELETE CASCADE,
    UNIQUE KEY uk_role_project_env_priv (
        project_id,
        environment_id,
        privilege_level
    ),
    INDEX idx_role_name (role_name),
    INDEX idx_project_id (project_id)
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
  runtime_id         CHAR(36) NOT NULL PRIMARY KEY,
  project_id         CHAR(36) NOT NULL,
  component_id       CHAR(36) NOT NULL,
  environment_id     CHAR(36) NOT NULL,
  runtime_name       VARCHAR(100) NULL,

  runtime_type       ENUM('MI','BI') NOT NULL,
  status             ENUM('RUNNING','FAILED','DISABLED','OFFLINE') NOT NULL DEFAULT 'OFFLINE',
  version            VARCHAR(50) NULL,

-- Node information
platform_name VARCHAR(50) NOT NULL DEFAULT 'ballerina',
platform_version VARCHAR(50) NULL,
platform_home VARCHAR(255) NULL,
os_name VARCHAR(50) NULL,
os_version VARCHAR(50) NULL,

-- Timestamps


registration_time  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_heartbeat     TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_runtime_project    FOREIGN KEY (project_id)   REFERENCES projects(project_id)   ON DELETE CASCADE,
  CONSTRAINT fk_runtime_component  FOREIGN KEY (component_id) REFERENCES components(component_id) ON DELETE CASCADE,
  CONSTRAINT fk_runtime_env        FOREIGN KEY (environment_id) REFERENCES environments(environment_id) ON DELETE CASCADE,

  INDEX idx_runtime_type (runtime_type),
  INDEX idx_status (status),
  INDEX idx_env (environment_id),
  INDEX idx_component (component_id),
  INDEX idx_project (project_id),
  INDEX idx_last_heartbeat (last_heartbeat),
  INDEX idx_registration_time (registration_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
        listener_package
    ),
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_listener_name (listener_name),
    INDEX idx_protocol (protocol),
    INDEX idx_state (state)
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
    CONSTRAINT fk_audit_runtime FOREIGN KEY (runtime_id) REFERENCES runtimes (runtime_id) ON DELETE SET NULL,
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

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Runtime summary view (is_online = heartbeat within last 5 minutes)
CREATE OR REPLACE VIEW runtime_summary AS
SELECT
    r.runtime_id,
    r.runtime_type,
    r.status,
    e.name AS environment,
    r.version,
    r.last_heartbeat,
    rs_cnt.total_services,
    rl_cnt.total_listeners,
    (
        r.last_heartbeat > (NOW(6) - INTERVAL 5 MINUTE)
    ) AS is_online,
    r.registration_time,
    r.created_at,
    r.updated_at,
    c.name AS component_name,
    p.name AS project_name
FROM
    runtimes r
    JOIN environments e ON r.environment_id = e.environment_id
    JOIN components c ON r.component_id = c.component_id
    JOIN projects p ON r.project_id = p.project_id
    LEFT JOIN (
        SELECT runtime_id, COUNT(*) AS total_services
        FROM runtime_services
        GROUP BY
            runtime_id
    ) rs_cnt ON rs_cnt.runtime_id = r.runtime_id
    LEFT JOIN (
        SELECT runtime_id, COUNT(*) AS total_listeners
        FROM runtime_listeners
        GROUP BY
            runtime_id
    ) rl_cnt ON rl_cnt.runtime_id = r.runtime_id;

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

-- Insert a default admin user for testing
INSERT INTO
    users (
        user_id,
        username,
        display_name
    )
VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        'admin',
        'System Administrator'
    );

-- Insert credentials for admin user
-- Password: admin (Bcrypt hashed - Ballerina format)
INSERT INTO
    user_credentials (
        user_id,
        username,
        display_name,
        password_hash
    )
VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        'admin',
        'System Administrator',
        '$2a$12$ZbcSg6botbwvmQV3/wBAfEozQoOn+5V7F8s/5evMUNb7L6FgCmFaEQ=='
    ),
    (
        '660e8400-e29b-41d4-a716-446655440001',
        'newuser',
        'New Test User',
        '$2a$12$qJcaAGnurmpgmAPywgMocpUJQCDt3aPTknPZeItz3vEyca46bbg4Kw=='
    );

-- Insert sample project
INSERT INTO
    projects (
        project_id,
        name,
        description,
        created_by
    )
VALUES (
        '650e8400-e29b-41d4-a716-446655440001',
        'sample_project',
        'Sample project for testing',
        '550e8400-e29b-41d4-a716-446655440000'
    );

INSERT INTO
    components (
        component_id,
        name,
        description,
        created_by,
        project_id
    )
VALUES (
        '640e8400-e29b-41d4-a716-446655440001',
        'sample_component',
        'Sample component for testing',
        '550e8400-e29b-41d4-a716-446655440000',
        '650e8400-e29b-41d4-a716-446655440001'
    );

-- Insert sample environments
INSERT INTO
    environments (
        environment_id,
        name,
        description,
        is_production,
        created_by
    )
VALUES (
        '750e8400-e29b-41d4-a716-446655440001',
        'dev',
        'Development environment',
        FALSE,
        '550e8400-e29b-41d4-a716-446655440000'
    ),
    (
        '750e8400-e29b-41d4-a716-446655440002',
        'prod',
        'Production environment',
        TRUE,
        '550e8400-e29b-41d4-a716-446655440000'
    );

-- Insert sample roles with format: <project_name>:<env_name>:<privilege_level>
INSERT INTO
    roles (
        role_id,
        project_id,
        environment_id,
        privilege_level,
        role_name
    )
VALUES (
        '850e8400-e29b-41d4-a716-446655440001',
        '650e8400-e29b-41d4-a716-446655440001',
        '750e8400-e29b-41d4-a716-446655440001',
        'admin',
        'sample_project:dev:admin'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440002',
        '650e8400-e29b-41d4-a716-446655440001',
        '750e8400-e29b-41d4-a716-446655440001',
        'developer',
        'sample_project:dev:developer'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440003',
        '650e8400-e29b-41d4-a716-446655440001',
        '750e8400-e29b-41d4-a716-446655440002',
        'admin',
        'sample_project:prod:admin'
    ),
    (
        '850e8400-e29b-41d4-a716-446655440004',
        '650e8400-e29b-41d4-a716-446655440001',
        '750e8400-e29b-41d4-a716-446655440002',
        'developer',
        'sample_project:prod:developer'
    );

-- Assign admin role to the admin user for sample_project:prod
INSERT INTO
    user_roles (user_id, role_id, assigned_by)
VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        '850e8400-e29b-41d4-a716-446655440003',
        '550e8400-e29b-41d4-a716-446655440000'
    );