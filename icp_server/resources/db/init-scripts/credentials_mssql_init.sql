-- ============================================================================
-- ICP Server MSSQL Credentials Database Schema
-- This database is separate from the main ICP database and is only accessed
-- by the default authentication backend for user credential management.
-- ============================================================================

-- ============================================================================
-- USER CREDENTIALS TABLE
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_credentials' AND type = 'U')
BEGIN
    CREATE TABLE user_credentials (
        user_id CHAR(36) NOT NULL PRIMARY KEY,
        username NVARCHAR(255) NOT NULL UNIQUE,
        display_name NVARCHAR(200) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        password_salt NVARCHAR(255) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX idx_user_credentials_username ON user_credentials (username);
END;
GO

-- ============================================================================
-- SAMPLE DATA FOR TESTING, MUST BE CHANGED FOR PRODUCTION
-- ============================================================================

-- Insert credentials for admin user (only if not exists)
IF NOT EXISTS (SELECT 1 FROM user_credentials WHERE user_id = '550e8400-e29b-41d4-a716-446655440000')
BEGIN
    INSERT INTO user_credentials (
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
END;
GO
