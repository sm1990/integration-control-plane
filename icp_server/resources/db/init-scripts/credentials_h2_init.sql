-- ============================================================================
-- ICP Server H2 Credentials Database Schema
-- This database is separate from the main ICP database and is only accessed
-- by the default authentication backend for user credential management.
-- ============================================================================

-- Drop all database objects (tables, views, sequences, etc.)
DROP ALL OBJECTS;

-- ============================================================================
-- USER CREDENTIALS TABLE
-- ============================================================================

CREATE TABLE user_credentials (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_credentials_username ON user_credentials (username);

-- ============================================================================
-- USER ATTRIBUTES (EAV key-value store per user)
-- Inspired by UM_USER_ATTRIBUTE from WSO2 MI user store schema.
-- ============================================================================

CREATE TABLE user_attributes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    attr_name VARCHAR(255) NOT NULL,
    attr_value VARCHAR(1024),
    profile_id VARCHAR(255) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_attributes_user FOREIGN KEY (user_id)
        REFERENCES user_credentials (user_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_attr_profile UNIQUE (user_id, attr_name, profile_id)
);

CREATE INDEX idx_ua_user_id ON user_attributes(user_id);
CREATE INDEX idx_ua_attr_name ON user_attributes(attr_name);
CREATE INDEX idx_ua_user_attr ON user_attributes(user_id, attr_name);

-- ============================================================================
-- SAMPLE DATA FOR TESTING, MUST BE CHANGED FOR PRODUCTION
-- ============================================================================

-- Insert credentials for admin user
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
    );
