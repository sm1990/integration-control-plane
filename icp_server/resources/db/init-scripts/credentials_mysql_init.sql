-- ============================================================================
-- ICP Server MySQL Credentials Database Schema
-- This database is separate from the main ICP database and is only accessed
-- by the default authentication backend for user credential management.
-- ============================================================================

-- ============================================================================
-- USER CREDENTIALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_credentials (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_credentials_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- USER ATTRIBUTES (EAV key-value store per user)
-- Inspired by UM_USER_ATTRIBUTE from WSO2 MI user store schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_attributes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    attr_name VARCHAR(255) NOT NULL,
    attr_value VARCHAR(1024),
    profile_id VARCHAR(255) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_user_attributes_user FOREIGN KEY (user_id)
        REFERENCES user_credentials (user_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_attr_profile UNIQUE (user_id, attr_name, profile_id),
    INDEX idx_ua_user_id (user_id),
    INDEX idx_ua_attr_name (attr_name),
    INDEX idx_ua_user_attr (user_id, attr_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- SAMPLE DATA FOR TESTING, MUST BE CHANGED FOR PRODUCTION
-- ============================================================================

-- Insert credentials for admin user (only if not exists)
INSERT IGNORE INTO user_credentials (
    user_id,
    username,
    display_name,
    password_hash
)
VALUES 
    (
        '550e8400-e29b-41d4-a716-446655440000',
        'admin',
        'System Administrator',
        '$2a$12$ZbcSg6botbwvmQV3/wBAfEozQoOn+5V7F8s/5evMUNb7L6FgCmFaEQ=='
    );
