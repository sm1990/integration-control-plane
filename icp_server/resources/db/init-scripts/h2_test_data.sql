-- ============================================================================
-- TEST DATA FOR RBAC V2 TESTING (H2)
-- ============================================================================
-- This file contains additional test data for testing Phase 6.2.1 Runtime Management endpoints
-- Run this file AFTER h2_init.sql to add test data to your H2 database

-- ============================================================================
-- ADDITIONAL TEST USERS
-- ============================================================================

-- User with org-level Developer permissions (can view all, edit non-prod)
INSERT INTO users (user_id, username, display_name, is_super_admin)
VALUES ('770e8400-e29b-41d4-a716-446655440001', 'orgdev', 'Org Developer', FALSE);

-- User with project-level Admin permissions (full access to specific project only)
INSERT INTO users (user_id, username, display_name, is_super_admin)
VALUES ('770e8400-e29b-41d4-a716-446655440002', 'projectadmin', 'Project Admin', FALSE);

-- User with integration-level view permissions (read-only access to specific integration)
INSERT INTO users (user_id, username, display_name, is_super_admin)
VALUES ('770e8400-e29b-41d4-a716-446655440003', 'integrationviewer', 'Integration Viewer', FALSE);

-- User with dev environment-only access
INSERT INTO users (user_id, username, display_name, is_super_admin)
VALUES ('770e8400-e29b-41d4-a716-446655440004', 'devonly', 'Dev Only User', FALSE);

-- User with read-only viewer role (view permission only, no edit/manage)
INSERT INTO users (user_id, username, display_name, is_super_admin)
VALUES ('770e8400-e29b-41d4-a716-446655440005', 'readonlyviewer', 'Read Only Viewer', FALSE);

-- ============================================================================
-- ADDITIONAL COMPONENTS FOR TESTING
-- ============================================================================

-- Second component in Project 1 for same-project testing
INSERT INTO components (
    component_id,
    name,
    display_name,
    component_type,
    description,
    created_by,
    project_id
)
VALUES (
    '640e8400-e29b-41d4-a716-446655440002',
    'sample-integration-2',
    'Sample Integration 2',
    'BI',
    'Second integration in Project 1 for testing',
    '550e8400-e29b-41d4-a716-446655440000',
    '650e8400-e29b-41d4-a716-446655440001'
);

-- Component in Project 2 for cross-project testing
INSERT INTO components (
    component_id,
    name,
    display_name,
    component_type,
    description,
    created_by,
    project_id
)
VALUES (
    '640e8400-e29b-41d4-a716-446655440003',
    'project2-integration',
    'Project 2 Integration',
    'MI',
    'Integration in Project 2 for cross-project testing',
    '550e8400-e29b-41d4-a716-446655440000',
    '650e8400-e29b-41d4-a716-446655440002'
);

-- ============================================================================
-- RUNTIMES FOR TESTING ENDPOINTS
-- ============================================================================

-- Runtime 1: Project 1, Component 1, Dev env, RUNNING
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    registration_time,
    last_heartbeat
)
VALUES (
    '880e8400-e29b-41d4-a716-446655440001',
    'sample-integration-dev-runtime',
    '650e8400-e29b-41d4-a716-446655440001',
    '640e8400-e29b-41d4-a716-446655440001',
    '750e8400-e29b-41d4-a716-446655440001',
    'BI',
    'RUNNING',
    '1.0.0',
    'ballerina',
    '2201.9.0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Runtime 2: Project 1, Component 1, Prod env, RUNNING
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    registration_time,
    last_heartbeat
)
VALUES (
    '880e8400-e29b-41d4-a716-446655440002',
    'sample-integration-prod-runtime',
    '650e8400-e29b-41d4-a716-446655440001',
    '640e8400-e29b-41d4-a716-446655440001',
    '750e8400-e29b-41d4-a716-446655440002',
    'BI',
    'RUNNING',
    '1.0.0',
    'ballerina',
    '2201.9.0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Runtime 3: Project 1, Component 2, Dev env, OFFLINE
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    registration_time,
    last_heartbeat
)
VALUES (
    '880e8400-e29b-41d4-a716-446655440003',
    'sample-integration-2-dev-runtime',
    '650e8400-e29b-41d4-a716-446655440001',
    '640e8400-e29b-41d4-a716-446655440002',
    '750e8400-e29b-41d4-a716-446655440001',
    'BI',
    'OFFLINE',
    '1.0.0',
    'ballerina',
    '2201.9.0',
    CURRENT_TIMESTAMP,
    DATEADD('HOUR', -1, CURRENT_TIMESTAMP)
);

-- Runtime 4: Project 2, Component 3, Dev env, RUNNING
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    registration_time,
    last_heartbeat
)
VALUES (
    '880e8400-e29b-41d4-a716-446655440004',
    'project2-integration-dev-runtime',
    '650e8400-e29b-41d4-a716-446655440002',
    '640e8400-e29b-41d4-a716-446655440003',
    '750e8400-e29b-41d4-a716-446655440001',
    'MI',
    'RUNNING',
    '1.0.0',
    'micro-integrator',
    '4.3.0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Runtime 5: Project 1, Component 2, Prod env, FAILED (for testing failure scenarios)
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    registration_time,
    last_heartbeat
)
VALUES (
    '880e8400-e29b-41d4-a716-446655440005',
    'sample-integration-2-prod-runtime',
    '650e8400-e29b-41d4-a716-446655440001',
    '640e8400-e29b-41d4-a716-446655440002',
    '750e8400-e29b-41d4-a716-446655440002',
    'BI',
    'FAILED',
    '1.0.0',
    'ballerina',
    '2201.9.0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ============================================================================
-- RBAC V2 USER GROUP ASSIGNMENTS
-- ============================================================================

-- Assign orgdev to Developers group at org level
INSERT INTO group_user_mapping (group_id, user_uuid)
VALUES (
    (SELECT group_id FROM user_groups WHERE group_name = 'Developers'),
    '770e8400-e29b-41d4-a716-446655440001'
);

-- Assign projectadmin to Administrators group
INSERT INTO group_user_mapping (group_id, user_uuid)
VALUES (
    (SELECT group_id FROM user_groups WHERE group_name = 'Administrators'),
    '770e8400-e29b-41d4-a716-446655440002'
);

-- Assign integrationviewer to Developers group (will have restricted access via role mapping)
INSERT INTO group_user_mapping (group_id, user_uuid)
VALUES (
    (SELECT group_id FROM user_groups WHERE group_name = 'Developers'),
    '770e8400-e29b-41d4-a716-446655440003'
);

-- Assign devonly to Developers group
INSERT INTO group_user_mapping (group_id, user_uuid)
VALUES (
    (SELECT group_id FROM user_groups WHERE group_name = 'Developers'),
    '770e8400-e29b-41d4-a716-446655440004'
);

-- Create a separate group for readonlyviewer (to avoid inheriting org-level Developer permissions)
INSERT INTO user_groups (group_id, group_name, org_uuid, description)
VALUES (RANDOM_UUID(), 'Read-Only Viewers', 1, 'Users with view-only access to specific integrations');

-- Assign readonlyviewer to Read-Only Viewers group
INSERT INTO group_user_mapping (group_id, user_uuid)
VALUES (
    (SELECT group_id FROM user_groups WHERE group_name = 'Read-Only Viewers'),
    '770e8400-e29b-41d4-a716-446655440005'
);

-- ============================================================================
-- RBAC V2 GROUP-ROLE MAPPINGS WITH DIFFERENT SCOPES
-- ============================================================================

-- orgdev: Developers group with org-level access (can see everything, edit non-prod)
INSERT INTO group_role_mapping (group_id, role_id, org_uuid)
SELECT 
    gum.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Developer'),
    1
FROM group_user_mapping gum
WHERE gum.user_uuid = '770e8400-e29b-41d4-a716-446655440001'
FETCH FIRST 1 ROWS ONLY;

-- projectadmin: Administrators group with project-level access (full access to Project 1 only)
INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid)
SELECT 
    gum.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Admin'),
    1,
    '650e8400-e29b-41d4-a716-446655440001'
FROM group_user_mapping gum
WHERE gum.user_uuid = '770e8400-e29b-41d4-a716-446655440002'
FETCH FIRST 1 ROWS ONLY;

-- integrationviewer: Developer role with integration-level access (view-only Component 1 in Project 1)
INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid, integration_uuid)
SELECT 
    gum.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Developer'),
    1,
    '650e8400-e29b-41d4-a716-446655440001',
    '640e8400-e29b-41d4-a716-446655440001'
FROM group_user_mapping gum
WHERE gum.user_uuid = '770e8400-e29b-41d4-a716-446655440003'
FETCH FIRST 1 ROWS ONLY;

-- devonly: Developer role restricted to dev environment only
INSERT INTO group_role_mapping (group_id, role_id, org_uuid, env_uuid)
SELECT 
    gum.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Developer'),
    1,
    '750e8400-e29b-41d4-a716-446655440001'
FROM group_user_mapping gum
WHERE gum.user_uuid = '770e8400-e29b-41d4-a716-446655440004'
FETCH FIRST 1 ROWS ONLY;

-- readonlyviewer: Viewer role with integration-level access (view-only Component 1 in Project 1)
INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid, integration_uuid)
SELECT 
    gum.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Viewer'),
    1,
    '650e8400-e29b-41d4-a716-446655440001',
    '640e8400-e29b-41d4-a716-446655440001'
FROM group_user_mapping gum
WHERE gum.user_uuid = '770e8400-e29b-41d4-a716-446655440005'
FETCH FIRST 1 ROWS ONLY;


-- ============================================================================
-- TEST DATA SUMMARY
-- ============================================================================
-- Users created:
--   - admin (550e8400-e29b-41d4-a716-446655440000): Super Admin - full access
--   - orgdev (770e8400-e29b-41d4-a716-446655440001): Org-level Developer - view all, edit non-prod
--   - projectadmin (770e8400-e29b-41d4-a716-446655440002): Project 1 Admin - full access to Project 1
--   - integrationviewer (770e8400-e29b-41d4-a716-446655440003): Component 1 viewer - read-only Component 1
--   - devonly (770e8400-e29b-41d4-a716-446655440004): Dev env only - access only dev environment
--   - readonlyviewer (770e8400-e29b-41d4-a716-446655440005): Read-only viewer - view-only Component 1
--
-- Projects:
--   - Sample Project (650e8400-e29b-41d4-a716-446655440001)
--   - Sample Project 2 (650e8400-e29b-41d4-a716-446655440002)
--
-- Components:
--   - sample-integration (640e8400-e29b-41d4-a716-446655440001) in Project 1
--   - sample-integration-2 (640e8400-e29b-41d4-a716-446655440002) in Project 1
--   - project2-integration (640e8400-e29b-41d4-a716-446655440003) in Project 2
--
-- Environments:
--   - dev (750e8400-e29b-41d4-a716-446655440001)
--   - prod (750e8400-e29b-41d4-a716-446655440002)
--
-- Runtimes:
--   - Runtime 1: Project 1 / Component 1 / Dev / RUNNING
--   - Runtime 2: Project 1 / Component 1 / Prod / RUNNING
--   - Runtime 3: Project 1 / Component 2 / Dev / OFFLINE
--   - Runtime 4: Project 2 / Component 3 / Dev / RUNNING
--   - Runtime 5: Project 1 / Component 2 / Prod / FAILED
