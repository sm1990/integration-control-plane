-- Main tables
CREATE TABLE IF NOT EXISTS runtimes (
    runtime_id VARCHAR(255) PRIMARY KEY,
    runtime_type VARCHAR(10) NOT NULL,
    status VARCHAR(10) NOT NULL,
    environment VARCHAR(50),
    deployment_type VARCHAR(50),
    version VARCHAR(50),
    platform_name NVARCHAR(50),
    platform_version NVARCHAR(50),
    platform_home NVARCHAR(255),
    os_name NVARCHAR(50),
    os_version NVARCHAR(50),
    registration_time DATETIME(6) NOT NULL,
    last_heartbeat DATETIME(6) NOT NULL,
    INDEX idx_runtime_status (status),
    INDEX idx_runtime_env (environment)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS control_commands (
    command_id VARCHAR(255) PRIMARY KEY,
    runtime_id VARCHAR(255) NOT NULL,
    target_artifact VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    issued_at DATETIME(6) NOT NULL,
    status VARCHAR(20) NOT NULL,
    FOREIGN KEY (runtime_id) REFERENCES runtimes(runtime_id),
    INDEX idx_cmd_status (status),
    INDEX idx_cmd_runtime (runtime_id)
) ENGINE=InnoDB;

-- Optimized for MySQL JSON operations
ALTER TABLE runtimes ADD COLUMN (
    total_services INT GENERATED ALWAYS AS (JSON_EXTRACT(artifacts, '$.services.length()')) STORED,
    total_listeners INT GENERATED ALWAYS AS (JSON_EXTRACT(artifacts, '$.listeners.length()')) STORED
);

-- Views for summary data
CREATE VIEW runtime_summary_view AS
SELECT 
    runtime_id,
    runtime_type,
    status,
    environment,
    total_services,
    total_listeners,
    last_heartbeat,
    CASE 
        WHEN TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) < 60 THEN 1
        ELSE 0
    END AS is_online
FROM runtimes;