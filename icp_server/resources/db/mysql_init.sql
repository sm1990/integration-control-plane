-- ============================================================================
-- ICP Server MySQL Database Schema
-- Integration Control Plane Database Schema for Runtime Management
-- ============================================================================

DROP Database icp_database;

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS icp_database 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE icp_database;

-- ============================================================================
-- CORE RUNTIME MANAGEMENT TABLES
-- ============================================================================

-- Main runtimes table - stores core runtime information
CREATE TABLE IF NOT EXISTS runtimes (
    runtime_id VARCHAR(100) NOT NULL PRIMARY KEY,
    runtime_type ENUM('MI', 'BI') NOT NULL,
    status ENUM('RUNNING', 'FAILED', 'DISABLED', 'OFFLINE') NOT NULL DEFAULT 'OFFLINE',
    environment VARCHAR(50) NULL,
    deployment_type VARCHAR(50) NULL,
    version VARCHAR(20) NULL,
    
    -- Node information
    platform_name VARCHAR(50) NOT NULL DEFAULT 'ballerina',
    platform_version VARCHAR(50) NULL,
    platform_home VARCHAR(255) NULL,
    os_name VARCHAR(50) NULL,
    os_version VARCHAR(50) NULL,
    
    -- Timestamps
    registration_time TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_heartbeat TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_runtime_type (runtime_type),
    INDEX idx_status (status),
    INDEX idx_environment (environment),
    INDEX idx_last_heartbeat (last_heartbeat),
    INDEX idx_registration_time (registration_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ARTIFACT MANAGEMENT TABLES
-- ============================================================================

-- Runtime services table - stores service artifacts
CREATE TABLE IF NOT EXISTS runtime_services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_package VARCHAR(200) NOT NULL,
    base_path VARCHAR(500) NULL,
    state ENUM('ENABLED', 'DISABLED', 'STARTING', 'STOPPING', 'FAILED') NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate services per runtime
    UNIQUE KEY uk_runtime_service (runtime_id, service_name, service_package),
    
    -- Indexes
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_service_name (service_name),
    INDEX idx_service_package (service_package),
    INDEX idx_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service resources table - stores detailed resource information
CREATE TABLE IF NOT EXISTS service_resources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    resource_url VARCHAR(1000) NOT NULL,
    methods JSON NOT NULL, -- Stores array of HTTP methods
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_runtime_service (runtime_id, service_name),
    INDEX idx_resource_url (resource_url(255)),
    
    -- JSON index for methods array
    INDEX idx_methods ((CAST(methods AS CHAR(100) ARRAY)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Runtime listeners table - stores listener artifacts
CREATE TABLE IF NOT EXISTS runtime_listeners (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id VARCHAR(100) NOT NULL,
    listener_name VARCHAR(100) NOT NULL,
    listener_package VARCHAR(200) NOT NULL,
    protocol VARCHAR(20) NULL DEFAULT 'HTTP',
    state ENUM('ENABLED', 'DISABLED', 'STARTING', 'STOPPING', 'FAILED') NULL DEFAULT 'ENABLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE KEY uk_runtime_listener (runtime_id, listener_name, listener_package),
    
    -- Indexes
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_listener_name (listener_name),
    INDEX idx_protocol (protocol),
    INDEX idx_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CONTROL COMMAND MANAGEMENT
-- ============================================================================

-- Control commands table - manages runtime control operations
CREATE TABLE IF NOT EXISTS control_commands (
    command_id VARCHAR(36) NOT NULL PRIMARY KEY, -- UUID
    runtime_id VARCHAR(100) NOT NULL,
    target_artifact VARCHAR(200) NOT NULL,
    action VARCHAR(50) NOT NULL, -- start, stop, restart, deploy, undeploy
    parameters JSON NULL, -- Additional command parameters
    status ENUM('pending', 'sent', 'acknowledged', 'completed', 'failed', 'timeout') NOT NULL DEFAULT 'pending',
    issued_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    sent_at TIMESTAMP(6) NULL,
    acknowledged_at TIMESTAMP(6) NULL,
    completed_at TIMESTAMP(6) NULL,
    error_message TEXT NULL,
    issued_by VARCHAR(100) NULL, -- User who issued the command
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_status (status),
    INDEX idx_issued_at (issued_at),
    INDEX idx_target_artifact (target_artifact),
    INDEX idx_action (action),
    INDEX idx_issued_by (issued_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- AUDIT AND LOGGING TABLES
-- ============================================================================

-- Audit logs table - comprehensive audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id VARCHAR(100) NULL,
    user_id VARCHAR(100) NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NULL, -- runtime, service, listener, command
    resource_id VARCHAR(200) NULL,
    details TEXT NULL,
    client_ip VARCHAR(45) NULL, -- IPv6 compatible
    user_agent VARCHAR(500) NULL,
    timestamp TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint (optional, allows NULL for system actions)
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_runtime_id (runtime_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource_type (resource_type),
    INDEX idx_timestamp (timestamp),
    INDEX idx_client_ip (client_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System events table - for system-level events and monitoring
CREATE TABLE IF NOT EXISTS system_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- heartbeat_timeout, runtime_offline, system_error
    severity ENUM('INFO', 'WARN', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    source VARCHAR(100) NULL, -- runtime_id or system component
    message TEXT NOT NULL,
    metadata JSON NULL, -- Additional event data
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity),
    INDEX idx_source (source),
    INDEX idx_resolved (resolved),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- USER MANAGEMENT AND AUTHENTICATION
-- ============================================================================

-- Users table - for authentication and authorization
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(100) NOT NULL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    full_name VARCHAR(200) NULL,
    status ENUM('ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING') NOT NULL DEFAULT 'PENDING',
    last_login TIMESTAMP NULL,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_last_login (last_login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles table - role definitions
CREATE TABLE IF NOT EXISTS roles (
    role_id VARCHAR(50) NOT NULL PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    permissions JSON NOT NULL, -- Array of permission strings
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User roles mapping table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id VARCHAR(100) NOT NULL,
    role_id VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(100) NULL,
    
    PRIMARY KEY (user_id, role_id),
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id),
    INDEX idx_assigned_at (assigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MONITORING AND METRICS TABLES
-- ============================================================================

-- Runtime metrics table - stores performance and health metrics
CREATE TABLE IF NOT EXISTS runtime_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20) NULL,
    tags JSON NULL, -- Additional metric tags/labels
    timestamp TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    -- Foreign key constraint
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_runtime_metric (runtime_id, metric_name),
    INDEX idx_timestamp (timestamp),
    INDEX idx_metric_name (metric_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Health checks table - stores health check results
CREATE TABLE IF NOT EXISTS health_checks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runtime_id VARCHAR(100) NOT NULL,
    check_type VARCHAR(50) NOT NULL, -- heartbeat, connectivity, resource
    status ENUM('HEALTHY', 'DEGRADED', 'UNHEALTHY') NOT NULL,
    response_time_ms INT NULL,
    error_message TEXT NULL,
    details JSON NULL,
    timestamp TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    -- Foreign key constraint
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_runtime_check (runtime_id, check_type),
    INDEX idx_status (status),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CONFIGURATION AND SETTINGS
-- ============================================================================

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    config_key VARCHAR(100) NOT NULL PRIMARY KEY,
    config_value TEXT NOT NULL,
    config_type ENUM('STRING', 'INTEGER', 'BOOLEAN', 'JSON') NOT NULL DEFAULT 'STRING',
    description TEXT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_config_type (config_type),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Runtime summary view
CREATE OR REPLACE VIEW runtime_summary AS
SELECT 
    r.runtime_id,
    r.runtime_type,
    r.status,
    r.environment,
    r.version,
    r.last_heartbeat,
    COUNT(DISTINCT rs.id) as total_services,
    COUNT(DISTINCT rl.id) as total_listeners,
    CASE 
        WHEN r.last_heartbeat > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN TRUE 
        ELSE FALSE 
    END as is_online,
    r.registration_time,
    r.created_at,
    r.updated_at
FROM runtimes r
LEFT JOIN runtime_services rs ON r.runtime_id = rs.runtime_id
LEFT JOIN runtime_listeners rl ON r.runtime_id = rl.runtime_id
GROUP BY r.runtime_id;

-- Active commands view
CREATE OR REPLACE VIEW active_commands AS
SELECT 
    cc.*,
    r.runtime_type,
    r.status as runtime_status,
    TIMESTAMPDIFF(SECOND, cc.issued_at, NOW()) as age_seconds
FROM control_commands cc
JOIN runtimes r ON cc.runtime_id = r.runtime_id
WHERE cc.status IN ('pending', 'sent')
ORDER BY cc.issued_at ASC;
