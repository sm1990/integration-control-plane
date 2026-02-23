-- ============================================================================
-- ICP Server PostgreSQL Credentials Database Schema
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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_credentials_username ON user_credentials (username);

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
